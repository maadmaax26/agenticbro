import { useState } from 'react';
import { Radio, TrendingUp, TrendingDown, AlertTriangle, Filter, Flame } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CallType = 'long' | 'short' | 'gem' | 'alert';
type ChannelFilter = 'all' | 'CryptoEdge Pro' | 'AlphaWhale' | 'DeFi Gems' | 'GemHunters';

interface AlphaCall {
  id: number;
  ticker: string;
  callType: CallType;
  channel: string;
  channelScore: number;   // 0–1, from alpha auditor
  confidence: number;     // 0–100
  timestamp: string;
  rawText: string;
  liquidity: number;
  isNew: boolean;
  contract?: string;
}

// ─── Mock feed data (replace with live OpenClaw agent stream) ─────────────────

const ALPHA_CALLS: AlphaCall[] = [
  {
    id: 1, ticker: '$NOVA', callType: 'gem',
    channel: 'CryptoEdge Pro', channelScore: 0.81,
    confidence: 88, timestamp: '1m ago',
    rawText: 'New gem launching now — $NOVA just hit DEX, deployer wallets clean, liq locked 6mo.',
    liquidity: 182000, isNew: true,
    contract: '0x4e3a...f29b',
  },
  {
    id: 2, ticker: 'SOL', callType: 'long',
    channel: 'AlphaWhale', channelScore: 0.76,
    confidence: 91, timestamp: '4m ago',
    rawText: 'SOL momentum confirmed — whale accumulation on-chain, funding neutral. Entry zone $185–$188.',
    liquidity: 0, isNew: false,
  },
  {
    id: 3, ticker: '$FLUX', callType: 'gem',
    channel: 'AlphaWhale', channelScore: 0.76,
    confidence: 79, timestamp: '7m ago',
    rawText: '$FLUX presale ending — team doxxed, audit passed, stealth launch in 2h. Early entry opportunity.',
    liquidity: 94000, isNew: true,
    contract: '0x8c1d...a442',
  },
  {
    id: 4, ticker: 'BTC', callType: 'short',
    channel: 'CryptoEdge Pro', channelScore: 0.81,
    confidence: 63, timestamp: '12m ago',
    rawText: 'BTC rejection at $72k resistance. Funding rate elevated. Short bias for next 4–6h.',
    liquidity: 0, isNew: false,
  },
  {
    id: 5, ticker: '$PRISM', callType: 'gem',
    channel: 'DeFi Gems', channelScore: 0.63,
    confidence: 71, timestamp: '15m ago',
    rawText: '$PRISM DeFi protocol — new AMM design, TVL growing fast. Getting in early.',
    liquidity: 55000, isNew: false,
    contract: '0x2f7b...e891',
  },
  {
    id: 6, ticker: 'ETH', callType: 'alert',
    channel: 'AlphaWhale', channelScore: 0.76,
    confidence: 85, timestamp: '19m ago',
    rawText: 'ETH whale moved 12,000 ETH to exchange — watch for volatility spike next 30–60min.',
    liquidity: 0, isNew: false,
  },
  {
    id: 7, ticker: '$KRYPT', callType: 'gem',
    channel: 'CryptoEdge Pro', channelScore: 0.81,
    confidence: 74, timestamp: '26m ago',
    rawText: '$KRYPT KryptVault — custodial yield product, institutional backing rumoured. Accumulation phase.',
    liquidity: 126000, isNew: false,
    contract: '0x9a3c...b17e',
  },
  {
    id: 8, ticker: 'SOL', callType: 'alert',
    channel: 'GemHunters', channelScore: 0.42,
    confidence: 44, timestamp: '33m ago',
    rawText: 'SOL pump inbound — trust me bro. All in.',
    liquidity: 0, isNew: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function callTypeConfig(type: CallType) {
  switch (type) {
    case 'long':  return { icon: TrendingUp,    color: 'text-green-400', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',  label: 'LONG'  };
    case 'short': return { icon: TrendingDown,  color: 'text-red-400',   bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   label: 'SHORT' };
    case 'gem':   return { icon: null,          color: 'text-purple-300',bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)',  label: 'GEM'   };
    case 'alert': return { icon: AlertTriangle, color: 'text-yellow-400',bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',  label: 'ALERT' };
  }
}

function channelScoreBadge(score: number) {
  if (score >= 0.70) return { label: 'HIGH_ALPHA', color: '#4ade80', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' };
  if (score >= 0.50) return { label: 'TRADEABLE',  color: '#67e8f9', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.3)'  };
  return                    { label: 'LOW_QUALITY',color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)'  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AlphaFeed() {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [typeFilter, setTypeFilter]       = useState<CallType | 'all'>('all');
  const [expandedId, setExpandedId]       = useState<number | null>(null);
  const [burnedIds, setBurnedIds]         = useState<Set<number>>(new Set());
  const [pendingBurnId, setPendingBurnId] = useState<number | null>(null);

  const channels: ChannelFilter[] = ['all', 'CryptoEdge Pro', 'AlphaWhale', 'DeFi Gems', 'GemHunters'];

  const filtered = ALPHA_CALLS
    .filter(c => channelFilter === 'all' || c.channel === channelFilter)
    .filter(c => typeFilter === 'all'    || c.callType === typeFilter);

  const handleExpand = (call: AlphaCall) => {
    if (burnedIds.has(call.id)) {
      setExpandedId(expandedId === call.id ? null : call.id);
    } else {
      setPendingBurnId(call.id);
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
            </p>
          </div>
          <div
            className="ml-auto text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#4ade80' }}
          >
            ● Live
          </div>
        </div>

        {/* Channel filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          {channels.map(ch => (
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
        {filtered.length === 0 ? (
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-10 text-center">
            <p className="text-gray-500">No calls match this filter.</p>
          </div>
        ) : (
          filtered.map(call => {
            const ct  = callTypeConfig(call.callType);
            const csb = channelScoreBadge(call.channelScore);
            const Icon = ct.icon;
            const unlocked = burnedIds.has(call.id);
            const isExpanded = expandedId === call.id;

            return (
              <div
                key={call.id}
                className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 overflow-hidden transition-all"
              >
                {/* Main row */}
                <div className="flex items-center gap-4 p-4">
                  {/* Call type badge */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                    style={{ background: ct.bg, border: `1px solid ${ct.border}`, color: ct.color.replace('text-', '') }}
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
                        {call.channel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {unlocked ? call.rawText : call.rawText.slice(0, 48) + '…'}
                    </p>
                  </div>

                  {/* Right: confidence + time + expand */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold text-purple-300">{call.confidence}%</p>
                      <p className="text-xs text-gray-500">{call.timestamp}</p>
                    </div>
                    <button
                      onClick={() => handleExpand(call)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={
                        unlocked
                          ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#c4b5fd' }
                          : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }
                      }
                    >
                      <Flame className="w-3 h-3" />
                      {unlocked ? (isExpanded ? 'Collapse' : 'Expand') : 'Unlock'}
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && unlocked && (
                  <div
                    className="px-4 pb-4 pt-0"
                    style={{ borderTop: '1px solid rgba(139,92,246,0.15)' }}
                  >
                    <div
                      className="rounded-xl p-4 mt-3"
                      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                      <p className="text-sm text-gray-300 leading-relaxed mb-3">"{call.rawText}"</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <DetailStat label="Confidence"     value={`${call.confidence}%`} />
                        <DetailStat label="Channel Score"  value={call.channelScore.toFixed(2)} />
                        {call.liquidity > 0 && (
                          <DetailStat label="Liquidity" value={`$${(call.liquidity / 1000).toFixed(0)}K`} />
                        )}
                        {call.contract && (
                          <DetailStat label="Contract" value={call.contract} mono />
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
        <AlphaBurnModal
          onConfirm={confirmBurn}
          onCancel={() => setPendingBurnId(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
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
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}
        >
          <p className="text-xs text-gray-400 mb-3">Transaction Details</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Feature</span>
              <span className="text-white font-semibold">Alpha Call Detail</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cost</span>
              <span className="text-purple-300 font-semibold">2,500 AGNTCBRO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Burn Effect</span>
              <span className="text-green-400 font-semibold">Reduces Supply ✓</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white font-semibold hover:bg-black/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors"
          >
            Confirm Burn
          </button>
        </div>
      </div>
    </div>
  );
}
