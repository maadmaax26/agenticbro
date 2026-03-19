import { useEffect, useState } from 'react'

interface Signal {
  id: string
  asset: string
  direction: 'LONG' | 'SHORT'
  strength: 'Strong' | 'Moderate' | 'Weak'
  price: string
  time: string
  emoji: string
}

// Static delayed signals — rotate every 30 min to simulate a live feed
const SIGNAL_POOL: Signal[] = [
  { id: '1', asset: 'BTC',  direction: 'LONG',  strength: 'Strong',   price: '—',    time: '30m ago', emoji: '₿' },
  { id: '2', asset: 'SOL',  direction: 'LONG',  strength: 'Moderate', price: '—',    time: '30m ago', emoji: '◎' },
  { id: '3', asset: 'ETH',  direction: 'SHORT', strength: 'Weak',     price: '—',    time: '1h ago',  emoji: 'Ξ' },
  { id: '4', asset: 'BNB',  direction: 'LONG',  strength: 'Moderate', price: '—',    time: '1h ago',  emoji: '🟡' },
  { id: '5', asset: 'XRP',  direction: 'SHORT', strength: 'Strong',   price: '—',    time: '2h ago',  emoji: '✕' },
  { id: '6', asset: 'DOGE', direction: 'LONG',  strength: 'Weak',     price: '—',    time: '2h ago',  emoji: '🐕' },
]

export default function PublicSignalFeed() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-5"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          ⚡ Signal Feed
        </h2>
        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold"
          style={{ background: 'rgba(234,179,8,0.15)', color: '#facc15', border: '1px solid rgba(234,179,8,0.4)' }}>
          ⏱ 30-MIN DELAYED
        </span>
      </div>

      {/* Signal rows */}
      <div className="space-y-2">
        {SIGNAL_POOL.map(sig => (
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
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{sig.time}</span>
              <span className="text-gray-700">🔒 Live</span>
            </div>
          </div>
        ))}
      </div>

      {/* Upsell footer */}
      <div className="mt-4 pt-3 border-t border-purple-500/15 text-center">
        <p className="text-xs text-gray-500">
          🔒 Real-time signals & exact prices available in{' '}
          <span className="text-purple-400 font-semibold">Holder Tier</span>
        </p>
      </div>
    </div>
  )
}
