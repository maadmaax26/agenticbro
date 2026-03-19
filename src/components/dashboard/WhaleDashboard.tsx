import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowLeft, TrendingUp, MessageSquare, Sliders, BarChart2, Users, DollarSign, Vote, Star, Eye, Clock } from 'lucide-react';
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
  { icon: '💬', title: 'Whale Chat Access',        badge: 'Private',       badgeColor: 'rgba(6,182,212,0.2)',  badgeBorder: 'rgba(6,182,212,0.6)',  badgeText: '#67e8f9',  desc: 'Private Discord channel with direct access to the core team and co-whales.' },
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

function WhaleRisk() {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-8 text-center">
      <div className="text-5xl mb-4">🌡</div>
      <h3 className="text-xl font-bold text-white mb-2">Risk Dashboard</h3>
      <p className="text-gray-400 text-sm mb-4">Portfolio heat maps, liquidation cascades & correlation breakdowns — coming soon.</p>
      <span className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
        In Development
      </span>
    </div>
  );
}

// ─── Strategy tab ─────────────────────────────────────────────────────────────

function WhaleStrategy() {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-8 text-center">
      <div className="text-5xl mb-4">🔧</div>
      <h3 className="text-xl font-bold text-white mb-2">Custom Strategy Builder</h3>
      <p className="text-gray-400 text-sm mb-4">Define rules, backtest against historical data, deploy alerts — coming soon.</p>
      <span className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)', color: '#facc15' }}>
        In Development
      </span>
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

      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/20 p-5 flex items-start gap-4"
        style={{ background: 'rgba(6,182,212,0.05)' }}>
        <Users className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-white text-sm mb-0.5">Whale Chat — Private Discord</p>
          <p className="text-xs text-gray-400 mb-3">
            Exclusive channel with direct team access, co-whale alpha sharing, and early feature previews.
          </p>
          <a
            href="https://discord.gg/agenticbro"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all hover:brightness-125"
            style={{ background: 'rgba(88,101,242,0.3)', border: '1px solid rgba(88,101,242,0.6)', color: '#a5b4fc' }}
          >
            <MessageSquare className="w-3 h-3" />
            Join Whale Discord
          </a>
        </div>
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
