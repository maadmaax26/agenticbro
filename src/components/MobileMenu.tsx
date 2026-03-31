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
    <div className="md:hidden">
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Menu panel */}
          <div className="absolute top-full left-0 right-0 bg-background border-b border-border z-50 shadow-lg">
            <nav className="flex flex-col p-4 gap-1">
              <button
                onClick={() => handleNavigate('scanners')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left min-h-[44px]"
              >
                <Search className="h-5 w-5 text-purple-500" />
                <span>Scanners</span>
              </button>

              <button
                onClick={() => handleNavigate('features')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left min-h-[44px]"
              >
                <Shield className="h-5 w-5 text-cyan-500" />
                <span>Features</span>
              </button>

              <button
                onClick={() => handleNavigate('roadmap')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left min-h-[44px]"
              >
                <Map className="h-5 w-5 text-green-500" />
                <span>Roadmap</span>
              </button>

              <button
                onClick={() => handleNavigate('community')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left min-h-[44px]"
              >
                <Users className="h-5 w-5 text-orange-500" />
                <span>Community</span>
              </button>

              {/* Divider */}
              <div className="border-t border-border my-2" />

              {/* Mobile-specific CTAs */}
              <div className="flex flex-col gap-2 px-4 pt-2">
                <a
                  href="https://t.me/agenticbro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-center font-medium min-h-[44px] flex items-center justify-center"
                >
                  Join Telegram
                </a>
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}