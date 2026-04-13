import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { isTestWallet } from '../hooks/useTokenGating';

// Direct to local backend — works from both localhost:5173 and the deployed Vercel site
const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Token burn constants ───────────────────────────────────────────────────────
const AGNTCBRO_MINT = new PublicKey('52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const DEFAULT_FREE_SCAN_LIMIT = 3;
const SCAN_COST_USD = 2.00;
const TOKEN_DECIMALS = 6; // AGNTCBRO has 6 decimals

// ─── Scan count persistence (localStorage per wallet) ───────────────────────────

function getScanCount(walletAddress: string): number {
  try {
    const raw = localStorage.getItem(`scam_scans_${walletAddress}`);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch { return 0; }
}

function incrementScanCount(walletAddress: string): number {
  const count = getScanCount(walletAddress) + 1;
  try { localStorage.setItem(`scam_scans_${walletAddress}`, String(count)); } catch {}
  return count;
}

// ─── SPL Token helpers ──────────────────────────────────────────────────────────

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

/** Build a raw SPL Token burn instruction (no @solana/spl-token dependency) */
function createBurnInstruction(
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
): { keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]; programId: PublicKey; data: Buffer } {
  // Burn = instruction index 8 in SPL Token program
  const data = Buffer.alloc(9);
  data.writeUInt8(8, 0); // instruction index
  data.writeBigUInt64LE(amount, 1);

  return {
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint,         isSigner: false, isWritable: true },
      { pubkey: owner,        isSigner: true,  isWritable: false },
    ],
    data,
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface InvestigationReport {
  scammer_data: {
    x_handle?: string;
    telegram_channel?: string;
    wallet_address?: string;
    blockchain?: string;
  };
  investigation_date: string;
  twitter_profile?: {
    username: string;
    profile_url: string;
    collected_at: string;
    bio?: string;
    followers?: number;
    following?: number;
    created_at?: string;
    is_verified: boolean;
    profile_image?: string;
    banner_image?: string;
    location?: string;
    website?: string;
    name?: string;
  };
  wallet_analysis?: {
    address: string;
    blockchain: string;
    balance_sol?: number;
    balance_eth?: number;
    balance_usd: number;
    transactions: {
      tx_hash: string;
      type: string;
      timestamp: string;
      amount?: number;
      value_eth?: number;
      from: string;
      to: string;
    }[];
    received_from_victims: { from: string; amount: number; timestamp: string }[];
    total_received: number;
    total_sent: number;
    analyzed_at: string;
  };
  victim_reports?: Record<string, {
    title: string;
    url: string;
    snippet?: string;
    subreddit?: string;
    author?: string;
    score?: number;
    platform: string;
  }[]>;
  victim_analysis?: {
    total_reports: number;
    unique_sources: string[];
    common_platforms: Record<string, number>;
  };
  evidence?: Record<string, unknown>;
  full_report?: string;
  // Database match from scammer-database.csv
  database_match?: {
    'Scammer Name': string;
    'Platform': string;
    'X Handle': string;
    'Telegram Channel': string;
    'Victims Count': string;
    'Total Lost USD': string;
    'Verification Level': string;
    'Scam Type': string;
    'Last Updated': string;
    'Notes': string;
    'Wallet Address': string;
    'Evidence Links': string;
  };
  // Enhanced scam-service fields
  enhanced?: {
    riskScore: number;
    redFlags: string[];
    verificationLevel: string;
    scamType?: string;
    recommendedAction: string;
  };
  // Telegram group intelligence
  telegram_intel?: {
    group_id: string;
    messages_found: number;
    messages: { date: string; sender: string; text: string }[];
    error?: string;
  };
  error?: string;
}

type ScanStatus = 'idle' | 'scanning' | 'done';

interface ScamDetectionProps {
  walletAddress: string;
  tokenPriceUsd: number;
  freeScanLimit?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────────


// ── Disclaimer Notice Component ──────────────────────────────────────────────────────────────────────
function DisclaimerNotice() {
  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.35)' }}>
      <div className="text-center mb-3">
        <h4 className="text-base font-bold text-yellow-400">⚠️ DISCLAIMER NOTICE ⚠️</h4>
        <div className="text-yellow-500/40 text-xs font-mono">════════════════════════════════════════════</div>
      </div>
      <p className="text-center text-xs text-gray-300 mb-3">
        This scan is an AI-powered threat assessment of social media content.<br />
        For complete accuracy, verify information through multiple sources.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-bold text-yellow-400 mb-1">LIMITATIONS:</p>
          <ul className="space-y-0.5 text-gray-400">
            <li>• Only scans public profile data</li>
            <li>• Does NOT verify user identity</li>
            <li>• May miss sophisticated, well-hidden scams</li>
            <li>• Scans HTML/timestamp — not reliable for all assets</li>
            <li>• Subject to website rules and rate limiting</li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-yellow-400 mb-1">INDEPENDENT VERIFICATION REQUIRED:</p>
          <ul className="space-y-0.5 text-gray-400">
            <li>• Cross-check username across multiple platforms</li>
            <li>• Verify contract addresses manually</li>
            <li>• Beware of "guaranteed returns" or "insider information"</li>
            <li>• Never send money or share private keys</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ScamDetectionSection({ walletAddress, tokenPriceUsd, freeScanLimit = DEFAULT_FREE_SCAN_LIMIT }: ScamDetectionProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [usernameInput, setUsernameInput] = useState('');
  const [walletInput, setWalletInput]     = useState('');
  const [platform, setPlatform]           = useState<'X' | 'Telegram'>('X');
  const [scanStatus, setScanStatus]       = useState<ScanStatus>('idle');
  const [scanProgress, setScanProgress]   = useState(0);
  const [report, setReport]               = useState<InvestigationReport | null>(null);
  const [scanError, setScanError]         = useState<string | null>(null);
  const [scanCount, setScanCount]         = useState(0);
  const isTest = isTestWallet(walletAddress);
  const [burnStatus, setBurnStatus]       = useState<'idle' | 'burning' | 'confirmed'>('idle');

  // Load scan count on mount / wallet change
  useEffect(() => {
    setScanCount(getScanCount(walletAddress));
  }, [walletAddress]);

  const freeScansLeft = isTest ? Infinity : Math.max(0, freeScanLimit - scanCount);
  const requiresPayment = !isTest && freeScansLeft <= 0;

  // Calculate token cost for $2.00 USD
  const tokenCostForScan = tokenPriceUsd > 0 ? Math.ceil(SCAN_COST_USD / tokenPriceUsd) : 0;

  const isDisabled = scanStatus === 'scanning' || burnStatus === 'burning' || !usernameInput.trim();

  // Burn AGNTCBRO tokens for paid scan
  const burnTokensForScan = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signTransaction || !connection) {
      setScanError('Wallet not connected or does not support signing.');
      return false;
    }
    if (tokenCostForScan <= 0) {
      setScanError('Cannot determine AGNTCBRO price. Please try again later.');
      return false;
    }

    setBurnStatus('burning');
    try {
      const ownerAta = getAssociatedTokenAddress(publicKey, AGNTCBRO_MINT);
      const burnAmount = BigInt(tokenCostForScan) * BigInt(10 ** TOKEN_DECIMALS);

      const burnIx = createBurnInstruction(ownerAta, AGNTCBRO_MINT, publicKey, burnAmount);

      const tx = new Transaction().add(burnIx);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      setBurnStatus('confirmed');
      return true;
    } catch (err) {
      setBurnStatus('idle');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('User rejected') || msg.includes('rejected')) {
        setScanError('Transaction cancelled.');
      } else {
        setScanError(`Token burn failed: ${msg}`);
      }
      return false;
    }
  }, [publicKey, signTransaction, connection, tokenCostForScan]);

  const runScan = async () => {
    // If payment required, burn tokens first
    if (requiresPayment) {
      const paid = await burnTokensForScan();
      if (!paid) return;
    }

    setScanStatus('scanning');
    setScanProgress(0);
    setReport(null);
    setScanError(null);
    setBurnStatus('idle');

    // Animate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 8 + 3;
      setScanProgress(Math.min(progress, 92));
    }, 400);

    try {
      // Use the full OpenClaw scam-investigate pipeline (Vercel serverless function)
      const res = await fetch(`${API_BASE}/api/scam-investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          platform,
          walletAddress: walletInput.trim() || undefined,
        }),
      });

      const data = await res.json() as { investigation?: any; error?: string; detail?: string };
      clearInterval(interval);
      setScanProgress(100);

      if (!res.ok || data.error) {
        setScanError(data.detail ?? data.error ?? `Server error (${res.status})`);
      } else if (data.investigation) {
        // Map OpenClaw investigation response → InvestigationReport shape
        const inv = data.investigation as any;
        const tp = inv.twitter_profile;
        const wa = inv.wallet_analysis;
        const vr = inv.victim_reports;
        const va = inv.victim_analysis;
        const db = inv.database_match;
        const en = inv.enhanced;
        const ti = inv.telegram_intel;

        const investigationReport: InvestigationReport = {
          scammer_data: inv.scammer_data ?? {
            x_handle: platform === 'X' ? `@${usernameInput.trim().replace(/^@/, '')}` : undefined,
            telegram_channel: platform === 'Telegram' ? `@${usernameInput.trim().replace(/^@/, '')}` : undefined,
            wallet_address: walletInput.trim() || undefined,
          },
          investigation_date: inv.investigation_date ?? new Date().toISOString(),

          twitter_profile: tp ? {
            username: tp.username ?? usernameInput.trim().replace(/^@/, ''),
            profile_url: tp.profile_url ?? `https://x.com/${usernameInput.trim().replace(/^@/, '')}`,
            collected_at: tp.collected_at ?? new Date().toISOString(),
            bio: tp.bio,
            followers: tp.followers,
            following: tp.following,
            created_at: tp.created_at,
            is_verified: tp.is_verified ?? false,
            profile_image: tp.profile_image,
            banner_image: tp.banner_image,
            location: tp.location,
            website: tp.website,
            name: tp.name,
          } : undefined,

          wallet_analysis: wa ? {
            address: wa.address,
            blockchain: wa.blockchain,
            balance_sol: wa.balance_sol,
            balance_eth: wa.balance_eth,
            balance_usd: wa.balance_usd ?? 0,
            transactions: wa.transactions ?? [],
            received_from_victims: wa.received_from_victims ?? [],
            total_received: wa.total_received ?? 0,
            total_sent: wa.total_sent ?? 0,
            analyzed_at: wa.analyzed_at ?? new Date().toISOString(),
          } : undefined,

          victim_reports: vr ?? undefined,

          victim_analysis: va ? {
            total_reports: va.total_reports ?? 0,
            unique_sources: va.unique_sources ?? [],
            common_platforms: va.common_platforms ?? {},
          } : undefined,

          evidence: inv.evidence,

          full_report: inv.full_report,

          database_match: db ? {
            'Scammer Name': db['Scammer Name'] ?? db.name ?? '',
            'Platform': db['Platform'] ?? platform,
            'X Handle': db['X Handle'] ?? (platform === 'X' ? `@${usernameInput.trim().replace(/^@/, '')}` : ''),
            'Telegram Channel': db['Telegram Channel'] ?? (platform === 'Telegram' ? `@${usernameInput.trim().replace(/^@/, '')}` : ''),
            'Victims Count': db['Victims Count'] ?? db.victims ?? '?',
            'Total Lost USD': db['Total Lost USD'] ?? '?',
            'Verification Level': db['Verification Level'] ?? en?.verificationLevel ?? 'Unverified',
            'Scam Type': db['Scam Type'] ?? en?.scamType ?? 'Unknown',
            'Last Updated': db['Last Updated'] ?? new Date().toISOString().slice(0, 10),
            'Notes': db['Notes'] ?? db.notes ?? '',
            'Wallet Address': db['Wallet Address'] ?? wa?.address ?? '',
            'Evidence Links': db['Evidence Links'] ?? '',
          } : undefined,

          enhanced: en ? {
            riskScore: en.riskScore,
            redFlags: en.redFlags ?? [],
            verificationLevel: en.verificationLevel ?? 'Unverified',
            scamType: en.scamType,
            recommendedAction: en.recommendedAction,
          } : undefined,

          telegram_intel: ti ? {
            group_id: ti.group_id,
            messages_found: ti.messages_found ?? 0,
            messages: ti.messages ?? [],
            error: ti.error,
          } : undefined,
        };

        setReport(investigationReport);
        // Increment scan count only on successful scan
        if (!isTest) { const newCount = incrementScanCount(walletAddress); setScanCount(newCount); }
      }
      setScanStatus('done');
    } catch (err) {
      clearInterval(interval);
      setScanProgress(100);
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(`Scan failed: ${msg}`);
      setScanStatus('done');
    }
  };

  return (
    <div className="max-w-6xl mx-auto mb-8">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-red-500/30 p-6 relative overflow-hidden">
        {/* Accent glow at top */}
        <div className="absolute inset-x-0 top-0 h-1"
          style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)' }} />

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl">🚨</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">Scam Detection System</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Powered by <span className="text-red-400 font-semibold">Agentic Bro Detection Engine</span> — full investigation with profile analysis, victim reports, wallet forensics & scammer database
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {freeScansLeft > 0 ? (
              <div className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#4ade80' }}>
                {freeScansLeft} FREE SCAN{freeScansLeft !== 1 ? 'S' : ''} LEFT
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>
                $2.00 / SCAN
              </div>
            )}
            <p className="text-xs text-gray-600">{scanCount} scan{scanCount !== 1 ? 's' : ''} used</p>
          </div>
        </div>

        {/* Input form */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Username */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
              🔍 Username to Investigate
            </label>
            <input
              type="text"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isDisabled && runScan()}
              placeholder="e.g. @CryptoWhaleCalls  ·  raynft_  ·  Monarchcalls001"
              className="w-full bg-black/50 border border-red-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500/60 transition-colors font-mono"
            />
          </div>

          {/* Wallet (optional) */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
              👛 Wallet Address <span className="text-gray-600 normal-case font-normal">(optional — enhances analysis)</span>
            </label>
            <input
              type="text"
              value={walletInput}
              onChange={e => setWalletInput(e.target.value)}
              placeholder="Solana or EVM address for on-chain forensics"
              className="w-full bg-black/50 border border-red-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500/60 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Platform selector + Launch button */}
        <div className="flex items-center gap-3 mb-2">
          {/* Platform toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setPlatform('X')}
              className={`rounded-xl py-2.5 px-5 text-sm font-semibold transition-all border ${
                platform === 'X'
                  ? 'border-red-500/60 text-white bg-red-600'
                  : 'border-red-500/20 text-gray-400 hover:border-red-500/40 bg-black/30'
              }`}
            >
              𝕏 X (Twitter)
            </button>
            <button
              onClick={() => setPlatform('Telegram')}
              className={`rounded-xl py-2.5 px-5 text-sm font-semibold transition-all border ${
                platform === 'Telegram'
                  ? 'border-red-500/60 text-white bg-red-600'
                  : 'border-red-500/20 text-gray-400 hover:border-red-500/40 bg-black/30'
              }`}
            >
              ✈️ Telegram
            </button>
          </div>

          {/* Launch button */}
          <button
            onClick={runScan}
            disabled={isDisabled}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              requiresPayment ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {burnStatus === 'burning' ? (
              <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Confirming burn…</>
            ) : scanStatus === 'scanning' ? (
              <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Investigating…</>
            ) : requiresPayment ? (
              <>🔥 Burn {tokenCostForScan > 0 ? `${tokenCostForScan.toLocaleString()} AGNTCBRO` : '$2.00 AGNTCBRO'} & Scan</>
            ) : (
              <>🔍 Run Full Investigation</>
            )}
          </button>
        </div>

        {/* ── Payment / free scan info banner ── */}
        {requiresPayment ? (
          <div
            className="flex items-center gap-3 rounded-xl p-3 mt-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <span className="text-amber-400 text-lg">🔥</span>
            <p className="text-xs text-amber-300 flex-1">
              You've used all {freeScanLimit} free scans. Each additional scan burns <span className="font-bold">{tokenCostForScan > 0 ? `${tokenCostForScan.toLocaleString()} AGNTCBRO` : '$2.00 in AGNTCBRO'}</span> (≈ $2.00 USD) from your wallet — tokens are permanently burned.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-600 mt-2">
            🎁 {freeScansLeft} of {freeScanLimit} free scans remaining. After that, each scan costs $2.00 in AGNTCBRO (burned).
          </p>
        )}
      </div>

      {/* ── Progress bar ── */}
      {scanStatus === 'scanning' && (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-red-500/20 p-6 mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="animate-spin w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full" />
            <p className="text-white font-semibold">
              Investigating {platform === 'X' ? '𝕏' : 'Telegram'} user @{usernameInput}…
            </p>
            <p className="ml-auto text-sm text-red-300 font-bold">{Math.round(scanProgress)}%</p>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }}
            />
          </div>
          <div className="mt-3 space-y-1">
            {[
              { pct: 0,  label: platform === 'X' ? '[1/5] Scraping X profile data…' : '[1/5] Fetching Telegram data…' },
              { pct: 15, label: '[2/5] Analyzing wallet on-chain…' },
              { pct: 35, label: '[3/5] Searching victim reports (Reddit, Google, Bitcointalk)…' },
              { pct: 55, label: '[4/5] Collecting & organizing evidence…' },
              { pct: 75, label: '[5/5] Generating full investigation report…' },
            ].map(step => (
              <p
                key={step.pct}
                className={`text-xs transition-colors ${scanProgress >= step.pct ? 'text-gray-400' : 'text-gray-700'}`}
              >
                {scanProgress >= step.pct ? '✓' : '○'} {step.label}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {scanStatus === 'done' && scanError && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 mt-4"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <span className="text-yellow-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
          <pre className="text-sm text-yellow-300 flex-1 whitespace-pre-wrap font-sans leading-relaxed">{scanError}</pre>
        </div>
      )}

      {/* ── Full Investigation Report ── */}
      {scanStatus === 'done' && report && (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-red-500/20 mt-4 overflow-hidden">
          {/* Report header */}
          <div className="px-6 py-4 border-b border-red-500/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Full Investigation Report — {report.scammer_data.x_handle || report.scammer_data.telegram_channel || 'Unknown'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Generated {new Date(report.investigation_date).toLocaleString()} · OpenClaw Scammer Detection Service
                  </p>
                </div>
              </div>
              {report.enhanced && (
                <span
                  className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{
                    background: report.enhanced.riskScore >= 7 ? 'rgba(239,68,68,0.15)' : report.enhanced.riskScore >= 4 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                    border: `1px solid ${report.enhanced.riskScore >= 7 ? 'rgba(239,68,68,0.4)' : report.enhanced.riskScore >= 4 ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                    color: report.enhanced.riskScore >= 7 ? '#f87171' : report.enhanced.riskScore >= 4 ? '#fbbf24' : '#4ade80',
                  }}
                >
                  Risk Score: {report.enhanced.riskScore}/10
                </span>
              )}
            </div>
          </div>

          {/* Scrollable report body */}
          <div className="overflow-y-auto px-6 py-4 space-y-4" style={{ maxHeight: '70vh' }}>

            {/* Disclaimer Notice */}
            <DisclaimerNotice />

            {/* ── Database Match Alert ── */}
            {report.database_match && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: report.database_match['Verification Level'] === 'Verified'
                    ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${report.database_match['Verification Level'] === 'Verified'
                    ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.25)'}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🗃️</span>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    Known Scammer Database Match
                  </p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-lg ml-auto"
                    style={{
                      background: report.database_match['Verification Level'] === 'Verified'
                        ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      border: `1px solid ${report.database_match['Verification Level'] === 'Verified'
                        ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
                      color: report.database_match['Verification Level'] === 'Verified'
                        ? '#f87171' : '#fbbf24',
                    }}
                  >
                    {report.database_match['Verification Level']}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Scam Type</p>
                    <p className="text-sm font-bold text-white">{report.database_match['Scam Type'] || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Victims</p>
                    <p className="text-sm font-bold text-red-400">{report.database_match['Victims Count'] || '?'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Lost</p>
                    <p className="text-sm font-bold text-red-400">${report.database_match['Total Lost USD'] || '?'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm font-bold text-white">{report.database_match['Last Updated'] || 'N/A'}</p>
                  </div>
                </div>
                {report.database_match['Notes'] && (
                  <p className="text-xs text-gray-400 leading-relaxed bg-black/30 rounded-lg p-3 border border-red-500/10">
                    📝 {report.database_match['Notes']}
                  </p>
                )}
              </div>
            )}

            {/* ── Enhanced Risk Summary ── */}
            {report.enhanced && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: report.enhanced.riskScore >= 7 ? 'rgba(239,68,68,0.08)' : 'rgba(139,92,246,0.07)',
                  border: `1px solid ${report.enhanced.riskScore >= 7 ? 'rgba(239,68,68,0.25)' : 'rgba(139,92,246,0.15)'}`,
                }}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Risk Assessment</p>
                {report.enhanced.scamType && (
                  <p className="text-sm font-bold text-white mb-2">Scam Type: {report.enhanced.scamType}</p>
                )}
                <p className="text-sm text-gray-300 mb-3">{report.enhanced.recommendedAction}</p>

                {report.enhanced.redFlags.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Red Flags ({report.enhanced.redFlags.length})</p>
                    <ul className="space-y-1">
                      {report.enhanced.redFlags.map((flag, idx) => (
                        <li key={idx} className="text-sm text-red-400 flex items-start gap-2">
                          <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Twitter Profile Section ── */}
            {report.twitter_profile && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(29,155,240,0.07)', border: '1px solid rgba(29,155,240,0.2)' }}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  𝕏 Twitter Profile Analysis
                </p>
                <div className="flex items-start gap-4">
                  {report.twitter_profile.profile_image && (
                    <img
                      src={report.twitter_profile.profile_image}
                      alt=""
                      className="w-14 h-14 rounded-full flex-shrink-0 border-2 border-blue-500/30"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-white text-lg">{report.twitter_profile.name || `@${report.twitter_profile.username}`}</span>
                      {report.twitter_profile.is_verified && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(29,155,240,0.2)', color: '#1d9bf0' }}>✓ Verified</span>
                      )}
                      <a
                        href={report.twitter_profile.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        View profile →
                      </a>
                    </div>
                    {report.twitter_profile.bio && (
                      <p className="text-sm text-gray-400 mb-2">{report.twitter_profile.bio}</p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {report.twitter_profile.followers !== undefined && report.twitter_profile.followers !== null && (
                        <div>
                          <p className="text-xs text-gray-500">Followers</p>
                          <p className="text-sm font-bold text-white">{report.twitter_profile.followers.toLocaleString()}</p>
                        </div>
                      )}
                      {report.twitter_profile.following !== undefined && report.twitter_profile.following !== null && (
                        <div>
                          <p className="text-xs text-gray-500">Following</p>
                          <p className="text-sm font-bold text-white">{report.twitter_profile.following.toLocaleString()}</p>
                        </div>
                      )}
                      {report.twitter_profile.location && (
                        <div>
                          <p className="text-xs text-gray-500">Location</p>
                          <p className="text-sm font-bold text-white">{report.twitter_profile.location}</p>
                        </div>
                      )}
                      {report.twitter_profile.created_at && (
                        <div>
                          <p className="text-xs text-gray-500">Account Created</p>
                          <p className="text-sm font-bold text-white">{report.twitter_profile.created_at}</p>
                        </div>
                      )}
                    </div>
                    {report.twitter_profile.website && (
                      <p className="text-xs text-gray-500 mt-2">
                        Website: <a href={report.twitter_profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{report.twitter_profile.website}</a>
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">Collected: {new Date(report.twitter_profile.collected_at).toLocaleString()}</p>
              </div>
            )}

            {/* ── Wallet Analysis Section ── */}
            {report.wallet_analysis && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  🔗 Blockchain Wallet Analysis
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Blockchain</p>
                    <p className="text-sm font-bold text-white">{report.wallet_analysis.blockchain}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Balance (USD)</p>
                    <p className="text-sm font-bold text-white">${report.wallet_analysis.balance_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Received</p>
                    <p className="text-sm font-bold text-yellow-400">{report.wallet_analysis.total_received.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Victim Senders</p>
                    <p className={`text-sm font-bold ${report.wallet_analysis.received_from_victims.length >= 3 ? 'text-red-400' : 'text-white'}`}>
                      {new Set(report.wallet_analysis.received_from_victims.map(v => v.from)).size}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 font-mono mb-3">
                  {report.wallet_analysis.address} · {report.wallet_analysis.transactions.length} txns analyzed
                </p>

                {/* Transaction list */}
                {report.wallet_analysis.transactions.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Recent Transactions</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {report.wallet_analysis.transactions.slice(0, 10).map((tx, idx) => (
                        <div key={idx} className="bg-black/30 rounded-lg p-2 text-xs border border-yellow-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-400">Type: <span className="text-white font-semibold">{tx.type || 'transfer'}</span></span>
                            <span className="text-yellow-400 font-bold">{(tx.amount ?? tx.value_eth ?? 0).toFixed(6)}</span>
                          </div>
                          <p className="text-gray-600 font-mono truncate">From: {tx.from}</p>
                          <p className="text-gray-600 font-mono truncate">To: {tx.to}</p>
                          <p className="text-gray-700 font-mono text-xs mt-0.5">Hash: {tx.tx_hash}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Victim Reports Section ── */}
            {report.victim_reports && report.victim_analysis && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  📢 Victim Reports ({report.victim_analysis.total_reports} found)
                </p>

                {/* Platform breakdown */}
                <div className="flex gap-4 mb-3">
                  {Object.entries(report.victim_analysis.common_platforms).map(([plat, count]) => (
                    <div key={plat} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      {plat}: {count}
                    </div>
                  ))}
                </div>

                {/* Report list */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(report.victim_reports).flatMap(([, reports]) => reports).slice(0, 15).map((r, idx) => (
                    <div key={idx} className="bg-black/30 rounded-lg p-3 border border-red-500/10">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline font-semibold"
                      >
                        {r.title || r.url}
                      </a>
                      {r.snippet && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.snippet}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                        <span>{r.platform}</span>
                        {r.subreddit && <span>r/{r.subreddit}</span>}
                        {r.score !== undefined && <span>Score: {r.score}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Telegram Group Intelligence ── */}
            {report.telegram_intel && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(0,136,204,0.07)', border: '1px solid rgba(0,136,204,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✈️</span>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    Telegram Group Intelligence
                  </p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-lg ml-auto"
                    style={{
                      background: report.telegram_intel.messages_found > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(100,100,100,0.15)',
                      border: `1px solid ${report.telegram_intel.messages_found > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(100,100,100,0.3)'}`,
                      color: report.telegram_intel.messages_found > 0 ? '#f87171' : '#9ca3af',
                    }}
                  >
                    {report.telegram_intel.messages_found} match{report.telegram_intel.messages_found !== 1 ? 'es' : ''}
                  </span>
                </div>

                {report.telegram_intel.error ? (
                  <p className="text-xs text-gray-500">{report.telegram_intel.error}</p>
                ) : report.telegram_intel.messages_found > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {report.telegram_intel.messages.slice(0, 10).map((msg, idx) => (
                      <div key={idx} className="bg-black/30 rounded-lg p-3 border border-cyan-500/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">{msg.sender}</span>
                          <span className="text-xs text-gray-600">{new Date(msg.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No mentions found in scam intel group.</p>
                )}

                <p className="text-xs text-gray-600 mt-2">Source: AgenticBro Scam Intel Group (ID: {report.telegram_intel.group_id})</p>
              </div>
            )}

            {/* ── Full Text Report ── */}
            {report.full_report && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Full Text Report</p>
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto bg-black/40 rounded-lg p-4 border border-purple-500/10">
                  {report.full_report}
                </pre>
              </div>
            )}

            {/* ── Legal Disclaimer ── */}
            <div className="rounded-xl p-3" style={{ background: 'rgba(100,100,100,0.06)', border: '1px solid rgba(100,100,100,0.15)' }}>
              <p className="text-xs text-gray-600 leading-relaxed">
                ⚠️ This report contains only publicly available information collected for legitimate awareness purposes.
                All data sourced from: Twitter/X public profiles, public blockchain data (Solscan/Etherscan),
                public web search results, Reddit posts, and Bitcointalk forums.
                No private information, private keys, or personal data is included.
                Use this report only for legitimate purposes. Do not harass, dox, or contact scammers directly — file reports with proper authorities.
              </p>
            </div>

            {/* ── Powered by footer ── */}
            <p className="text-xs text-gray-600 text-center pb-2">
              Powered by <span className="text-red-400 font-semibold">Agentic Bro Scammer Detection Service</span> · Solscan · Etherscan · Reddit · Google
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
