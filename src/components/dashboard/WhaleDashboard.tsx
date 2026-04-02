import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTokenGating } from '../../hooks/useTokenGating'
import { useTierCredits } from '../../hooks/useTierCredits'
import ProfileVerifierScanner from '../ProfileVerifierScanner'
import PriorityTokenScanner from '../PriorityTokenScanner'
import TokenScanner from '../TokenScanner'
import TokenImpersonationScanner from '../TokenImpersonationScanner'
import ScamDetectionSection from '../ScamDetectionSection'
import { TrendingUp, Zap, Activity, Settings, ArrowLeft, Search, Shield, AlertTriangle } from 'lucide-react'

interface WhaleHolding {
  walletAddress: string
  balance: number
  tokenSymbol: string
  changePercentage: number
  lastTransaction: Date
}

interface TransactionActivity {
  signature: string
  timestamp: Date
  amount: number
  type: 'buy' | 'sell' | 'transfer'
  token: string
  from?: string
  to?: string
}

interface WhaleDashboardProps {
  onBack?: () => void
  whaleTierUnlocked?: boolean
  balance?: number
  usdValue?: number
}

type ActiveTab = 'dashboard' | 'profile' | 'tokenscan' | 'faketoken' | 'scam' | 'settings';

const MOCK_WHALES: WhaleHolding[] = [
  {
    walletAddress: '5ZT17V9d3j2aJ6h9k3m8p2q4r7s1t5u8v9w0x3y7z8a9b0c1d2e3f4g5h6i7j8k9l0m',
    balance: 12500,
    tokenSymbol: 'SOL',
    changePercentage: 2.5,
    lastTransaction: new Date(Date.now() - 3600000)
  },
  {
    walletAddress: 'A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5',
    balance: 8750,
    tokenSymbol: 'SOL',
    changePercentage: -1.2,
    lastTransaction: new Date(Date.now() - 7200000)
  },
  {
    walletAddress: 'Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4Z3Y2X1W0V9U8T7S6',
    balance: 15200,
    tokenSymbol: 'SOL',
    changePercentage: 5.7,
    lastTransaction: new Date(Date.now() - 1800000)
  },
  {
    walletAddress: 'C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3',
    balance: 9800,
    tokenSymbol: 'SOL',
    changePercentage: 3.1,
    lastTransaction: new Date(Date.now() - 5400000)
  }
]

const MOCK_TRANSACTIONS: TransactionActivity[] = [
  {
    signature: 'signature123456789',
    timestamp: new Date(Date.now() - 3600000),
    amount: 1500,
    type: 'buy',
    token: 'SOL',
    from: '5ZT17V9d3j2aJ6h9k3m8p2q4r7s1t5u8v9w0x3y7z8a9b0c1d2e3f4g5h6i7j8k9l0m',
    to: 'A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5'
  },
  {
    signature: 'signature987654321',
    timestamp: new Date(Date.now() - 7200000),
    amount: 2200,
    type: 'sell',
    token: 'SOL',
    from: 'A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5',
    to: 'Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4Z3Y2X1W0V9U8T7S6'
  },
  {
    signature: 'signature456789123',
    timestamp: new Date(Date.now() - 1800000),
    amount: 3100,
    type: 'transfer',
    token: 'SOL',
    from: 'Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4Z3Y2X1W0V9U8T7S6',
    to: '5ZT17V9d3j2aJ6h9k3m8p2q4r7s1t5u8v9w0x3y7z8a9b0c1d2e3f4g5h6i7j8k9l0m'
  },
  {
    signature: 'signature789123456',
    timestamp: new Date(Date.now() - 4800000),
    amount: 1800,
    type: 'buy',
    token: 'SOL',
    from: 'C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3',
    to: 'Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4Z3Y2X1W0V9U8T7S6'
  }
]

const WHALE_FEATURES = [
  {
    icon: '🔍',
    title: 'Profile Verifier',
    desc: 'Full profile scam detection across all platforms. Whale tier gets priority processing and advanced analysis.',
    badge: '20/mo',
    badgeColor: 'rgba(234,88,12,0.2)',
    badgeBorder: 'rgba(234,88,12,0.5)',
    badgeText: '#fb923c',
  },
  {
    icon: '🪙',
    title: 'Token Scanner',
    desc: 'Deep analysis of any token by contract address with honeypot detection, holder distribution, and security flags.',
    badge: 'Priority',
    badgeColor: 'rgba(139,92,246,0.25)',
    badgeBorder: 'rgba(139,92,246,0.6)',
    badgeText: '#c4b5fd',
  },
  {
    icon: '⚠️',
    title: 'Fake Token Detector',
    desc: 'Real-time detection of impersonator tokens and copycats. Advanced pattern matching across all chains.',
    badge: 'Free',
    badgeColor: 'rgba(239,68,68,0.15)',
    badgeBorder: 'rgba(239,68,68,0.5)',
    badgeText: '#f87171',
  },
  {
    icon: '🚨',
    title: 'Scam Detection',
    desc: 'Full scam investigation with profile analysis, victim reports, wallet forensics & scammer database. 20 free scans/month.',
    badge: '20/mo',
    badgeColor: 'rgba(239,68,68,0.15)',
    badgeBorder: 'rgba(239,68,68,0.5)',
    badgeText: '#f87171',
  },
  {
    icon: '🐋',
    title: 'Whale Tracking',
    desc: 'Real-time tracking of large token holders and their transaction activity.',
    badge: 'Live',
    badgeColor: 'rgba(16,185,129,0.15)',
    badgeBorder: 'rgba(16,185,129,0.5)',
    badgeText: '#4ade80',
  },
  {
    icon: '🔥',
    title: 'Burn Discounts',
    desc: '25% off all pay-per-use features when paying with AGNTCBRO tokens.',
    badge: '25% off',
    badgeColor: 'rgba(34,197,94,0.15)',
    badgeBorder: 'rgba(34,197,94,0.5)',
    badgeText: '#4ade80',
  },
]

