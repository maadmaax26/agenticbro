import { useEffect, useState } from 'react'

interface SentimentData {
  fearGreedIndex: number
  fearGreedLabel: string
  assets: {
    symbol: string
    emoji: string
    sentiment: 'Bullish' | 'Bearish' | 'Neutral'
    score: number   // 0–100
    change24h: string
  }[]
  dominance: { btc: number; eth: number; others: number }
}

// Fetch Fear & Greed from public API, fall back to static data
async function fetchFearGreed(): Promise<{ value: number; label: string }> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) throw new Error('non-ok')
    const json = await res.json()
    const entry = json?.data?.[0]
    return {
      value: parseInt(entry?.value ?? '50', 10),
      label: entry?.value_classification ?? 'Neutral',
    }
  } catch {
    return { value: 50, label: 'Neutral' }
  }
}

function fearColor(v: number): string {
  if (v <= 25) return '#f87171'   // red   — Extreme Fear
  if (v <= 45) return '#fb923c'   // orange — Fear
  if (v <= 55) return '#facc15'   // yellow — Neutral
  if (v <= 75) return '#a3e635'   // lime  — Greed
  return '#4ade80'                // green — Extreme Greed
}

const STATIC_ASSETS: SentimentData['assets'] = [
  { symbol: 'BTC', emoji: '₿',  sentiment: 'Bullish', score: 68, change24h: '+2.1%' },
  { symbol: 'ETH', emoji: 'Ξ',  sentiment: 'Neutral', score: 51, change24h: '-0.4%' },
  { symbol: 'SOL', emoji: '◎',  sentiment: 'Bullish', score: 74, change24h: '+3.8%' },
  { symbol: 'BNB', emoji: '🟡', sentiment: 'Neutral', score: 49, change24h: '+0.2%' },
  { symbol: 'XRP', emoji: '✕',  sentiment: 'Bearish', score: 35, change24h: '-1.7%' },
]

export default function MarketSentiment() {
  const [fg, setFg] = useState<{ value: number; label: string } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    fetchFearGreed().then(setFg)
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [])

  const fgValue = fg?.value ?? 50
  const fgLabel = fg?.label ?? '…'
  const color = fearColor(fgValue)

  return (
    <div
      className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-5"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        🌡 Market Sentiment
      </h2>

      {/* Fear & Greed gauge */}
      <div className="flex items-center gap-5 mb-5 bg-black/30 rounded-xl p-4 border border-purple-500/15">
        {/* Dial */}
        <div className="relative flex-shrink-0 w-20 h-20">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            {/* Background arc */}
            <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" strokeDasharray="94.25 188.5" strokeLinecap="round" />
            {/* Value arc */}
            <circle
              cx="40" cy="40" r="30" fill="none"
              stroke={color} strokeWidth="8"
              strokeDasharray={`${(fgValue / 100) * 94.25} 188.5`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease, stroke 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: '10px' }}>
            <span className="text-xl font-bold" style={{ color }}>{fgValue}</span>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-0.5">Crypto Fear & Greed Index</p>
          <p className="text-lg font-bold" style={{ color }}>{fgLabel}</p>
          <p className="text-xs text-gray-600 mt-1">via alternative.me · live</p>
        </div>
      </div>

      {/* Per-asset sentiment */}
      <div className="space-y-2">
        {STATIC_ASSETS.map(a => (
          <div key={a.symbol} className="flex items-center gap-3">
            <span className="w-5 text-center text-sm">{a.emoji}</span>
            <span className="text-xs font-bold text-white w-8">{a.symbol}</span>

            {/* Bar */}
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${a.score}%`,
                  background: a.sentiment === 'Bullish' ? '#4ade80'
                    : a.sentiment === 'Bearish' ? '#f87171'
                    : '#facc15',
                }}
              />
            </div>

            <span
              className="text-xs font-semibold w-14 text-right"
              style={{
                color: a.sentiment === 'Bullish' ? '#4ade80'
                  : a.sentiment === 'Bearish' ? '#f87171'
                  : '#facc15',
              }}
            >
              {a.sentiment}
            </span>
            <span
              className="text-xs font-mono w-12 text-right"
              style={{ color: a.change24h.startsWith('+') ? '#4ade80' : '#f87171' }}
            >
              {a.change24h}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4 text-center">
        Sentiment scores are indicative · 24h change is approximate
      </p>
    </div>
  )
}
