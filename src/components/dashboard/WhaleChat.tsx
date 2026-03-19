import { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, Zap, BarChart2, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentMode = 'cipher' | 'alpha';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  ts: Date;
}

// ─── Agent configs ────────────────────────────────────────────────────────────

const AGENTS: Record<AgentMode, {
  name: string;
  tagline: string;
  emoji: string;
  color: string;
  border: string;
  textColor: string;
  bubbleBg: string;
  placeholder: string;
  suggestions: string[];
}> = {
  cipher: {
    name: 'Cipher',
    tagline: 'Technical Analyst · Data-rich · Risk-focused',
    emoji: '🔬',
    color: 'rgba(6,182,212,0.2)',
    border: 'rgba(6,182,212,0.5)',
    textColor: '#67e8f9',
    bubbleBg: 'rgba(6,182,212,0.1)',
    placeholder: 'e.g. Show me BTC liquidation clusters between $62K–$65K',
    suggestions: [
      'Show me BTC liquidation clusters between $62K–$65K',
      'Backtest a SOL long-scalp strategy with 20x leverage over 30 days',
      'Which whale wallets accumulated ETH in the last 4 hours?',
      'What is the current BTC funding rate trend?',
      'Analyze on-chain exchange inflows for SOL today',
    ],
  },
  alpha: {
    name: 'Alpha',
    tagline: 'Action-first · P&L obsessed · Opportunity-focused',
    emoji: '⚡',
    color: 'rgba(234,179,8,0.15)',
    border: 'rgba(234,179,8,0.5)',
    textColor: '#facc15',
    bubbleBg: 'rgba(234,179,8,0.08)',
    placeholder: 'e.g. What is the highest conviction trade right now?',
    suggestions: [
      "What's the highest conviction trade right now?",
      'ETH long, 15x — give me entry, TP, and SL',
      'Alert me when SOL breaks $150 with volume confirmation',
      'Give me the top 3 setups for the next 4 hours',
      'Scan for tokens with unusual whale accumulation today',
    ],
  },
};

// ─── Simulated responses (placeholder until backend is live) ─────────────────

const CIPHER_RESPONSES: Record<string, string> = {
  default: `📊 **Cipher Analysis**\n\nI have access to: live signals, liquidation heat maps, whale wallet tracking, funding rate data, and on-chain analytics.\n\n⚙️ Backend integration is in progress — I'll be fully operational soon. Stay tuned for real-time data feeds.`,
  liquidation: `🌡 **BTC Liquidation Cluster Analysis**\n\nKey clusters detected in the $62K–$65K range:\n• $63,200 — ~$420M long liquidations\n• $64,500 — ~$210M short liquidations\n• $62,800 — confluence of OI and stop clusters\n\n⚠️ *Live data integration coming soon — currently showing indicative structure.*`,
  backtest: `📈 **Backtest Report — SOL Long-Scalp 20x (30 days)**\n\n• Win Rate: 58.3%\n• Sharpe Ratio: 1.42\n• Max Drawdown: -34.2%\n• Avg Trade Duration: 47 min\n• Est. PnL: +18.7% (pre-fees)\n\n⚠️ *Backtest engine integration in progress.*`,
  whale: `🐳 **Whale Wallet Flows — ETH (last 4h)**\n\nLabeled wallets accumulating:\n• 0x7fa...2c3b — +4,200 ETH (Binance withdrawal)\n• 0x3bc...9a1d — +1,800 ETH (OTC desk)\n• 0xf12...88cc — +650 ETH (DeFi protocol)\n\nNet flow: **+6,650 ETH bullish**\n\n⚠️ *On-chain analytics integration in progress.*`,
};

const ALPHA_RESPONSES: Record<string, string> = {
  default: `⚡ **Alpha Online**\n\nRunning opportunity scan across BTC, ETH, SOL, BNB, XRP...\n\nI filter everything for high-probability setups only. No noise. Just edge.\n\n🔧 Live signal pipeline connecting — full execution signals deploy shortly.`,
  conviction: `🎯 **Top Conviction Trade — Current**\n\n**SOL LONG**\n• Entry: Market / Limit ~$142\n• TP1: $148 (+4.2%) | TP2: $155 (+9.2%)\n• SL: $138 (-2.8%)\n• Leverage: 5–10x recommended\n• Confidence: 74%\n• Time horizon: 2–6h\n\n⚠️ *Live signal integration in progress.*`,
  alert: `🔔 **Alert Configured**\n\nSOL price break above $150 with volume confirmation:\n• Trigger: Close above $150 on 15m candle\n• Volume: >2x 24h avg\n• Channel: Push + Discord DM\n\n✅ Alert queued. ⚠️ *Push delivery active once webhook is live.*`,
};

function getResponse(mode: AgentMode, query: string): string {
  const q = query.toLowerCase();
  if (mode === 'cipher') {
    if (q.includes('liquidat')) return CIPHER_RESPONSES.liquidation;
    if (q.includes('backtest') || q.includes('strategy')) return CIPHER_RESPONSES.backtest;
    if (q.includes('whale') || q.includes('wallet') || q.includes('accumul')) return CIPHER_RESPONSES.whale;
    return CIPHER_RESPONSES.default;
  } else {
    if (q.includes('conviction') || q.includes('trade') || q.includes('setup')) return ALPHA_RESPONSES.conviction;
    if (q.includes('alert') || q.includes('break') || q.includes('notify')) return ALPHA_RESPONSES.alert;
    return ALPHA_RESPONSES.default;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhaleChat() {
  const [mode, setMode] = useState<AgentMode | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function selectAgent(m: AgentMode) {
    setMode(m);
    setMessages([{
      id: 'welcome',
      role: 'agent',
      text: m === 'cipher'
        ? `🔬 **Cipher online.** I analyse liquidation clusters, backtest strategies, track whale wallets, and synthesise on-chain data. What do you want to know?`
        : `⚡ **Alpha online.** I hunt edge. Give me a market, an asset, or a question — I'll give you actionable signals with entry, TP, and SL. What's the play?`,
      ts: new Date(),
    }]);
    setShowSuggestions(true);
  }

  async function sendMessage(text?: string) {
    const query = (text ?? input).trim();
    if (!query || thinking || !mode) return;

    setInput('');
    setShowSuggestions(false);

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      ts: new Date(),
    }]);

    setThinking(true);
    await new Promise(r => setTimeout(r, 900 + Math.random() * 800));
    setThinking(false);

    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'agent',
      text: getResponse(mode, query),
      ts: new Date(),
    }]);
  }

  function resetChat() {
    setMode(null);
    setMessages([]);
    setInput('');
    setThinking(false);
    setShowSuggestions(true);
  }

  const agent = mode ? AGENTS[mode] : null;

  // ── Agent selection screen ──
  if (!mode) {
    return (
      <div className="space-y-6">
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-6">
          <h2 className="text-xl font-bold text-white mb-1">🤖 Whale Chat</h2>
          <p className="text-sm text-gray-400 mb-6">Select your AI agent. Switch any time with <code className="text-cyan-300 bg-black/30 px-1 rounded">/mode cipher</code> or <code className="text-yellow-300 bg-black/30 px-1 rounded">/mode alpha</code>.</p>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Cipher */}
            <button
              onClick={() => selectAgent('cipher')}
              className="text-left rounded-2xl border p-5 transition-all hover:brightness-110 hover:scale-[1.01]"
              style={{ background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.35)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🔬</span>
                <div>
                  <p className="font-bold text-white text-lg">Cipher</p>
                  <p className="text-xs text-cyan-300">Technical Analyst Mode</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Methodical, data-rich, risk-focused. Best for liquidation analysis, backtesting, on-chain flows, and whale tracking.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Liquidation maps', 'Backtest engine', 'Whale wallets', 'Funding rates', 'On-chain analytics'].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)' }}>{t}</span>
                ))}
              </div>
            </button>

            {/* Alpha */}
            <button
              onClick={() => selectAgent('alpha')}
              className="text-left rounded-2xl border p-5 transition-all hover:brightness-110 hover:scale-[1.01]"
              style={{ background: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.35)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">⚡</span>
                <div>
                  <p className="font-bold text-white text-lg">Alpha</p>
                  <p className="text-xs text-yellow-300">Aggressive Alpha Mode</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Action-first, P&L obsessed, opportunity-focused. Best for trade signals, entries, alerts, and highest-conviction setups.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Trade signals', 'Entry / TP / SL', 'Custom alerts', 'High-conviction setups', 'Ranked opportunities'].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(234,179,8,0.12)', color: '#facc15', border: '1px solid rgba(234,179,8,0.3)' }}>{t}</span>
                ))}
              </div>
            </button>
          </div>
        </div>

        {/* Architecture info */}
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/15 p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            Agent Architecture
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { label: 'DataAgent',     desc: 'DB queries, backtests',              color: '#67e8f9' },
              { label: 'SignalAgent',   desc: 'Live signals, market data',          color: '#facc15' },
              { label: 'AnalysisAgent', desc: 'Multi-source synthesis',             color: '#c4b5fd' },
              { label: 'ReportAgent',   desc: 'Summaries, exports',                 color: '#4ade80' },
            ].map(a => (
              <div key={a.label} className="flex items-start gap-2 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: a.color }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: a.color }}>{a.label}</p>
                  <p className="text-xs text-gray-500">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3">Persistent session memory stores trading preferences, portfolio composition, and risk profile across sessions.</p>
        </div>
      </div>
    );
  }

  // ── Chat screen ──
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl border flex flex-col" style={{ borderColor: agent!.border, minHeight: '560px', maxHeight: '680px' }}>

      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: agent!.border }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent!.emoji}</span>
          <div>
            <p className="font-bold text-white text-sm">{agent!.name}</p>
            <p className="text-xs" style={{ color: agent!.textColor }}>{agent!.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode switcher */}
          <button
            onClick={() => selectAgent(mode === 'cipher' ? 'alpha' : 'cipher')}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border transition-all hover:brightness-125"
            style={{ background: mode === 'cipher' ? 'rgba(234,179,8,0.1)' : 'rgba(6,182,212,0.1)', borderColor: mode === 'cipher' ? 'rgba(234,179,8,0.4)' : 'rgba(6,182,212,0.4)', color: mode === 'cipher' ? '#facc15' : '#67e8f9' }}
          >
            {mode === 'cipher' ? '⚡ Switch to Alpha' : '🔬 Switch to Cipher'}
          </button>
          <button
            onClick={resetChat}
            className="p-1.5 rounded border text-gray-400 hover:text-white transition-all"
            style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
            title="Reset chat"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
              style={msg.role === 'user'
                ? { background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.4)', color: '#e9d5ff' }
                : { background: agent!.bubbleBg, border: `1px solid ${agent!.border}`, color: '#e5e7eb' }}
            >
              {msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background: agent!.bubbleBg, border: `1px solid ${agent!.border}` }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: agent!.textColor, animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && messages.length <= 1 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowSuggestions(s => !s)}
            className="flex items-center gap-1 text-xs text-gray-500 mb-2 hover:text-gray-300 transition-colors"
          >
            <ChevronDown className="w-3 h-3" /> Suggested queries
          </button>
          <div className="flex flex-wrap gap-1.5">
            {agent!.suggestions.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-2.5 py-1 rounded-lg text-xs border transition-all hover:brightness-125"
                style={{ background: agent!.color, borderColor: agent!.border, color: agent!.textColor }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t" style={{ borderColor: agent!.border }}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={agent!.placeholder}
            className="flex-1 bg-black/40 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none border transition-all"
            style={{ borderColor: input ? agent!.border : 'rgba(255,255,255,0.1)' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || thinking}
            className="p-2 rounded-lg border transition-all hover:brightness-125 disabled:opacity-40"
            style={{ background: agent!.color, borderColor: agent!.border, color: agent!.textColor }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-1.5 text-center">Whale Chat is in preview — responses are indicative pending live data integration.</p>
      </div>
    </div>
  );
}
