import { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

export default function HolderMarketAnalysis() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const allowance = { used: 3, total: 10 };

  const handleRequestAnalysis = () => {
    setLoading(true);
    // Simulate market analysis generation
    setTimeout(() => {
      setAnalysis(
        "Market Analysis Summary:\n\n• BTC: $68,450 (+2.3% 24h) — Strong support at $67,000, resistance at $70,000\n• ETH: $3,420 (+1.8% 24h) — Breaking above $3,400, next target $3,600\n• SOL: $145 (+4.2% 24h) — Momentum building, watch $150 resistance\n• Overall Sentiment: Bullish with moderate risk\n• Key Events: FOMC meeting next week, Q1 earnings season starting"
      );
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Market Analysis
        </h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">
              {allowance.total - allowance.used} of {allowance.total} analyses remaining this month
            </p>
            <p className="text-xs text-gray-500">Cost: 10,000 AGNTCBRO per analysis</p>
          </div>
          <button
            onClick={handleRequestAnalysis}
            disabled={allowance.used >= allowance.total || loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing...' : 'Get Market Analysis'}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">Market Analysis Report</h3>
          </div>
          <pre className="text-gray-300 whitespace-pre-wrap leading-relaxed">{analysis}</pre>
        </div>
      )}
    </div>
  );
}