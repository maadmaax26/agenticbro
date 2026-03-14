/**
 * Alert Feed Component
 *
 * Displays real-time alerts from all bots
 * Holder-gated: Free users see top 3 alerts/day, holders see all
 */

import { useEffect, useState } from 'react';
import { botDataAggregator, BotSignal } from '../../services/botDataAggregator';
import { tokenVerifier, HolderTier } from '../../services/tokenVerification';

interface AlertFeedProps {
  walletAddress?: string;
}

export default function AlertFeed({ walletAddress }: AlertFeedProps) {
  const [alerts, setAlerts] = useState<BotSignal[]>([]);
  const [tier, setTier] = useState<HolderTier>('free');
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

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

      // Get alerts
      const allAlerts = await botDataAggregator.getAlerts();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayAlerts = allAlerts.filter((a) => a.timestamp >= today);
      setAlertCount(todayAlerts.length);

      // Limit alerts for free users (top 3 per day)
      if (userTier === 'free') {
        setAlerts(todayAlerts.slice(0, 3));
      } else {
        setAlerts(allAlerts.slice(0, 20));
      }

      setLoading(false);
    }

    loadData();

    // Refresh every 15 seconds (alerts are time-sensitive)
    const interval = setInterval(loadData, 15000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  function getAlertIcon(source: string): string {
    const icons: { [key: string]: string } = {
      hyperliquid: '🔴',
      kraken: '🟢',
      mes: '🟡',
      polymarket: '🔵',
    };
    return icons[source] || '📊';
  }

  function getAlertSeverity(message: string): 'info' | 'warning' | 'error' {
    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('critical') || lower.includes('disconnect')) {
      return 'error';
    }
    if (lower.includes('warning') || lower.includes('caution') || lower.includes('watch')) {
      return 'warning';
    }
    return 'info';
  }

  function getAlertColor(severity: string): string {
    const colors: { [key: string]: string } = {
      info: 'border-blue-500 bg-blue-50',
      warning: 'border-yellow-500 bg-yellow-50',
      error: 'border-red-500 bg-red-50',
    };
    return colors[severity] || 'border-gray-500 bg-gray-50';
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">🚨 Live Alerts</h2>
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
        <h2 className="text-xl font-bold mb-4">🚨 Live Alerts</h2>
        <p className="text-gray-600">Connect your wallet to view alerts</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">🚨 Live Alerts</h2>
        {tier === 'free' && (
          <span className="text-sm text-gray-500">
            {alertCount > 3
              ? `Showing 3 of ${alertCount} alerts today`
              : `${alertCount} alerts today`}
          </span>
        )}
        {(tier === 'holder' || tier === 'whale') && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
            {tier === 'whale' ? 'Whale Tier (SMS alerts enabled)' : 'Holder Tier'}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-gray-500">No alerts today</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const message = alert.data.message || alert.data.description || 'No message';
            const severity = getAlertSeverity(message);

            return (
              <div
                key={alert.id}
                className={`border-l-4 ${getAlertColor(severity)} p-4 rounded-r`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getAlertIcon(alert.source)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold capitalize">{alert.source}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      {severity === 'error' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded uppercase">
                          Critical
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700">{message}</p>
                    {alert.data.actionRequired && (
                      <p className="text-sm text-red-600 mt-1">
                        ⚠️ Action required: {alert.data.actionRequired}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tier === 'free' && alertCount > 3 && (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>Want to see all {alertCount} alerts?</strong>
          </p>
          <p className="text-sm text-purple-600 mt-1">
            Hold 10,000 AGNTCBRO to unlock full alert access
          </p>
        </div>
      )}

      {/* Whale tier: SMS notification settings */}
      {tier === 'whale' && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>📱 SMS Notifications Enabled</strong>
          </p>
          <p className="text-sm text-yellow-600 mt-1">
            Critical alerts are sent to your phone instantly
          </p>
        </div>
      )}
    </div>
  );
}