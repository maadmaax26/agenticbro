/**
 * SubscriptionManager Component
 * 
 * Shows current plan, usage stats, and management controls
 * - Displays current plan name and scan usage
 * - Shows progress bar for monthly scans
 * - Provides buttons for Stripe Customer Portal and plan changes
 * - Handles subscription states: active, past_due, canceled, expired
 */

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'expired' | 'unpaid';
  current_period_start: string;
  current_period_end: string;
  scan_limit: number;
  scans_used: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionManagerProps {
  subscription: Subscription | null;
  onManageBilling: () => void;
  onChangePlan: () => void;
  onCancelSubscription: () => void;
  loading: boolean;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active: { color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-500/30' },
  past_due: { color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/30' },
  canceled: { color: 'text-gray-400', bg: 'bg-gray-900/20', border: 'border-gray-500/30' },
  expired: { color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/30' },
  unpaid: { color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/30' },
};

const PLAN_NAMES = {
  free: 'Free Tier',
  guardian: 'Guardian',
  sentinel: 'Sentinel',
  fortress: 'Fortress',
};

// ─── Component ────────────────────────────────────────────────────────────────
export function SubscriptionManager({
  subscription,
  onManageBilling,
  onChangePlan,
  onCancelSubscription,
  loading,
}: SubscriptionManagerProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  // Calculate usage percentage
  const usagePercent = subscription && subscription.scan_limit > 0
    ? Math.min(100, Math.round((subscription.scans_used / subscription.scan_limit) * 100))
    : 0;

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleCancelSubscription = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    setCanceling(true);
    try {
      await onCancelSubscription();
      setShowCancelConfirm(false);
      setCancelReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCanceling(false);
    }
  };

  // Determine if we can show usage bar
  const canShowUsage = subscription && subscription.scan_limit > 0;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {subscription && (
        <div
          className={`rounded-xl p-4 border ${STATUS_CONFIG[subscription.status as keyof typeof STATUS_CONFIG].bg} ${
            STATUS_CONFIG[subscription.status as keyof typeof STATUS_CONFIG].border
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${subscription.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <div className="text-white font-semibold">Subscription Status: {subscription.status.toUpperCase()}</div>
              <div className="text-gray-400 text-sm">
                {subscription.status === 'active'
                  ? `Next billing: ${formatDate(subscription.current_period_end)}`
                  : `Status updated: ${formatDate(subscription.updated_at)}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current plan info */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-6">Current Plan</h3>

        <div className="flex items-start justify-between">
          <div>
            <div className="text-3xl font-bold text-white mb-2">
              {subscription ? PLAN_NAMES[subscription.plan_id as keyof typeof PLAN_NAMES] : 'Free Tier'}
            </div>
            <div className="text-gray-400 text-sm">
              {subscription
                ? `Plan ID: ${subscription.id}`
                : 'No active subscription'}
            </div>
            <div className="text-gray-500 text-xs mt-1">
              Created: {subscription ? formatDate(subscription.created_at) : 'N/A'}
            </div>
          </div>
          {canShowUsage && subscription && subscription.status === 'active' && (
            <div className="text-right">
              <div className={`text-lg font-bold ${usagePercent >= 90 ? 'text-red-400' : 'text-green-400'}`}>
                {subscription.scans_used} / {subscription.scan_limit} scans
              </div>
              <div className="text-gray-500 text-xs mt-1">
                {100 - usagePercent}% remaining
              </div>
            </div>
          )}
        </div>

        {/* Usage progress bar */}
        {canShowUsage && subscription && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Monthly Scan Usage</span>
              <span className="text-white font-semibold">{usagePercent}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 75 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-4">
        {subscription && subscription.status === 'active' && (
          <button
            onClick={onManageBilling}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>⚙️</span>
            Manage Billing & Subscription
          </button>
        )}

        <button
          onClick={onChangePlan}
          disabled={loading || !subscription}
          className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span>🔄</span>
          {subscription ? 'Change Plan' : 'Upgrade to Pro'}
        </button>

        {subscription && subscription.status === 'active' && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[#0a0a0f] px-2 text-gray-500">Or</span>
              </div>
            </div>

            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl border border-red-500/30 bg-red-900/10 hover:bg-red-900/20 text-red-400 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>🚫</span>
              Cancel Subscription
            </button>
          </>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0f0f19] border border-red-500/30 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Cancel Subscription?</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to cancel your subscription? You'll lose access to Pro features at the end of your current billing period.
            </p>

            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Why are you canceling? (Optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Your feedback helps us improve..."
                className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-gray-700 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none resize-none h-24"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={canceling}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-all disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all disabled:opacity-50"
              >
                {canceling ? 'Canceling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