export default function WhaleDashboard({ onBack, whaleTierUnlocked = false, balance = 0, usdValue = 0 }: WhaleDashboardProps) {
  const { connected, publicKey } = useWallet()
  const { whaleTierUnlocked: hasWhaleAccess, balance: tokenBalance } = useTokenGating()
  const tierCredits = useTierCredits(publicKey?.toBase58() || null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')

  // Use props if provided, otherwise use hook values
  const effectiveWhaleTierUnlocked = whaleTierUnlocked || hasWhaleAccess
  const effectiveBalance = balance || tokenBalance
  
  const [whales] = useState<WhaleHolding[]>(MOCK_WHALES)
  const [lastUpdate] = useState<Date>(new Date())

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatBalance = (balance: number) => {
    return balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  if (!connected || !publicKey) {
    return null
  }

  if (!effectiveWhaleTierUnlocked) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-orange-500/20 p-8 text-center">
          <div className="text-6xl mb-4">🐋</div>
          <h2 className="text-2xl font-bold text-white mb-4">Whale Tier Access Required</h2>
          <p className="text-gray-300 mb-6">
            Hold at least <span className="text-orange-400 font-bold">$1,000 USD</span> worth of AGNTCBRO to access the Whale Tier dashboard.
          </p>
          <div className="bg-orange-900/40 rounded-xl p-6 mb-6">
            <p className="text-sm text-gray-400 mb-2">Current Balance</p>
            <p className="text-2xl font-bold text-orange-300">
              {effectiveBalance.toLocaleString()} AGNTCBRO
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <p className="mb-2">Whale Tier includes:</p>
            <ul className="text-left max-w-sm mx-auto space-y-1">
              <li>• 20 free scans per month</li>
              <li>• All Holder Tier features</li>
              <li>• Priority processing</li>
              <li>• Advanced whale tracking</li>
              <li>• 25% burn discount</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto mt-6">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-orange-500/20 p-6 mb-6">
        {/* Back button row */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 mb-4 px-3 py-1 rounded-md border text-xs font-semibold transition-all hover:brightness-125"
            style={{ background: 'rgba(234,88,12,0.2)', borderColor: 'rgba(234,88,12,0.5)', color: '#fb923c' }}
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Home
          </button>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">🐋 Whale Tier Dashboard</h1>
            <p className="text-gray-400">
              Premium access with priority processing and advanced features
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">Your Balance</p>
            <p className="text-2xl font-bold text-orange-300">
              {effectiveBalance.toLocaleString()} AGNTCBRO
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {tierCredits.isTestWallet ? '∞ Unlimited Scans' : `${tierCredits.tierScansRemaining}/${tierCredits.tierMonthlyScans} free scans this month`}
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
            active={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            icon={<Search />}
            label="Profile Verifier"
            isNew
          />
          <TabButton
            active={activeTab === 'tokenscan'}
            onClick={() => setActiveTab('tokenscan')}
            icon={<Shield />}
            label="Token Scanner"
          />
          <TabButton
            active={activeTab === 'faketoken'}
            onClick={() => setActiveTab('faketoken')}
            icon={<AlertTriangle />}
            label="Fake Tokens"
          />
          <TabButton
            active={activeTab === 'scam'}
            onClick={() => setActiveTab('scam')}
            icon={<Activity />}
            label="Scam Detect"
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
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Feature cards */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-orange-500/20 p-6">
            <h2 className="text-xl font-bold text-white mb-5">🐋 Whale Tier Features</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {WHALE_FEATURES.map(f => (
                <div
                  key={f.title}
                  className="flex gap-4 rounded-xl p-4 border"
                  style={{ background: 'rgba(234,88,12,0.07)', borderColor: 'rgba(234,88,12,0.2)' }}
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
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard label="Monthly Scans" value={`${tierCredits.isTestWallet ? '∞' : tierCredits.tierScansRemaining}/${tierCredits.tierMonthlyScans}`} icon="🔍" />
            <StatCard label="Priority" value="Highest" icon="⚡" />
            <StatCard label="Whales Tracked" value={whales.length.toString()} icon="🐋" />
            <StatCard label="Burn Discount" value="25%" icon="🔥" />
          </div>

          {/* Low credits warning */}
          {!tierCredits.isTestWallet && tierCredits.tierScansRemaining <= 5 && (
            <div
              className="rounded-2xl border p-5 flex items-center gap-4"
              style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.25)' }}
            >
              <span className="text-3xl flex-shrink-0">⚠️</span>
              <div>
                <p className="font-bold text-white text-sm mb-0.5">Low Scan Credits</p>
                <p className="text-xs text-gray-400">
                  You have <span className="text-red-400 font-semibold">{tierCredits.tierScansRemaining}</span> free scans remaining this month.
                  Purchase additional credits at <span className="text-orange-400 font-semibold">$1/scan</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && <ProfileVerifierScanner onLoginRequired={() => {}} />}
      {activeTab === 'tokenscan' && (
        <>
          <PriorityTokenScanner onLoginRequired={() => {}} />
          <TokenScanner onLoginRequired={() => {}} />
        </>
      )}
      {activeTab === 'faketoken' && <TokenImpersonationScanner />}
      {activeTab === 'scam' && (
        connected && publicKey ? (
          <ScamDetectionSection walletAddress={publicKey.toBase58()} tokenPriceUsd={0} freeScanLimit={20} />
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-gray-400">Connect your wallet to access scam detection</p>
          </div>
        )
      )}
      {activeTab === 'settings' && (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-orange-500/20 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Whale Tier Settings</h3>
          <p className="text-gray-400">Settings coming soon...</p>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active, onClick, icon, label, isNew,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isNew?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
        active
          ? 'bg-orange-600 text-white'
          : 'bg-black/30 text-gray-400 hover:bg-black/50'
      }`}
    >
      {icon}
      {label}
      {isNew && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{
            background: 'rgba(234,88,12,0.35)',
            border: '1px solid rgba(234,88,12,0.7)',
            color: '#fb923c',
          }}
        >
          NEW
        </span>
      )}
    </button>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-orange-500/20 p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xl font-bold text-orange-300">{value}</p>
    </div>
  )
}