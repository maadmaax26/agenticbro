/**
 * Trade Analysis Dashboard Component
 *
 * Displays detailed trade analysis from all bots
 * Holder-gated: Free users see daily summary, holders see detailed analysis
 */

import { useEffect, useState } from 'react';
import { botDataAggregator, BotStatus, PortfolioHealth } from '../../services/botDataAggregator';
import { tokenVerifier, HolderTier } from '../../services/tokenVerification';

interface TradeAnalysisProps {
  walletAddress?: string;
}

export default function TradeAnalysis({ walletAddress }: TradeAnalysisProps) {
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [tier, setTier] = useState<HolderTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!walletAddress) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Get user tier
      const { tier: userTier } = await tokenVerifier.getHoldings(walletAddress);
      setTier(userTier);

      // Get bot statuses
      const statuses = await botDataAggregator.getBotStatus();
      setBotStatuses(statuses);

      // Get health score
      const healthScore = await botDataAggregator.calculateHealthScore();
      setHealth(healthScore);

      setLoading(false);
    }

    loadData();

    // Refresh every 60 seconds
    const interval = setInterval(loadData, 60000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  function getHealthColor(status: string): string {
    const colors: { [key: string]: string } = {
      optimal: 'text-green-600 bg-green-50',
      good: 'text-blue-600 bg-blue-50',
      warning: 'text-yellow-600 bg-yellow-50',
      critical: 'text-red-600 bg-red-50',
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  }

  function getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      running: '🟢',
      stopped: '🔴',
      error: '⚠️',
    };
    return icons[status] || '⚪';
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">📈 Trade Analysis</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">📈 Trade Analysis</h2>
        <p className="text-gray-600">Connect your wallet to view analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Health Score */}
      {health && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">🏥 Portfolio Health</h2>
          <div className={`p-4 rounded-lg ${getHealthColor(health.status)}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold">{health.score}/100</span>
              <span className="text-sm uppercase font-semibold">{health.status}</span>
            </div>

            {/* Only show breakdown for holders */}
            {tier !== 'free' && (
              <div className="grid grid-cols-5 gap-2 text-sm">
                <div className="text-center">
                  <div className="font-semibold">{health.components.profit}/30</div>
                  <div className="text-gray-600">Profit</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{health.components.winRate}/25</div>
                  <div className="text-gray-600">Win Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{health.components.risk}/20</div>
                  <div className="text-gray-600">Risk</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{health.components.health}/15</div>
                  <div className="text-gray-600">Health</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{health.components.efficiency}/10</div>
                  <div className="text-gray-600">Efficiency</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bot Status Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">📊 Bot Status</h2>
          {tier === 'free' && (
            <span className="text-sm text-gray-500">Daily summary</span>
          )}
          {(tier === 'holder' || tier === 'whale') && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              Holder Tier
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-4">Bot</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Uptime</th>
                {tier !== 'free' && (
                  <>
                    <th className="py-2 px-4">Win Rate</th>
                    <th className="py-2 px-4">Daily Profit</th>
                    <th className="py-2 px-4">Positions</th>
                    <th className="py-2 px-4">Session DD</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {botStatuses.map((bot) => (
                <tr key={bot.bot} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4 capitalize font-semibold">{bot.bot}</td>
                  <td className="py-2 px-4">
                    <span className="flex items-center gap-2">
                      {getStatusIcon(bot.status)}
                      <span className="capitalize">{bot.status}</span>
                    </span>
                  </td>
                  <td className="py-2 px-4">{bot.uptime.toFixed(1)}%</td>

                  {tier !== 'free' && (
                    <>
                      <td className="py-2 px-4">
                        {bot.metrics.winRate !== undefined
                          ? `${bot.metrics.winRate.toFixed(1)}%`
                          : 'N/A'}
                      </td>
                      <td className="py-2 px-4">
                        {bot.metrics.dailyProfit !== undefined ? (
                          <span
                            className={
                              bot.metrics.dailyProfit >= 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            ${bot.metrics.dailyProfit.toFixed(2)}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {bot.metrics.openPositions !== undefined
                          ? bot.metrics.openPositions
                          : 'N/A'}
                      </td>
                      <td className="py-2 px-4">
                        {bot.metrics.sessionDD !== undefined
                          ? `${(bot.metrics.sessionDD * 100).toFixed(2)}%`
                          : 'N/A'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Positions (Holder only) */}
      {tier !== 'free' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">💼 Open Positions</h2>
          {botStatuses.some((bot) => bot.positions && bot.positions.length > 0) ? (
            <div className="space-y-3">
              {botStatuses.map((bot) =>
                bot.positions?.map((position, idx) => (
                  <div
                    key={`${bot.bot}-${idx}`}
                    className="border-l-4 border-purple-500 bg-gray-50 p-4 rounded-r"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold capitalize">{bot.bot}</span>
                        <span className="mx-2">•</span>
                        <span className="font-bold">{position.symbol}</span>
                        <span className="mx-2">•</span>
                        <span className={position.side === 'long' ? 'text-green-600' : 'text-red-600'}>
                          {position.side.toUpperCase()}
                        </span>
                      </div>
                      {position.pnl !== undefined && (
                        <span
                          className={
                            position.pnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'
                          }
                        >
                          ${position.pnl.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Size: {position.size} • Entry: ${position.entryPrice.toLocaleString()}
                      {position.currentPrice && ` • Current: $${position.currentPrice.toLocaleString()}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="text-gray-500">No open positions</p>
          )}
        </div>
      )}

      {/* Upgrade prompt for free users */}
      {tier === 'free' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-800">
            <strong>Want detailed analysis?</strong>
          </p>
          <p className="text-sm text-purple-600 mt-1">
            Hold 10,000 AGNTCBRO to unlock:
          </p>
          <ul className="text-sm text-purple-600 mt-2 list-disc list-inside">
            <li>Real-time bot status</li>
            <li>Win rate and profit metrics</li>
            <li>Open positions tracking</li>
            <li>Drawdown monitoring</li>
          </ul>
        </div>
      )}
    </div>
  );
}