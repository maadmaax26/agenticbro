import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Menu, X, Shield, Search, Map, Users } from 'lucide-react'

interface MobileMenuProps {
  onNavigate?: (section: string) => void
}

export default function MobileMenu({ onNavigate }: MobileMenuProps) {
  const [open, setOpen] = useState(false)

  const handleNavigate = useCallback((section: string) => {
    setOpen(false)
    onNavigate?.(section)
  }, [onNavigate])

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {/* Hamburger button - visible only on mobile */}
      <div className="lg:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="p-3 rounded-lg hover:bg-purple-500/20 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center bg-purple-500/10 border border-purple-500/30"
          aria-label={open ? 'Close menu' : 'Open menu'}
          type="button"
        >
          {open ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Menu className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      {/* Menu overlay - rendered via portal at body level */}
      {open && createPortal(
        <div 
          className="fixed inset-0 z-[99999]"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 99999,
          }}
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            style={{ zIndex: 99998 }}
          />
          
          {/* Menu content */}
          <div 
            className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-slate-900 to-black"
            style={{ zIndex: 99999 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-purple-500/50 bg-slate-900/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <img src="/icon.png" alt="Agentic Bro" className="w-10 h-10 rounded-lg" />
                <span className="font-bold text-white text-xl">Menu</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-3 rounded-lg hover:bg-white/10 min-h-[48px] min-w-[48px] flex items-center justify-center"
                type="button"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col p-4 gap-3">
              <button
                onClick={() => handleNavigate('scanners')}
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-left w-full border border-purple-500/30 transition-colors"
                type="button"
              >
                <Search className="h-7 w-7 text-purple-400 flex-shrink-0" />
                <span className="text-white font-semibold text-xl">Scanners</span>
              </button>

              <button
                onClick={() => handleNavigate('features')}
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 text-left w-full border border-cyan-500/30 transition-colors"
                type="button"
              >
                <Shield className="h-7 w-7 text-cyan-400 flex-shrink-0" />
                <span className="text-white font-semibold text-xl">Features</span>
              </button>

              <button
                onClick={() => handleNavigate('roadmap')}
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-green-500/20 hover:bg-green-500/40 text-left w-full border border-green-500/30 transition-colors"
                type="button"
              >
                <Map className="h-7 w-7 text-green-400 flex-shrink-0" />
                <span className="text-white font-semibold text-xl">Roadmap</span>
              </button>

              <button
                onClick={() => handleNavigate('community')}
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-orange-500/20 hover:bg-orange-500/40 text-left w-full border border-orange-500/30 transition-colors"
                type="button"
              >
                <Users className="h-7 w-7 text-orange-400 flex-shrink-0" />
                <span className="text-white font-semibold text-xl">Community</span>
              </button>

              <div className="border-t border-purple-500/30 my-3" />

              <a
                href="https://t.me/agenticbro11"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center py-4 px-5 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl text-white font-semibold text-xl hover:opacity-90 transition-opacity"
              >
                Join Telegram
              </a>

              <a
                href="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center py-4 px-5 bg-[#39ff14]/20 border-2 border-[#39ff14]/50 rounded-xl text-[#39ff14] font-semibold text-xl hover:bg-[#39ff14]/30 transition-colors"
              >
                💰 Buy $AGNTCBRO
              </a>
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}