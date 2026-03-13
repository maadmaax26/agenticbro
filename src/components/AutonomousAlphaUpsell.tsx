import { useState } from 'react'
import { BookOpen, ExternalLink, CheckCircle } from 'lucide-react'

export default function AutonomousAlphaUpsell() {
  const [copied, setCopied] = useState(false)

  const copyDiscountCode = () => {
    navigator.clipboard.writeText('AGNTCBRO20')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 p-6 rounded-xl border border-blue-500/30 mt-6 animate-pulse-glow">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-blue-400" />
        <h3 className="text-xl font-bold text-white">📘 Want to Trade Like AI?</h3>
      </div>

      <p className="text-gray-300 mb-4">
        Your roast told you where you messed up. Now learn how to fix it.
      </p>

      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-gray-300">30-Page Comprehensive PDF Guide</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-gray-300">Complete Python Source Code (5 Strategies)</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-gray-300">AI Prompt Templates for Ollama Integration</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-gray-300">Professional Risk Management Framework</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-gray-300">Deployable Bot Templates</span>
        </div>
      </div>

      <div className="bg-black/30 p-4 rounded-lg mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Discount Code:</span>
          <button
            onClick={copyDiscountCode}
            className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white transition-colors"
          >
            {copied ? '✓ Copied!' : 'AGNTCBRO20'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Save $20 on the AI Trading Playbook
        </p>
      </div>

      <a
        href="https://autonomousalpha.io"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-center"
      >
        Get the Playbook ($79 with discount)
      </a>

      <p className="text-xs text-gray-500 mt-3 text-center">
        <ExternalLink className="w-3 h-3 inline mr-1" />
        autonomousalpha.io
      </p>
    </div>
  )
}