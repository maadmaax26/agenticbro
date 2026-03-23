import { useState } from 'react';

// Direct to local backend
const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:3001';

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
  error?: string;
}

type ScanStatus = 'idle' | 'scanning' | 'done';

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ScamDetectionSection() {
  const [usernameInput, setUsernameInput] = useState('');
  const [walletInput, setWalletInput]     = useState('');
  const [platform, setPlatform]           = useState<'X' | 'Telegram'>('X');
  const [scanStatus, setScanStatus]       = useState<ScanStatus>('idle');
  const [scanProgress, setScanProgress]   = useState(0);
  const [report, setReport]               = useState<InvestigationReport | null>(null);
  const [scanError, setScanError]         = useState<string | null>(null);

  const isDisabled = scanStatus === 'scanning' || !usernameInput.trim();

  const runScan = async () => {
    setScanStatus('scanning');
    setScanProgress(0);
    setReport(null);
    setScanError(null);

    // Animate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 8 + 3;
      setScanProgress(Math.min(progress, 92));
    }, 400);

    try {
      const res = await fetch(`${API_BASE}/api/telegram/scam-investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          platform,
          walletAddress: walletInput.trim() || undefined,
        }),
      });

      // Check if we got HTML back (means no backend running — Vercel SPA fallback)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html') || (!contentType.includes('json') && res.status === 200)) {
        const text = await res.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          clearInterval(interval);
          setScanProgress(100);
          setScanError(
            'Backend server is not running. The scam detection service requires the local Express server on port 3001.\n\n' +
            'To start it:\n  cd ~/.openclaw/workspace/aibro && npm run dev\n\n' +
            'The Python scammer-detection-service at ~/.openclaw/workspace/scammer-detection-service will be invoked automatically.'
          );
          setScanStatus('done');
          return;
        }
      }

      const data = await res.json() as { investigation?: InvestigationReport; error?: string; detail?: string };
      clearInterval(interval);
      setScanProgress(100);

      if (!res.ok || data.error) {
        setScanError(data.detail ?? data.error ?? `Server error (${res.status})`);
      } else if (data.investigation) {
        setReport(data.investigation);
      }
      setScanStatus('done');
    } catch (err) {
      clearInterval(interval);
      setScanProgress(100);
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(
        msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError') || msg.includes('DOCTYPE')
          ? 'Backend server is offline. Start the local server for live scans:\n  cd ~/.openclaw/workspace/aibro && npm run dev'
          : `Scan failed: ${msg}`,
      );
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
              Powered by <span className="text-red-400 font-semibold">OpenClaw Detection Engine</span> — full investigation with profile analysis, victim reports, wallet forensics & scammer database
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
            FREE ACCESS
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
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
          >
            {scanStatus === 'scanning' ? (
              <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Investigating…</>
            ) : (
              <>🔍 Run Full Investigation</>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-600">
          Uses <span className="text-red-400">~/.openclaw/workspace/scammer-detection-service</span> Python engine.
          {platform === 'X' && ' X users are analyzed via browser-based profile scraping.'}
          {' '}Only public information is accessed — no private data.
        </p>
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
              Powered by <span className="text-red-400 font-semibold">OpenClaw Scammer Detection Service</span> · Solscan · Etherscan · Reddit · Google
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
