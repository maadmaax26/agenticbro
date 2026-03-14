/**
 * Signal Feed Component
 *
 * Displays real-time trading signals from all bots
 * Holder-gated: Free users see 1 signal/day, holders see all
 */

import { useEffect, useState } from 'react';
import { botDataAggregator, BotSignal } from '../../services/botDataAggregator';
import { tokenVerifier, HolderTier } from '../../services/tokenVerification';

interface SignalFeedProps {
  walletAddress?: string;
}

export default function SignalFeed({ walletAddress }: SignalFeedProps) {
  const [signals, setSignals] = useState<BotSignal[]>([]);
  const [tier, setTier] = useState<HolderTier>('free');
  const [loading, setLoading] = useState(true);
  const [signalCount, setSignalCount] = useState(0);

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

      // Get signals
      const allSignals = await botDataAggregator.getSignals();

      // Limit signals for free users (1 per day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaySignals = allSignals.filter((s) => s.timestamp >= today);
      setSignalCount(todaySignals.length);

      if (userTier === 'free') {
        // Free users only see the first signal of the day
        setSignals(todaySignals.slice(0, 1));
      } else {
        // Holders see all signals
        setSignals(allSignals.slice(0, 20));
      }

      setLoading(false);
    }

    loadData();

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  function getSignalIcon(source: string): string {
    const icons: { [key: string]: string } = {
      hyperliquid: '🔴',
      kraken: '🟢',
      mes: '🟡',
      polymarket: '🔵',
    };
    return icons[source] || '📊';
  }

  function getSignalColor(type: string): string {
    const colors: { [key: string]: string } = {
      entry: 'text-green-500',
      exit: 'text-red-500',
      alert: 'text-yellow-500',
      fill: 'text-blue-500',
      error: 'text-red-600',
    };
    return colors[type] || 'text-gray-500';
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">📊 Live Signals</h2>
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
        <h2 className="text-xl font-bold mb-4">📊 Live Signals</h2>
        <p className="text-gray-600">Connect your wallet to view signals</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📊 Live Signals</h2>
        {tier === 'free' && (
          <span className="text-sm text-gray-500">
            {signalCount > 1
              ? `${signalCount} signals today (hold 10k AGNTCBRO to see all)`
              : `${signalCount} signal today`}
          </span>
        )}
        {tier === 'holder' && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
            Holder Tier
          </span>
        )}
        {tier === 'whale' && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
            Whale Tier
          </span>
        )}
      </div>

      {signals.length === 0 ? (
        <p className="text-gray-500">No signals today</p>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="border-l-4 border-purple-500 bg-gray-50 p-4 rounded-r"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getSignalIcon(signal.source)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold capitalize">
                      {signal.source}
                    </span>
                    <span className={`text-sm ${getSignalColor(signal.type)} uppercase`}>
                      {signal.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(signal.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{signal.data.message || signal.data.description || ''}</p>
                  {signal.data.price && (
                    <span className="text-sm text-gray-600">
                      @ ${signal.data.price.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tier === 'free' && signalCount > 1 && (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>Want to see all {signalCount} signals?</strong>
          </p>
          <p className="text-sm text-purple-600 mt-1">
            Hold 10,000 AGNTCBRO to unlock full signal access
          </p>
        </div>
      )}
    </div>
  );
}