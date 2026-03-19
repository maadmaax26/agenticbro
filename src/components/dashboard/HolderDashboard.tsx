import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTokenGating } from '../../hooks/useTokenGating';
import HolderSignalFeed from './HolderSignalFeed';
import HolderAIInsights from './HolderAIInsights';
import HolderMarketAnalysis from './HolderMarketAnalysis';
import HolderUsageHistory from './HolderUsageHistory';
import HolderSettings from './HolderSettings';
import { TrendingUp, Zap, Activity, Settings } from 'lucide-react';

type ActiveTab = 'dashboard' | 'signals' | 'insights' | 'analysis' | 'history' | 'settings';

export default function HolderDashboard() {
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

function DashboardOverview() {
  const [currentMonth] = useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));

  return (
    <div className="space-y-6">
      {/* Monthly Allowances */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Monthly Allowances — {currentMonth}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AllowanceCard
            title="Market Analysis"
            used={3}
            total={10}
            cost="10,000"
            icon="📊"
          />
          <AllowanceCard
            title="BTC Signals"
            used={2}
            total={5}
            cost="10,000"
            icon="₿"
          />
          <AllowanceCard
            title="ETH Signals"
            used={1}
            total={5}
            cost="10,000"
            icon="Ξ"
          />
          <AllowanceCard
            title="SOL Signals"
            used={0}
            total={5}
            cost="10,000"
            icon="◎"
          />
          <AllowanceCard
            title="AI Insights"
            used={1}
            total={5}
            cost="20,000"
            icon="🤖"
          />
          <AllowanceCard
            title="Market Impact"
            used={0}
            total={3}
            cost="10,000"
            icon="🌊"
          />
        </div>
      </div>

      {/* Top-Up Rates */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Top-Up Rates (Pay-Per-Use)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-500/20">
                <th className="text-left py-2 text-gray-400">Feature</th>
                <th className="text-right py-2 text-gray-400">Cost (USD)</th>
                <th className="text-right py-2 text-gray-400">Tokens Burned</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-purple-500/10">
                <td className="py-2">Additional Signal</td>
                <td className="text-right text-purple-300">$0.10</td>
                <td className="text-right">10,000 AGNTCBRO</td>
              </tr>
              <tr className="border-b border-purple-500/10">
                <td className="py-2">AI Insight</td>
                <td className="text-right text-purple-300">$0.20</td>
                <td className="text-right">20,000 AGNTCBRO</td>
              </tr>
              <tr>
                <td className="py-2">Market Analysis</td>
                <td className="text-right text-purple-300">$0.10</td>
                <td className="text-right">10,000 AGNTCBRO</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Top-up limits: Max 50 extra signals, 10 AI insights, 5 market analyses per month. Estimated top-up spend: $5–15/month.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Total Signals Available" value="25/month" icon="⚡" />
        <StatCard label="AI Insights Available" value="5/month" icon="🤖" />
        <StatCard label="Market Analysis" value="10/month" icon="📊" />
      </div>
    </div>
  );
}

function AllowanceCard({ title, used, total, cost, icon }: { title: string; used: number; total: number; cost: string; icon: string }) {
  const remaining = total - used;
  const percentage = (remaining / total) * 100;

  return (
    <div className="bg-purple-900/30 rounded-xl p-4 border border-purple-500/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Remaining</span>
          <span className="text-purple-300 font-semibold">{remaining} / {total}</span>
        </div>
        <div className="h-2 bg-purple-900/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">Cost: {cost} AGNTCBRO each</p>
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