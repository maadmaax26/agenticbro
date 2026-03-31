import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Menu, X, Shield, Search, Map, Users } from 'lucide-react'

interface MobileMenuProps {
  onNavigate?: (section: string) => void
}

export default function MobileMenu({ onNavigate }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNavigate = (section: string) => {
    setOpen(false)
    onNavigate?.(section)
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  // Prevent body scroll when menu is open
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

  const menuContent = open && (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        style={{ zIndex: 9998 }}
        onClick={() => setOpen(false)}
      />

      {/* Menu panel */}
      <div
        className="fixed inset-0 bg-slate-900 overflow-y-auto"
        style={{ zIndex: 9999 }}
      >
        {/* Header with close button */}
        <div className="sticky top-0 bg-slate-900 flex items-center justify-between px-4 py-3 border-b-2 border-purple-500/50">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Agentic Bro" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-white">Menu</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex flex-col p-4 gap-2">
          <button
            onClick={() => handleNavigate('scanners')}
            className="flex items-center gap-3 px-4 py-4 rounded-lg bg-purple-500/10 hover:bg-purple-500/30 transition-colors text-left min-h-[52px] w-full border border-purple-500/20"
          >
            <Search className="h-6 w-6 text-purple-400" />
            <span className="text-white font-medium text-lg">Scanners</span>
          </button>

          <button
            onClick={() => handleNavigate('features')}
            className="flex items-center gap-3 px-4 py-4 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/30 transition-colors text-left min-h-[52px] w-full border border-cyan-500/20"
          >
            <Shield className="h-6 w-6 text-cyan-400" />
            <span className="text-white font-medium text-lg">Features</span>
          </button>

          <button
            onClick={() => handleNavigate('roadmap')}
            className="flex items-center gap-3 px-4 py-4 rounded-lg bg-green-500/10 hover:bg-green-500/30 transition-colors text-left min-h-[52px] w-full border border-green-500/20"
          >
            <Map className="h-6 w-6 text-green-400" />
            <span className="text-white font-medium text-lg">Roadmap</span>
          </button>

          <button
            onClick={() => handleNavigate('community')}
            className="flex items-center gap-3 px-4 py-4 rounded-lg bg-orange-500/10 hover:bg-orange-500/30 transition-colors text-left min-h-[52px] w-full border border-orange-500/20"
          >
            <Users className="h-6 w-6 text-orange-400" />
            <span className="text-white font-medium text-lg">Community</span>
          </button>

          {/* Divider */}
          <div className="border-t border-purple-500/30 my-4" />

          {/* Mobile-specific CTAs */}
          <div className="flex flex-col gap-3">
            <a
              href="https://t.me/agenticbro11"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-4 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-center font-medium min-h-[52px] flex items-center justify-center text-white text-lg"
            >
              Join Telegram
            </a>
            <a
              href="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-4 bg-[#39ff14]/20 border-2 border-[#39ff14]/50 rounded-lg text-center font-medium min-h-[52px] flex items-center justify-center text-[#39ff14] text-lg"
            >
              💰 Buy $AGNTCBRO
            </a>
          </div>
        </nav>
      </div>
    </>
  )

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-accent/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center bg-black/40"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Menu className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Render menu via portal at document body */}
      {mounted && createPortal(menuContent, document.body)}
    </div>
  )
}