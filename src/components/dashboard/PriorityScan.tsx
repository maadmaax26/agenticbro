import { useState } from 'react';
import { ScanLine, Flame, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Wallet, Hash, AlertCircle, Info } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { isTestWallet } from '../../hooks/useTokenGating';
import PhoneNumberVerifier from '../PhoneNumberVerifier';

// Direct to local backend — works from both localhost:5173 and the deployed Vercel site
const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanStatus = 'idle' | 'scanning' | 'done';
type ScanTarget = 'all' | 'wallet' | 'channels' | 'token' | 'scam' | 'phone';

interface ScanResult {
  id: number;
  ticker: string;
  edgeScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  winRate: number;
  rugRate: number;
  liquidity: number;
  sourceChannel: string;
  recommendation: string;
  flagged: boolean;
  flagReason?: string;
}

interface ScamDetectionResult {
  username: string;
  platform: 'X' | 'Telegram';
  riskScore: number; // 1-10
  redFlags: string[];
  verificationLevel: 'Unverified' | 'Partially Verified' | 'Verified' | 'Highly Verified' | 'Legitimate';
  scamType?: string;
  evidence: string[];
  recommendedAction: string;
  fullReport?: string;
  // Enhanced fields from OpenClaw integration
  xProfile?: {
    name?: string;
    bio?: string;
    followers?: number;
    following?: number;
    isVerified: boolean;
    profileImage?: string;
    profileUrl: string;
  };
  walletAnalysis?: {
    address: string;
    blockchain: string;
    balance: number;
    balanceUsd: number;
    totalReceived: number;
    totalSent: number;
    txCount: number;
    uniqueSenders: number;
  };
  victimReports?: {
    totalReports: number;
    reports: { title: string; url: string; platform: string; score?: number }[];
  };
  knownScammer?: {
    name: string;
    status: string;
    victims: number;
    notes: string;
  };
}

