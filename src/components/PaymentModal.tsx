/**
 * Payment Modal Component
 * 
 * Stripe checkout for purchasing scan credits
 * $1 USD per scan credit
 */

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { CREDIT_PACKAGES, useStripePayment } from '../lib/stripe';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PaymentModal({ 
  isOpen, 
  onClose
}: PaymentModalProps) {
  const { user, email, walletAddress, isAuthenticated } = useAuth();
  const { loading, error, createCheckoutSession, reset } = useStripePayment();
  
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (pkg: typeof CREDIT_PACKAGES[0]) => {
    if (!isAuthenticated) {
      alert('Please sign in first');
      return;
    }

    const userId = user?.id || walletAddress || 'anonymous';
    const userEmail = email || user?.email || '';

    await createCheckoutSession(pkg.id, userId, userEmail);
  };

  const totalCredits = (pkg: typeof CREDIT_PACKAGES[0]) => pkg.credits + (pkg.bonus || 0);
  const pricePerCredit = (pkg: typeof CREDIT_PACKAGES[0]) => {
    const total = totalCredits(pkg);
    return (pkg.price / total).toFixed(2);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.85)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full max-w-2xl rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(0, 0, 0, 0.95) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">💎</div>
          <h2 className="text-2xl font-bold text-white">Buy Scan Credits</h2>
          <p className="text-gray-400 text-sm mt-1">
            1 scan = $1 USD • Scan X profiles, Telegram channels, and more
          </p>
        </div>

        {/* Current Balance */}
        <div 
          className="mb-6 p-4 rounded-xl text-center"
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}
        >
          <p className="text-sm text-gray-400">Current Balance</p>
          <p className="text-3xl font-bold text-white">
            {user?.scan_credits || 0} <span className="text-purple-400 text-lg">credits</span>
          </p>
          {(user?.free_scans_used ?? 0) < 3 && (
            <p className="text-xs text-green-400 mt-1">
              + {3 - (user?.free_scans_used ?? 0)} free scans remaining
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div 
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
            }}
          >
            {error}
            <button 
              onClick={reset}
              className="ml-2 underline hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Credit Packages */}
        <div className="grid md:grid-cols-2 gap-4">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${
                selectedPackage === pkg.id ? 'ring-2 ring-emerald-500' : ''
              }`}
              style={{
                background: pkg.popular 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: pkg.popular 
                  ? '2px solid rgba(16, 185, 129, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {pkg.popular && (
                <div 
                  className="text-xs font-bold px-2 py-1 rounded-full inline-block mb-2"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)',
                    color: 'white',
                  }}
                >
                  MOST POPULAR
                </div>
              )}
              
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                  <p className="text-gray-400 text-sm">{pkg.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">${pkg.price}</p>
                  <p className="text-xs text-gray-500">${pricePerCredit(pkg)}/scan</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-2xl">🔍</span>
                <span className="text-white font-semibold">{totalCredits(pkg)} scans</span>
                {pkg.bonus && pkg.bonus > 0 && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#4ade80',
                    }}
                  >
                    +{pkg.bonus} bonus
                  </span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePurchase(pkg);
                }}
                disabled={loading || !isAuthenticated}
                className="w-full mt-4 py-2 px-4 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                style={{
                  background: pkg.popular
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                }}
              >
                {loading ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Pricing Info */}
        <div 
          className="mt-6 p-4 rounded-xl text-sm"
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <h4 className="font-semibold text-blue-400 mb-2">💡 How It Works</h4>
          <ul className="space-y-1 text-gray-300">
            <li>• Free scans are used first (3 free scans for new users)</li>
            <li>• After free scans, paid credits are used</li>
            <li>• Credits never expire</li>
            <li>• Track your balance in the top-right corner</li>
          </ul>
        </div>

        {/* Payment Security */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p className="flex items-center justify-center gap-2">
            <span>🔒</span>
            <span>Secure payment powered by Stripe</span>
          </p>
          <p className="mt-1">
            We never store your card details
          </p>
        </div>

        {/* Sign In Prompt */}
        {!isAuthenticated && (
          <div 
            className="mt-4 p-4 rounded-xl text-center"
            style={{
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
            }}
          >
            <p className="text-yellow-400 text-sm">
              ⚠️ Please sign in or connect your wallet to purchase credits
            </p>
          </div>
        )}
      </div>
    </div>
  );
}