import { useState, useRef, useEffect, useCallback } from 'react';
import { API_BASE } from '../../lib/apiBase';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTokenGating } from '../../hooks/useTokenGating';
import { Send, Search, Sparkles, Trash2, Zap, BarChart2, FlaskConical } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentMode = 'cipher' | 'alpha';

interface ChatMessage {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: Date;
  type:      'realtime' | 'search' | 'error';
  sources?:  string[];
  streaming?: boolean;
  intent?:   string;
  subAgent?: string;
  modelName?: string;
  agent?:    AgentMode;
}

// ─── Agent config ─────────────────────────────────────────────────────────────

const AGENT_CONFIG = {
  cipher: {
    name:        'Cipher',
    tagline:     'Technical Analyst',
    emoji:       '🔬',
    description: 'Methodical, data-rich, risk-focused. Every trade comes with Sharpe ratio, max drawdown, and invalidation levels.',
    color:       'rgba(6,182,212,',        // cyan
    border:      'rgba(6,182,212,0.4)',
    text:        '#67e8f9',
    bg:          'rgba(6,182,212,0.08)',
    msgBg:       'rgba(6,182,212,0.12)',
    msgBorder:   'rgba(6,182,212,0.25)',
    badge:       'rgba(6,182,212,0.2)',
    icon:        <BarChart2 />,
    prompts: [
      "Show me BTC liquidation clusters between current price ±10%",
      "Which whale wallets accumulated ETH in the last 4 hours?",
      "Backtest a long-scalp on SOL with 5x leverage over 30 days",
      "Show funding rates and what they signal right now",
    ],
  },
  alpha: {
    name:        'Alpha',
    tagline:     'Aggressive Alpha',
    emoji:       '⚡',
    description: 'Action-first, P&L obsessed. Identifies highest-conviction setups with definitive direction and time horizon.',
    color:       'rgba(251,146,60,',       // orange
    border:      'rgba(251,146,60,0.4)',
    text:        '#fed7aa',
    bg:          'rgba(251,146,60,0.08)',
    msgBg:       'rgba(251,146,60,0.12)',
    msgBorder:   'rgba(251,146,60,0.3)',
    badge:       'rgba(251,146,60,0.2)',
    icon:        <Zap />,
    prompts: [
      "What's the highest conviction trade right now?",
      "ETH long or short — give me definitive direction and entry",
      "Search latest BTC news — any catalysts or risk events?",
      "Alert setup: SOL breaks $150 with volume confirmation",
    ],
  },
} as const;

type AgentConfig = typeof AGENT_CONFIG[AgentMode];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSearchQuery(query: string): boolean {
  return ['search', 'find', 'research', 'news', 'recent', 'latest', 'what happened',
    'why did', 'what caused', 'investigate', 'tell me about'].some(kw => query.toLowerCase().includes(kw));
}

function extractAssets(query: string): string[] {
  const map: Record<string, string> = {
    bitcoin: 'BTC', btc: 'BTC', ethereum: 'ETH', eth: 'ETH',
    solana: 'SOL', sol: 'SOL', bnb: 'BNB', xrp: 'XRP', ripple: 'XRP',
    doge: 'DOGE', dogecoin: 'DOGE',
  };
  const q = query.toLowerCase();
  const found = new Set(Object.entries(map).filter(([k]) => q.includes(k)).map(([, v]) => v));
  return found.size > 0 ? [...found] : ['BTC', 'ETH', 'SOL'];
}

// Parse /mode command — returns new agent if found, null otherwise
function parseModeCommand(input: string): AgentMode | null {
  const match = input.trim().toLowerCase().match(/^\/mode\s+(cipher|alpha)$/);
  return match ? (match[1] as AgentMode) : null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

const CLIENT_TIMEOUT_MS = 42_000  // 42s — slightly longer than server's 30s deadline

async function streamChat(
  walletAddress: string,
  message:       string,
  agent:         AgentMode,
  onChunk:       (text: string) => void,
  onMeta:        (intent: string, subAgent: string, model: string) => void,
  onError:       (msg: string) => void,
  onDone:        () => void,
): Promise<void> {
  const abort = new AbortController();

  // Client-side hard deadline — prevents the UI hanging indefinitely if the
  // server's own abort fires but the SSE stream doesn't cleanly close
  const deadline = setTimeout(() => {
    abort.abort();
    onError('Request timed out — Ollama may be busy or offline. Try again.');
  }, CLIENT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  abort.signal,
      body: JSON.stringify({ walletAddress, message, agent }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
      onError(err.error ?? `Server error ${res.status}`);
      return;
    }

    if (!res.body) { onError('No response body'); return; }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const chunk = JSON.parse(payload) as {
            ack?:     boolean;
            content?: string;
            done?:    boolean;
            error?:   string;
            meta?:    { intent: string; subAgent: string; model: string; agent: string };
          };

          // Combined ack+meta frame — routing is complete, model call in-flight
          if (chunk.ack && chunk.meta) {
            clearTimeout(deadline);  // server is alive and routing succeeded
            onMeta(chunk.meta.intent, chunk.meta.subAgent, chunk.meta.model);
            continue;
          }
          // Legacy-compat: bare meta frame
          if (chunk.meta) {
            onMeta(chunk.meta.intent, chunk.meta.subAgent, chunk.meta.model);
            continue;
          }
          if (chunk.error)   { onError(chunk.error); return; }
          if (chunk.content)   onChunk(chunk.content);
          if (chunk.done)    { onDone(); return; }
        } catch { /* skip malformed */ }
      }
    }
    onDone();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return; // timeout handler already called onError
    onError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(deadline);
  }
}

