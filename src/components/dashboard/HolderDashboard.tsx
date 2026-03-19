import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTokenGating } from '../../hooks/useTokenGating';
import HolderSignalFeed from './HolderSignalFeed';
import HolderAIInsights from './HolderAIInsights';
import HolderMarketAnalysis from './HolderMarketAnalysis';
import HolderUsageHistory from './HolderUsageHistory';
import HolderSettings from './HolderSettings';
import { TrendingUp, Zap, Activity, Settings, ArrowLeft } from 'lucide-react';

type ActiveTab = 'dashboard' | 'signals' | 'insights' | 'analysis' | 'history' | 'settings';

export default function HolderDashboard({ onBack }: { onBack?: () => void }) {
  const { connected, publicKey } = useWallet();
  const { holderTierUnlocked, balance } = useTokenGating();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  if (!connected || !publicKey) {
    return null;
  }

  // Check if user has holder tier access (10K+ AGNTCBRO)
  if (!holderTierUnlocked) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-4">Holder Tier Access Required</h2>
          <p className="text-gray-300 mb-6">
            You need at least 10,000 AGNTCBRO tokens to access the Holder Tier dashboard.
          </p>
          <div className="bg-purple-900/40 rounded-xl p-6 mb-6">
            <p className="text-sm text-gray-400 mb-2">Current Balance</p>
            <p className="text-2xl font-bold text-purple-300">
              {balance.toLocaleString()} AGNTCBRO
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <p className="mb-2">Holder Tier includes:</p>
            <ul className="text-left max-w-sm mx-auto space-y-1">
              <li>• 25 monthly trading signals</li>
              <li>• 5 AI-powered market insights</li>
              <li>• 10 market analysis requests</li>
              <li>• Portfolio health & risk assessment</li>
              <li>• Daily market reports</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mt-6">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6 mb-6">
        {/* Back button row */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 mb-4 px-3 py-1 rounded-md border text-xs font-semibold transition-all hover:brightness-125"
            style={{ background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.5)', color: '#c4b5fd' }}
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Home
          </button>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">💰 Holder Tier Dashboard</h1>
            <p className="text-gray-400">
              You have access to premium trading intelligence — features cost tokens to use
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">Your Balance</p>
            <p className="text-2xl font-bold text-purple-300">
              {balance.toLocaleString()} AGNTCBRO
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          <TabButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={<TrendingUp />}
            label="Dashboard"
          />
          <TabButton
            active={activeTab === 'signals'}
            onClick={() => setActiveTab('signals')}
            icon={<Zap />}
            label="Signals"
          />
          <TabButton
            active={activeTab === 'insights'}
            onClick={() => setActiveTab('insights')}
            icon={<Activity />}
            label="AI Insights"
          />
          <TabButton
            active={activeTab === 'analysis'}
            onClick={() => setActiveTab('analysis')}
            icon={<TrendingUp />}
            label="Market Analysis"
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            icon={<Activity />}
            label="Usage History"
          />
          <TabButton
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            icon={<Settings />}
            label="Settings"
          />
        </div>
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && <DashboardOverview />}
      {activeTab === 'signals' && <HolderSignalFeed />}
      {activeTab === 'insights' && <HolderAIInsights />}
      {activeTab === 'analysis' && <HolderMarketAnalysis />}
      {activeTab === 'history' && <HolderUsageHistory />}
      {activeTab === 'settings' && <HolderSettings />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
        active
          ? 'bg-purple-600 text-white'
          : 'bg-black/30 text-gray-400 hover:bg-black/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const HOLDER_FEATURES = [
  {
    icon: '⚡',
    title: 'Early Signal Access',
    desc: '15-min delayed signals — twice as fast as the free 30-min feed.',
    badge: '15-min delay',
    badgeColor: 'rgba(139,92,246,0.25)',
    badgeBorder: 'rgba(139,92,246,0.6)',
    badgeText: '#c4b5fd',
  },
  {
    icon: '🔥',
    title: 'Portfolio Roast',
    desc: 'Weekly AI deep-dive into your trading mistakes with specific, actionable lessons.',
    badge: 'Weekly',
    badgeColor: 'rgba(234,88,12,0.2)',
    badgeBorder: 'rgba(234,88,12,0.5)',
    badgeText: '#fb923c',
  },
  {
    icon: '🔔',
    title: 'Smart Alerting',
    desc: 'Custom price + sentiment alerts — e.g. "BTC funding rate spiking + whale inflows".',
    badge: 'Custom',
    badgeColor: 'rgba(6,182,212,0.2)',
    badgeBorder: 'rgba(6,182,212,0.5)',
    badgeText: '#67e8f9',
  },
  {
    icon: '🏆',
    title: 'Community Alpha',
    desc: 'Access to the holder-only Discord with curated trade ideas from top contributors.',
    badge: 'Exclusive',
    badgeColor: 'rgba(234,179,8,0.15)',
    badgeBorder: 'rgba(234,179,8,0.5)',
    badgeText: '#facc15',
  },
  {
    icon: '🔥',
    title: 'Burn Discounts',
    desc: '20% off all pay-per-use features when paying with AGNTCBRO tokens.',
    badge: '20% off',
    badgeColor: 'rgba(34,197,94,0.15)',
    badgeBorder: 'rgba(34,197,94,0.5)',
    badgeText: '#4ade80',
  },
  {
    icon: '👁',
    title: 'Multi-Asset Watchlist',
    desc: 'Track and monitor up to 15 assets simultaneously with live sentiment overlays.',
    badge: '15 assets',
    badgeColor: 'rgba(139,92,246,0.25)',
    badgeBorder: 'rgba(139,92,246,0.6)',
    badgeText: '#c4b5fd',
  },
  {
    icon: '📜',
    title: 'Signal History',
    desc: '30 days of full historical signal data — backtest ideas and spot patterns.',
    badge: '30-day history',
    badgeColor: 'rgba(6,182,212,0.2)',
    badgeBorder: 'rgba(6,182,212,0.5)',
    badgeText: '#67e8f9',
  },
];

function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* Feature cards */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-5">💰 Holder Tier Features</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {HOLDER_FEATURES.map(f => (
            <div
              key={f.title}
              className="flex gap-4 rounded-xl p-4 border"
              style={{ background: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.2)' }}
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

      {/* Quick stat summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Signal Delay" value="15 minutes" icon="⚡" />
        <StatCard label="Watchlist Assets" value="Up to 15" icon="👁" />
        <StatCard label="Signal History" value="30 days" icon="📜" />
      </div>

      {/* Burn discount callout */}
      <div
        className="rounded-2xl border p-5 flex items-center gap-4"
        style={{ background: 'rgba(34,197,94,0.07)', borderColor: 'rgba(34,197,94,0.25)' }}
      >
        <span className="text-3xl flex-shrink-0">🔥</span>
        <div>
          <p className="font-bold text-white text-sm mb-0.5">Burn Discount Active</p>
          <p className="text-xs text-gray-400">
            Pay with AGNTCBRO on any pay-per-use feature and receive <span className="text-green-400 font-semibold">20% off</span> automatically.
            Tokens are burned, reducing supply and rewarding long-term holders.
          </p>
        </div>
      </div>
    </div>
  );
}


function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-purple-500/20 p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xl font-bold text-purple-300">{value}</p>
    </div>
  );
}