interface ScanJob {
  id: string;
  target: string;
  startedAt: string;
  completedAt?: string;
  status: 'done' | 'failed';
  resultsCount: number;
  tokensBurned: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SCAN_RESULTS: ScanResult[] = [
  {
    id: 1, ticker: '$NOVA',
    edgeScore: 0.81, confidence: 'HIGH',
    winRate: 0.44, rugRate: 0.08,
    liquidity: 182000, sourceChannel: 'CryptoEdge Pro',
    recommendation: 'Strong edge signal. Clean deployer history. Liquidity locked. Watch for entry on next 15% pullback.',
    flagged: false,
  },
  {
    id: 2, ticker: '$FLUX',
    edgeScore: 0.76, confidence: 'HIGH',
    winRate: 0.39, rugRate: 0.12,
    liquidity: 94000, sourceChannel: 'AlphaWhale',
    recommendation: 'Good channel score + new listing momentum. Volume accelerating. Early-stage play.',
    flagged: false,
  },
  {
    id: 3, ticker: '$PRISM',
    edgeScore: 0.63, confidence: 'MEDIUM',
    winRate: 0.31, rugRate: 0.19,
    liquidity: 55000, sourceChannel: 'DeFi Gems',
    recommendation: 'Moderate quality. Channel has mixed track record. Smaller position sizing recommended.',
    flagged: false,
  },
  {
    id: 4, ticker: '$RUGME',
    edgeScore: 0.18, confidence: 'LOW',
    winRate: 0.09, rugRate: 0.78,
    liquidity: 4200, sourceChannel: 'GemHunters',
    recommendation: 'Avoid. High rug probability. Deployer wallet linked to 3 previous rug pulls.',
    flagged: true,
    flagReason: 'Rug rate 78% — deployer wallet flagged',
  },
  {
    id: 5, ticker: '$KRYPT',
    edgeScore: 0.71, confidence: 'HIGH',
    winRate: 0.36, rugRate: 0.14,
    liquidity: 126000, sourceChannel: 'CryptoEdge Pro',
    recommendation: 'Solid fundamentals for the sector. Institutional interest signal detected on-chain.',
    flagged: false,
  },
];

const SCAN_HISTORY: ScanJob[] = [
  { id: 'scan_001', target: 'All Channels',         startedAt: '2h ago', completedAt: '2h ago', status: 'done',   resultsCount: 8, tokensBurned: 15000 },
  { id: 'scan_002', target: '👛 7xKX…Bm3a',         startedAt: '6h ago', completedAt: '6h ago', status: 'done',   resultsCount: 5, tokensBurned: 10000 },
  { id: 'scan_003', target: '📡 CryptoEdge Pro',    startedAt: '1d ago', completedAt: '1d ago', status: 'done',   resultsCount: 3, tokensBurned: 10000 },
  { id: 'scan_004', target: '🔍 $SOL',              startedAt: '2d ago', completedAt: '2d ago', status: 'failed', resultsCount: 0, tokensBurned: 10000 },
];

// ─── Scan target config ───────────────────────────────────────────────────────

const SCAN_TARGETS: { id: ScanTarget; label: string; icon: string; cost: number; description: string }[] = [
  { id: 'all',      label: 'All Channels', icon: '🌐', cost: 15000, description: 'Scan every tracked channel' },
  { id: 'wallet',   label: 'Wallet Scan', icon: '👛', cost: 10000, description: 'Track a wallet\'s alpha signals' },
  { id: 'channels', label: 'Channel Scan', icon: '📡', cost: 10000, description: 'Deep-scan a specific channel' },
  { id: 'token',    label: 'Single Token', icon: '🔍', cost: 10000, description: 'Find all calls for a token' },
  { id: 'scam',     label: 'Scam Detection', icon: '🚨', cost: 5000, description: 'Scan X or Telegram user for scam patterns' },
  { id: 'phone',    label: 'Phone Verify',   icon: '📞', cost: 5000, description: 'Verify phone numbers for scam/virtual/spam' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PriorityScan() {
  const { publicKey } = useWallet();
  const isTest = isTestWallet(publicKey?.toBase58() ?? '');

  const [scanStatus,    setScanStatus]    = useState<ScanStatus>('idle');
  const [scanTarget,    setScanTarget]    = useState<ScanTarget>('all');
  const [walletInput,   setWalletInput]   = useState('');
  const [channelInput,  setChannelInput]  = useState('');
  const [tokenInput,    setTokenInput]    = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [scamWalletInput, setScamWalletInput] = useState('');
  const [platform,      setPlatform]      = useState<'X' | 'Telegram'>('X');
  const [results,       setResults]       = useState<ScanResult[]>([]);
  const [scamResults,   setScamResults]   = useState<ScamDetectionResult[]>([]);
  const [showModal,     setShowModal]     = useState(false);
  const [expandedId,    setExpandedId]    = useState<number | string | null>(null);
  const [showHistory,   setShowHistory]   = useState(false);
  const [scanProgress,  setScanProgress]  = useState(0);
  const [isMockData,    setIsMockData]    = useState(false);
  const [scanError,     setScanError]     = useState<string | null>(null);

  const burnCost = scanTarget === 'all' ? 15000 : (scanTarget === 'scam' || scanTarget === 'phone') ? 5000 : 10000;

  // Resolve human-readable label for burn modal / history
  const scanLabel = (() => {
    if (scanTarget === 'wallet')   return walletInput   ? `👛 ${walletInput.slice(0, 6)}…${walletInput.slice(-4)}` : 'Wallet Scan';
    if (scanTarget === 'channels') return channelInput  ? `📡 ${channelInput}` : 'Channel Scan';
    if (scanTarget === 'token')    return tokenInput     ? `🔍 ${tokenInput}`  : 'Single Token';
    if (scanTarget === 'scam')     return usernameInput ? `🚨 ${platform === 'X' ? 'X' : 'Telegram'}: ${usernameInput}` : 'Scam Detection';
    if (scanTarget === 'phone')    return '📞 Phone Verify';
    return 'All Channels';
  })();

  // Disable launch if required input is empty
  const isLaunchDisabled =
    scanStatus === 'scanning' ||
    (scanTarget === 'wallet'   && !walletInput.trim())  ||
    (scanTarget === 'channels' && !channelInput.trim()) ||
    (scanTarget === 'token'    && !tokenInput.trim()) ||
    (scanTarget === 'scam'     && !usernameInput.trim()) ||
    scanTarget === 'phone';

  // Test wallet: skip burn confirmation and run immediately
  const startScan = () => { if (isTest) { void confirmScan(); } else { setShowModal(true); } };

  const confirmScan = async () => {
    setShowModal(false);
    setScanStatus('scanning');
    setScanProgress(0);
    setResults([]);
    setScamResults([]);
    setIsMockData(false);
    setScanError(null);

    // Animate progress while waiting for real API
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 4;
      setScanProgress(Math.min(progress, 92));
    }, 280);

    try {
      // Handle scam detection scan separately
      if (scanTarget === 'scam') {
        const res = await fetch(`${API_BASE}/api/scam-detect`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            username: usernameInput.trim(),
            platform,
            walletAddress: scamWalletInput.trim() || undefined,
          }),
        });
        const data = await res.json() as { results?: ScamDetectionResult[]; mock?: boolean; error?: string };
        clearInterval(interval);
        setScanProgress(100);
        if (data.mock) setIsMockData(true);
        if (data.error) {
          setScanError(data.error);
          // Show error as an informational result
          setScamResults([{
            username: usernameInput.trim(),
            platform,
            riskScore: 0,
            redFlags: [],
            verificationLevel: 'Unverified',
            evidence: [data.error],
            recommendedAction: `Analysis failed: ${data.error}`,
          }]);
        } else {
          setScamResults(data.results ?? []);
        }
        setScanStatus('done');
        return;
      }

