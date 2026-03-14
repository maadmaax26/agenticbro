/**
 * Daily Market Report Component
 *
 * Displays daily market analysis with BTC/ETH/SOL prices, sentiment,
 * liquidation levels, and key events
 */

import { useState, useEffect } from 'react';

interface MarketData {
  btcPrice: number;
  ethPrice: number;
  solPrice: number;
  btcChange: string;
  ethChange: string;
  solChange: string;
}

interface LiquidationLevel {
  level: string;
  amount: string;
  direction: string;
  impact: string;
}

interface DailyReportProps {
  walletAddress?: string;
}

export default function DailyReport({ walletAddress }: DailyReportProps) {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    fetchDailyReport();

    // Refresh every hour
    const interval = setInterval(fetchDailyReport, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchDailyReport = async () => {
    try {
      setLoading(true);
      // In production, fetch from API
      // For now, use mock data
      const mockData = {
        btcPrice: 70798,
        ethPrice: 2090.81,
        solPrice: 88.25,
        btcChange: '+0.1%',
        ethChange: '+5%',
        solChange: '+5%',
      };
      setMarketData(mockData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching daily report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📊 Daily Market Report</h2>
        {lastUpdate && (
          <span className="text-xs text-gray-500">
            Updated: {lastUpdate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {!marketData ? (
        <p className="text-gray-500">No market data available</p>
      ) : (
        <>
          {/* Price Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left mb-4">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4">Asset</th>
                  <th className="py-2 px-4">Price</th>
                  <th className="py-2 px-4">24h</th>
                  <th className="py-2 px-4">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-4 font-semibold">Bitcoin (BTC)</td>
                  <td className="py-2 px-4 text-green-600">${marketData.btcPrice.toLocaleString()}</td>
                  <td className="py-2 px-4">{marketData.btcChange}</td>
                  <td className="py-2 px-4">Cautiously Optimistic</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-4 font-semibold">Ethereum (ETH)</td>
                  <td className="py-2 px-4">{marketData.ethPrice.toLocaleString()}</td>
                  <td className="py-2 px-4">{marketData.ethChange}</td>
                  <td className="py-2 px-4">Bearish / Long-term Bullish</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-semibold">Solana (SOL)</td>
                  <td className="py-2 px-4 text-green-600">{marketData.solPrice.toLocaleString()}</td>
                  <td className="py-2 px-4">{marketData.solChange}</td>
                  <td className="py-2 px-4">Bearish / Technical Weakness</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Liquidation Levels */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3">💥 Liquidation Watch</h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Bitcoin Liquidations */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Bitcoin (BTC)</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>$74,000:</span>
                    <span className="font-medium text-red-600">$2B short cluster</span>
                  </div>
                  <div className="flex justify-between">
                    <span>$69,759:</span>
                    <span className="font-medium text-red-600">$1.23B long liquidation</span>
                  </div>
                  <div className="flex justify-between">
                    <span>$65,000:</span>
                    <span className="font-medium text-red-600">$1.028B long cascade</span>
                  </div>
                </div>
              </div>

              {/* Ethereum Liquidations */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Ethereum (ETH)</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>$2,150:</span>
                    <span className="font-medium text-green-600">$958M short</span>
                  </div>
                  <div className="flex justify-between">
                    <span>$2,030:</span>
                    <span className="font-medium text-green-600">$273M short cluster</span>
                  </div>
                  <div className="flex justify-between">
                    <span>$1,951:</span>
                    <span className="font-medium text-red-600">$907M long</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Events */}
          <div>
            <h3 className="text-lg font-bold mb-3">📅 Today's Key Events</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>⏰ 20Mth BTC mining complete (scarcity narrative)</li>
              <li>📅 FOMC rate decision (March 18)</li>
              <li>📅 DC Blockchain Summit (March 17-18)</li>
              <li>📅 CLARITY Act signing (early April)</li>
            </ul>
          </div>

          {/* Sentiment Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">📈 Sentiment Summary</h3>
            <p className="text-sm text-gray-600">
              <strong>Overall:</strong> Mixed to Bearish
            </p>
            <p className="text-sm text-gray-600">
              <strong>BTC:</strong> Cautiously Optimistic — testing $73K-$75K resistance
            </p>
            <p className="text-sm text-gray-600">
              <strong>ETH:</strong> Bearish but long-term bullish — ETHB ETF launched
            </p>
            <p className="text-sm text-gray-600">
              <strong>SOL:</strong> Bearish — Alpenglow upgrade on horizon
            </p>
          </div>

          {/* Token Holder Action Items */}
          <div className="mt-4 pt-4 border-t">
            <h3 className="font-semibold mb-2">🎯 What to Watch Today</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• BTC: Watch $74K breakout / $65K support</li>
              <li>• ETH: Watch $2,119 upside / $1,951 downside</li>
              <li>• SOL: Monitor Alpenglow upgrade news</li>
              <li>• ETF flow trends for BTC & ETH</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}