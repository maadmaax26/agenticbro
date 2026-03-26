import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'

interface Signal {
  id: string
  type: 'scam' | 'suspicious' | 'whale' | 'normal'
  title: string
  description: string
  timestamp: Date
  walletAddress?: string
  token?: string
  confidence: number
}

const MOCK_WALLETS = [
  '5ZT17V9d3j2aJ6h9k3m8p2q4r7s1t5u8v9w0x3y7z8a9b0c1d2e3f4g5h6i7j8k9l0m',
  'A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5',
  'Z9Y8X7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4Z3Y2X1W0V9U8T7S6'
]

export default function SignalFeed() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSignals = async () => {
    try {
      setLoading(true)
      
      const newSignals: Signal[] = []

      // Simulate wallet analysis for scam detection
      for (const wallet of MOCK_WALLETS) {
        const isScam = Math.random() < 0.2 // 20% chance of scam for demo
        
        if (isScam) {
          newSignals.push({
            id: `scam-${Date.now()}-${Math.random()}`,
            type: 'scam',
            title: 'Potential Scam Address Detected',
            description: `Wallet ${wallet.substring(0, 10)}... has been flagged as a scam`,
            timestamp: new Date(),
            walletAddress: wallet,
            confidence: 85 + Math.floor(Math.random() * 15)
          })
        } else {
          // Check for whale activity
          const isWhale = Math.random() < 0.3 // 30% chance of whale activity
          if (isWhale) {
            const balance = Math.floor(Math.random() * 50000) + 10000
            newSignals.push({
              id: `whale-${Date.now()}-${Math.random()}`,
              type: 'whale',
              title: 'Whale Activity Detected',
              description: `${wallet.substring(0, 10)}... is holding ${balance.toLocaleString()} SOL`,
              timestamp: new Date(),
              walletAddress: wallet,
              confidence: 80 + Math.floor(Math.random() * 15)
            })
          }
        }
      }

      // Add normal signals for variety
      if (newSignals.length < 3) {
        const normalActivities = [
          { title: 'Transaction Processed', desc: 'Normal transaction completed successfully' },
          { title: 'Token Transfer', desc: 'Token transfer completed' },
          { title: 'Account Activity', desc: 'Account activity detected' }
        ]
        
        normalActivities.slice(0, 3 - newSignals.length).forEach((activity, i) => {
          newSignals.push({
            id: `normal-${Date.now()}-${i}`,
            type: 'normal',
            title: activity.title,
            description: activity.desc,
            timestamp: new Date(Date.now() - Math.random() * 3600000),
            confidence: 70 + Math.floor(Math.random() * 20)
          })
        })
      }

      // Sort by timestamp (newest first)
      newSignals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      
      setSignals(newSignals.slice(0, 10)) // Limit to 10 signals
      setError(null)
    } catch (err) {
      setError('Failed to fetch signals')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSignals()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSignals, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatTimestamp = (date: Date) => {
    const now = Date.now()
    const diff = now - date.getTime()
    
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  const getSignalIcon = (type: Signal['type']) => {
    switch (type) {
      case 'scam': return '⚠️'
      case 'whale': return '🐋'
      case 'normal': return '✅'
      default: return 'ℹ️'
    }
  }

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Live Signals</h3>
        </div>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-red-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Live Signals</h3>
        </div>
        <p className="text-red-400 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-purple-500/20">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-white">Live Signals</h3>
        <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">● Live</span>
      </div>
      <div className="space-y-3">
        {signals.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No signals to display</p>
        ) : (
          signals.map((signal) => (
            <div key={signal.id} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getSignalIcon(signal.type)}</span>
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-sm">{signal.title}</span>
                  <span className="text-xs text-gray-400">{signal.description}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-purple-300 font-semibold">{signal.confidence}%</p>
                <p className="text-xs text-gray-500">{formatTimestamp(signal.timestamp)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}