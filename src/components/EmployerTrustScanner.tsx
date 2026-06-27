/**
 * EmployerTrustScanner.tsx — Employer Trust Score Scanner Component
 * 
 * Allows users to scan Web3 employers/projects for trust risk before accepting work.
 * Also supports submitting community reports for non-payment, rug pulls, etc.
 * 
 * Route: integrated into main page (like ProfileVerifierScanner)
 */

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────
interface EmployerScanResult {
  employer_trust_score: number;
  trust_level: string;
  trust_recommendation: string;
  risk_flags_detected: number;
  trust_signals_detected: number;
  risk_flags: string[];
  trust_signals: string[];
  signal_details: { type: string; flag: string; weight: number; description: string }[];
  profile_flags: { name: string; weight: number; description: string }[];
  scan_timestamp: string;
  scan_type: string;
  handle: string;
  platform: string;
  profile_data?: {
    display_name: string;
    bio: string;
    followers: string;
    following: string;
    joined_date: string;
    post_count: string;
    verified: boolean;
    website: string;
  };
  community_data?: {
    community_reports: number;
    prior_rug_flags: number;
    positive_reviews: number;
    verified_payments: number;
    total_reports: number;
  };
  domain_data?: {
    domain: string;
    age_days: number | null;
  };
  wallet_data?: {
    address: string;
    has_payment_history: boolean | null;
    tx_count: number | null;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────
const REPORT_TYPES: Record<string, { label: string; emoji: string }> = {
  non_payment: { label: 'Non-Payment', emoji: '💸' },
  rug_pull: { label: 'Rug Pull', emoji: '🚨' },
  abandoned_project: { label: 'Abandoned Project', emoji: '📉' },
  blocked_contractor: { label: 'Blocked Contractor', emoji: '🚫' },
  deleted_community: { label: 'Deleted Community', emoji: '🗑️' },
  fake_hiring: { label: 'Fake Hiring', emoji: '🎭' },
  account_rebrand: { label: 'Account Rebrand', emoji: '🔄' },
  positive_review: { label: 'Positive Review', emoji: '👍' },
  verified_payment: { label: 'Verified Payment', emoji: '✅' },
};

const ROLES: Record<string, string> = {
  developer: 'Developer',
  moderator: 'Moderator',
  designer: 'Designer',
  marketer: 'Marketer',
  kol: 'KOL',
  community_manager: 'Community Manager',
  content_creator: 'Content Creator',
  other: 'Other',
};

const LEVEL_STYLES: Record<string, { color: string; bg: string; emoji: string }> = {
  'HIGHLY TRUSTED': { color: '#10b981', bg: 'rgba(16,185,129,0.1)', emoji: '✅' },
  'TRUSTED': { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', emoji: '🟢' },
  'MODERATE': { color: '#eab308', bg: 'rgba(234,179,8,0.1)', emoji: '🟡' },
  'HIGH RISK': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', emoji: '🔴' },
  'CRITICAL RISK': { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', emoji: '🚨' },
};

// ── Component ────────────────────────────────────────────────────────────────
export function EmployerTrustScanner() {
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState('x');
  const [bioText, setBioText] = useState('');
  const [websiteDomain, setWebsiteDomain] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<EmployerScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Report submission state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportType, setReportType] = useState('non_payment');
  const [reporterRole, setReporterRole] = useState('developer');
  const [reportDescription, setReportDescription] = useState('');
  const [reportAmount, setReportAmount] = useState('');
  const [reportProject, setReportProject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const runScan = useCallback(async () => {
    if (!handle.trim()) {
      setError('Please enter an employer handle');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch('/api/employer-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handle.replace(/^@/, ''),
          platform,
          text: bioText,
          website_domain: websiteDomain || undefined,
          wallet_address: walletAddress || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Scan failed');
      }

      const data = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [handle, platform, bioText, websiteDomain, walletAddress]);

  const submitReport = useCallback(async () => {
    if (!handle.trim() || !reportDescription.trim()) {
      setError('Handle and description are required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const resp = await fetch('/api/employer-scan/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_handle: handle.replace(/^@/, ''),
          employer_platform: platform,
          report_type: reportType,
          reporter_role: reporterRole,
          description: reportDescription,
          amount_owed: reportAmount || undefined,
          project_name: reportProject || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Submission failed');
      }

      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportForm(false);
        setReportDescription('');
        setReportAmount('');
        setReportProject('');
      }, 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [handle, platform, reportType, reporterRole, reportDescription, reportAmount, reportProject]);

  const levelStyle = result ? LEVEL_STYLES[result.trust_level] || LEVEL_STYLES['MODERATE'] : null;

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-900/10 to-black/30 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">💼</span>
        <div>
          <h3 className="text-lg font-bold text-white">Employer Trust Scanner</h3>
          <p className="text-sm text-gray-400">Verify Web3 employers before accepting work</p>
        </div>
      </div>

      {/* Scan Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-lg bg-black/50 border border-purple-500/20 text-white px-3 py-2 text-sm"
          >
            <option value="x">X (Twitter)</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="telegram">Telegram</option>
            <option value="facebook">Facebook</option>
          </select>
          <input
            type="text"
            placeholder="@employer_handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="flex-1 rounded-lg bg-black/50 border border-purple-500/20 text-white px-4 py-2 text-sm placeholder-gray-500"
            onKeyDown={(e) => e.key === 'Enter' && runScan()}
          />
          <button
            onClick={runScan}
            disabled={scanning}
            className="rounded-lg bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        <input
          type="text"
          placeholder="Employer bio text (optional — improves scam pattern detection)"
          value={bioText}
          onChange={(e) => setBioText(e.target.value)}
          className="w-full rounded-lg bg-black/50 border border-purple-500/20 text-white px-4 py-2 text-sm placeholder-gray-500"
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Website domain (e.g. alphadao.xyz)"
            value={websiteDomain}
            onChange={(e) => setWebsiteDomain(e.target.value)}
            className="rounded-lg bg-black/50 border border-purple-500/20 text-white px-4 py-2 text-sm placeholder-gray-500"
          />
          <input
            type="text"
            placeholder="Solana wallet address (optional)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="rounded-lg bg-black/50 border border-purple-500/20 text-white px-4 py-2 text-sm placeholder-gray-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Scan Result */}
      {result && levelStyle && (
        <div className="mt-4 space-y-3">
          {/* Score Card */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: levelStyle.color + '40', backgroundColor: levelStyle.bg }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Employer Trust Score</div>
                <div className="text-3xl font-bold" style={{ color: levelStyle.color }}>
                  {result.employer_trust_score}/10
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold" style={{ color: levelStyle.color }}>
                  {levelStyle.emoji} {result.trust_level}
                </div>
                <div className="text-xs text-gray-500">
                  {result.risk_flags_detected} risk · {result.trust_signals_detected} trust
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-400">{result.trust_recommendation}</p>
          </div>

          {/* Profile Details */}
          {result.profile_data && (
            <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 p-3">
              <div className="text-sm font-medium text-blue-400 mb-2">👤 Profile Details</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                {result.profile_data.display_name && (
                  <div><span className="text-gray-500">Name:</span> {result.profile_data.display_name}</div>
                )}
                {result.profile_data.bio && (
                  <div className="col-span-2"><span className="text-gray-500">Bio:</span> {result.profile_data.bio}</div>
                )}
                {result.profile_data.followers && (
                  <div><span className="text-gray-500">Followers:</span> {result.profile_data.followers}</div>
                )}
                {result.profile_data.following && (
                  <div><span className="text-gray-500">Following:</span> {result.profile_data.following}</div>
                )}
                {result.profile_data.joined_date && (
                  <div><span className="text-gray-500">Joined:</span> {result.profile_data.joined_date}</div>
                )}
                {result.profile_data.post_count && (
                  <div><span className="text-gray-500">Posts:</span> {result.profile_data.post_count}</div>
                )}
                {result.profile_data.verified && (
                  <div><span className="text-gray-500">Verified:</span> ✅ Yes</div>
                )}
                {result.profile_data.website && (
                  <div className="col-span-2"><span className="text-gray-500">Website:</span> {result.profile_data.website}</div>
                )}
              </div>
            </div>
          )}

          {/* Community Reports */}
          {result.community_data && result.community_data.total_reports > 0 && (
            <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3">
              <div className="text-sm font-medium text-orange-400 mb-2">📢 Community Reports</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                {result.community_data.community_reports > 0 && (
                  <div className="text-red-400">💸 Non-payment: {result.community_data.community_reports}</div>
                )}
                {result.community_data.prior_rug_flags > 0 && (
                  <div className="text-red-400">🚨 Rug pulls: {result.community_data.prior_rug_flags}</div>
                )}
                {result.community_data.positive_reviews > 0 && (
                  <div className="text-green-400">👍 Positive: {result.community_data.positive_reviews}</div>
                )}
                {result.community_data.verified_payments > 0 && (
                  <div className="text-green-400">✅ Verified payments: {result.community_data.verified_payments}</div>
                )}
                <div className="col-span-2 text-gray-500">Total reports: {result.community_data.total_reports}</div>
              </div>
            </div>
          )}

          {/* Domain Data */}
          {result.domain_data && result.domain_data.domain && (
            <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/10 p-3">
              <div className="text-sm font-medium text-cyan-400 mb-2">🌐 Domain Info</div>
              <div className="text-xs text-gray-400 space-y-1">
                <div><span className="text-gray-500">Domain:</span> {result.domain_data.domain}</div>
                {result.domain_data.age_days !== null && result.domain_data.age_days !== undefined && (
                  <div><span className="text-gray-500">Age:</span> {result.domain_data.age_days < 90 ? <span className="text-red-400">{result.domain_data.age_days} days ⚠️</span> : result.domain_data.age_days > 730 ? <span className="text-green-400">{Math.floor(result.domain_data.age_days / 365)} years ✅</span> : <span>{result.domain_data.age_days} days</span>}</div>
                )}
              </div>
            </div>
          )}

          {/* Wallet Data */}
          {result.wallet_data && result.wallet_data.address && (
            <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 p-3">
              <div className="text-sm font-medium text-purple-400 mb-2">🪙 Wallet Activity</div>
              <div className="text-xs text-gray-400 space-y-1">
                <div><span className="text-gray-500">Address:</span> {result.wallet_data.address.slice(0, 8)}...{result.wallet_data.address.slice(-4)}</div>
                {result.wallet_data.has_payment_history !== null && result.wallet_data.has_payment_history !== undefined && (
                  <div><span className="text-gray-500">Payment history:</span> {result.wallet_data.has_payment_history ? <span className="text-green-400">Yes ✅</span> : <span className="text-red-400">No ❌</span>}</div>
                )}
                {result.wallet_data.tx_count !== null && result.wallet_data.tx_count !== undefined && (
                  <div><span className="text-gray-500">Transactions:</span> {result.wallet_data.tx_count}</div>
                )}
              </div>
            </div>
          )}

          {/* Risk Signals */}
          {result.signal_details.filter((s) => s.type === 'risk').length > 0 && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
              <div className="text-sm font-medium text-red-400 mb-2">🚨 Risk Signals</div>
              <ul className="space-y-1">
                {result.signal_details
                  .filter((s) => s.type === 'risk')
                  .map((s, i) => (
                    <li key={i} className="text-xs text-gray-400 flex justify-between">
                      <span>{s.description}</span>
                      <span className="text-red-400">+{s.weight}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Trust Signals */}
          {result.signal_details.filter((s) => s.type === 'trust').length > 0 && (
            <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-3">
              <div className="text-sm font-medium text-green-400 mb-2">🟢 Trust Signals</div>
              <ul className="space-y-1">
                {result.signal_details
                  .filter((s) => s.type === 'trust')
                  .map((s, i) => (
                    <li key={i} className="text-xs text-gray-400 flex justify-between">
                      <span>{s.description}</span>
                      <span className="text-green-400">{s.weight}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Profile Scam Indicators */}
          {result.profile_flags && result.profile_flags.length > 0 && (
            <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/10 p-3">
              <div className="text-sm font-medium text-yellow-400 mb-2">🔍 Profile Scam Indicators</div>
              <ul className="space-y-1">
                {result.profile_flags.map((f, i) => (
                  <li key={i} className="text-xs text-gray-400 flex justify-between">
                    <span>{f.description}</span>
                    <span className="text-yellow-400">+{f.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <div className="text-xs text-gray-500 border-t border-gray-700/30 pt-2">
            ⚠️ Educational purposes only. Not financial advice. Not a guarantee of employer reliability. Always DYOR.
            <br />
            Scan date: {result.scan_timestamp?.slice(0, 10)}
          </div>

          {/* Report Button */}
          <button
            onClick={() => setShowReportForm(!showReportForm)}
            className="w-full rounded-lg border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 py-2 text-sm font-medium transition-colors"
          >
            📢 Report this employer
          </button>
        </div>
      )}

      {/* Report Form */}
      {showReportForm && (
        <div className="mt-4 rounded-xl border border-purple-500/20 bg-black/30 p-4 space-y-3">
          <h4 className="text-sm font-bold text-white">Submit Community Report</h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full mt-1 rounded-lg bg-black/50 border border-purple-500/20 text-white px-3 py-2 text-sm"
              >
                {Object.entries(REPORT_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.emoji} {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Your Role</label>
              <select
                value={reporterRole}
                onChange={(e) => setReporterRole(e.target.value)}
                className="w-full mt-1 rounded-lg bg-black/50 border border-purple-500/20 text-white px-3 py-2 text-sm"
              >
                {Object.entries(ROLES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400">Amount Owed (optional)</label>
            <input
              type="text"
              placeholder="e.g. 2000 USDC"
              value={reportAmount}
              onChange={(e) => setReportAmount(e.target.value)}
              className="w-full mt-1 rounded-lg bg-black/50 border border-purple-500/20 text-white px-3 py-2 text-sm placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Project Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. AlphaDAO"
              value={reportProject}
              onChange={(e) => setReportProject(e.target.value)}
              className="w-full mt-1 rounded-lg bg-black/50 border border-purple-500/20 text-white px-3 py-2 text-sm placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Description</label>
            <textarea
              placeholder="Describe what happened..."
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-lg bg-black/50 border border-purple-500/20 text-white px-3 py-2 text-sm placeholder-gray-500 resize-none"
            />
          </div>

          {reportSuccess ? (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2 text-sm text-green-400 text-center">
              ✅ Report submitted! It will be reviewed by our team.
            </div>
          ) : (
            <button
              onClick={submitReport}
              disabled={submitting || !reportDescription.trim()}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 text-white py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmployerTrustScanner;