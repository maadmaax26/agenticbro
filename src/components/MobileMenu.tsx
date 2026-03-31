import { useState } from 'react'
import { Menu, X, Shield, Search, Map, Users } from 'lucide-react'

interface MobileMenuProps {
  onNavigate?: (section: string) => void
}

export default function MobileMenu({ onNavigate }: MobileMenuProps) {
  const [open, setOpen] = useState(false)

  const handleNavigate = (section: string) => {
    setOpen(false)
    onNavigate?.(section)
  }

  return (
    <div className="md:hidden relative">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-accent/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <>
          {/* Backdrop - semi-transparent overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={() => setOpen(false)}
          />

          {/* Menu panel - high contrast background */}
          <div className="fixed top-0 left-0 right-0 z-[110] bg-slate-900/98 border-b-2 border-purple-500/50 shadow-2xl shadow-purple-500/20">
            {/* Header with close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/30">
              <div className="flex items-center gap-2">
                <img src="/icon.png" alt="Agentic Bro" className="w-8 h-8 rounded-lg" />
                <span className="font-bold text-white">Menu</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Navigation items */}
            <nav className="flex flex-col p-2 gap-1 max-h-[70vh] overflow-y-auto">
              <button
                onClick={() => handleNavigate('scanners')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-500/20 transition-colors text-left min-h-[44px] w-full"
              >
                <Search className="h-5 w-5 text-purple-400" />
                <span className="text-white font-medium">Scanners</span>
              </button>

              <button
                onClick={() => handleNavigate('features')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-500/20 transition-colors text-left min-h-[44px] w-full"
              >
                <Shield className="h-5 w-5 text-cyan-400" />
                <span className="text-white font-medium">Features</span>
              </button>

              <button
                onClick={() => handleNavigate('roadmap')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-500/20 transition-colors text-left min-h-[44px] w-full"
              >
                <Map className="h-5 w-5 text-green-400" />
                <span className="text-white font-medium">Roadmap</span>
              </button>

              <button
                onClick={() => handleNavigate('community')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-500/20 transition-colors text-left min-h-[44px] w-full"
              >
                <Users className="h-5 w-5 text-orange-400" />
                <span className="text-white font-medium">Community</span>
              </button>

              {/* Divider */}
              <div className="border-t border-purple-500/30 my-2" />

              {/* Mobile-specific CTAs */}
              <div className="flex flex-col gap-2 px-2 pt-2 pb-4">
                <a
                  href="https://t.me/agenticbro11"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-center font-medium min-h-[44px] flex items-center justify-center text-white"
                >
                  Join Telegram
                </a>
                <a
                  href="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-[#39ff14]/20 border border-[#39ff14]/40 rounded-lg text-center font-medium min-h-[44px] flex items-center justify-center text-[#39ff14]"
                >
                  💰 Buy $AGNTCBRO
                </a>
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}