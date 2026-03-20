import { useState } from 'react';
import { Gem, RefreshCw, TrendingUp, Droplets, Flame } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type FilterMode = 'all' | 'high' | 'medium' | 'low' | 'new';

interface GemAdviseItem {
  id: number;
  ticker: string;
  name: string;
  avatar: string;
  edgeScore: number;       // 0–1
  confidence: ConfidenceLevel;
  winRate: number;         // 0–1
  rugRate: number;         // 0–1
  liquidity: number;       // USD
  volume24h: number;       // USD
  sourceChannel: string;
  isNew: boolean;
  priceChange1h: string;   // e.g. "+12.4%"
  maxGain: string;         // e.g. "3.2x"
}

// ─── Static gem pool (replace with live API / OpenClaw skill call) ────────────

const GEM_POOL: GemAdviseItem[] = [
  {
    id: 1, ticker: '$NOVA', name: 'NovaProtocol', avatar: '🌟',
    edgeScore: 0.81, confidence: 'HIGH',
    winRate: 0.44, rugRate: 0.08,
    liquidity: 182000, volume24h: 540000,
    sourceChannel: 'CryptoEdge Pro', isNew: false,
    priceChange1h: '+12.4%', maxGain: '3.2x',
  },
  {
    id: 2, ticker: '$FLUX', name: 'FluxLayer', avatar: '⚡',
    edgeScore: 0.76, confidence: 'HIGH',
    winRate: 0.39, rugRate: 0.12,
    liquidity: 94000, volume24h: 310000,
    sourceChannel: 'AlphaWhale', isNew: true,
    priceChange1h: '+8.1%', maxGain: '2.7x',
  },
  {
    id: 3, ticker: '$KRYPT', name: 'KryptVault', avatar: '🔐',
    edgeScore: 0.71, confidence: 'HIGH',
    winRate: 0.36, rugRate: 0.14,
    liquidity: 126000, volume24h: 275000,
    sourceChannel: 'CryptoEdge Pro', isNew: false,
    priceChange1h: '+6.7%', maxGain: '2.4x',
  },
  {
    id: 4, ticker: '$PRISM', name: 'PrismFi', avatar: '🔷',
    edgeScore: 0.63, confidence: 'MEDIUM',
    winRate: 0.31, rugRate: 0.19,
    liquidity: 55000, volume24h: 88000,
    sourceChannel: 'DeFi Gems', isNew: true,
    priceChange1h: '+3.2%', maxGain: '1.9x',
  },
  {
    id: 5, ticker: '$VEIL', name: 'VeilSwap', avatar: '🌀',
    edgeScore: 0.58, confidence: 'MEDIUM',
    winRate: 0.28, rugRate: 0.22,
    liquidity: 42000, volume24h: 61000,
    sourceChannel: 'MoonSignals', isNew: false,
    priceChange1h: '+1.8%', maxGain: '1.5x',
  },
  {
    id: 6, ticker: '$QBIT', name: 'QbitChain', avatar: '🧬',
    edgeScore: 0.54, confidence: 'MEDIUM',
    winRate: 0.26, rugRate: 0.25,
    liquidity: 31000, volume24h: 44000,
    sourceChannel: 'GemHunters', isNew: true,
    priceChange1h: '-0.4%', maxGain: '1.2x',
  },
];

// ─── Core gem advise logic (mirrors gem_advise.py) ────────────────────────────

