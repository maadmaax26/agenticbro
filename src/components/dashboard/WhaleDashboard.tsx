import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowLeft, TrendingUp, MessageSquare, Sliders, BarChart2, DollarSign, Vote, Star, Eye, Clock, RefreshCw } from 'lucide-react';
import WhaleChat from './WhaleChat';

type ActiveTab = 'overview' | 'chat' | 'signals' | 'risk' | 'strategy' | 'governance';

interface WhaleDashboardProps {
  onBack?: () => void;
  whaleTierUnlocked: boolean;
  balance: number;
  usdValue: number;
}

export default function WhaleDashboard({ onBack, whaleTierUnlocked, balance, usdValue }: WhaleDashboardProps) {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  if (!connected || !publicKey) return null;

  if (!whaleTierUnlocked) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-8 text-center">
          <div className="text-6xl mb-4">🐋</div>
          <h2 className="text-2xl font-bold text-white mb-4">Whale Tier Access Required</h2>
          <p className="text-gray-300 mb-6">
            Your AGNTCBRO holdings need to reach the $1,000 USD threshold to unlock Whale Tier.
          </p>
          <div className="bg-cyan-900/30 rounded-xl p-6 mb-6 border border-cyan-500/20">
            <p className="text-sm text-gray-400 mb-2">Current Balance</p>
            <p className="text-2xl font-bold text-cyan-300">
              {balance.toLocaleString()} AGNTCBRO
            </p>
            {usdValue > 0 && (
              <p className="text-sm text-gray-500 mt-1">≈ ${usdValue.toFixed(2)} USD</p>
            )}
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 mx-auto px-3 py-1 rounded-md border text-xs font-semibold transition-all hover:brightness-125"
              style={{ background: 'rgba(6,182,212,0.2)', borderColor: 'rgba(6,182,212,0.5)', color: '#67e8f9' }}
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mt-6 px-4">
      {/* Header card */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/25 p-6 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 mb-4 px-3 py-1 rounded-md border text-xs font-semibold transition-all hover:brightness-125"
            style={{ background: 'rgba(6,182,212,0.2)', borderColor: 'rgba(6,182,212,0.5)', color: '#67e8f9' }}
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Home
          </button>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">🐋 Whale Tier Dashboard</h1>
            <p className="text-gray-400">
              Maximum intelligence, zero delay — built for serious capital.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">Your Balance</p>
            <p className="text-2xl font-bold text-cyan-300">
              {balance.toLocaleString()} AGNTCBRO
            </p>
            {usdValue > 0 && (
              <p className="text-xs text-gray-500">≈ ${usdValue.toFixed(2)} USD</p>
            )}
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'overview',    label: 'Overview',    icon: <Star className="w-4 h-4" /> },
            { id: 'chat',        label: 'Whale Chat',  icon: <MessageSquare className="w-4 h-4" /> },
            { id: 'signals',     label: 'Signals',     icon: <TrendingUp className="w-4 h-4" /> },
            { id: 'risk',        label: 'Risk',        icon: <BarChart2 className="w-4 h-4" /> },
            { id: 'strategy',    label: 'Strategy',    icon: <Sliders className="w-4 h-4" /> },
            { id: 'governance',  label: 'Governance',  icon: <Vote className="w-4 h-4" /> },
          ] as { id: ActiveTab; label: string; icon: React.ReactNode }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'bg-black/30 text-gray-400 hover:bg-black/50'
              }`}
              style={activeTab === tab.id
                ? { background: 'rgba(6,182,212,0.35)', border: '1px solid rgba(6,182,212,0.6)' }
                : {}}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview'   && <WhaleOverview />}
      {activeTab === 'chat'       && <WhaleChat />}
      {activeTab === 'signals'    && <WhaleSignals />}
      {activeTab === 'risk'       && <WhaleRisk />}
      {activeTab === 'strategy'   && <WhaleStrategy />}
      {activeTab === 'governance' && <WhaleGovernance />}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

const WHALE_FEATURES = [
  { icon: '⚡', title: 'Real-Time Signals',       badge: 'Zero delay',    badgeColor: 'rgba(6,182,212,0.2)',  badgeBorder: 'rgba(6,182,212,0.6)',  badgeText: '#67e8f9',  desc: 'Execution-grade triggers with zero delay — arrive before the crowd.' },
  { icon: '🤖', title: 'Whale Chat',              badge: 'AI sub-agent',  badgeColor: 'rgba(139,92,246,0.2)', badgeBorder: 'rgba(139,92,246,0.6)', badgeText: '#c4b5fd',  desc: 'Interactive AI sub-agent trained on on-chain whale flows and macro data.' },
  { icon: '🔧', title: 'Custom Strategy Builder', badge: 'Backtest',      badgeColor: 'rgba(234,179,8,0.15)', badgeBorder: 'rgba(234,179,8,0.5)',  badgeText: '#facc15',  desc: 'Define your own signal rules and backtest them against full historical data.' },
  { icon: '🌡', title: 'Risk Dashboard',          badge: 'Live',          badgeColor: 'rgba(239,68,68,0.15)', badgeBorder: 'rgba(239,68,68,0.5)',  badgeText: '#f87171',  desc: 'Portfolio heat maps, liquidation cascade alerts, and cross-asset correlation breakdowns.' },
{ icon: '💰', title: 'Revenue Share',            badge: '10% monthly',   badgeColor: 'rgba(34,197,94,0.15)', badgeBorder: 'rgba(34,197,94,0.5)',  badgeText: '#4ade80',  desc: '10% of all platform fees distributed monthly to Whale Tier holders, pro-rata by balance.' },
  { icon: '🗳',  title: 'Governance Rights',        badge: 'On-chain vote', badgeColor: 'rgba(234,179,8,0.15)', badgeBorder: 'rgba(234,179,8,0.5)',  badgeText: '#facc15',  desc: 'Vote on new features, asset additions, and signal parameters. Your holdings = your weight.' },
  { icon: '🤝', title: 'White Glove Onboarding',  badge: '1:1 setup',     badgeColor: 'rgba(139,92,246,0.2)', badgeBorder: 'rgba(139,92,246,0.6)', badgeText: '#c4b5fd',  desc: '1:1 setup call with the team + custom alert configuration tailored to your strategy.' },
  { icon: '👁',  title: 'Unlimited Watchlist',      badge: 'All assets',    badgeColor: 'rgba(6,182,212,0.2)',  badgeBorder: 'rgba(6,182,212,0.6)',  badgeText: '#67e8f9',  desc: 'Track every supported asset simultaneously with no cap.' },
  { icon: '📜', title: 'Signal History',           badge: 'Full access',   badgeColor: 'rgba(34,197,94,0.15)', badgeBorder: 'rgba(34,197,94,0.5)',  badgeText: '#4ade80',  desc: 'Complete historical signal archive — no time limit, full depth.' },
];

function WhaleOverview() {
  return (
    <div className="space-y-6">
      {/* Feature grid */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-5">🐋 Whale Tier Features</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {WHALE_FEATURES.map(f => (
            <div
              key={f.title}
              className="flex gap-4 rounded-xl p-4 border"
              style={{ background: 'rgba(6,182,212,0.05)', borderColor: 'rgba(6,182,212,0.18)' }}
            >
              <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-white text-sm">{f.title}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-semibold"
                    style={{ background: f.badgeColor, border: `1px solid ${f.badgeBorder}`, color: f.badgeText }}
                  >
                    {f.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid md:grid-cols-4 gap-4">
        <WhaleStatCard label="Signal Delay"     value="Real-time"  icon={<TrendingUp className="w-5 h-5" />} />
        <WhaleStatCard label="Watchlist"         value="Unlimited"  icon={<Eye className="w-5 h-5" />} />
        <WhaleStatCard label="Signal History"    value="Full"       icon={<Clock className="w-5 h-5" />} />
        <WhaleStatCard label="Revenue Share"     value="10%/mo"     icon={<DollarSign className="w-5 h-5" />} />
      </div>

      {/* Pay-per-use table */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Pay-Per-Use Add-ons</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyan-500/20">
                <th className="text-left py-2 text-gray-400">Feature</th>
                <th className="text-right py-2 text-gray-400">Cost (USD)</th>
                <th className="text-right py-2 text-gray-400">AGNTCBRO Burned</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                { label: 'Additional Signals',    usd: '$0.05', tokens: '5,000'  },
                { label: 'AI Insights',           usd: '$0.10', tokens: '10,000' },
                { label: 'Market Analysis',       usd: '$0.05', tokens: '5,000'  },
                { label: 'Custom Backtest Runs',  usd: '$0.20', tokens: '20,000' },
              ].map((row, i, arr) => (
                <tr key={row.label} className={i < arr.length - 1 ? 'border-b border-cyan-500/10' : ''}>
                  <td className="py-2.5">{row.label}</td>
                  <td className="text-right text-cyan-300 font-semibold">{row.usd}</td>
                  <td className="text-right">{row.tokens} AGNTCBRO</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-3">All add-on payments burn AGNTCBRO, reducing supply.</p>
      </div>

      {/* Revenue share callout */}
      <div
        className="rounded-2xl border p-5 flex items-start gap-4"
        style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.22)' }}
      >
        <span className="text-3xl flex-shrink-0">💰</span>
        <div>
          <p className="font-bold text-white text-sm mb-0.5">Revenue Share — 10% Monthly</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            10% of all platform fees are distributed to Whale Tier holders every month, pro-rata based on your AGNTCBRO balance.
            Distributions are paid directly to your connected wallet in SOL or USDC.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Signals tab ──────────────────────────────────────────────────────────────

const LIVE_SIGNAL_POOL = [
  { id: '1', asset: 'BTC',  emoji: '₿',  direction: 'LONG'  as const, strength: 'Strong'   as const, cgId: 'bitcoin'     },
  { id: '2', asset: 'SOL',  emoji: '◎',  direction: 'LONG'  as const, strength: 'Strong'   as const, cgId: 'solana'      },
  { id: '3', asset: 'ETH',  emoji: 'Ξ',  direction: 'SHORT' as const, strength: 'Moderate' as const, cgId: 'ethereum'    },
  { id: '4', asset: 'BNB',  emoji: '🟡', direction: 'LONG'  as const, strength: 'Moderate' as const, cgId: 'binancecoin' },
  { id: '5', asset: 'XRP',  emoji: '✕',  direction: 'SHORT' as const, strength: 'Strong'   as const, cgId: 'ripple'      },
  { id: '6', asset: 'DOGE', emoji: '🐕', direction: 'LONG'  as const, strength: 'Weak'     as const, cgId: 'dogecoin'    },
];

function WhaleSignals() {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPrices() {
    setLoading(true);
    try {
      const ids = LIVE_SIGNAL_POOL.map(s => s.cgId).join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error('non-ok');
      const json = await res.json();
      const map: Record<string, string> = {};
      LIVE_SIGNAL_POOL.forEach(s => {
        const p: number | undefined = json[s.cgId]?.usd;
        map[s.asset] = p !== undefined
          ? p >= 1000 ? `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            : p >= 1 ? `$${p.toFixed(2)}`
            : `$${p.toFixed(5)}`
          : '—';
      });
      setPrices(map);
      setLastUpdated(new Date());
    } catch {
      /* keep stale prices on error */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            ⚡ Live Signal Feed
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.4)' }}>
              🟢 REAL-TIME
            </span>
            <button
              onClick={loadPrices}
              className="p-1.5 rounded border text-gray-400 hover:text-white transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
              title="Refresh prices"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Signal rows */}
        <div className="space-y-2">
          {LIVE_SIGNAL_POOL.map(sig => (
            <div
              key={sig.id}
              className="flex items-center justify-between rounded-xl px-4 py-2.5 border"
              style={{
                background: sig.direction === 'LONG' ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                borderColor: sig.direction === 'LONG' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">{sig.emoji}</span>
                <span className="font-bold text-white text-sm">{sig.asset}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{
                    background: sig.direction === 'LONG' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    color: sig.direction === 'LONG' ? '#4ade80' : '#f87171',
                  }}
                >
                  {sig.direction}
                </span>
                <span className="text-xs text-gray-500">{sig.strength}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-mono font-semibold ${loading && !prices[sig.asset] ? 'text-gray-600' : 'text-white'}`}>
                  {loading && !prices[sig.asset] ? '…' : (prices[sig.asset] ?? '—')}
                </span>
                <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                  Live
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-700 mt-3 text-center">
          Prices via CoinGecko · refreshes every 30s
          {lastUpdated && ` · last updated ${lastUpdated.toLocaleTimeString()}`}
        </p>
      </div>
    </div>
  );
}

// ─── Risk tab ─────────────────────────────────────────────────────────────────

interface FundingRate {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
}

interface LiquidationSummary {
  symbol: string;
  longLiqUsd: number;
  shortLiqUsd: number;
}

// ─── Liq cluster types (mirrored from server) ──────────────────────────────

interface LiqClusterEntry {
  priceMid:   number;
  longUsd:    number;
  shortUsd:   number;
  totalUsd:   number;
  intensity:  number;
  source:     'historical' | 'estimated';
  label?:     string;
  side?:      'long' | 'short';
}

interface BTCLiqData {
  currentPrice: number;
  clusters:     LiqClusterEntry[];
  estimated:    LiqClusterEntry[];
  fetchedAt:    number;
}

// ─── BTC Liq Heatmap component ─────────────────────────────────────────────

function BTCLiqHeatmap({ data, loading }: { data: BTCLiqData | null; loading: boolean }) {
  if (loading && !data) {
    return <div className="text-center py-8 text-gray-600 text-sm">Loading liquidation clusters…</div>;
  }
  if (!data) return null;

  const { currentPrice, clusters, estimated } = data;

  // Combine historical + estimated for a unified price-sorted view
  // Keep only entries within ±15% of current price
  const RANGE = 0.15;
  const lo = currentPrice * (1 - RANGE);
  const hi = currentPrice * (1 + RANGE);

  const hist = clusters
    .filter(c => c.priceMid >= lo && c.priceMid <= hi && c.totalUsd > 0)
    .sort((a, b) => b.priceMid - a.priceMid);   // descending: highest price first

  // For estimated, show top 3 long zones (below) + top 3 short zones (above)
  const estLong = estimated
    .filter(e => e.side === 'long'  && e.priceMid >= lo && e.priceMid < currentPrice)
    .sort((a, b) => b.priceMid - a.priceMid)
    .slice(0, 4);
  const estShort = estimated
    .filter(e => e.side === 'short' && e.priceMid > currentPrice && e.priceMid <= hi)
    .sort((a, b) => a.priceMid - b.priceMid)
    .slice(0, 4);

  const maxHist = hist.reduce((m, c) => Math.max(m, c.totalUsd), 1);
  const fmtK = (v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : `$${(v/1_000).toFixed(0)}K`;
  const fmtP = (p: number) => p >= 1000 ? `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${p.toFixed(2)}`;

  // Render a single heat row
  function HeatRow({
    priceMid, longUsd, shortUsd, totalUsd, intensity, isCurrentPrice = false, label, source, side,
  }: LiqClusterEntry & { isCurrentPrice?: boolean }) {
    const isBelowCurrent = priceMid < currentPrice;
    const pctOff = ((priceMid - currentPrice) / currentPrice * 100);
    const pctStr = `${pctOff >= 0 ? '+' : ''}${pctOff.toFixed(1)}%`;
    const barWidth = `${Math.max((intensity || totalUsd / maxHist) * 100, 2)}%`;

    const isEst = source === 'estimated';
    const domSide  = longUsd > shortUsd ? 'long' : 'short';
    // Color: red = long-dominant zone (longs get rekt if price drops here)
    //        green = short-dominant zone (shorts get rekt if price rises here)
    const heatColor = isEst
      ? side === 'long'
        ? 'rgba(239,68,68,0.55)'
        : 'rgba(34,197,94,0.55)'
      : domSide === 'long'
        ? `rgba(239,68,68,${0.25 + intensity * 0.6})`
        : `rgba(34,197,94,${0.25 + intensity * 0.6})`;

    return (
      <div
        className={`flex items-center gap-2 rounded px-2 py-1 relative overflow-hidden ${
          isCurrentPrice ? 'ring-1 ring-cyan-400/60' : ''
        }`}
        style={{
          background: isCurrentPrice
            ? 'rgba(6,182,212,0.12)'
            : isBelowCurrent ? 'rgba(239,68,68,0.04)' : 'rgba(34,197,94,0.04)',
          border: isCurrentPrice
            ? '1px solid rgba(6,182,212,0.4)'
            : '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Heat bar in background */}
        {!isCurrentPrice && (
          <div
            className="absolute left-0 top-0 h-full rounded opacity-30"
            style={{ width: barWidth, background: heatColor }}
          />
        )}

        {/* Price */}
        <span className={`relative z-10 font-mono text-xs w-24 flex-shrink-0 ${
          isCurrentPrice ? 'font-bold text-cyan-300' : 'text-gray-400'
        }`}>
          {isCurrentPrice ? '▶ ' : ''}{fmtP(priceMid)}
        </span>

        {/* Pct offset */}
        <span className={`relative z-10 text-xs font-mono w-12 flex-shrink-0 ${
          isCurrentPrice ? 'text-cyan-400' : pctOff < 0 ? 'text-red-400' : 'text-green-400'
        }`}>
          {isCurrentPrice ? 'NOW' : pctStr}
        </span>

        {/* Label / liq info */}
        <span className="relative z-10 text-xs text-gray-500 flex-1 truncate">
          {isCurrentPrice
            ? 'Current Mark Price'
            : isEst
              ? `${label} liq zone  ${fmtK(totalUsd)}`
              : `Actual liq  ${fmtK(totalUsd)}  (L:${fmtK(longUsd)} S:${fmtK(shortUsd)})`
          }
        </span>

        {/* Source badge */}
        {!isCurrentPrice && (
          <span className={`relative z-10 text-xs px-1 py-0.5 rounded flex-shrink-0 ${
            isEst
              ? 'text-yellow-500 bg-yellow-500/10 border border-yellow-500/20'
              : 'text-purple-400 bg-purple-500/10 border border-purple-500/20'
          }`}>
            {isEst ? 'est' : 'real'}
          </span>
        )}
      </div>
    );
  }

  // Build unified sorted list: short est above, hist rows, current price, hist rows, long est below
  const aboveHist = hist.filter(c => c.priceMid > currentPrice);
  const belowHist = hist.filter(c => c.priceMid < currentPrice);

  return (
    <div className="space-y-1">
      {/* Short estimated zones (above current price) */}
      {estShort.slice().reverse().map(e => (
        <HeatRow key={`est-s-${e.priceMid}`} {...e} />
      ))}

      {/* Historical rows above */}
      {aboveHist.map(c => (
        <HeatRow key={`hist-${c.priceMid}`} {...c} />
      ))}

      {/* Current price marker */}
      <HeatRow
        priceMid={currentPrice} longUsd={0} shortUsd={0} totalUsd={0}
        intensity={0} source="historical" isCurrentPrice
      />

      {/* Historical rows below */}
      {belowHist.map(c => (
        <HeatRow key={`hist-${c.priceMid}`} {...c} />
      ))}

      {/* Long estimated zones (below current price) */}
      {estLong.map(e => (
        <HeatRow key={`est-l-${e.priceMid}`} {...e} />
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-white/5 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-500/60 inline-block" />
          Long liq zone (price drops here)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-green-500/60 inline-block" />
          Short liq zone (price rises here)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block px-1 rounded text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 text-xs">est</span>
          Model estimate
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block px-1 rounded text-purple-400 bg-purple-500/10 border border-purple-500/20 text-xs">real</span>
          Binance forceOrders
        </span>
      </div>
    </div>
  );
}

function WhaleRisk() {
  const [funding, setFunding] = useState<FundingRate[]>([]);
  const [liquidations, setLiquidations] = useState<LiquidationSummary[]>([]);
  const [btcLiq, setBtcLiq] = useState<BTCLiqData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liqLoading, setLiqLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fundRes, liqRes] = await Promise.all([
        fetch('/api/market/funding',      { signal: AbortSignal.timeout(10_000) }),
        fetch('/api/market/liquidations', { signal: AbortSignal.timeout(10_000) }),
      ]);

      if (fundRes.ok) {
        const d = await fundRes.json() as { funding: FundingRate[] };
        setFunding(d.funding ?? []);
      }
      if (liqRes.ok) {
        const d = await liqRes.json() as { liquidations: LiquidationSummary[] };
        setLiquidations(d.liquidations ?? []);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError('Could not reach proxy server — is npm run dev running?');
      console.error('[WhaleRisk]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Liq clusters load separately — they take longer and have their own loading state
  const loadLiqClusters = useCallback(async () => {
    setLiqLoading(true);
    try {
      const res = await fetch('/api/market/liq-clusters', { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const d = await res.json() as BTCLiqData;
        setBtcLiq(d);
      }
    } catch (err) {
      console.error('[WhaleRisk liq-clusters]', err);
    } finally {
      setLiqLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadLiqClusters();
    const iv1 = setInterval(loadData,        30_000);
    const iv2 = setInterval(loadLiqClusters, 60_000);   // clusters refresh every 60s
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [loadData, loadLiqClusters]);

  function fundingColor(rate: number): string {
    if (rate > 0.05)  return '#f87171'; // very positive = crowded longs (bearish signal)
    if (rate > 0.01)  return '#fb923c';
    if (rate < -0.05) return '#4ade80'; // very negative = crowded shorts (bullish signal)
    if (rate < -0.01) return '#86efac';
    return '#94a3b8'; // neutral
  }

  function fundingLabel(rate: number): string {
    if (rate > 0.05)  return 'Crowded Long ⚠️';
    if (rate > 0.01)  return 'Bullish Bias';
    if (rate < -0.05) return 'Crowded Short ⚠️';
    if (rate < -0.01) return 'Bearish Bias';
    return 'Neutral';
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🌡 Risk Dashboard
        </h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-600">
              updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded border text-gray-400 hover:text-white transition-all disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Funding Rates */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span>⚡</span> Funding Rates
          <span className="text-xs text-gray-600 font-normal ml-1">(positive = longs pay shorts)</span>
        </h3>
        {loading && funding.length === 0 ? (
          <div className="text-center py-6 text-gray-600 text-sm">Loading…</div>
        ) : (
          <div className="space-y-2">
            {(funding.length > 0 ? funding : [
              { symbol: 'BTC', fundingRate: 0, nextFundingTime: 0 },
              { symbol: 'ETH', fundingRate: 0, nextFundingTime: 0 },
              { symbol: 'SOL', fundingRate: 0, nextFundingTime: 0 },
            ]).map(f => (
              <div
                key={f.symbol}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 border"
                style={{ background: 'rgba(6,182,212,0.04)', borderColor: 'rgba(6,182,212,0.15)' }}
              >
                <span className="font-bold text-white text-sm w-12">{f.symbol}</span>
                <div className="flex-1 mx-4">
                  {/* Bar */}
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(Math.abs(f.fundingRate) * 500, 100)}%`,
                        background: fundingColor(f.fundingRate),
                        marginLeft: f.fundingRate < 0 ? 'auto' : undefined,
                      }}
                    />
                  </div>
                </div>
                <span
                  className="text-sm font-mono font-semibold w-16 text-right"
                  style={{ color: fundingColor(f.fundingRate) }}
                >
                  {f.fundingRate > 0 ? '+' : ''}{f.fundingRate.toFixed(4)}%
                </span>
                <span className="text-xs text-gray-600 w-32 text-right">
                  {fundingLabel(f.fundingRate)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liquidation Levels */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span>💥</span> Estimated 24h Liquidation Exposure
          <span className="text-xs text-gray-600 font-normal ml-1">(via open interest proxy)</span>
        </h3>
        {loading && liquidations.length === 0 ? (
          <div className="text-center py-6 text-gray-600 text-sm">Loading…</div>
        ) : (
          <div className="space-y-2">
            {(liquidations.length > 0 ? liquidations : []).map(liq => {
              const total = liq.longLiqUsd + liq.shortLiqUsd;
              const longPct = total > 0 ? (liq.longLiqUsd / total) * 100 : 50;
              return (
                <div key={liq.symbol}
                  className="rounded-xl px-4 py-3 border"
                  style={{ background: 'rgba(6,182,212,0.04)', borderColor: 'rgba(6,182,212,0.15)' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-sm">{liq.symbol}</span>
                    <span className="text-xs text-gray-500">
                      Total ≈ ${(total / 1_000_000).toFixed(1)}M
                    </span>
                  </div>
                  {/* Stacked bar: green=longs, red=shorts */}
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${longPct}%`, background: 'rgba(239,68,68,0.7)' }} />
                    <div className="h-full flex-1" style={{ background: 'rgba(34,197,94,0.7)' }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs">
                    <span className="text-red-400">Longs ${(liq.longLiqUsd / 1_000_000).toFixed(1)}M</span>
                    <span className="text-green-400">Shorts ${(liq.shortLiqUsd / 1_000_000).toFixed(1)}M</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-700 mt-3">
          Estimates based on open interest. Actual liquidation cascades depend on market structure.
        </p>
      </div>

      {/* BTC Liquidation Heatmap */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <span>🌡</span> BTC Liquidation Cluster Heatmap
            <span className="text-xs text-gray-600 font-normal ml-1">(±15% from mark price)</span>
          </h3>
          <div className="flex items-center gap-2">
            {btcLiq && (
              <span className="text-xs text-gray-600">
                {new Date(btcLiq.fetchedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={loadLiqClusters}
              disabled={liqLoading}
              className="p-1.5 rounded border text-gray-400 hover:text-white transition-all disabled:opacity-40"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
              title="Refresh clusters"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${liqLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {btcLiq && (
          <div className="flex items-center gap-3 mb-3 p-2 rounded-lg border border-cyan-500/20 bg-cyan-500/05">
            <span className="text-xs text-gray-500">Mark price:</span>
            <span className="text-sm font-bold text-cyan-300 font-mono">
              ${btcLiq.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-500">
              {btcLiq.clusters.length} historical buckets · {btcLiq.estimated.length} estimated zones
            </span>
          </div>
        )}

        <BTCLiqHeatmap data={btcLiq} loading={liqLoading} />

        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-gray-700">
            Historical: Binance forceOrders (last 1000 liquidations) · Estimated: OI × leverage model
          </p>
          <button
            onClick={() => {
              const event = new CustomEvent('whale-chat-prefill', {
                detail: { message: 'Analyze the BTC liquidation cluster heatmap — which price levels have the largest liquidation zones and what does this mean for the next move?' },
              });
              window.dispatchEvent(event);
            }}
            className="flex-shrink-0 ml-4 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-125"
            style={{ background: 'rgba(6,182,212,0.2)', border: '1px solid rgba(6,182,212,0.4)', color: '#67e8f9' }}
          >
            Ask Whale Chat
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Strategy tab ─────────────────────────────────────────────────────────────

interface OrderbookLevel {
  price: number;
  qty: number;
}

interface Orderbook {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

function WhaleStrategy() {
  const [symbol, setSymbol] = useState('BTC');
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrderbook = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market/orderbook/${sym}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Orderbook;
      setOrderbook(data);
    } catch (err) {
      setError('Could not reach proxy server — is npm run dev running?');
      console.error('[WhaleStrategy]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrderbook(symbol);
    const iv = setInterval(() => loadOrderbook(symbol), 30_000);
    return () => clearInterval(iv);
  }, [symbol, loadOrderbook]);

  const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'];

  // Find max qty for bar scaling
  const allLevels = orderbook ? [...orderbook.bids, ...orderbook.asks] : [];
  const maxQty = allLevels.reduce((m, l) => Math.max(m, l.qty), 0) || 1;

  // Cumulative bid/ask value (rough spread and wall detection)
  const bidTotal = orderbook?.bids.reduce((s, l) => s + l.price * l.qty, 0) ?? 0;
  const askTotal = orderbook?.asks.reduce((s, l) => s + l.price * l.qty, 0) ?? 0;
  const bidAskRatio = bidTotal + askTotal > 0
    ? (bidTotal / (bidTotal + askTotal) * 100).toFixed(1)
    : '—';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🔧 Orderbook Depth
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {SYMBOLS.map(s => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  symbol === s ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                style={symbol === s
                  ? { background: 'rgba(6,182,212,0.3)', border: '1px solid rgba(6,182,212,0.6)' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadOrderbook(symbol)}
            disabled={loading}
            className="p-1.5 rounded border text-gray-400 hover:text-white transition-all disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Bid/Ask summary */}
      {orderbook && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-black/40 rounded-xl border border-green-500/20 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Bid Volume</p>
            <p className="text-lg font-bold text-green-400">
              ${(bidTotal / 1_000_000).toFixed(2)}M
            </p>
          </div>
          <div className="bg-black/40 rounded-xl border border-cyan-500/20 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Buy Pressure</p>
            <p className="text-lg font-bold text-cyan-300">
              {bidAskRatio}%
            </p>
          </div>
          <div className="bg-black/40 rounded-xl border border-red-500/20 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Ask Volume</p>
            <p className="text-lg font-bold text-red-400">
              ${(askTotal / 1_000_000).toFixed(2)}M
            </p>
          </div>
        </div>
      )}

      {/* Orderbook visualization */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-5">
        {loading && !orderbook ? (
          <div className="text-center py-12 text-gray-600">Loading orderbook…</div>
        ) : orderbook ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Bids */}
            <div>
              <p className="text-xs font-semibold text-green-400 mb-2">BIDS</p>
              <div className="space-y-1">
                {orderbook.bids.slice(0, 15).map((level, i) => (
                  <div key={i} className="flex items-center gap-2 relative">
                    <div
                      className="absolute left-0 top-0 h-full rounded"
                      style={{
                        width: `${(level.qty / maxQty) * 100}%`,
                        background: 'rgba(34,197,94,0.12)',
                      }}
                    />
                    <span className="relative text-xs text-green-400 font-mono w-24 text-right">
                      ${level.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="relative text-xs text-gray-500 font-mono">
                      {level.qty.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Asks */}
            <div>
              <p className="text-xs font-semibold text-red-400 mb-2">ASKS</p>
              <div className="space-y-1">
                {orderbook.asks.slice(0, 15).map((level, i) => (
                  <div key={i} className="flex items-center gap-2 relative">
                    <div
                      className="absolute left-0 top-0 h-full rounded"
                      style={{
                        width: `${(level.qty / maxQty) * 100}%`,
                        background: 'rgba(239,68,68,0.12)',
                      }}
                    />
                    <span className="relative text-xs text-red-400 font-mono w-24 text-right">
                      ${level.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="relative text-xs text-gray-500 font-mono">
                      {level.qty.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {orderbook && (
          <p className="text-xs text-gray-700 mt-3 text-center">
            {symbol}/USDT · Binance · top 15 levels · refreshes every 30s
          </p>
        )}
      </div>

      {/* Ask Whale Chat CTA */}
      <div
        className="rounded-2xl border p-5 flex items-center justify-between"
        style={{ background: 'rgba(6,182,212,0.05)', borderColor: 'rgba(6,182,212,0.2)' }}
      >
        <div>
          <p className="font-semibold text-white text-sm mb-0.5">Need a deeper read?</p>
          <p className="text-xs text-gray-400">
            Ask the Whale Chat agent to analyze this orderbook and suggest trade setups.
          </p>
        </div>
        <button
          onClick={() => {
            // Pre-fill message is handled via a custom event; fallback to tab switch
            const event = new CustomEvent('whale-chat-prefill', {
              detail: { message: `Analyze the ${symbol} orderbook depth and suggest the best trade setup right now` },
            });
            window.dispatchEvent(event);
          }}
          className="flex-shrink-0 ml-4 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-125"
          style={{ background: 'rgba(6,182,212,0.25)', border: '1px solid rgba(6,182,212,0.5)', color: '#67e8f9' }}
        >
          Ask Whale Chat
        </button>
      </div>
    </div>
  );
}

// ─── Governance tab ───────────────────────────────────────────────────────────

function WhaleGovernance() {
  return (
    <div className="space-y-4">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Vote className="w-5 h-5 text-cyan-400" />
          Governance
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Your AGNTCBRO balance determines your voting weight. Proposals go live each month — whale holders shape the roadmap.
        </p>

        {/* Open proposals (placeholder) */}
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Open Proposals</h3>
        <div className="space-y-3">
          {[
            { title: 'Add PENGU to signal feed',          votes: '64%', closes: '3 days' },
            { title: 'Increase revenue share to 15%',     votes: '41%', closes: '5 days' },
            { title: 'Launch Telegram alert bot (Phase 1)', votes: '78%', closes: '1 day'  },
          ].map(p => (
            <div
              key={p.title}
              className="flex items-center justify-between rounded-xl px-4 py-3 border"
              style={{ background: 'rgba(6,182,212,0.05)', borderColor: 'rgba(6,182,212,0.18)' }}
            >
              <div>
                <p className="text-sm font-semibold text-white">{p.title}</p>
                <p className="text-xs text-gray-500">Closes in {p.closes}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-cyan-300">{p.votes} Yes</p>
                <button
                  className="text-xs px-2 py-0.5 rounded border mt-1 transition-all hover:brightness-125"
                  style={{ background: 'rgba(6,182,212,0.2)', borderColor: 'rgba(6,182,212,0.5)', color: '#67e8f9' }}
                >
                  Vote
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-4">On-chain voting via Realms — integration in progress.</p>
      </div>

    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function WhaleStatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ background: 'rgba(6,182,212,0.07)', borderColor: 'rgba(6,182,212,0.2)' }}
    >
      <div className="text-cyan-400">{icon}</div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold text-cyan-300">{value}</p>
    </div>
  );
}
