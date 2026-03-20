import { useState, useEffect, useCallback } from 'react';
import { Radio, TrendingUp, TrendingDown, AlertTriangle, Filter, Flame, RefreshCw } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { isTestWallet } from '../../hooks/useTokenGating';

const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

type CallType = 'long' | 'short' | 'gem' | 'alert';

interface AlphaCall {
  messageId:     number;
  ticker:        string;
  callType:      CallType;
  sourceChannel: string;
  channelScore:  number;
  confidence:    'HIGH' | 'MEDIUM' | 'LOW';
  winRate:       number;
  timestamp:     string;
  rawText:       string;
  liquidity:     number;
  isNew:         boolean;
  contract?:     string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function callTypeConfig(type: CallType) {
  switch (type) {
    case 'long':  return { icon: TrendingUp,    color: 'text-green-400',  bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',  label: 'LONG'  };
    case 'short': return { icon: TrendingDown,  color: 'text-red-400',    bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   label: 'SHORT' };
    case 'gem':   return { icon: null,          color: 'text-purple-300', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)',  label: 'GEM'   };
    case 'alert': return { icon: AlertTriangle, color: 'text-yellow-400', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',  label: 'ALERT' };
  }
}

function channelScoreBadge(score: number) {
  if (score >= 0.70) return { label: 'HIGH_ALPHA', color: '#4ade80', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' };
  if (score >= 0.50) return { label: 'TRADEABLE',  color: '#67e8f9', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.3)'  };
  return                    { label: 'LOW_QUALITY', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)'  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AlphaFeed() {
  const { publicKey } = useWallet();
  const isTest = isTestWallet(publicKey?.toBase58() ?? '');

  const [calls, setCalls]               = useState<AlphaCall[]>([]);
  const [loading, setLoading]           = useState(true);
  const [isMock, setIsMock]             = useState(false);
  const [channelFilter, setChannelFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState<CallType | 'all'>('all');
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [burnedIds, setBurnedIds]       = useState<Set<number>>(new Set());
  const [pendingBurnId, setPendingBurnId] = useState<number | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30', type: typeFilter, channel: channelFilter });
      const res  = await fetch(`${API_BASE}/api/telegram/alpha-feed?${params}`);
      const data = await res.json() as { calls: AlphaCall[]; mock: boolean };
      setCalls(data.calls ?? []);
      setIsMock(data.mock ?? false);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, channelFilter]);

  // Initial fetch + poll every 60s
  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 60_000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  // Derive unique channel names for filter tabs
  const channelNames = ['all', ...Array.from(new Set(calls.map(c => c.sourceChannel)))];

  const filtered = calls
    .filter(c => channelFilter === 'all' || c.sourceChannel === channelFilter)
    .filter(c => typeFilter === 'all'    || c.callType === typeFilter);

  const handleExpand = (call: AlphaCall) => {
    // Test wallet: all calls unlocked, no burn required
    if (isTest || burnedIds.has(call.messageId)) {
      setExpandedId(expandedId === call.messageId ? null : call.messageId);
    } else {
      setPendingBurnId(call.messageId);
    }
  };

  const confirmBurn = () => {
    if (pendingBurnId === null) return;
    setBurnedIds(prev => new Set(prev).add(pendingBurnId));
    setExpandedId(pendingBurnId);
    setPendingBurnId(null);
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <div className="flex items-center gap-3 mb-5">
          <Radio className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Alpha Feed
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Real-time calls from audited Telegram alpha channels — no delay
              {isMock && <span className="ml-2 text-yellow-400">(demo data — add Telegram credentials to go live)</span>}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchFeed}
              disabled={loading}
              className="p-2 rounded-lg transition-all disabled:opacity-50"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}
            >
              <RefreshCw className={`w-4 h-4 text-purple-300 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#4ade80' }}
            >
              ● Live
            </div>
          </div>
        </div>

        {/* Channel filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          {channelNames.map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                channelFilter === ch
                  ? 'bg-purple-600 text-white'
                  : 'bg-black/30 text-gray-400 hover:bg-black/50'
              }`}
            >
              {ch === 'all' ? 'All Channels' : ch}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'gem', 'long', 'short', 'alert'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === t
                  ? 'bg-purple-600 text-white'
                  : 'bg-black/30 text-gray-400 hover:bg-black/50'
              }`}
            >
              <Filter className="w-3 h-3" />
              {t === 'all' ? 'All Types' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-10 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
              <p className="text-gray-400">Fetching alpha calls…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-10 text-center">
            <p className="text-gray-500">No calls match this filter.</p>
          </div>
        ) : (
          filtered.map(call => {
            const ct       = callTypeConfig(call.callType);
            const csb      = channelScoreBadge(call.channelScore);
            const Icon     = ct.icon;
            const unlocked = burnedIds.has(call.messageId);
            const isExpanded = expandedId === call.messageId;

            return (
              <div
                key={call.messageId}
                className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 overflow-hidden transition-all"
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Call type badge */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                    style={{ background: ct.bg, border: `1px solid ${ct.border}` }}
                  >
                    {Icon && <Icon className={`w-3 h-3 ${ct.color}`} />}
                    <span className={ct.color}>{ct.label}</span>
                  </div>

                  {/* Ticker + channel */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{call.ticker}</span>
                      {call.isNew && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }}
                        >
                          NEW
                        </span>
                      )}
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: csb.bg, border: `1px solid ${csb.border}`, color: csb.color }}
                      >
                        {call.sourceChannel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {unlocked ? call.rawText : call.rawText.slice(0, 48) + '…'}
                    </p>
                  </div>

                  {/* Right: confidence + time + expand */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold text-purple-300">{call.confidence}</p>
                      <p className="text-xs text-gray-500">{relativeTime(call.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => handleExpand(call)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={
                        unlocked
                          ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#c4b5fd' }
                          : { background: 'rgba(239,68,68,0.1)',   border: '1px solid rgba(239,68,68,0.3)',   color: '#f87171' }
                      }
                    >
                      <Flame className="w-3 h-3" />
                      {unlocked ? (isExpanded ? 'Collapse' : 'Expand') : 'Unlock'}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && unlocked && (
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(139,92,246,0.15)' }}>
                    <div
                      className="rounded-xl p-4 mt-3"
                      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                      <p className="text-sm text-gray-300 leading-relaxed mb-3">"{call.rawText}"</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <DetailStat label="Confidence"    value={call.confidence} />
                        <DetailStat label="Channel Score" value={call.channelScore.toFixed(2)} />
                        {call.liquidity > 0 && (
                          <DetailStat label="Liquidity" value={`$${(call.liquidity / 1000).toFixed(0)}K`} />
                        )}
                        {call.contract && (
                          <DetailStat label="Contract" value={String(call.contract)} mono />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Burn modal ── */}
      {pendingBurnId !== null && (
        <AlphaBurnModal onConfirm={confirmBurn} onCancel={() => setPendingBurnId(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold text-white ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</p>
    </div>
  );
}

function AlphaBurnModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 rounded-2xl border border-purple-500/40 p-8 max-w-md w-full">
        <div className="text-4xl mb-4 text-center">📡</div>
        <h3 className="text-2xl font-bold text-white mb-3 text-center">Unlock Full Alpha Call</h3>
        <p className="text-gray-300 mb-6 text-center text-sm">
          Unlocking the full call detail costs{' '}
          <span className="text-purple-300 font-bold">2,500 AGNTCBRO</span>.
          Tokens are burned — reducing supply and rewarding long-term holders.
        </p>
        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Feature</span><span className="text-white font-semibold">Alpha Call Detail</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Cost</span><span className="text-purple-300 font-semibold">2,500 AGNTCBRO</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Burn Effect</span><span className="text-green-400 font-semibold">Reduces Supply ✓</span></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white font-semibold hover:bg-black/70 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors">Confirm Burn</button>
        </div>
      </div>
    </div>
  );
}
