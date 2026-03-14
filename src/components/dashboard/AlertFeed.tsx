import { Bell, AlertTriangle, Info } from 'lucide-react'

interface Alert {
  type: 'warning' | 'info' | 'danger'
  message: string
  time: string
}

const mockAlerts: Alert[] = [
  { type: 'danger', message: 'BONK whale dumping — exit now?', time: '1m ago' },
  { type: 'warning', message: 'WIF liquidity thinning on Raydium', time: '8m ago' },
  { type: 'info', message: 'SOL breaking resistance at $142', time: '15m ago' },
  { type: 'warning', message: 'High slippage detected on JUP swap', time: '22m ago' },
]

const icons = {
  danger: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
}

const colors = {
  danger: 'border-red-500/20 bg-red-500/5',
  warning: 'border-yellow-500/20 bg-yellow-500/5',
  info: 'border-blue-500/20 bg-blue-500/5',
}

export default function AlertFeed() {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-purple-500/20">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-bold text-white">Alerts</h3>
        <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{mockAlerts.length}</span>
      </div>
      <div className="space-y-3">
        {mockAlerts.map((a, i) => (
          <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-2.5 border ${colors[a.type]}`}>
            {icons[a.type]}
            <div>
              <p className="text-white text-sm">{a.message}</p>
              <p className="text-gray-500 text-xs mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
