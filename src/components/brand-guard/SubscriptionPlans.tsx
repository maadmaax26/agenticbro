/**
 * SubscriptionPlans Component
 * 
 * Displays 4 plan cards with upgrade/downgrade buttons
 * - Free: 25 scans
 * - Guardian: $29/mo, 50 scans
 * - Sentinel: $99/mo, 200 scans
 * - Fortress: $299/mo, unlimited
 */

import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Plan {
  id: string;
  name: string;
  price: number;
  scans: number;
  features: string[];
  description?: string;
  highlight?: boolean;
}

export interface SubscriptionPlansProps {
  currentPlanId: string | null;
  onSelectPlan: (planId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    scans: 25,
    features: [
      '25 brand scans',
      'Real-time monitoring',
      'Email alerts',
      'Brand health score',
    ],
    description: 'Perfect for individuals',
  },
  {
    id: 'guardian',
    name: 'Guardian',
    price: 29,
    scans: 50,
    features: [
      '50 brand scans/month',
      'Priority monitoring',
      'Advanced threat detection',
      'Email alerts',
      'Brand health score',
    ],
    description: 'Best for small businesses',
    highlight: false,
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    price: 99,
    scans: 200,
    features: [
      '200 brand scans/month',
      'Real-time monitoring',
      'Advanced threat detection',
      'Priority support',
      'API access',
      'Brand health score',
    ],
    description: 'Recommended for enterprises',
    highlight: true,
  },
  {
    id: 'fortress',
    name: 'Fortress',
    price: 299,
    scans: -1, // unlimited
    features: [
      'Unlimited brand scans',
      '24/7 real-time monitoring',
      'Advanced threat detection',
      'Priority support',
      'API access',
      'Custom reporting',
    ],
    description: 'Ultimate protection',
    highlight: false,
  },
];

// ─── Plan card colors ────────────────────────────────────────────────────────
const PLAN_COLORS = {
  free: 'border-gray-600 bg-gray-900/30 hover:bg-gray-900/50',
  guardian: 'border-blue-500 bg-blue-900/20 hover:bg-blue-900/30 shadow-blue-900/20',
  sentinel: 'border-purple-500 bg-purple-900/20 hover:bg-purple-900/30 shadow-purple-900/20',
  fortress: 'border-amber-500 bg-amber-900/20 hover:bg-amber-900/30 shadow-amber-900/20',
};

const PLAN_HEADER_COLORS = {
  free: 'bg-gray-600/20 text-gray-300',
  guardian: 'bg-blue-600/20 text-blue-300',
  sentinel: 'bg-purple-600/20 text-purple-300',
  fortress: 'bg-amber-600/20 text-amber-300',
};

const PLAN_ACCENT = {
  free: 'text-gray-400',
  guardian: 'text-blue-400',
  sentinel: 'text-purple-400',
  fortress: 'text-amber-400',
};

// ─── Component ────────────────────────────────────────────────────────────────
export function SubscriptionPlans({ currentPlanId, onSelectPlan }: SubscriptionPlansProps) {
  const { walletAddress, email } = useAuth();
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') {
      setError('Free tier requires no subscription');
      return;
    }

    if (planId === currentPlanId) {
      setError('You are already on this plan');
      return;
    }

    if (!walletAddress && !email) {
      setError('Please sign in or connect your wallet first');
      return;
    }

    setProcessing(planId);
    setError(null);

    try {
      await onSelectPlan(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(null);
    }
  };

  const getPlanStatus = (planId: string) => {
    if (planId === currentPlanId) {
      return (
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          Current Plan
        </div>
      );
    }
    if (currentPlanId && ['guardian', 'sentinel', 'fortress'].includes(currentPlanId)) {
      const currentIdx = ['free', 'guardian', 'sentinel', 'fortress'].indexOf(currentPlanId);
      const planIdx = ['free', 'guardian', 'sentinel', 'fortress'].indexOf(planId);
      if (planIdx > currentIdx) {
        return <span className="text-green-400 text-xs font-semibold">Upgrade</span>;
      } else {
        return <span className="text-red-400 text-xs font-semibold">Downgrade</span>;
      }
    }
    return <span className="text-gray-500 text-xs">Select plan</span>;
  };

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isProcessing = processing === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 border transition-all duration-200 ${
                isCurrent
                  ? PLAN_COLORS[plan.id as keyof typeof PLAN_COLORS]
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              } ${plan.highlight ? 'ring-2 ring-purple-500/50 shadow-2xl shadow-purple-900/20' : ''}`}
            >
              {/* Highlight badge */}
              {plan.highlight && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-bold">
                  RECOMMENDED
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </span>
                  <span className="text-gray-400">/month</span>
                </div>
                <div className={`text-sm font-semibold mt-1 ${PLAN_ACCENT[plan.id as keyof typeof PLAN_ACCENT]}`}>
                  {plan.scans === -1 ? 'Unlimited scans' : `${plan.scans} scans/month`}
                </div>
                {/* Free trial badge for paid plans */}
                {plan.price > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full">
                      7-DAY FREE TRIAL
                    </span>
                    <span className="text-xs text-gray-500">
                      No credit card required
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Status badge */}
              <div className="mb-4 flex justify-center">
                {getPlanStatus(plan.id)}
              </div>

              {/* CTA button */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isProcessing || isCurrent}
                className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all ${
                  isCurrent
                    ? 'bg-gray-600/30 cursor-not-allowed'
                    : isProcessing
                    ? 'bg-white/20 cursor-wait'
                    : `bg-gradient-to-r from-${PLAN_HEADER_COLORS[plan.id as keyof typeof PLAN_HEADER_COLORS].split(' ')[0].replace('bg-', '')} to-white/20 hover:scale-[1.02] active:scale-[0.98]`
                }`}
                style={
                  isCurrent
                    ? {}
                    : isProcessing
                    ? {}
                    : {
                        background: plan.id === 'free'
                          ? 'rgba(139, 92, 246, 0.2)'
                          : plan.id === 'guardian'
                          ? 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(59,130,246,0.1))'
                          : plan.id === 'sentinel'
                          ? 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(168,85,247,0.1))'
                          : 'linear-gradient(135deg, rgba(251,191,36,0.3), rgba(251,191,36,0.1))',
                      }
                }
              >
                {isCurrent ? 'Current Plan' : isProcessing ? 'Processing...' : 'Start Free Trial'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
