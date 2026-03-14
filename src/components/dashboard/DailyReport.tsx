/**
 * Daily Report Component
 *
 * Displays daily market analysis including:
 * - Asset prices
 * - Liquidation levels
 * - Market sentiment
 * - Key events
 * - Trading insights
 */

import { useState, useEffect } from 'react';

interface MarketData {
  timestamp: string;
  btcPrice: number;
  ethPrice: number;
  solPrice: number;
  bnbPrice: number;
  xrpPrice: number;
  btcChange: string;
  ethChange: string;
  solChange: string;
  bnbChange: string;
  xrpChange: string;
  btcSentiment: string;
  ethSentiment: string;
  solSentiment: string;
  btcLiquidation: Array<{
    level: string;
    amount: string;
    direction: string;
    impact: string;
  }>;
  ethLiquidation: Array<{
    level: string;
    amount: string;
    direction: string;
    impact: string;
  }>;
  btcSupport: string[];
  ethSupport: string[];
  keyEvents: Array<{
    date: string;
    time: string;
    event: string;
    impact: string;
    assets: string[];
  }>;
  sentimentSummary: string;
  tradingInsights: Array<{
    asset: string;
    signal: 'long' | 'short' | 'neutral';
    timeframe: string;
    confidence: number;
    reasoning: string;
    stopLoss?: string;
    takeProfit?: string;
    risk: 'low' | 'medium' | 'high' | 'extreme';
  }>;
}

