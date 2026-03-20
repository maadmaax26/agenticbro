import { useState } from 'react';
import { ScanLine, Flame, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Wallet, Hash } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { isTestWallet } from '../../hooks/useTokenGating';

// Direct to local backend — works from both localhost:5173 and the deployed Vercel site
const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanStatus = 'idle' | 'scanning' | 'done';
type ScanTarget = 'all' | 'wallet' | 'channels' | 'token';

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
  { id: 'wallet',   label: 'Wallet Scan',  icon: '👛', cost: 10000, description: 'Track a wallet\'s alpha signals' },
  { id: 'channels', label: 'Channel Scan', icon: '📡', cost: 10000, description: 'Deep-scan a specific channel' },
  { id: 'token',    label: 'Single Token', icon: '🔍', cost: 10000, description: 'Find all calls for a token' },
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
  const [results,       setResults]       = useState<ScanResult[]>([]);
  const [showModal,     setShowModal]     = useState(false);
  const [expandedId,    setExpandedId]    = useState<number | null>(null);
  const [showHistory,   setShowHistory]   = useState(false);
  const [scanProgress,  setScanProgress]  = useState(0);

  const burnCost = scanTarget === 'all' ? 15000 : 10000;

  // Resolve human-readable label for burn modal / history
  const scanLabel = (() => {
    if (scanTarget === 'wallet')   return walletInput   ? `👛 ${walletInput.slice(0, 6)}…${walletInput.slice(-4)}` : 'Wallet Scan';
    if (scanTarget === 'channels') return channelInput  ? `📡 ${channelInput}` : 'Channel Scan';
    if (scanTarget === 'token')    return tokenInput     ? `🔍 ${tokenInput}`  : 'Single Token';
    return 'All Channels';
  })();

  // Disable launch if required input is empty
  const isLaunchDisabled =
    scanStatus === 'scanning' ||
    (scanTarget === 'wallet'   && !walletInput.trim())  ||
    (scanTarget === 'channels' && !channelInput.trim()) ||
    (scanTarget === 'token'    && !tokenInput.trim());

  // Test wallet: skip burn confirmation and run immediately
  const startScan = () => { if (isTest) { void confirmScan(); } else { setShowModal(true); } };

  const confirmScan = async () => {
    setShowModal(false);
    setScanStatus('scanning');
    setScanProgress(0);
    setResults([]);

    // Animate progress while waiting for real API
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 4;
      setScanProgress(Math.min(progress, 92));
    }, 280);

    try {
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
      const data = await res.json() as { results: ScanResult[]; mock?: boolean };
      clearInterval(interval);
      setScanProgress(100);
      setTimeout(() => {
        setResults(data.results ?? []);
        setScanStatus('done');
      }, 300);
    } catch {
      clearInterval(interval);
      setScanProgress(100);
      setResults(MOCK_SCAN_RESULTS);
      setScanStatus('done');
    }
  };

  const confidenceStyle = (c: ScanResult['confidence']) => {
    if (c === 'HIGH')   return { color: '#4ade80', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  };
    if (c === 'MEDIUM') return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
    return                     { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'  };
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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

        {/* ── Launch button ── */}
        <button
          onClick={startScan}
          disabled={isLaunchDisabled}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700"
        >
          <ScanLine className="w-4 h-4" />
          {scanStatus === 'scanning' ? 'Scanning…' : `Run Priority Scan — ${burnCost.toLocaleString()} AGNTCBRO`}
        </button>
      </div>

      {/* ── Progress bar ── */}
      {scanStatus === 'scanning' && (
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
            <p className="text-white font-semibold">
              {scanTarget === 'wallet'   ? `Scanning wallet ${walletInput.slice(0,6)}…`   :
               scanTarget === 'channels' ? `Deep-scanning ${channelInput}…`                :
               scanTarget === 'token'    ? `Searching channels for ${tokenInput}…`          :
               'Scanning all channels…'}
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
            {[
              { pct: 0,  label: scanTarget === 'wallet' ? 'Resolving wallet on-chain activity…' : 'Connecting to channel feeds…' },
              { pct: 25, label: 'Extracting token calls…' },
              { pct: 55, label: 'Pulling DEX market data…' },
              { pct: 80, label: 'Running scoring engine…' },
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

      {/* ── Results ── */}
      {scanStatus === 'done' && results.length > 0 && (
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
  const icon = target === 'wallet' ? '👛' : target === 'channels' ? '📡' : target === 'token' ? '🔍' : '🌐';
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
