/**
 * Payment Modal Component
 * 
 * Multiple payment options:
 * - Stripe (USD): $1/scan credit
 * - USDC (Solana): $1 equivalent per scan
 * - USDC (Base): $1 equivalent per scan
 * - AGNTCBRO tokens: $1 equivalent value per scan
 * 
 * Track credits by wallet address or email
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  CREDIT_PACKAGES, 
  useStripePayment,
  getAGNTCBROPrice,
  AGNTCBRO_MINT,
} from '../lib/payments';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentMethod = 'stripe' | 'usdc-solana' | 'usdc-base' | 'agntcbro';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PaymentModal({ 
  isOpen, 
  onClose
}: PaymentModalProps) {
  const { user, email, walletAddress, isAuthenticated } = useAuth();
  const { loading, error, createCheckoutSession, reset } = useStripePayment();
  
  const [selectedPackage, setSelectedPackage] = useState<string | null>('pro');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [agntcbroPrice, setAgntcbroPrice] = useState<number>(0);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Fetch AGNTCBRO price
  useEffect(() => {
    if (isOpen && paymentMethod === 'agntcbro') {
      setLoadingPrice(true);
      getAGNTCBROPrice()
        .then(price => setAgntcbroPrice(price))
        .catch(console.error)
        .finally(() => setLoadingPrice(false));
    }
  }, [isOpen, paymentMethod]);

  if (!isOpen) return null;

  const selectedPkg = CREDIT_PACKAGES.find(p => p.id === selectedPackage) || CREDIT_PACKAGES[0];
  const totalCostUSD = selectedPkg.price;

  // Calculate AGNTCBRO amount needed
  const agntcbroAmount = agntcbroPrice > 0 ? (totalCostUSD / agntcbroPrice) : 0;

  const handleStripePurchase = async () => {
    if (!isAuthenticated) {
      alert('Please sign in or connect your wallet first');
      return;
    }

    const userId = user?.id || walletAddress || 'anonymous';
    const userEmail = email || user?.email || '';

    await createCheckoutSession(selectedPkg.id, userId, userEmail);
  };

  const handleCryptoPurchase = async (method: PaymentMethod) => {
    if (!walletAddress) {
      alert('Please connect your wallet to pay with crypto');
      return;
    }

    // For USDC payments, we'll show payment instructions
    // In production, this would integrate with a wallet connector
    alert(`Crypto payment integration coming soon! You'll be able to pay ${totalCostUSD} USDC via ${method === 'usdc-solana' ? 'Solana' : method === 'usdc-base' ? 'Base' : 'AGNTCBRO tokens'}.`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.85)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full max-w-3xl rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
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
            1 scan = $1 USD (or equivalent in crypto)
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

        {/* Credit Package Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Select Package</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all text-center ${
                  selectedPackage === pkg.id 
                    ? 'ring-2 ring-emerald-500 bg-emerald-500/10' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {pkg.popular && (
                  <div className="text-xs text-emerald-400 font-semibold mb-1">★ POPULAR</div>
                )}
                <div className="text-2xl font-bold text-white">{pkg.credits}</div>
                <div className="text-xs text-gray-400">scans</div>
                <div className="text-lg font-semibold text-white mt-2">${pkg.price}</div>
                <div className="text-xs text-gray-500">USD</div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Payment Method</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Stripe USD */}
            <div
              onClick={() => setPaymentMethod('stripe')}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                paymentMethod === 'stripe' 
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/10' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-2xl mb-1">💳</div>
              <div className="text-sm font-semibold text-white">USD</div>
              <div className="text-xs text-gray-400">Stripe</div>
              <div className="text-xs text-emerald-400 mt-1">${totalCostUSD}</div>
            </div>

            {/* USDC Solana */}
            <div
              onClick={() => setPaymentMethod('usdc-solana')}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                paymentMethod === 'usdc-solana' 
                  ? 'ring-2 ring-purple-500 bg-purple-500/10' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-2xl mb-1">◎</div>
              <div className="text-sm font-semibold text-white">USDC</div>
              <div className="text-xs text-gray-400">Solana</div>
              <div className="text-xs text-purple-400 mt-1">{totalCostUSD} USDC</div>
            </div>

            {/* USDC Base */}
            <div
              onClick={() => setPaymentMethod('usdc-base')}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                paymentMethod === 'usdc-base' 
                  ? 'ring-2 ring-blue-500 bg-blue-500/10' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-2xl mb-1">🔷</div>
              <div className="text-sm font-semibold text-white">USDC</div>
              <div className="text-xs text-gray-400">Base</div>
              <div className="text-xs text-blue-400 mt-1">{totalCostUSD} USDC</div>
            </div>

            {/* AGNTCBRO */}
            <div
              onClick={() => setPaymentMethod('agntcbro')}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                paymentMethod === 'agntcbro' 
                  ? 'ring-2 ring-amber-500 bg-amber-500/10' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-2xl mb-1">🦞</div>
              <div className="text-sm font-semibold text-white">AGNTCBRO</div>
              <div className="text-xs text-gray-400">Token</div>
              <div className="text-xs text-amber-400 mt-1">
                {loadingPrice ? '...' : agntcbroPrice > 0 ? `${agntcbroAmount.toFixed(0)}` : '?'} tokens
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        {paymentMethod === 'agntcbro' && (
          <div 
            className="mb-6 p-4 rounded-xl"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <h4 className="font-semibold text-amber-400 mb-2">💰 AGNTCBRO Payment</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p>• Current price: ${agntcbroPrice.toFixed(6)} per AGNTCBRO</p>
              <p>• Required: {agntcbroAmount.toFixed(0)} AGNTCBRO (${totalCostUSD} USD equivalent)</p>
              <p>• Contract: <code className="text-xs bg-black/30 px-1 rounded">{AGNTCBRO_MINT.slice(0, 12)}...</code></p>
            </div>
          </div>
        )}

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

        {/* Purchase Button */}
        <button
          onClick={() => {
            if (paymentMethod === 'stripe') {
              handleStripePurchase();
            } else {
              handleCryptoPurchase(paymentMethod);
            }
          }}
          disabled={loading || loadingPrice || (!isAuthenticated && paymentMethod === 'stripe') || (!walletAddress && paymentMethod !== 'stripe')}
          className="w-full py-4 px-6 rounded-xl font-bold text-white text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
          style={{
            background: paymentMethod === 'stripe' 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : paymentMethod === 'usdc-solana'
              ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
              : paymentMethod === 'usdc-base'
              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          }}
        >
          {loading ? 'Processing...' : (
            <>
              {paymentMethod === 'stripe' && `Pay $${totalCostUSD} with Stripe`}
              {paymentMethod === 'usdc-solana' && `Pay ${totalCostUSD} USDC (Solana)`}
              {paymentMethod === 'usdc-base' && `Pay ${totalCostUSD} USDC (Base)`}
              {paymentMethod === 'agntcbro' && `Pay ${agntcbroAmount.toFixed(0)} AGNTCBRO`}
            </>
          )}
        </button>

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
            <li>• <span className="text-green-400">3 free scans</span> for new users</li>
            <li>• Free scans are used first</li>
            <li>• After free scans: <span className="text-emerald-400">$1/scan</span></li>
            <li>• Credits tracked by wallet or email</li>
            <li>• Credits never expire</li>
          </ul>
        </div>

        {/* Crypto Note */}
        {paymentMethod !== 'stripe' && (
          <div 
            className="mt-4 p-3 rounded-lg text-xs text-center"
            style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              color: '#c4b5fd',
            }}
          >
            <p>Crypto payments require wallet connection</p>
            <p className="mt-1">Credits will be added after transaction confirmation</p>
          </div>
        )}

        {/* Payment Security */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p className="flex items-center justify-center gap-2">
            <span>🔒</span>
            <span>Secure payment • We never store card details</span>
          </p>
        </div>

        {/* Sign In Prompt */}
        {!isAuthenticated && paymentMethod === 'stripe' && (
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

        {/* Wallet Required */}
        {paymentMethod !== 'stripe' && !walletAddress && (
          <div 
            className="mt-4 p-4 rounded-xl text-center"
            style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}
          >
            <p className="text-purple-400 text-sm">
              🔗 Please connect your wallet to pay with crypto
            </p>
          </div>
        )}
      </div>
    </div>
  );
}