function DailyReport() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      // In production, fetch from API
      // For now, use mock data
      const data: MarketData = {
        timestamp: new Date().toISOString(),
        btcPrice: 70798,
        ethPrice: 2090.81,
        solPrice: 88.25,
        bnbPrice: 0,
        xrpPrice: 0,
        btcChange: '+0.1%',
        ethChange: '+5%',
        solChange: '+5%',
        bnbChange: 'N/A',
        xrpChange: 'N/A',
        btcSentiment: 'Cautiously Optimistic',
        ethSentiment: 'Bearish / Long-term Bullish',
        solSentiment: 'Bearish / Technical Weakness',
        btcLiquidation: [
          { level: '$74,000', amount: '$2B', direction: '⬆️', impact: 'Breakout → $75K-$78K' },
          { level: '$69,759', amount: '$1.234B', direction: '⬇️', impact: 'Key trigger level' },
          { level: '$65,000', amount: '$1.028B', direction: '⬇️', impact: 'Critical support' },
        ],
        ethLiquidation: [
          { level: '$2,150', amount: '$1.062B cumulative shorts', direction: '⬆️', impact: 'Major upside catalyst' },
          { level: '$2,030', amount: '$273M short cluster', direction: '⬆️', impact: 'Mid-range liquidity zone' },
          { level: '$1,951', amount: '$907M long', direction: '⬇️', impact: 'Support test level' },
          { level: '$1,863', amount: '$454M long', direction: '⬇️', impact: 'Acceleration zone' },
        ],
        btcSupport: ['$66,000', '$58,000'],
        ethSupport: ['$1,800', '$1,500'],
        keyEvents: [
          { date: '2026-03-14', time: '10:00', event: 'Polkadot deflation event', impact: 'Positive for DOT', assets: ['DOT'] },
          { date: '2026-03-15', time: '00:00', event: '20Mth BTC mining complete', impact: 'Scarcity narrative', assets: ['BTC'] },
          { date: '2026-03-18', time: '14:00', event: 'FOMC rate decision', impact: 'Macro catalyst', assets: ['BTC', 'ETH', 'all'] },
          { date: 'H1 2026', time: 'TBD', event: 'Solana Alpenglow mainnet', impact: 'Major catalyst', assets: ['SOL'] },
        ],
        sentimentSummary: 'Bullish — 3 bullish indicators with momentum',
        tradingInsights: [
          {
            asset: 'BTC',
            signal: 'long',
            timeframe: '1-2 weeks',
            confidence: 65,
            reasoning: 'Scarcity narrative + institutional accumulation + ETF inflows',
            stopLoss: '$66,000',
            takeProfit: '$75,000',
            risk: 'medium',
          },
          {
            asset: 'ETH',
            signal: 'long',
            timeframe: '2-4 weeks',
            confidence: 60,
            reasoning: 'ETHB ETF launch + institutional staking comfort + network upgrades',
            stopLoss: '$2,000',
            takeProfit: '$2,300',
            risk: 'medium',
          },
        ],
      };
      setMarketData(data);
    } catch (err) {
      setError('Failed to load market data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded"></div>
          <div className="h-32 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !marketData) {
    return (
      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-red-500/30">
        <p className="text-red-400">{error || 'Failed to load market data'}</p>
      </div>
    );
  }

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Daily Market Report</h2>
          <p className="text-sm text-purple-300">
            Last updated: {new Date(marketData.timestamp).toLocaleString()}
          </p>
        </div>
        <button
          onClick={fetchMarketData}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Asset Prices */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-black/50 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">BTC</div>
          <div className="text-xl font-bold text-white">${marketData.btcPrice.toLocaleString()}</div>
          <div className={`text-sm ${marketData.btcChange.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
            {marketData.btcChange}
          </div>
        </div>
        <div className="bg-black/50 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">ETH</div>
          <div className="text-xl font-bold text-white">${marketData.ethPrice.toLocaleString()}</div>
          <div className={`text-sm ${marketData.ethChange.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
            {marketData.ethChange}
          </div>
        </div>
        <div className="bg-black/50 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">SOL</div>
          <div className="text-xl font-bold text-white">${marketData.solPrice.toLocaleString()}</div>
          <div className={`text-sm ${marketData.solChange.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
            {marketData.solChange}
          </div>
        </div>
        <div className="bg-black/50 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">BNB</div>
          <div className="text-xl font-bold text-white">{marketData.bnbPrice > 0 ? `$${marketData.bnbPrice.toLocaleString()}` : 'N/A'}</div>
          <div className="text-sm text-gray-400">{marketData.bnbChange}</div>
        </div>
        <div className="bg-black/50 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">XRP</div>
          <div className="text-xl font-bold text-white">{marketData.xrpPrice > 0 ? `$${marketData.xrpPrice.toLocaleString()}` : 'N/A'}</div>
          <div className="text-sm text-gray-400">{marketData.xrpChange}</div>
        </div>
      </div>

      {/* Liquidation Levels */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>🔥</span> BTC Liquidation Levels
          </h3>
          <div className="space-y-2">
            {marketData.btcLiquidation.map((level, idx) => (
              <div key={idx} className="bg-black/50 rounded-lg p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{level.direction}</span>
                  <div>
                    <div className="font-bold text-white">{level.level}</div>
                    <div className="text-xs text-gray-400">{level.amount}</div>
                  </div>
                </div>
                <div className="text-sm text-purple-300 text-right">{level.impact}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>🔥</span> ETH Liquidation Levels
          </h3>
          <div className="space-y-2">
            {marketData.ethLiquidation.map((level, idx) => (
              <div key={idx} className="bg-black/50 rounded-lg p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{level.direction}</span>
                  <div>
                    <div className="font-bold text-white">{level.level}</div>
                    <div className="text-xs text-gray-400">{level.amount}</div>
                  </div>
                </div>
                <div className="text-sm text-purple-300 text-right">{level.impact}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sentiment */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span>📊</span> Market Sentiment
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-black/50 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">BTC</div>
            <div className="font-semibold text-white">{marketData.btcSentiment}</div>
          </div>
          <div className="bg-black/50 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">ETH</div>
            <div className="font-semibold text-white">{marketData.ethSentiment}</div>
          </div>
          <div className="bg-black/50 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">SOL</div>
            <div className="font-semibold text-white">{marketData.solSentiment}</div>
          </div>
        </div>
        <div className="mt-3 bg-black/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Summary</div>
          <div className="font-semibold text-white">{marketData.sentimentSummary}</div>
        </div>
      </div>

      {/* Key Events */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span>📅</span> Key Events
        </h3>
        <div className="space-y-2">
          {marketData.keyEvents.map((event, idx) => (
            <div key={idx} className="bg-black/50 rounded-lg p-3 flex justify-between items-start">
              <div className="flex-1">
                <div className="font-semibold text-white">{event.event}</div>
                <div className="text-xs text-gray-400">{event.date} at {event.time}</div>
              </div>
              <div className="text-sm text-purple-300">{event.impact}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trading Insights */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span>🎯</span> Trading Insights
        </h3>
        <div className="space-y-3">
          {marketData.tradingInsights.map((insight, idx) => (
            <div key={idx} className="bg-black/50 rounded-lg p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{insight.asset}</span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    insight.signal === 'long' ? 'bg-green-600 text-white' :
                    insight.signal === 'short' ? 'bg-red-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {insight.signal.toUpperCase()}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-600 text-white">
                    {insight.confidence}% confidence
                  </span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  insight.risk === 'low' ? 'bg-green-900 text-green-300' :
                  insight.risk === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                  insight.risk === 'high' ? 'bg-red-900 text-red-300' :
                  'bg-gray-900 text-gray-300'
                }`}>
                  {insight.risk.toUpperCase()} RISK
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-2">{insight.reasoning}</p>
              <div className="flex gap-4 text-xs">
                {insight.stopLoss && (
                  <div>
                    <span className="text-gray-400">Stop Loss:</span>{' '}
                    <span className="text-red-400 font-semibold">{insight.stopLoss}</span>
                  </div>
                )}
                {insight.takeProfit && (
                  <div>
                    <span className="text-gray-400">Take Profit:</span>{' '}
                    <span className="text-green-400 font-semibold">{insight.takeProfit}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Timeframe:</span>{' '}
                  <span className="text-white">{insight.timeframe}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DailyReport;