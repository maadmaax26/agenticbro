/**
 * AGNTCBRO Balance Tracker
 *
 * Prominent mobile-first component that shows the connected wallet's
 * $AGNTCBRO balance, USD value, price, and tier status.
 * Auto-refreshes every 60 seconds while connected.
 * Uses the existing useTokenGating hook for data.
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTokenGating, isTestWallet } from '../hooks/useTokenGating';

export default function AgntcbroBalanceTracker() {
  const { publicKey, connected } = useWallet();
  const { balance, usdValue, tokenPriceUsd, holderTierUnlocked, whaleTierUnlocked, loading, error } = useTokenGating();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState(true);
  const walletAddr = publicKey?.toBase58() ?? '';

  // Mark last successful update
  useEffect(() => {
    if (!loading && balance >= 0 && !error) {
      setLastUpdated(new Date());
    }
  }, [loading, balance, error]);

  // Auto-refresh every 60s while connected
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      // useTokenGating will re-fetch if session cache is stale
      // Force a fresh check by clearing session cache
      const key = `agntcbro_gating_${walletAddr}`;
      try { sessionStorage.removeItem(key); } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, [connected, walletAddr]);

  if (!connected) return null;

  const isTest = walletAddr ? isTestWallet(walletAddr) : false;

  const formatBalance = (n: number): string => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatUsd = (n: number): string => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n > 0) return `$${n.toFixed(6)}`;
    return '$0.00';
  };

  const tierBadge = () => {
    if (isTest) return { emoji: '🧪', label: 'Test Wallet', color: '#4ade80', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)' };
    if (whaleTierUnlocked) return { emoji: '🐋', label: 'Whale Tier', color: '#818cf8', bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.4)' };
    if (holderTierUnlocked) return { emoji: '💎', label: 'Holder Tier', color: '#c084fc', bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.4)' };
    return { emoji: '🔓', label: 'No Tier', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' };
  };

  const badge = tierBadge();

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(16,185,129,0.08) 100%)',
        border: `1px solid ${holderTierUnlocked || isTest ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.25)'}`,
        boxShadow: holderTierUnlocked || isTest ? '0 0 20px rgba(16,185,129,0.1)' : 'none',
      }}
    >
      {/* ── Header row (always visible) ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' }}
          >
            🔐
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base">$AGNTCBRO</span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}
              >
                {badge.emoji} {badge.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {walletAddr.slice(0, 4)}…{walletAddr.slice(-4)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            {loading ? (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-purple-500/40 border-t-purple-400 rounded-full animate-spin" />
                <span className="text-xs text-gray-500">Loading…</span>
              </div>
            ) : error ? (
              <span className="text-xs text-red-400">⚠️ RPC Error</span>
            ) : (
              <>
                <p className="text-white font-bold text-lg leading-tight">
                  {formatBalance(balance)}
                </p>
                <p className="text-xs text-gray-400">
                  {formatUsd(usdValue)}
                </p>
              </>
            )}
          </div>
          <span className="text-gray-600 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* ── Expanded detail section ── */}
      {expanded && !loading && !error && (
        <div className="px-4 pb-4 space-y-3">
          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Balance */}
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Balance</p>
              <p className="text-sm font-bold text-white">{formatBalance(balance)}</p>
            </div>

            {/* Price */}
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Price</p>
              <p className="text-sm font-bold text-emerald-400">
                {tokenPriceUsd > 0 ? `$${tokenPriceUsd.toFixed(6)}` : '—'}
              </p>
            </div>

            {/* USD Value */}
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Value</p>
              <p className="text-sm font-bold text-purple-300">{formatUsd(usdValue)}</p>
            </div>
          </div>

          {/* Tier progress bar (shows how close to next tier) */}
          {!isTest && (
            <div
              className="rounded-lg p-3"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Holder Tier Progress</span>
                <span className="text-xs font-semibold" style={{ color: holderTierUnlocked ? '#4ade80' : '#fbbf24' }}>
                  {holderTierUnlocked ? '✅ Unlocked' : `$${(15 - usdValue).toFixed(2)} away`}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min((usdValue / 15) * 100, 100)}%`,
                    background: holderTierUnlocked
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">
                Hold $15+ USD of $AGNTCBRO to unlock unlimited scans, gem advisory & whale insights
              </p>
            </div>
          )}

          {/* Buy link + last updated */}
          <div className="flex items-center justify-between">
            <a
              href="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(57,255,20,0.12)',
                border: '1px solid rgba(57,255,20,0.35)',
                color: '#39ff14',
              }}
            >
              💰 Buy $AGNTCBRO
            </a>
            {lastUpdated && (
              <span className="text-[10px] text-gray-600">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}