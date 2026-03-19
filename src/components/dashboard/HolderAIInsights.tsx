import { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';

export default function HolderAIInsights() {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const allowance = { used: 1, total: 5 };

  const handleRequestInsight = () => {
    setLoading(true);
    // Simulate AI insight generation
    setTimeout(() => {
      setInsight(
        "BTC is showing strong bullish momentum with increasing volume. RSI at 65 suggests room for upside. Key resistance at $72,000. Monitor for breakout confirmation before entry. Sentiment remains positive with institutional interest growing."
      );
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5" />
          AI Insights
        </h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">
              {allowance.total - allowance.used} of {allowance.total} insights remaining this month
            </p>
            <p className="text-xs text-gray-500">Cost: 20,000 AGNTCBRO per insight</p>
          </div>
          <button
            onClick={handleRequestInsight}
            disabled={allowance.used >= allowance.total || loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Get AI Insight'}
          </button>
        </div>
      </div>

      {insight && (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">AI-Generated Insight</h3>
          </div>
          <p className="text-gray-300 leading-relaxed">{insight}</p>
        </div>
      )}
    </div>
  );
}