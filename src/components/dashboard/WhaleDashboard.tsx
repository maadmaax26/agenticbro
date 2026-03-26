import { useState, useEffect } from 'react'

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

export default function WhaleDashboard({ onBack, whaleTierUnlocked = false, balance = 0, usdValue = 0 }: WhaleDashboardProps) {
  // Use props to avoid unused warning
  const _unusedProps = { onBack, whaleTierUnlocked, balance, usdValue }
  void _unusedProps // Suppress unused warning
  
  const [whales, setWhales] = useState<WhaleHolding[]>(MOCK_WHALES)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchWhaleData = async () => {
    try {
      setLoading(true)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Simulate data updates
      const updatedWhales = MOCK_WHALES.map(whale => ({
        ...whale,
        balance: whale.balance * (1 + (Math.random() - 0.5) * 0.1), // +/- 5% fluctuation
        changePercentage: whale.changePercentage + (Math.random() - 0.5) * 2,
        lastTransaction: new Date(Date.now() - Math.random() * 7200000)
      }))
      
      setWhales(updatedWhales)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError('Failed to fetch whale data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWhaleData()
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchWhaleData, 60000)
    return () => clearInterval(interval)
  }, [])

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatBalance = (balance: number) => {
    return balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold">Active Whales</h3>
          <p className="text-3xl font-bold mt-2">{whales.length}</p>
          <p className="text-sm opacity-90 mt-1">Currently monitored</p>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold">Total Value</h3>
          <p className="text-3xl font-bold mt-2">
            {whales.reduce((sum, whale) => sum + whale.balance, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm opacity-90 mt-1">SOL combined holdings</p>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <p className="text-3xl font-bold mt-2">{MOCK_TRANSACTIONS.length}</p>
          <p className="text-sm opacity-90 mt-1">Transactions last hour</p>
        </div>
      </div>

      {/* Whale Holdings Section */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden border border-purple-500/20">
        <div className="px-6 py-4 border-b border-purple-500/20">
          <h2 className="text-xl font-bold text-white">🐋 Top Whale Holdings</h2>
          <p className="text-sm text-gray-400 mt-1">Large token holders and their activity</p>
        </div>
        
        <div className="divide-y divide-purple-500/10">
          {whales.map((whale, index) => (
            <div key={index} className="px-6 py-4 hover:bg-purple-500/5 transition-colors">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl w-10 h-10 flex items-center justify-center text-white font-bold">
                    🐋
                  </div>
                  <div>
                    <h3 className="font-semibold text-white truncate max-w-xs font-mono text-sm">
                      {whale.walletAddress.substring(0, 6)}...{whale.walletAddress.substring(-4)}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {whale.tokenSymbol} Balance: {formatBalance(whale.balance)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    whale.changePercentage >= 0 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {whale.changePercentage >= 0 ? '↑' : '↓'} {Math.abs(whale.changePercentage)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden border border-purple-500/20">
        <div className="px-6 py-4 border-b border-purple-500/20">
          <h2 className="text-xl font-bold text-white">💸 Recent Whale Transactions</h2>
          <p className="text-sm text-gray-400 mt-1">Latest activity from major holders</p>
        </div>
        
        <div className="divide-y divide-purple-500/10">
          {MOCK_TRANSACTIONS.map((tx, index) => (
            <div key={index} className="px-6 py-4 hover:bg-purple-500/5 transition-colors">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    tx.type === 'buy' ? 'bg-green-500/20 text-green-400' :
                    tx.type === 'sell' ? 'bg-red-500/20 text-red-400' : 
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {tx.type === 'buy' ? '↑' : tx.type === 'sell' ? '↓' : '⇄'}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white capitalize">{tx.type} transaction</h3>
                    <p className="text-sm text-gray-400">
                      {formatBalance(tx.amount)} {tx.token}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-300">
                    {formatTimestamp(tx.timestamp)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Whale Analysis Section */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-purple-500/20">
        <h2 className="text-xl font-bold text-white mb-4">📊 Whale Activity Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-blue-300">Active Whales</h3>
            <p className="text-2xl font-bold text-blue-400 mt-1">{whales.length}</p>
            <p className="text-sm text-blue-300 mt-1">Currently monitored</p>
          </div>
          
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-green-300">Total Value</h3>
            <p className="text-2xl font-bold text-green-400 mt-1">
              {formatBalance(whales.reduce((sum, whale) => sum + whale.balance, 0))}
            </p>
            <p className="text-sm text-green-300 mt-1">Combined holdings</p>
          </div>
          
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-purple-300">Recent Activity</h3>
            <p className="text-2xl font-bold text-purple-400 mt-1">{MOCK_TRANSACTIONS.length}</p>
            <p className="text-sm text-purple-300 mt-1">Transactions today</p>
          </div>
        </div>
      </div>
    </div>
  )
}