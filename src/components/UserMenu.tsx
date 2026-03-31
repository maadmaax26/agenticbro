/**
 * User Menu Component
 * 
 * Shows login button or user balance + profile
 * Positioned in top-right corner of the page
 */

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserMenuProps {
  onLoginClick: () => void;
  onBuyCreditsClick: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function UserMenu({ onLoginClick, onBuyCreditsClick }: UserMenuProps) {
  const { 
    email, 
    walletAddress, 
    isAuthenticated, 
    authMethod,
    loading,
    scanCredits,
    freeScansRemaining,
    logout 
  } = useAuth();
  
  const [showDropdown, setShowDropdown] = useState(false);

  const totalScans = freeScansRemaining + scanCredits;

  if (loading) {
    return (
      <div 
        className="px-4 py-2 rounded-lg animate-pulse"
        style={{ background: 'rgba(139, 92, 246, 0.1)', width: '120px', height: '40px' }}
      />
    );
  }

  // Not logged in - show login button
  if (!isAuthenticated) {
    return (
      <button
        onClick={onLoginClick}
        className="px-4 py-2 rounded-lg font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
          boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
        }}
      >
        <span>🔐</span>
        <span>Sign In</span>
      </button>
    );
  }

  // Logged in - show balance and dropdown
  return (
    <div className="relative">
      {/* Balance Display */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 px-4 py-2 rounded-lg transition-all hover:scale-[1.02]"
        style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        {/* Credits */}
        <div className="flex items-center gap-1">
          <span className="text-lg">🔍</span>
          <span className="text-white font-semibold">{totalScans}</span>
        </div>

        {/* Separator */}
        <div className="w-px h-5" style={{ background: 'rgba(139, 92, 246, 0.3)' }} />

        {/* User Avatar */}
        <div 
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
            color: 'white',
          }}
        >
          {authMethod === 'email' 
            ? (email?.charAt(0).toUpperCase() || 'U')
            : (walletAddress?.slice(0, 1) || 'W')}
        </div>

        <span className="text-gray-400 text-xs">▼</span>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Menu */}
          <div 
            className="absolute right-0 mt-2 w-64 rounded-xl z-50 overflow-hidden"
            style={{
              background: 'rgba(15, 15, 26, 0.98)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* User Info */}
            <div className="p-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
              <p className="text-white font-semibold truncate">
                {authMethod === 'email' ? email : `${walletAddress?.slice(0, 8)}...${walletAddress?.slice(-4)}`}
              </p>
              <p className="text-xs text-gray-400 capitalize">{authMethod} account</p>
            </div>

            {/* Balance */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Free Scans</span>
                <span className="text-green-400 font-semibold">{freeScansRemaining}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Paid Credits</span>
                <span className="text-purple-400 font-semibold">{scanCredits}</span>
              </div>
              <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-white font-semibold">Total Scans</span>
                <span className="text-white font-bold text-lg">{totalScans}</span>
              </div>
            </div>

            {/* Buy Credits Button */}
            <div className="px-4 pb-2">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onBuyCreditsClick();
                }}
                className="w-full py-2 px-4 rounded-lg font-semibold text-white transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                }}
              >
                <span>💎</span>
                <span>Buy Credits</span>
              </button>
            </div>

            {/* Logout */}
            <div className="p-4 pt-2">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  logout();
                }}
                className="w-full py-2 px-4 rounded-lg text-gray-400 hover:text-white transition-colors text-sm"
                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}