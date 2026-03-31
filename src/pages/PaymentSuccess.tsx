/**
 * Payment Success Page
 * 
 * Shown after successful Stripe checkout
 * Verifies payment and credits user account
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useStripePayment } from '../lib/stripe';

interface PaymentSuccessProps {
  sessionId?: string;
  onClose?: () => void;
}

export default function PaymentSuccess({ sessionId, onClose }: PaymentSuccessProps) {
  const { addScanCredits } = useAuth();
  const { verifyPayment, loading, success, error } = useStripePayment();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      console.error('No session_id provided');
      return;
    }

    // Verify payment and get credits
    const verify = async () => {
      const result = await verifyPayment(sessionId);
      
      if (result?.credits) {
        setCredits(result.credits);
        addScanCredits(result.credits);
      }
    };

    verify();
  }, [sessionId, verifyPayment, addScanCredits]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      <div 
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(0, 0, 0, 0.95) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {loading && (
          <>
            <div className="text-5xl mb-4 animate-spin">⏳</div>
            <h1 className="text-2xl font-bold text-white mb-2">Verifying Payment...</h1>
            <p className="text-gray-400">Please wait while we confirm your purchase</p>
          </>
        )}

        {success && credits && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-gray-400 mb-6">
              Your credits have been added to your account
            </p>
            
            <div 
              className="p-6 rounded-xl mb-6"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <p className="text-sm text-gray-400 mb-1">Credits Added</p>
              <p className="text-4xl font-bold text-emerald-400">
                +{credits}
              </p>
            </div>

            <button
              onClick={() => onClose?.()}
              className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              }}
            >
              Start Scanning →
            </button>
          </>
        )}

        {error && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Verification Failed</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            
            <div className="space-y-3">
              <button
                onClick={() => onClose?.()}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                }}
              >
                Return Home
              </button>
              
              <p className="text-xs text-gray-500">
                If you were charged, please contact support with your order confirmation
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}