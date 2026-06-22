/**
 * Authentication Modal Component
 * 
 * Provides email/password login and registration
 * Also supports wallet connect
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AuthModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialMode = 'login' 
}: AuthModalProps) {
  const { connected, publicKey } = useWallet();
  const { 
    loginWithEmail, 
    registerWithEmail, 
    loading,
    isAuthenticated,
    user,
    linkWalletToEmailAccount,
  } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showWalletLink, setShowWalletLink] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);

  // Close on success (but not if we're showing the wallet link step)
  useEffect(() => {
    if (isAuthenticated && !showWalletLink) {
      onClose();
      onSuccess?.();
    }
  }, [isAuthenticated, onClose, onSuccess, showWalletLink]);

  // Show wallet link step automatically after email auth if no wallet linked yet
  useEffect(() => {
    if (isAuthenticated && user && !user.wallet_address && !linkSuccess) {
      setShowWalletLink(true);
    }
  }, [isAuthenticated, user, linkSuccess]);

  // Reset error when mode changes
  useEffect(() => {
    setError(null);
  }, [mode]);

  if (!isOpen) return null;

  // ── Wallet Link Step (shown after email auth if no wallet linked) ──────────
  if (showWalletLink && isAuthenticated) {
    const handleLinkWallet = async () => {
      if (!connected || !publicKey) {
        setError('Please connect your Solana wallet first');
        return;
      }
      setLinking(true);
      setError(null);
      const walletAddr = publicKey.toBase58();
      const { error: linkError } = await linkWalletToEmailAccount(walletAddr);
      setLinking(false);
      if (linkError) {
        setError(linkError);
      } else {
        setLinkSuccess(true);
        setTimeout(() => {
          setShowWalletLink(false);
          onClose();
          onSuccess?.();
        }, 2000);
      }
    };

    const handleSkip = () => {
      setShowWalletLink(false);
      onClose();
      onSuccess?.();
    };

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.8)' }}
        onClick={(e) => e.target === e.currentTarget && handleSkip()}
      >
        <div 
          className="w-full max-w-md rounded-2xl p-6 relative"
          style={{
            background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, rgba(0, 0, 0, 0.95) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">💼</div>
            <h2 className="text-2xl font-bold text-white">Link Your Solana Wallet</h2>
            <p className="text-gray-400 text-sm mt-1">
              Associate your wallet to unlock token-gated scan benefits
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            <div 
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)' }}
            >
              <span className="text-xl">💎</span>
              <div>
                <p className="text-white text-sm font-semibold">Holder Tier — 50 scans/month</p>
                <p className="text-gray-500 text-xs">Hold $100+ in $AGNTCBRO</p>
              </div>
            </div>
            <div 
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.2)' }}
            >
              <span className="text-xl">🐋</span>
              <div>
                <p className="text-white text-sm font-semibold">Whale Tier — Unlimited scans</p>
                <p className="text-gray-500 text-xs">Hold $1,000+ in $AGNTCBRO</p>
              </div>
            </div>
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
            </div>
          )}

          {/* Success */}
          {linkSuccess ? (
            <div 
              className="p-4 rounded-lg text-center"
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#4ade80',
              }}
            >
              ✅ Wallet linked successfully! Loading your entitlements…
            </div>
          ) : (
            <>
              {/* Wallet Connect Button */}
              <div className="space-y-3">
                <div className="flex justify-center">
                  <WalletMultiButton 
                    style={{ 
                      background: connected ? 'rgba(34, 197, 94, 0.15)' : 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                      border: connected ? '1px solid rgba(34, 197, 94, 0.4)' : 'none',
                      borderRadius: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      fontWeight: 600,
                      color: 'white',
                    }} 
                  / >
                </div>

                {connected && publicKey && (
                  <p className="text-center text-xs text-gray-500">
                    Connected: {publicKey.toBase58().slice(0, 8)}…{publicKey.toBase58().slice(-4)}
                  </p>
                )}

                <button
                  onClick={handleLinkWallet}
                  disabled={!connected || linking}
                  className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                  }}
                >
                  {linking ? 'Linking…' : connected ? 'Link Wallet to Account' : 'Connect wallet first'}
                </button>
              </div>

              {/* Skip */}
              <div className="mt-4 text-center">
                <button
                  onClick={handleSkip}
                  className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
                >
                  Skip for now — I'll do this later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      
      const { error: regError } = await registerWithEmail(email, password);
      if (regError) {
        setError(regError);
      } else {
        // Fire Google Ads sign-up conversion on successful email registration
        const conversionFired = sessionStorage.getItem('gads_signup_conversion');
        if (!conversionFired && typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'conversion', {
            send_to: 'AW-18179207888/YqbSCI_OoLIcENDlwtxD',
            value: 1.0,
            currency: 'USD',
          });
          sessionStorage.setItem('gads_signup_conversion', '1');
        }
      }
    } else {
      const { error: loginError } = await loginWithEmail(email, password);
      if (loginError) {
        setError(loginError);
      }
    }
  };

  const handleWalletLogin = async () => {
    // Wallet connection is handled via WalletMultiButton
    // User can click the wallet button directly
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.8)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{
          background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, rgba(0, 0, 0, 0.95) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
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
          <div className="text-4xl mb-3">🔐</div>
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' 
              ? 'Sign in to access your scans and credits' 
              : 'Get 5 free scans when you sign up'}
          </p>
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
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 rounded-lg bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-lg bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
            }}
          >
            {loading 
              ? 'Processing...' 
              : mode === 'login' 
                ? 'Sign In' 
                : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(139, 92, 246, 0.2)' }} />
          <span className="px-4 text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(139, 92, 246, 0.2)' }} />
        </div>

        {/* Wallet Connect */}
        <div className="space-y-3">
          <button
            onClick={handleWalletLogin}
            disabled={connected}
            className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            <span>💼</span>
            <span>{connected ? 'Wallet Connected' : 'Connect Wallet'}</span>
          </button>

          {/* Wallet Multi Button (styled) */}
          <div className="flex justify-center">
            <WalletMultiButton 
              style={{ 
                background: 'transparent',
                border: 'none',
                padding: 0,
              }} 
            />
          </div>
        </div>

        {/* Mode Switch */}
        <div className="mt-6 text-center text-sm">
          <span className="text-gray-400">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </span>
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="ml-2 text-purple-400 hover:text-purple-300 font-medium"
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        {/* Free Scans Notice */}
        <div 
          className="mt-4 p-3 rounded-lg text-xs text-center"
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            color: '#4ade80',
          }}
        >
          🎁 New accounts get <strong>5 free scans</strong> — link your Solana wallet after signup to unlock <strong>50 scans/month</strong> with $100+ in $AGNTCBRO!
        </div>
      </div>
    </div>
  );
}