async function callSearch(
  query:  string,
  assets: string[],
  agent:  AgentMode,
): Promise<{ content: string; sources: string[] }> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, assets, agent }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<{ content: string; sources: string[] }>;
}

async function clearServerSession(walletAddress: string): Promise<void> {
  await fetch(`${API_BASE}/api/chat/session`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhaleChat() {
  const { connected, publicKey } = useWallet();
  const { whaleTierUnlocked, balance } = useTokenGating();

  const [agent,    setAgent]    = useState<AgentMode | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  const walletAddress = publicKey?.toBase58() ?? '';
  const cfg           = agent ? AGENT_CONFIG[agent] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for "Ask Whale Chat" CTA from Strategy tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      if (detail?.message && agent) handleSend(detail.message);
    };
    window.addEventListener('whale-chat-prefill', handler);
    return () => window.removeEventListener('whale-chat-prefill', handler);
  }, [agent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Select agent ───────────────────────────────────────────────────────────

  const selectAgent = (mode: AgentMode) => {
    setAgent(mode);
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ─── Send message ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async (queryOverride?: string) => {
    if (!agent) return;
    const raw   = queryOverride ?? input;
    const query = raw.trim();
    if (!query || loading || !walletAddress) return;

    // Handle /mode switch
    const modeCmd = parseModeCommand(query);
    if (modeCmd) {
      setInput('');
      selectAgent(modeCmd);
      return;
    }

    setInput('');
    setLoading(true);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`, role: 'user', content: query,
      timestamp: new Date(), type: 'realtime', agent,
    };
    setMessages(prev => [...prev, userMsg]);

    const search = isSearchQuery(query);

    if (search) {
      const assistantId = `a_${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantId, role: 'assistant', content: '',
        timestamp: new Date(), type: 'search', streaming: true, agent,
      }]);

      try {
        const assets = extractAssets(query);
        const result = await callSearch(query, assets, agent);
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: result.content, sources: result.sources, streaming: false }
            : m
        ));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Search failed';
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: errMsg, type: 'error', streaming: false }
            : m
        ));
      }
      setLoading(false);

    } else {
      const assistantId = `a_${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantId, role: 'assistant', content: '',
        timestamp: new Date(), type: 'realtime', streaming: true, agent,
      }]);

      await streamChat(
        walletAddress, query, agent,
        (chunk) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          ));
        },
        (intent, subAgent, modelName) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, intent, subAgent, modelName } : m
          ));
        },
        (errMsg) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: errMsg, type: 'error', streaming: false } : m
          ));
          setLoading(false);
        },
        () => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, streaming: false } : m
          ));
          setLoading(false);
        },
      );
    }
  }, [agent, input, loading, walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearSession = useCallback(async () => {
    if (!walletAddress) return;
    await clearServerSession(walletAddress);
    setMessages([]);
  }, [walletAddress]);

  // ─── Auth gates ─────────────────────────────────────────────────────────────

  if (!connected || !publicKey) return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-8 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-white mb-4">Connect Wallet</h2>
        <p className="text-gray-400">Connect your wallet to access Whale Chat (Whale Tier required).</p>
      </div>
    </div>
  );

  if (!whaleTierUnlocked) return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-8 text-center">
        <div className="text-6xl mb-4">🐋</div>
        <h2 className="text-2xl font-bold text-white mb-4">Whale Tier Required</h2>
        <p className="text-gray-400 mb-4">Upgrade your AGNTCBRO holdings to unlock Whale Chat.</p>
        <p className="text-lg font-bold text-cyan-300">{balance.toLocaleString()} AGNTCBRO</p>
      </div>
    </div>
  );

  // ─── Agent selection ─────────────────────────────────────────────────────────

  if (!agent) return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐋</div>
          <h1 className="text-3xl font-bold text-white mb-2">Whale Chat</h1>
          <p className="text-gray-400">Select your agent. Switch anytime with <code className="text-cyan-400 bg-black/30 px-1.5 py-0.5 rounded text-sm">/mode cipher</code> or <code className="text-orange-400 bg-black/30 px-1.5 py-0.5 rounded text-sm">/mode alpha</code></p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {(['cipher', 'alpha'] as AgentMode[]).map(mode => {
            const c = AGENT_CONFIG[mode];
            return (
              <button
                key={mode}
                onClick={() => selectAgent(mode)}
                className="group text-left rounded-2xl border p-6 transition-all hover:brightness-110 hover:scale-[1.01]"
                style={{ background: c.bg, borderColor: c.border }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: `${c.color}0.15)`, border: `1px solid ${c.border}` }}>
                    {c.emoji}
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">{c.name}</p>
                    <p className="text-xs font-semibold" style={{ color: c.text }}>{c.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-5 leading-relaxed">{c.description}</p>
                <div className="space-y-1.5">
                  {c.prompts.slice(0, 3).map(p => (
                    <div key={p} className="flex items-center gap-2 text-xs text-gray-500">
                      <span style={{ color: c.text }}>›</span>
                      <span className="italic">"{p}"</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t flex items-center justify-between"
                  style={{ borderColor: `${c.color}0.2)` }}>
                  <span className="text-xs text-gray-600">
                    {mode === 'cipher' ? 'DataAgent · SignalAgent · AnalysisAgent' : 'SignalAgent · AnalysisAgent · ReportAgent'}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: c.badge, color: c.text, border: `1px solid ${c.border}` }}>
                    Select →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sub-agent architecture diagram */}
        <div className="mt-6 rounded-xl border border-white/5 bg-black/30 p-5">
          <p className="text-xs font-semibold text-gray-500 mb-3 tracking-wider">SUB-AGENT ARCHITECTURE</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { icon: '📊', name: 'DataAgent',     desc: 'Backtests · liquidation clusters · historical analysis' },
              { icon: '⚡', name: 'SignalAgent',   desc: 'Live signals · entry/exit · funding · orderbook' },
              { icon: '🔭', name: 'AnalysisAgent', desc: 'Whale wallets · on-chain flows · multi-source synthesis' },
              { icon: '📰', name: 'ReportAgent',   desc: 'Market news · catalysts · narrative mapping' },
            ].map(a => (
              <div key={a.name} className="rounded-lg p-3 border border-white/5 bg-white/2">
                <div className="text-xl mb-1">{a.icon}</div>
                <p className="text-xs font-semibold text-white mb-1">{a.name}</p>
                <p className="text-xs text-gray-600 leading-tight">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Main chat UI ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="rounded-2xl border p-5" style={{ background: cfg!.bg, borderColor: cfg!.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: `${cfg!.color}0.2)`, border: `1px solid ${cfg!.border}` }}>
              {cfg!.emoji}
            </div>
            <div>
              <p className="font-bold text-white">{cfg!.name} <span className="text-sm font-normal text-gray-500">— {cfg!.tagline}</span></p>
              <p className="text-xs" style={{ color: cfg!.text }}>
                {agent === 'cipher' ? 'DataAgent · SignalAgent · AnalysisAgent' : 'SignalAgent · AnalysisAgent · ReportAgent'} · qwen3.5:27b local
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Switch agent */}
            <button
              onClick={() => selectAgent(agent === 'cipher' ? 'alpha' : 'cipher')}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:brightness-125"
              style={{
                background: agent === 'cipher' ? 'rgba(251,146,60,0.1)' : 'rgba(6,182,212,0.1)',
                borderColor: agent === 'cipher' ? 'rgba(251,146,60,0.3)' : 'rgba(6,182,212,0.3)',
                color: agent === 'cipher' ? '#fed7aa' : '#67e8f9',
              }}
            >
              Switch to {agent === 'cipher' ? '⚡ Alpha' : '🔬 Cipher'}
            </button>
            {messages.length > 0 && (
              <button
                onClick={handleClearSession}
                className="p-1.5 rounded-lg border text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}
                title="Clear session memory"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {cfg!.prompts.map(p => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: `${cfg!.color}0.1)`, borderColor: `${cfg!.color}0.25)`, color: cfg!.text }}
            >
              {p.length > 45 ? p.slice(0, 45) + '…' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 p-5">
        <div className="space-y-4 mb-4 max-h-[580px] overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState agent={agent} cfg={cfg!} onPrompt={handleSend} loading={loading} />
          ) : (
            messages.map(m => <MessageBubble key={m.id} message={m} cfg={cfg!} />)
          )}
          {loading && messages[messages.length - 1]?.streaming !== true && (
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: `${cfg!.color}0.15)` }}>
                <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ color: cfg!.text }} />
              </div>
              <span className="text-sm" style={{ color: cfg!.text }}>
                {cfg!.name} is thinking…
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Ask ${cfg!.name}… or /mode ${agent === 'cipher' ? 'alpha' : 'cipher'} to switch`}
            className="flex-1 bg-black/50 border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors"
            style={{ borderColor: `${cfg!.color}0.25)` }}
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="px-5 py-3 rounded-xl text-white font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: `${cfg!.color}0.6)`, border: `1px solid ${cfg!.border}` }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-agent legend */}
      <div className="grid grid-cols-2 gap-3">
        <SubAgentCard icon={<FlaskConical className="w-4 h-4" />} name="Local Subagents" detail="qwen3.5:27b · Mac Studio · session memory" color={cfg!.text} />
        <SubAgentCard icon={<Search className="w-4 h-4" />} name="Cloud Search" detail="glm-4.7:cloud · Tailscale · news + research" color="#c4b5fd" />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({
  agent, cfg, onPrompt, loading,
}: {
  agent: AgentMode;
  cfg: AgentConfig;
  onPrompt: (p: string) => void;
  loading: boolean;
}) {
  return (
    <div className="text-center py-10">
      <div className="text-5xl mb-3">{cfg.emoji}</div>
      <h2 className="text-xl font-bold text-white mb-1">{cfg.name} Ready</h2>
      <p className="text-sm text-gray-500 mb-6">{cfg.tagline} — {agent === 'cipher' ? 'data-rich, risk-aware analysis' : 'highest-conviction setups, definitive direction'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {cfg.prompts.map(p => (
          <button
            key={p}
            onClick={() => onPrompt(p)}
            disabled={loading}
            className="px-4 py-2 rounded-lg border text-sm transition-all hover:brightness-125 disabled:opacity-40"
            style={{ background: `${cfg.color}0.08)`, borderColor: `${cfg.color}0.2)`, color: cfg.text }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

const SUBAGENT_ICONS: Record<string, string> = {
  DataAgent:     '📊',
  SignalAgent:   '⚡',
  AnalysisAgent: '🔭',
  ReportAgent:   '📰',
};

function MessageBubble({
  message,
  cfg,
}: {
  message: ChatMessage;
  cfg: AgentConfig;
}) {
  const isUser  = message.role === 'user';
  const msgCfg  = message.agent ? AGENT_CONFIG[message.agent] : cfg;

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
        style={{ background: isUser ? 'rgba(139,92,246,0.2)' : `${msgCfg.color}0.2)` }}>
        {isUser ? '👤' : msgCfg.emoji}
      </div>

      <div className={`flex-1 max-w-[82%] ${isUser ? 'text-right' : ''}`}>
        <div className="rounded-xl p-3.5"
          style={{
            background: isUser
              ? 'rgba(139,92,246,0.15)'
              : message.type === 'error'
                ? 'rgba(239,68,68,0.12)'
                : msgCfg.msgBg,
            border: `1px solid ${isUser
              ? 'rgba(139,92,246,0.25)'
              : message.type === 'error'
                ? 'rgba(239,68,68,0.3)'
                : msgCfg.msgBorder}`,
          }}>

          {/* Metadata row */}
          {!isUser && (message.subAgent || message.intent || message.streaming) && (
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {message.subAgent && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ background: `${msgCfg.color}0.15)`, color: msgCfg.text, border: `1px solid ${msgCfg.color}0.3)` }}>
                  {SUBAGENT_ICONS[message.subAgent] ?? '🤖'} {message.subAgent}
                </span>
              )}
              {message.intent && (
                <span className="text-xs text-gray-600 font-mono">{message.intent}</span>
              )}
              {message.streaming && (
                <span className="text-xs animate-pulse" style={{ color: msgCfg.text }}>● streaming</span>
              )}
            </div>
          )}

          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
            {message.content}
            {message.streaming && (
              <span className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                style={{ background: msgCfg.text }} />
            )}
          </div>

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-white/5">
              <p className="text-xs text-gray-600 mb-1">Sources:</p>
              <div className="flex flex-wrap gap-1">
                {message.sources.map((s, i) => (
                  <span key={i} className="text-xs bg-black/40 text-gray-500 px-2 py-0.5 rounded border border-white/5">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-700 mt-1 px-1">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function SubAgentCard({ icon, name, detail, color }: { icon: React.ReactNode; name: string; detail: string; color: string }) {
  return (
    <div className="bg-black/40 rounded-xl border border-white/5 p-3.5 flex items-center gap-3">
      <div style={{ color }}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-white">{name}</p>
        <p className="text-xs text-gray-600">{detail}</p>
      </div>
    </div>
  );
}
