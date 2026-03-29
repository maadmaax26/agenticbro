/**
 * LanguageSelector.tsx
 * Language picker for Agentic Bro UI.
 * Supported: English, Chinese, Japanese, German, French, Spanish.
 */

import { useState } from 'react'

export type Locale = 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es'

interface Props {
  current: Locale
  onChange: (locale: Locale) => void
}

const LANGUAGES: { code: Locale; flag: string; label: string; native: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English',  native: 'English'  },
  { code: 'zh', flag: '🇨🇳', label: 'Chinese',  native: '中文'     },
  { code: 'ja', flag: '🇯🇵', label: 'Japanese', native: '日本語'   },
  { code: 'de', flag: '🇩🇪', label: 'German',   native: 'Deutsch'  },
  { code: 'fr', flag: '🇫🇷', label: 'French',   native: 'Français' },
  { code: 'es', flag: '🇪🇸', label: 'Spanish',  native: 'Español'  },
]

export default function LanguageSelector({ current, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const cur = LANGUAGES.find(l => l.code === current) ?? LANGUAGES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all hover:brightness-110"
        style={{background:'rgba(80,80,80,0.2)',borderColor:'rgba(120,120,120,0.4)',color:'#d1d5db'}}>
        <span>{cur.flag}</span>
        <span>{cur.native}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M0 0l5 6 5-6z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md shadow-2xl overflow-hidden min-w-[130px]">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { onChange(lang.code); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-white/10"
              style={lang.code === current ? {color:'#a78bfa',background:'rgba(139,92,246,0.15)'} : {color:'#d1d5db'}}>
              <span>{lang.flag}</span>
              <span>{lang.native}</span>
              {lang.code === current && <span className="ml-auto text-purple-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