function getGemAdvise(
  filter: FilterMode = 'all',
  rugRateMax = 0.30,
  liquidityMin = 20000,
): GemAdviseItem[] {
  return GEM_POOL
    .filter(g => g.rugRate <= rugRateMax)
    .filter(g => g.liquidity >= liquidityMin)
    .filter(g => {
      if (filter === 'high')   return g.confidence === 'HIGH';
      if (filter === 'medium') return g.confidence === 'MEDIUM';
      if (filter === 'low')    return g.confidence === 'LOW';
      if (filter === 'new')    return g.isNew;
      return true;
    })
    .sort((a, b) => b.edgeScore - a.edgeScore);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GemAdvise() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('just now');
  const [freeScansRemaining, setFreeScansRemaining] = useState(() => {
    const saved = localStorage.getItem('gemAdviseFreeScans');
    return saved ? Math.max(0, parseInt(saved, 10)) : 3;
  });

  const gems = getGemAdvise(filter);
  const avgEdge = gems.length
    ? (gems.reduce((s, g) => s + g.edgeScore, 0) / gems.length).toFixed(2)
    : '—';
  const highCount = gems.filter(g => g.confidence === 'HIGH').length;
  const channelCount = new Set(gems.map(g => g.sourceChannel)).size;

  const handleRefresh = () => {
    if (freeScansRemaining > 0) {
      // Free scan available
      setFreeScansRemaining(freeScansRemaining - 1);
      localStorage.setItem('gemAdviseFreeScans', String(freeScansRemaining - 1));
      performScan();
    } else {
      // Need to burn tokens
      setShowBurnModal(true);
    }
  };

  const confirmRefresh = () => {
    setShowBurnModal(false);
    performScan();
  };

  const performScan = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setIsRefreshing(false);
    }, 1400);
  };

  return (
    <div className="space-y-6">

      {/* ── Header panel ── */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Gem className="w-6 h-6 text-purple-400" />
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Gem Advise
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(139,92,246,0.25)',
                    border: '1px solid rgba(139,92,246,0.6)',
                    color: '#c4b5fd',
                  }}
                >
                  NEW
                </span>
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                AI-ranked token recommendations from audited alpha channels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                 style={{
                   background: freeScansRemaining > 0
                     ? 'rgba(16,185,129,0.15)'
                     : 'rgba(245,158,11,0.15)',
                   border: freeScansRemaining > 0
                     ? '1px solid rgba(16,185,129,0.4)'
                     : '1px solid rgba(245,158,11,0.4)',
                   color: freeScansRemaining > 0 ? '#4ade80' : '#fbbf24',
                 }}>
              {freeScansRemaining > 0 ? (
                <>
                  <span>🎁</span>
                  <span>{freeScansRemaining} Free Scans</span>
                </>
              ) : (
                <>
                  <span>💎</span>
                  <span>10K AGNTCBRO/Scan</span>
                </>
              )}
            </div>
            <span className="text-xs text-gray-500">Updated: {lastUpdated}</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
              style={{
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.4)',
                color: '#c4b5fd',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Scanning…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all',    label: 'All Gems' },
              { id: 'high',   label: '🟢 High Confidence' },
              { id: 'medium', label: '🟡 Medium' },
              { id: 'low',    label: '🔴 Low' },
              { id: 'new',    label: '⚡ New' },
            ] as { id: FilterMode; label: string }[]
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                filter === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-black/30 text-gray-400 hover:bg-black/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gem cards grid ── */}
      {gems.length === 0 ? (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-10 text-center">
          <p className="text-gray-500">No gems match this filter.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {gems.map(gem => (
            <GemCard key={gem.id} gem={gem} />
          ))}
        </div>
      )}

      {/* ── Summary footer ── */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.2)' }}
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3 mb-4">
          <SummaryStat label="Active Advise"      value={String(gems.length)} />
          <SummaryStat label="Avg Edge Score"     value={avgEdge} />
          <SummaryStat label="High Confidence"    value={String(highCount)} />
          <SummaryStat label="Channels Sourced"   value={String(channelCount)} />
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          ⚠️ Gem Advise is generated from on-chain data, DEX liquidity metrics, and Telegram alpha channel scoring via the OpenClaw intelligence engine.
          This is <span className="text-gray-500">NOT financial advice</span>. Always DYOR. Past signal quality does not guarantee future performance.
        </p>
      </div>

      {/* ── Burn confirmation modal ── */}
      {showBurnModal && (
        <GemBurnModal
          onConfirm={confirmRefresh}
          onCancel={() => setShowBurnModal(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GemCard({ gem }: { gem: GemAdviseItem }) {
  const edgePct = Math.round(gem.edgeScore * 100);
  const isPositive = gem.priceChange1h.startsWith('+');

  const confidenceStyle: Record<ConfidenceLevel, { bg: string; border: string; color: string }> = {
    HIGH:   { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)',  color: '#4ade80' },
    MEDIUM: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)',  color: '#fbbf24' },
    LOW:    { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)',   color: '#f87171' },
  };
  const cs = confidenceStyle[gem.confidence];

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-5 hover:border-purple-500/50 transition-all cursor-pointer">
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.15)' }}
          >
            {gem.avatar}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm">{gem.name}</span>
              {gem.isNew && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(139,92,246,0.25)',
                    border: '1px solid rgba(139,92,246,0.5)',
                    color: '#c4b5fd',
                  }}
                >
                  NEW
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{gem.ticker}</p>
          </div>
        </div>
        <span
          className="text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}
        >
          {gem.confidence}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Metric
          icon={<TrendingUp className="w-3 h-3" />}
          label="Win Rate"
          value={`${Math.round(gem.winRate * 100)}%`}
          valueColor="text-green-400"
        />
        <Metric
          label="1h Change"
          value={gem.priceChange1h}
          valueColor={isPositive ? 'text-green-400' : 'text-red-400'}
        />
        <Metric
          icon={<Droplets className="w-3 h-3" />}
          label="Liquidity"
          value={`$${(gem.liquidity / 1000).toFixed(0)}K`}
          valueColor="text-white"
        />
        <Metric
          icon={<Flame className="w-3 h-3" />}
          label="Max Gain"
          value={gem.maxGain}
          valueColor="text-purple-300"
        />
      </div>

      {/* Footer: source + edge score bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 truncate max-w-[120px]">📡 {gem.sourceChannel}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Edge</span>
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${edgePct}%`,
                background: 'linear-gradient(90deg, #7c3aed, #00d4ff)',
              }}
            />
          </div>
          <span className="text-xs font-bold text-purple-300">{edgePct}</span>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label, value, valueColor, icon,
}: {
  label: string;
  value: string;
  valueColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg p-2.5"
      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
    >
      <div className="flex items-center gap-1 mb-0.5">
        {icon && <span className="text-gray-500">{icon}</span>}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-sm font-bold ${valueColor ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-purple-300">{value}</p>
    </div>
  );
}

function GemBurnModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 rounded-2xl border border-purple-500/40 p-8 max-w-md w-full">
        <div className="text-4xl mb-4 text-center">💎</div>
        <h3 className="text-2xl font-bold text-white mb-3 text-center">Gem Advise Scan</h3>
        <p className="text-gray-300 mb-2 text-center text-sm">
          Your free scans have been used up. Continue scanning by burning AGNTCBRO tokens.
        </p>
        <p className="text-gray-300 mb-6 text-center text-sm">
          This scan will burn{' '}
          <span className="text-purple-300 font-bold">10,000 AGNTCBRO</span>.
          The scan re-audits all tracked Telegram channels and surfaces new high-edge opportunities.
        </p>
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}
        >
          <p className="text-xs text-gray-400 mb-3">Scan Details</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Feature</span>
              <span className="text-white font-semibold">Gem Advise Scan</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Channels Scanned</span>
              <span className="text-white font-semibold">All Tracked (12)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cost</span>
              <span className="text-purple-300 font-semibold">10,000 AGNTCBRO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Burn Effect</span>
              <span className="text-green-400 font-semibold">Reduces Supply ✓</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tier Access</span>
              <span className="text-white font-semibold">Holder (10K+)</span>
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
