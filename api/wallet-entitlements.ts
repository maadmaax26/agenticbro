/**
 * api/wallet-entitlements.ts — Vercel Serverless Function
 *
 * Checks the user's associated Solana wallet for $AGNTCBRO balance and
 * returns their tier + scan entitlements.
 *
 * POST /api/wallet-entitlements
 *   { walletAddress: string, userId?: string }
 *   → { tier, monthlyLimit, monthlyUsed, freeScansRemaining, paidCredits, balance, usdValue }
 *
 * Also updates the user_profiles table in Supabase with the latest tier info.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';

// ── Config ──────────────────────────────────────────────────────────────────

const AGNTCBRO_MINT = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump';
const HOLDER_TIER_USD = 100;
const WHALE_TIER_USD = 1000;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ── Price fetching (same logic as useTokenGating hook) ──────────────────────

async function fetchPriceFromDexScreener(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${AGNTCBRO_MINT}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pairs = data?.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const sorted = [...pairs].sort((a: any, b: any) =>
      (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0)
    );
    const raw = sorted[0]?.priceUsd ?? null;
    if (raw === null) return null;
    const price = parseFloat(raw);
    return isNaN(price) || price <= 0 ? null : price;
  } catch { return null; }
}

async function fetchPriceFromPumpFun(): Promise<number | null> {
  try {
    const res = await fetch(`https://frontend-api.pump.fun/coins/${AGNTCBRO_MINT}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const marketCap: number = data?.usd_market_cap ?? 0;
    const totalSupply: number = data?.total_supply ?? 0;
    if (marketCap > 0 && totalSupply > 0) {
      const price = marketCap / (totalSupply / 1_000_000);
      if (price > 0) return price;
    }
    return null;
  } catch { return null; }
}

async function fetchPriceFromJupiter(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${AGNTCBRO_MINT}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const priceStr = data?.data?.[AGNTCBRO_MINT]?.price ?? null;
    if (priceStr === null) return null;
    const price = parseFloat(priceStr);
    return isNaN(price) || price <= 0 ? null : price;
  } catch { return null; }
}

async function fetchLivePrice(): Promise<number | null> {
  const [dex, pump, jupiter] = await Promise.allSettled([
    fetchPriceFromDexScreener(),
    fetchPriceFromPumpFun(),
    fetchPriceFromJupiter(),
  ]);

  const dexVal = dex.status === 'fulfilled' ? dex.value : null;
  if (dexVal !== null) return dexVal;
  const pumpVal = pump.status === 'fulfilled' ? pump.value : null;
  if (pumpVal !== null) return pumpVal;
  const jupVal = jupiter.status === 'fulfilled' ? jupiter.value : null;
  if (jupVal !== null) return jupVal;
  return null;
}

// ── Balance fetching via RPC ──────────────────────────────────────────────────

async function fetchTokenBalance(walletAddress: string): Promise<number> {
  // Use Solana mainnet RPC
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcEndpoint, 'confirmed');

  const ownerPubkey = new PublicKey(walletAddress);
  const mintPubkey = new PublicKey(AGNTCBRO_MINT);

  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      ownerPubkey,
      { mint: mintPubkey }
    );

    let balance = 0;
    for (const { account } of tokenAccounts.value) {
      const tokenAmount = account.data.parsed.info.tokenAmount;
      const amt = Number(tokenAmount.uiAmount ?? tokenAmount.uiAmountString ?? 0);
      if (!isNaN(amt)) {
        balance += amt;
      }
    }
    return balance;
  } catch (err) {
    console.error('[wallet-entitlements] Balance fetch error:', err);
    return 0;
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { walletAddress, userId } = req.body as {
    walletAddress?: string;
    userId?: string;
  };

  if (!walletAddress || walletAddress.length < 32) {
    res.status(400).json({ error: 'Valid walletAddress is required' });
    return;
  }

  try {
    // Fetch balance and price in parallel
    const [balance, livePrice] = await Promise.all([
      fetchTokenBalance(walletAddress),
      fetchLivePrice(),
    ]);

    const effectivePrice = livePrice ?? 0;
    const usdValue = balance * effectivePrice;

    // Determine tier
    let tier: 'free' | 'holder' | 'whale' = 'free';
    let monthlyLimit = 10;

    if (livePrice !== null && usdValue >= WHALE_TIER_USD) {
      tier = 'whale';
      monthlyLimit = -1; // unlimited
    } else if (livePrice !== null && usdValue >= HOLDER_TIER_USD) {
      tier = 'holder';
      monthlyLimit = 50;
    }

    // Update Supabase if we have a userId
    let monthlyUsed = 0;
    let freeScansRemaining = 10;
    let paidCredits = 0;

    if (supabase && userId) {
      // Update tier in profile
      try {
        await supabase.rpc('update_user_tier', {
          p_user_id: userId,
          p_balance: Math.round(balance),
          p_usd_value: usdValue,
        });
      } catch (e) {
        console.error('[wallet-entitlements] update_user_tier error:', e);
      }

      // Fetch current usage
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('monthly_scans_used, free_scans_used, scan_credits, monthly_reset_at, free_scans_reset_at')
          .eq('id', userId)
          .single();

        if (profile) {
          // Check if monthly reset is needed
          const resetAt = new Date(profile.monthly_reset_at);
          if (resetAt < new Date()) {
            await supabase.rpc('reset_monthly_scans_if_needed', { p_user_id: userId });
            monthlyUsed = 0;
          } else {
            monthlyUsed = profile.monthly_scans_used || 0;
          }

          // Check if daily free scan reset is needed
          const freeResetAt = profile.free_scans_reset_at ? new Date(profile.free_scans_reset_at) : null;
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (!freeResetAt || freeResetAt < todayStart) {
            // Reset free scans for the day
            try {
              await supabase
                .from('user_profiles')
                .update({ free_scans_used: 0, free_scans_reset_at: now.toISOString() })
                .eq('id', userId);
              freeScansRemaining = 10;
            } catch (e) {
              console.error('[wallet-entitlements] free scan daily reset error:', e);
              freeScansRemaining = Math.max(0, 10 - (profile.free_scans_used || 0));
            }
          } else {
            freeScansRemaining = Math.max(0, 10 - (profile.free_scans_used || 0));
          }
          paidCredits = profile.scan_credits || 0;
        }
      } catch (e) {
        console.error('[wallet-entitlements] profile fetch error:', e);
      }
    }

    const totalRemaining =
      tier === 'whale'
        ? -1 // unlimited
        : freeScansRemaining + paidCredits + Math.max(0, monthlyLimit - monthlyUsed);

    res.status(200).json({
      walletAddress,
      balance,
      tokenPriceUsd: effectivePrice,
      usdValue: Math.round(usdValue * 100) / 100,
      tier,
      monthlyLimit,
      monthlyUsed,
      freeScansRemaining,
      paidCredits,
      totalRemaining,
      holderTierUnlocked: tier !== 'free',
      whaleTierUnlocked: tier === 'whale',
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[wallet-entitlements] Error:', err);
    res.status(500).json({
      error: 'Failed to check entitlements',
      message: err?.message ?? String(err),
    });
  }
}