      // Regular priority scan
      const res  = await fetch(`${API_BASE}/api/telegram/priority-scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          target:  scanTarget,
          wallet:  scanTarget === 'wallet'   ? walletInput.trim()  : undefined,
          channel: scanTarget === 'channels' ? channelInput.trim() : undefined,
          token:   scanTarget === 'token'    ? tokenInput.trim()   : undefined,
        }),
      });
      const data = await res.json() as { results?: Record<string, unknown>[]; mock?: boolean; error?: string };
      clearInterval(interval);
      setScanProgress(100);
      if (data.mock) setIsMockData(true);

      if (!res.ok || data.error) {
        setScanError(data.error ?? `Server returned ${res.status}`);
        setIsMockData(true);
        setResults(MOCK_SCAN_RESULTS);
        setScanStatus('done');
        return;
      }

      // Map ScoredCall API response → ScanResult for display
      const mapped: ScanResult[] = (data.results ?? []).map((r: Record<string, unknown>, idx: number) => {
        const edgeScore  = Number(r.edgeScore ?? 0);
        const winRate    = Number(r.winRate ?? 0);
        const rugRate    = Number(r.rugRate ?? 0);
        const liquidity  = Number(r.liquidity ?? 0);
        const confidence = (r.confidence as ScanResult['confidence']) ?? 'LOW';

        const isScam   = (r.scamAnalysis as { verdict?: string })?.verdict === 'SCAM';
        const isRisky  = (r.scamAnalysis as { verdict?: string })?.verdict === 'RISKY';
        const flagged  = isScam || isRisky || rugRate > 0.35;

        const recParts: string[] = [];
        if (r.rawText)       recParts.push(String(r.rawText).slice(0, 120));
        if (isScam)          recParts.push('⚠️ SCAM detected — avoid.');
        else if (isRisky)    recParts.push('⚠️ Security risks flagged.');
        if (rugRate > 0.35)  recParts.push('⚠️ High rug probability.');

        return {
          id:             idx + 1,
          ticker:         String(r.ticker ?? '???'),
          edgeScore,
          confidence,
          winRate,
          rugRate,
          liquidity,
          sourceChannel:  String(r.sourceChannel ?? 'Unknown'),
          recommendation: recParts.join(' · ') || 'Live scan result',
          flagged,
          flagReason:     isScam  ? 'Contract flagged as SCAM by GoPlus'
                        : isRisky ? 'Security risks detected'
                        : rugRate > 0.35 ? `High rug rate: ${(rugRate * 100).toFixed(0)}%`
                        : undefined,
        };
      });

      setTimeout(() => {
        if (mapped.length > 0) {
          setResults(mapped);
        } else {
          setIsMockData(true);
          setResults(MOCK_SCAN_RESULTS);
        }
        setScanStatus('done');
      }, 300);
    } catch (err) {
      clearInterval(interval);
      setScanProgress(100);
      const msg = err instanceof Error ? err.message : String(err);
      const isNetworkError = msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed') || msg.includes('ECONNREFUSED');
      const errorMsg = isNetworkError
        ? 'Backend server is offline — showing demo data. Start the server on port 3001 for live scans.'
        : `Scan failed: ${msg}`;
      setScanError(errorMsg);
      setIsMockData(true);

      if (scanTarget === 'scam') {
        // Show a mock scam detection result
        setScamResults([{
          username: usernameInput.trim(),
          platform,
          riskScore: 7.2,
          redFlags: [
            'High shill language density (42% avg)',
            'Excessive urgency tactics (38% avg)',
            'Almost every message is a token call (78% call density)',
            'Claims guaranteed returns (4 occurrences)',
          ],
          verificationLevel: 'Unverified',
          scamType: 'Pump-and-Dump Channel',
          evidence: [
            '34% of messages contain shill patterns',
            'Frequent use of urgency language',
            'Channels that only post token calls are often pump-and-dump groups',
          ],
          recommendedAction: `DO NOT INVEST — HIGH RISK SCAM (7.2/10). Demo result — connect backend for live analysis.`,
        }]);
      } else {
        setResults(MOCK_SCAN_RESULTS);
      }
      setScanStatus('done');
    }
  };

  const confidenceStyle = (c: ScanResult['confidence']) => {
    if (c === 'HIGH')   return { color: '#4ade80', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  };
    if (c === 'MEDIUM') return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
    return                     { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'  };
  };

  const riskScoreStyle = (score: number) => {
    if (score >= 7) return { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  };
    if (score >= 4) return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
    return                  { color: '#4ade80', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)'  };
  };

  const verificationStyle = (level: ScamDetectionResult['verificationLevel']) => {
    switch (level) {
      case 'Verified':         return { color: '#4ade80', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' };
      case 'Partially Verified': return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
      case 'Unverified':       return { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
      default: return { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' };
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Scan config panel ── */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <div className="flex items-center gap-3 mb-5">
          <ScanLine className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Priority Scan</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              On-demand deep scan — jumps the queue and returns results in seconds
            </p>
          </div>
        </div>

        {/* ── Scan target selector ── */}
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Scan Target</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {SCAN_TARGETS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setScanTarget(opt.id)}
              className={`rounded-xl p-3 text-left transition-all border ${
                scanTarget === opt.id
                  ? 'border-purple-500/60 text-white'
                  : 'border-purple-500/20 text-gray-400 hover:border-purple-500/40'
              }`}
              style={scanTarget === opt.id ? { background: 'rgba(139,92,246,0.15)' } : { background: 'rgba(0,0,0,0.3)' }}
            >
              <p className="text-sm font-semibold">{opt.icon} {opt.label}</p>
              <p className="text-xs mt-0.5 text-gray-500">{opt.description}</p>
              <p className="text-xs mt-1" style={{ color: '#a78bfa' }}>{opt.cost.toLocaleString()} AGNTCBRO</p>
            </button>
          ))}
        </div>

        {/* ── Contextual input fields ── */}
        {scanTarget === 'wallet' && (
          <div className="mb-5">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
              <Wallet className="w-3.5 h-3.5" /> Wallet Address
            </label>
            <input
              type="text"
              value={walletInput}
              onChange={e => setWalletInput(e.target.value)}
              placeholder="Solana: 7xKX…Bm3a  ·  EVM: 0x4e3a…f29b"
              className="w-full bg-black/40 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Scans all tracked channels for calls referencing this wallet + on-chain token activity
            </p>
          </div>
        )}

        {scanTarget === 'channels' && (
          <div className="mb-5">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
              <Hash className="w-3.5 h-3.5" /> Channel Name or Username
            </label>
            <input
              type="text"
              value={channelInput}
              onChange={e => setChannelInput(e.target.value)}
              placeholder="e.g. CryptoEdgePro  ·  @alphawhalecalls  ·  t.me/defi_gems"
              className="w-full bg-black/40 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors"
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Deep-scans the last 50 messages from this channel and scores every token call found
            </p>
          </div>
        )}

        {scanTarget === 'token' && (
          <div className="mb-5">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
              <ScanLine className="w-3.5 h-3.5" /> Token Ticker or Contract
            </label>
            <input
              type="text"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="e.g. $NOVA  ·  SOL  ·  0x4e3a…f29b"
              className="w-full bg-black/40 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Searches every tracked channel for calls mentioning this ticker or contract address
            </p>
          </div>
        )}

        {scanTarget === 'scam' && (
          <div className="space-y-4">
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> User Name
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="e.g. @CryptoWhaleCalls  · CryptoSpaceX04  @raynft_"
                className="w-full bg-black/40 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                Platform
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setPlatform('X')}
                  className={`flex-1 rounded-xl py-3 px-4 transition-all border ${
                    platform === 'X'
                      ? 'border-purple-500/60 text-white bg-purple-600'
                      : 'border-purple-500/20 text-gray-400 hover:border-purple-500/40'
                  }`}
                >
                  X (Twitter)
                </button>
                <button
                  onClick={() => setPlatform('Telegram')}
                  className={`flex-1 rounded-xl py-3 px-4 transition-all border ${
                    platform === 'Telegram'
                      ? 'border-purple-500/60 text-white bg-purple-600'
                      : 'border-purple-500/20 text-gray-400 hover:border-purple-500/40'
                  }`}
                >
                  Telegram
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                <Wallet className="w-3.5 h-3.5" /> Wallet Address <span className="text-gray-600 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={scamWalletInput}
                onChange={e => setScamWalletInput(e.target.value)}
                placeholder="Solana or EVM address — enhances analysis with on-chain data"
                className="w-full bg-black/40 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
              />
            </div>

            <p className="text-xs text-gray-600 mt-1.5">
              Powered by <span className="text-purple-400 font-semibold">OpenClaw Detection Engine</span> — analyzes profile, posting patterns, victim reports, scammer database, and on-chain data. Only public information is accessed.
            </p>
          </div>
        )}

        {/* ── Phone Number Verifier ── */}
        {scanTarget === 'phone' && (
          <div className="space-y-4">
            <PhoneNumberVerifier />
            <p className="text-xs text-gray-600 mt-1.5">
              Powered by <span className="text-purple-400 font-semibold">OpenClaw Detection Engine</span> — carrier lookup, virtual/VoIP detection, scam operation database, spam dialer identification.
            </p>
          </div>
        )}

        {/* ── Launch button ── */}
        <button
          onClick={startScan}
          disabled={isLaunchDisabled}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            scanTarget === 'scam' ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {scanTarget === 'scam' ? <AlertCircle className="w-4 h-4" /> : <ScanLine className="w-4 h-4" />}
          {scanStatus === 'scanning'
            ? 'Scanning…'
            : scanTarget === 'scam'
              ? `🚨 Run Scam Detection — ${burnCost.toLocaleString()} AGNTCBRO`
              : `Run Priority Scan — ${burnCost.toLocaleString()} AGNTCBRO`}
        </button>
      </div>

      {/* ── Progress bar ── */}
      {scanStatus === 'scanning' && (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
            <p className="text-white font-semibold">
              {scanTarget === 'scam'
                ? `Analyzing ${platform === 'X' ? 'X' : 'Telegram'} user @${usernameInput}…`
                : scanTarget === 'wallet' ? `Scanning wallet ${walletInput.slice(0,6)}…`
                : scanTarget === 'channels' ? `Deep-scanning ${channelInput}…`
                : scanTarget === 'token' ? `Searching channels for ${tokenInput}…`
                : 'Scanning all channels…'
              }
            </p>
            <p className="ml-auto text-sm text-purple-300 font-bold">{Math.round(scanProgress)}%</p>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%`, background: 'linear-gradient(90deg, #7c3aed, #00d4ff)' }}
            />
          </div>
          <div className="mt-3 space-y-1">
            {(scanTarget === 'scam' ? [
              { pct: 0, label: platform === 'X' ? 'Scraping X profile data…' : 'Fetching Telegram messages…' },
              { pct: 20, label: 'Searching victim reports (Reddit, web)…' },
              { pct: 40, label: 'Checking OpenClaw scammer database…' },
              { pct: 55, label: scamWalletInput ? 'Analyzing wallet on-chain…' : 'Analyzing red flags…' },
              { pct: 75, label: 'Running enhanced risk scoring engine…' },
            ] : [
              { pct: 0, label: 'Connecting to channel feeds…' },
              { pct: 25, label: 'Extracting posting patterns…' },
              { pct: 55, label: 'Analyzing red flags…' },
              { pct: 80, label: 'Running risk scoring engine…' },
            ]).map(step => (
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

      {/* ── Error / Mock data banner ── */}
      {scanStatus === 'done' && (scanError || isMockData) && (
        <div
          className="flex items-center gap-3 rounded-2xl p-4"
          style={{
            background: scanError ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
            border: `1px solid ${scanError ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.25)'}`,
          }}
        >
          <Info className={`w-5 h-5 flex-shrink-0 ${scanError ? 'text-yellow-400' : 'text-blue-400'}`} />
          <div className="flex-1 min-w-0">
            {scanError && (
              <p className="text-sm text-yellow-300">{scanError}</p>
            )}
            {isMockData && !scanError && (
              <p className="text-sm text-blue-300">
                Showing demo data — connect the backend server for live scan results.
              </p>
            )}
          </div>
          {isMockData && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}
            >
              DEMO
            </span>
          )}
        </div>
      )}

      {/* ── Scam detection results ── */}
      {scanStatus === 'done' && scamResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="font-bold text-white">Scam Detection Results — {scamResults.length} user(s) analyzed</h3>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto"
              style={{ background: scamResults.some(r => r.riskScore >= 7) ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', border: `1px solid ${scamResults.some(r => r.riskScore >= 7) ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, color: scamResults.some(r => r.riskScore >= 7) ? '#f87171' : '#4ade80' }}
            >
              {scamResults.filter(r => r.riskScore >= 7).length} HIGH RISK
            </span>
          </div>

          {scamResults.map(result => {
            const rs = riskScoreStyle(result.riskScore);
            const vs = verificationStyle(result.verificationLevel);
            const isExpanded = expandedId === result.username;

            return (
              <div
                key={result.username}
                className={`bg-black/40 backdrop-blur-md rounded-2xl border overflow-hidden transition-all ${
                  result.riskScore >= 7 ? 'border-red-500/40' : result.riskScore >= 4 ? 'border-yellow-500/40' : 'border-purple-500/20'
                }`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : result.username)}
                >
                  <AlertTriangle className={`w-5 h-5 ${result.riskScore >= 7 ? 'text-red-400' : result.riskScore >= 4 ? 'text-yellow-400' : 'text-gray-400'} flex-shrink-0`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{result.platform === 'X' ? 'X' : 'Telegram'}: {result.username}</span>
                    </div>
                  </div>

                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color }}
                  >
                    Risk Score: {result.riskScore.toFixed(1)}/10 — {result.riskScore >= 7 ? 'HIGH' : result.riskScore >= 4 ? 'MEDIUM' : 'LOW'} RISK {result.riskScore >= 7 ? '⚠️' : result.riskScore >= 4 ? '⚡' : '✅'}
                  </span>

                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-lg flex-shrink-0"
                    style={{ background: vs.bg, border: `1px solid ${vs.border}`, color: vs.color }}
                  >
                    {result.verificationLevel}
                  </span>

                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  }
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(239,68,68,0.15)' }}>
                    {/* ── Known Scammer Banner ── */}
                    {result.knownScammer && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2 mt-3 mb-3 text-sm font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                      >
                        🚨 KNOWN SCAMMER — {result.knownScammer.status} in OpenClaw Database
                        {result.knownScammer.victims > 0 && ` · ${result.knownScammer.victims} victim(s)`}
                      </div>
                    )}

                    {result.riskScore >= 7 && !result.knownScammer && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2 mt-3 mb-3 text-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                      >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        HIGH RISK DETECTED ({result.riskScore}/10)
                      </div>
                    )}

                    {/* ── X Profile Card ── */}
                    {result.xProfile && (
                      <div
                        className="rounded-xl p-4 mt-3"
                        style={{ background: 'rgba(29,155,240,0.07)', border: '1px solid rgba(29,155,240,0.2)' }}
                      >
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">X Profile Analysis</p>
                        <div className="flex items-start gap-3">
                          {result.xProfile.profileImage && (
                            <img src={result.xProfile.profileImage} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white">{result.xProfile.name || `@${result.username}`}</span>
                              {result.xProfile.isVerified && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(29,155,240,0.2)', color: '#1d9bf0' }}>✓ Verified</span>
                              )}
                              <a href={result.xProfile.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">View profile →</a>
                            </div>
                            {result.xProfile.bio && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{result.xProfile.bio}</p>
                            )}
                            <div className="flex gap-4 mt-2">
                              {result.xProfile.followers !== undefined && (
                                <span className="text-xs text-gray-500"><span className="text-white font-semibold">{result.xProfile.followers.toLocaleString()}</span> followers</span>
                              )}
                              {result.xProfile.following !== undefined && (
                                <span className="text-xs text-gray-500"><span className="text-white font-semibold">{result.xProfile.following.toLocaleString()}</span> following</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Wallet Analysis Card ── */}
                    {result.walletAnalysis && (
                      <div
                        className="rounded-xl p-4 mt-3"
                        style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
                      >
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">On-Chain Wallet Analysis</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <p className="text-xs text-gray-500">Blockchain</p>
                            <p className="text-sm font-bold text-white">{result.walletAnalysis.blockchain}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Balance</p>
                            <p className="text-sm font-bold text-white">${result.walletAnalysis.balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total Received</p>
                            <p className="text-sm font-bold text-yellow-400">{result.walletAnalysis.totalReceived.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Unique Senders</p>
                            <p className={`text-sm font-bold ${result.walletAnalysis.uniqueSenders >= 5 ? 'text-red-400' : 'text-white'}`}>
                              {result.walletAnalysis.uniqueSenders}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 font-mono">{result.walletAnalysis.address.slice(0, 8)}…{result.walletAnalysis.address.slice(-6)} · {result.walletAnalysis.txCount} txns</p>
                      </div>
                    )}

                    {/* ── Scam Analysis ── */}
                    <div
                      className="rounded-xl p-4 mt-3"
                      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Scam Analysis</p>
                      {result.scamType && (
                        <p className="text-sm font-bold text-white mb-2">Type: {result.scamType}</p>
                      )}
                      <p className="text-sm text-gray-300 mb-4">{result.recommendedAction}</p>

                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Red Flags with Scores ({result.redFlags.length})</p>
                          <ul className="space-y-1">
                            {result.redFlags.map((flag, idx) => {
                              const pointMatch = flag.match(/\((\d+)pts?\)/);
                              const pts = pointMatch ? parseInt(pointMatch[1]) : 0;
                              const flagName = flag.replace(/\s*\(\d+pts?\).*/, '').replace(/_/g, ' ');
                              const descMatch = flag.match(/—\s*(.+)/);
                              const desc = descMatch ? descMatch[1] : '';
                              return (
                                <li key={idx} className="text-sm text-red-400 flex items-start gap-2">
                                  <span className="text-red-500 mt-0.5">•</span>
                                  <span className="capitalize">{flagName}</span>
                                  {pointMatch && <span className="text-xs font-mono ml-1 px-1 py-0.5 rounded" style={{background:'rgba(239,68,68,0.15)',color:'#f87171'}}>{pts}pts</span>}
                                  {desc && <span className="text-gray-500 ml-1">— {desc}</span>}
                                </li>
                              );
                            })}
                          </ul>
                          <p className="text-xs text-gray-600 mt-2">Flag values: guaranteed_returns(25) · giveaway_airdrop(20) · dm_solicitation(15) · free_crypto(15) · alpha_dm_scheme(15) · unrealistic_claims(10) · download_install(10) · urgency_tactics(10) · emotional_manipulation(10) · low_credibility(10)</p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Behavioral Pattern</p>
                          <p className="text-sm text-gray-300">
                            {result.riskScore >= 7 ? 'Multiple high-severity scam indicators detected. This account shows patterns consistent with crypto fraud operations. Extreme caution advised.' :
                             result.riskScore >= 4 ? 'Significant scam indicators present. Verify independently before any engagement.' :
                             'No significant scam patterns identified. Always verify independently.'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Evidence ({result.evidence.length})</p>
                          <ul className="space-y-1">
                            {result.evidence.map((ev, idx) => (
                              <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                                <span className="text-gray-500 mt-0.5">•</span>
                                {ev}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* ── Victim Reports Card ── */}
                    {result.victimReports && result.victimReports.totalReports > 0 && (
                      <div
                        className="rounded-xl p-4 mt-3"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                          Victim Reports Found ({result.victimReports.totalReports})
                        </p>
                        <ul className="space-y-2">
                          {result.victimReports.reports.map((report, idx) => (
                            <li key={idx} className="text-sm">
                              <a
                                href={report.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                              >
                                {report.title || report.url}
                              </a>
                              <span className="text-xs text-gray-600 ml-2">
                                {report.platform}{report.score !== undefined ? ` · Score: ${report.score}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* ── Powered By Footer ── */}
                    <p className="text-xs text-gray-600 mt-3 text-center">
                      Powered by <span className="text-purple-400">OpenClaw Detection Engine</span> · Solscan · Etherscan · Reddit
                    </p>

                    {/* ── Full Text Report (if available) ── */}
                    {(result as any).fullReport && (
                      <div
                        className="rounded-xl p-4 mt-4"
                        style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Full Investigation Report</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const reportText = (result as any).fullReport;
                              navigator.clipboard.writeText(reportText);
                              alert('Report copied to clipboard!');
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            Copy to clipboard
                          </button>
                        </div>
                        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto bg-black/40 rounded-lg p-4 border border-purple-500/10">
                          {(result as any).fullReport}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Regular scan results ── */}
      {scanStatus === 'done' && results.length > 0 && scanTarget !== 'scam' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="font-bold text-white">Scan Complete — {results.length} tokens evaluated</h3>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#4ade80' }}
            >
              {results.filter(r => r.confidence === 'HIGH').length} HIGH confidence
            </span>
          </div>

          {results.map(result => {
            const cs = confidenceStyle(result.confidence);
            const isExpanded = expandedId === result.id;
            const edgePct = Math.round(result.edgeScore * 100);

            return (
              <div
                key={result.id}
                className={`bg-black/40 backdrop-blur-md rounded-2xl border overflow-hidden transition-all ${
                  result.flagged ? 'border-red-500/40' : 'border-purple-500/20'
                }`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  {result.flagged && (
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{result.ticker}</span>
                      <span className="text-xs text-gray-500">{result.sourceChannel}</span>
                    </div>
                  </div>

                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color }}
                  >
                    {result.confidence}
                  </span>

                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-xs text-gray-500">Edge</span>
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${edgePct}%`, background: 'linear-gradient(90deg, #7c3aed, #00d4ff)' }}
                      />
                    </div>
                    <span className="text-xs font-bold text-purple-300">{edgePct}</span>
                  </div>

                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  }
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(139,92,246,0.15)' }}>
                    {result.flagged && result.flagReason && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2 mt-3 mb-3 text-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                      >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {result.flagReason}
                      </div>
                    )}
                    <div
                      className="rounded-xl p-4 mt-3"
                      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">AI Recommendation</p>
                      <p className="text-sm text-gray-300 leading-relaxed mb-4">{result.recommendation}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <ScanStat label="Win Rate"   value={`${Math.round(result.winRate * 100)}%`}   color="text-green-400" />
                        <ScanStat label="Rug Rate"   value={`${Math.round(result.rugRate * 100)}%`}   color={result.rugRate > 0.3 ? 'text-red-400' : 'text-gray-300'} />
                        <ScanStat label="Liquidity"  value={`$${(result.liquidity / 1000).toFixed(0)}K`} color="text-white" />
                        <ScanStat label="Edge Score" value={String(edgePct)}                          color="text-purple-300" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scan history ── */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-300">Scan History</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}
            >
              {SCAN_HISTORY.length} scans
            </span>
          </div>
          {showHistory ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>

        {showHistory && (
          <div style={{ borderTop: '1px solid rgba(139,92,246,0.15)' }}>
            {SCAN_HISTORY.map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{job.target}</p>
                  <p className="text-xs text-gray-500">Started {job.startedAt}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {job.resultsCount > 0 ? `${job.resultsCount} results` : '—'}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={
                      job.status === 'done'
                        ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#4ade80' }
                        : { background: 'rgba(239,68,68,0.12)',  border: '1px solid rgba(239,68,68,0.3)',  color: '#f87171' }
                    }
                  >
                    {job.status.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Flame className="w-3 h-3" />
                    {job.tokensBurned.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Burn modal ── */}
      {showModal && (
        <PriorityScanBurnModal
          label={scanLabel}
          target={scanTarget}
          cost={burnCost}
          onConfirm={confirmScan}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScanStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function PriorityScanBurnModal({
  label, target, cost, onConfirm, onCancel,
}: {
  label: string;
  target: ScanTarget;
  cost: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const icon = target === 'wallet' ? '👛' : target === 'channels' ? '📡' : target === 'token' ? '🔍' : target === 'scam' ? '🚨' : '🌐';
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 rounded-2xl border border-purple-500/40 p-8 max-w-md w-full">
        <div className="text-4xl mb-4 text-center">{icon}</div>
        <h3 className="text-2xl font-bold text-white mb-3 text-center">Confirm Priority Scan</h3>
        <p className="text-gray-300 mb-6 text-center text-sm">
          Running a priority scan on <span className="text-white font-semibold">{label}</span> will burn{' '}
          <span className="text-purple-300 font-bold">{cost.toLocaleString()} AGNTCBRO</span>.
          Your scan jumps the queue and completes in seconds.
        </p>
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}
        >
          <p className="text-xs text-gray-400 mb-3">Scan Details</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Target</span>
              <span className="text-white font-semibold font-mono text-xs">{label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Priority</span>
              <span className="text-purple-300 font-semibold">Front of Queue ⚡</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cost</span>
              <span className="text-purple-300 font-semibold">{cost.toLocaleString()} AGNTCBRO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Burn Effect</span>
              <span className="text-green-400 font-semibold">Reduces Supply ✓</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white font-semibold hover:bg-black/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors"
          >
            Confirm Burn
          </button>
        </div>
      </div>
    </div>
  );
}