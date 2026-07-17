// ============================================
// Agentic Bro - Phone Number Verifier Component
// ============================================
// Enhanced with:
//   • SMS/text scam checkbox → adjusts scoring on server
//   • Caller name (CNAM) from Twilio + IPQS
//   • City + state/region from IPQS
//   • "Report this number" button → POST /api/phone-report
//   • AgenticBro community reports count (own DB)
//   • IPQS fraud score displayed in Threat Intel
// ============================================

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────
interface PhoneScanResult {
  valid:          boolean;
  phone:          string;
  formatted:      string;
  country:        string;
  countryCode:    string;
  carrier:        string;
  lineType:       string;
  rawLineType?:    string;
  callerName:     string | null;
  city:           string | null;
  region:         string | null;
  riskScore:      number;
  riskLevel:      string;
  redFlags:       string[];
  ownerType:      string;
  scamOperationMatch: string | null;
  virtualCenterMatch: string | null;
  spamDialerMatch:    string | null;
  recommendation: string;
  disclaimer:     string;
  scanDate:       string;
  ipqsFraudScore:       number | null;
  ownCommunityReports:  number;
  threatIntel?: {
    voipVirtualDialer: { detected: boolean; provider: string | null; confidence: string };
    knownScamNumber:   { flagged: boolean; source: string | null; reports: number };
    communityReports:  { count: number; ownCount: number; source: string | null; lastReport: string | null };
    breachExposure:    { found: boolean; breaches: number; sources: string[] };
    stirShaken:        { attestation: 'A' | 'B' | 'C' | 'unknown'; verified: boolean; description: string };
  };
}

type ScanStep    = 'idle' | 'validating' | 'analyzing' | 'scoring' | 'done' | 'error';
type ReportType  = 'scam' | 'spam' | 'robocall' | 'fraud' | 'impersonation' | 'unknown';

// ── Helpers ─────────────────────────────────────────────────────────────────
function getRiskColors(level: string) {
  switch (level) {
    case 'CRITICAL': return { color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)' };
    case 'HIGH':     return { color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.3)' };
    case 'MEDIUM':   return { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)' };
    default:         return { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.3)' };
  }
}

function getLineTypeIcon(lineType: string): string {
  const lt = (lineType || '').toLowerCase();
  if (lt.includes('reported_sms') || lt.includes('text_enabled')) return '📱';
  if (lt.includes('voip') || lt.includes('virtual')) return '☁️';
  if (lt.includes('mobile') || lt.includes('cell') || lt.includes('wireless')) return '📱';
  if (lt.includes('landline') || lt.includes('fixed')) return '☎️';
  if (lt.includes('toll_free') || lt.includes('toll free')) return '📞';
  if (lt.includes('premium')) return '💰';
  return '📞';
}

function formatLineType(lineType: string, rawLineType?: string): string {
  const lt = (lineType || '').toLowerCase();
  if (lt.includes('reported_sms_text_enabled_or_spoofed')) {
    return `Reported SMS-capable / possible spoofing${rawLineType ? ` (carrier lookup: ${rawLineType})` : ''}`;
  }
  return lineType || 'unknown';
}

function getOwnerTypeLabel(ownerType: string): { label: string; color: string } {
  switch (ownerType) {
    case 'individual':   return { label: '👤 Individual',            color: '#4ade80' };
    case 'business':     return { label: '🏢 Business',              color: '#60a5fa' };
    case 'voip_service': return { label: '☁️ Virtual/VoIP Service',  color: '#fbbf24' };
    case 'government':   return { label: '🏛️ Government',            color: '#a78bfa' };
    default:             return { label: '❓ Unknown',               color: '#9ca3af' };
  }
}

const REPORT_TYPE_LABELS: Record<ReportType, { emoji: string; label: string }> = {
  scam:          { emoji: '🚨', label: 'Scam Call' },
  spam:          { emoji: '📢', label: 'Spam / Telemarketing' },
  robocall:      { emoji: '🤖', label: 'Robocall' },
  fraud:         { emoji: '💸', label: 'Fraud / Financial Scam' },
  impersonation: { emoji: '🎭', label: 'Impersonation (IRS, Tech Support, etc.)' },
  unknown:       { emoji: '❓', label: 'Suspicious but Unsure' },
};

// ── Component ────────────────────────────────────────────────────────────────
export default function PhoneNumberVerifier() {
  const [phoneInput,  setPhoneInput]  = useState('');
  const [textScam,    setTextScam]    = useState(false);
  const [result,      setResult]      = useState<PhoneScanResult | null>(null);
  const [step,        setStep]        = useState<ScanStep>('idle');
  const [errorMsg,    setErrorMsg]    = useState('');

  // Report modal state
  const [showReport,    setShowReport]    = useState(false);
  const [reportType,    setReportType]    = useState<ReportType>('scam');
  const [reportNotes,   setReportNotes]   = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone,    setReportDone]    = useState(false);
  const [reportError,   setReportError]   = useState('');

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    const phone = phoneInput.trim();
    if (!phone) return;

    setResult(null);
    setErrorMsg('');
    setReportDone(false);
    setStep('validating');

    try {
      await new Promise(r => setTimeout(r, 400));
      setStep('analyzing');

      const res = await fetch('/api/phone-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, textScam }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as Record<string, string>).error || 'Scan failed');
      }

      setStep('scoring');
      await new Promise(r => setTimeout(r, 300));

      const data = await res.json() as { success: boolean; result: PhoneScanResult };
      setResult(data.result);
      setStep('done');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Phone verification failed');
      setStep('error');
    }
  }, [phoneInput, textScam]);

  // ── Report submission ─────────────────────────────────────────────────────
  const handleReport = useCallback(async () => {
    if (!result) return;
    setReportSending(true);
    setReportError('');
    try {
      const res = await fetch('/api/phone-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          phone:       result.phone,
          report_type: reportType,
          notes:       reportNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || 'Submission failed');
      }
      setReportDone(true);
      setShowReport(false);
      // Bump the community count locally so it refreshes immediately
      setResult(prev => prev ? {
        ...prev,
        ownCommunityReports: (prev.ownCommunityReports || 0) + 1,
        threatIntel: prev.threatIntel ? {
          ...prev.threatIntel,
          communityReports: {
            ...prev.threatIntel.communityReports,
            count:    prev.threatIntel.communityReports.count + 1,
            ownCount: (prev.threatIntel.communityReports.ownCount || 0) + 1,
          },
        } : prev.threatIntel,
      } : prev);
    } catch (err: any) {
      setReportError(err?.message || 'Failed to submit report');
    } finally {
      setReportSending(false);
    }
  }, [result, reportType, reportNotes]);

  const handleReset = () => {
    setPhoneInput('');
    setResult(null);
    setStep('idle');
    setErrorMsg('');
    setTextScam(false);
    setShowReport(false);
    setReportDone(false);
    setReportNotes('');
  };

  const riskColors = result ? getRiskColors(result.riskLevel) : null;
  const ownerInfo  = result ? getOwnerTypeLabel(result.ownerType) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(15,15,25,0.9)', border: '1px solid rgba(139,92,246,0.2)' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">📞</span>
          <div>
            <h3 className="text-lg font-bold text-white">Phone Number Verifier</h3>
            <p className="text-xs text-gray-400">Carrier • VoIP detection • Scam databases • IPQS fraud scoring • Community reports</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Input area */}
        {!result && step !== 'error' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 block">
                Phone Number (include country code)
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="flex-1 px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}
                  onKeyDown={e => e.key === 'Enter' && handleScan()}
                />
                <button
                  onClick={handleScan}
                  disabled={step !== 'idle' || !phoneInput.trim()}
                  className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                >
                  {step === 'idle' ? '🔍 Verify' : '⏳ Scanning…'}
                </button>
              </div>

              {/* SMS scam checkbox */}
              <label className="flex items-center gap-2 mt-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={textScam}
                  onChange={e => setTextScam(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500"
                />
                <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                  📱 This number sent me a suspicious / malicious text message
                  <span className="ml-1 text-purple-500 font-semibold">(treats SMS evidence as a risk signal)</span>
                </span>
              </label>

              <p className="text-xs text-gray-600 mt-2">
                We check 9 data sources: carrier, Twilio CNAM, IPQS fraud score, FTC complaints, CallControl, 800notes, and more.
              </p>
            </div>

            {/* Progress steps */}
            {step !== 'idle' && (
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className={step === 'validating' ? 'text-purple-400 animate-pulse' : 'text-green-400'}>
                  {step === 'validating' ? '🔄' : '✅'} Validating format
                </span>
                <span className={step === 'analyzing' ? 'text-purple-400 animate-pulse' : ['idle','validating'].includes(step) ? 'text-gray-600' : 'text-green-400'}>
                  {step === 'analyzing' ? '🔄' : ['idle','validating'].includes(step) ? '⏳' : '✅'} Querying 9 data sources
                </span>
                <span className={step === 'scoring' ? 'text-purple-400 animate-pulse' : step === 'done' ? 'text-green-400' : 'text-gray-600'}>
                  {step === 'scoring' ? '🔄' : step === 'done' ? '✅' : '⏳'} Risk scoring
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-red-400 text-sm">❌ {errorMsg}</p>
            <button onClick={handleReset} className="mt-2 text-xs text-gray-400 hover:text-white transition-colors">
              ← Try again
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Risk score header */}
            <div className="rounded-xl p-5" style={{ background: riskColors!.bg, border: `2px solid ${riskColors!.border}` }}>
              <div className="space-y-3">
                <p className="text-sm text-gray-400">📞 Phone: {result.formatted}</p>
                <h3 className="text-xl font-bold" style={{ color: riskColors!.color }}>
                  📊 Risk Score: {result.riskScore}/10 — {result.riskLevel} RISK{' '}
                  {result.riskLevel === 'CRITICAL' ? '🚨' : result.riskLevel === 'HIGH' ? '⚠️' : result.riskLevel === 'MEDIUM' ? '⚡' : '✅'}
                </h3>
                {result.ipqsFraudScore !== null && (
                  <p className="text-xs" style={{ color: riskColors!.color }}>
                    IPQS Fraud Score: <span className="font-bold font-mono">{result.ipqsFraudScore}/100</span>
                    {result.ipqsFraudScore >= 85 ? ' — Critical' : result.ipqsFraudScore >= 75 ? ' — High Risk' : result.ipqsFraudScore >= 50 ? ' — Risky' : ' — Low Risk'}
                  </p>
                )}
                {/* Risk meter */}
                <div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${result.riskScore * 10}%`,
                        background: 'linear-gradient(90deg, #4ade80, #fbbf24, #fb923c, #f87171)',
                        backgroundSize: '300% 100%',
                        backgroundPosition: `${result.riskScore * 10}% 0`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span><span>3</span><span>5</span><span>7</span><span>10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone info block */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <p className="text-gray-300">
                  <span className="text-gray-500">Number:</span>{' '}
                  <span className="font-semibold text-white">{result.formatted}</span>
                </p>
                {result.callerName && (
                  <p className="text-gray-300">
                    <span className="text-gray-500">Registered name:</span>{' '}
                    <span className="font-semibold text-yellow-300">{result.callerName}</span>
                  </p>
                )}
                <p className="text-gray-300">
                  <span className="text-gray-500">Country:</span>{' '}
                  {result.country} {result.countryCode ? `(${result.countryCode})` : ''}
                </p>
                {(result.city || result.region) && (
                  <p className="text-gray-300">
                    <span className="text-gray-500">Location:</span>{' '}
                    <span className="text-white">{[result.city, result.region].filter(Boolean).join(', ')}</span>
                  </p>
                )}
                <p className="text-gray-300">
                  <span className="text-gray-500">Carrier:</span>{' '}
                  <span className="text-white font-medium">{result.carrier}</span>
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Line type:</span>{' '}
                  {getLineTypeIcon(result.lineType)} {formatLineType(result.lineType, result.rawLineType)}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Owner type:</span>{' '}
                  <span style={{ color: ownerInfo!.color }}>{ownerInfo!.label}</span>
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Valid:</span>{' '}
                  <span style={{ color: result.valid ? '#4ade80' : '#f87171' }}>
                    {result.valid ? '✓ Yes' : '✗ Failed validation'}
                  </span>
                </p>
              </div>
            </div>

            {/* Threat matches */}
            {(result.scamOperationMatch || result.virtualCenterMatch || result.spamDialerMatch) && (
              <div className="rounded-xl p-5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <h3 className="text-base font-bold text-red-400 mb-3">🎯 Threat Identification</h3>
                {result.scamOperationMatch && (
                  <p className="text-sm text-red-300 mb-2">
                    🚨 <span className="font-semibold">Scam Operation:</span> {result.scamOperationMatch}
                  </p>
                )}
                {result.virtualCenterMatch && (
                  <p className="text-sm text-yellow-300 mb-2">
                    ☁️ <span className="font-semibold">Virtual Phone Center:</span> {result.virtualCenterMatch}
                  </p>
                )}
                {result.spamDialerMatch && (
                  <p className="text-sm text-orange-300 mb-2">
                    📞 <span className="font-semibold">Spam Dialer:</span> {result.spamDialerMatch}
                  </p>
                )}
              </div>
            )}

            {/* Red flags */}
            {result.redFlags.length > 0 && (
              <div className="rounded-xl p-5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <h3 className="text-base font-bold text-red-400 mb-3">Red Flags with Scores:</h3>
                <div className="space-y-1.5">
                  {result.redFlags.map((flag, index) => {
                    const pointMatch = flag.match(/\((\d+)pts?\)/);
                    const points     = pointMatch ? parseInt(pointMatch[1]) : 0;
                    const hasPoints  = pointMatch !== null;
                    const flagName   = flag.replace(/\s*\(\d+pts?\).*/, '').replace(/_/g, ' ');
                    const descMatch  = flag.match(/—\s*(.+)/);
                    const desc       = descMatch ? descMatch[1] : '';
                    return (
                      <div key={index} className="text-sm text-gray-300">
                        <span className="text-gray-500">•</span>{' '}
                        <span className="font-medium capitalize">{flagName}</span>
                        {hasPoints && (
                          <span className="ml-1 text-xs font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            {points}pts
                          </span>
                        )}
                        {desc && <span className="text-gray-500"> — {desc}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Threat intel */}
            {result.threatIntel && (
              <div className="rounded-xl p-5" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <h3 className="text-base font-bold text-purple-400 mb-3">🛡️ Threat Intel</h3>
                <div className="space-y-3">
                  {/* VoIP */}
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{result.threatIntel.voipVirtualDialer.detected ? '☁️' : '✅'}</span>
                    <div>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold">VoIP / Virtual Dialer:</span>{' '}
                        {result.threatIntel.voipVirtualDialer.detected ? (
                          <>
                            <span style={{ color: '#f87171' }}>Detected</span>
                            {result.threatIntel.voipVirtualDialer.provider && (
                              <span className="text-gray-500"> — {result.threatIntel.voipVirtualDialer.provider}</span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#4ade80' }}>Not detected</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-600">Confidence: {result.threatIntel.voipVirtualDialer.confidence}</p>
                    </div>
                  </div>

                  {/* Known scam number */}
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{result.threatIntel.knownScamNumber.flagged ? '🚨' : '✅'}</span>
                    <div>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold">Known Scam Number:</span>{' '}
                        {result.threatIntel.knownScamNumber.flagged
                          ? <span style={{ color: '#f87171' }}>Flagged</span>
                          : <span style={{ color: '#4ade80' }}>Not flagged</span>}
                      </p>
                      {result.threatIntel.knownScamNumber.flagged && (
                        <>
                          <p className="text-xs text-red-400">{result.threatIntel.knownScamNumber.reports} scam reports found</p>
                          {result.threatIntel.knownScamNumber.source && (
                            <p className="text-xs text-gray-600">Source: {result.threatIntel.knownScamNumber.source}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Community reports */}
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{result.threatIntel.communityReports.count > 0 ? '📊' : '✅'}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold">Community Reports:</span>{' '}
                        <span style={{ color: result.threatIntel.communityReports.count > 10 ? '#f87171' : result.threatIntel.communityReports.count > 3 ? '#fbbf24' : '#4ade80' }}>
                          {result.threatIntel.communityReports.count} report{result.threatIntel.communityReports.count !== 1 ? 's' : ''}
                        </span>
                        {result.threatIntel.communityReports.ownCount > 0 && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                            {result.threatIntel.communityReports.ownCount} from AgenticBro users
                          </span>
                        )}
                      </p>
                      {result.threatIntel.communityReports.lastReport && (
                        <p className="text-xs text-gray-600">Last report: {result.threatIntel.communityReports.lastReport}</p>
                      )}
                      {result.threatIntel.communityReports.source && (
                        <p className="text-xs text-gray-600">Sources: {result.threatIntel.communityReports.source}</p>
                      )}
                    </div>
                  </div>

                  {/* Breach exposure (powered by IPQS) */}
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{result.threatIntel.breachExposure.found ? '🔓' : '🔒'}</span>
                    <div>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold">Breach Exposure:</span>{' '}
                        {result.threatIntel.breachExposure.found ? (
                          <span style={{ color: '#fb923c' }}>{result.threatIntel.breachExposure.breaches} breach source{result.threatIntel.breachExposure.breaches !== 1 ? 's' : ''} found</span>
                        ) : (
                          <span style={{ color: '#4ade80' }}>No known breaches</span>
                        )}
                      </p>
                      {result.threatIntel.breachExposure.sources.length > 0 && (
                        <p className="text-xs text-gray-600">{result.threatIntel.breachExposure.sources.join(' · ')}</p>
                      )}
                    </div>
                  </div>

                  {/* STIR/SHAKEN */}
                  <div className="flex items-start gap-3">
                    <span className="text-lg">
                      {result.threatIntel.stirShaken.verified ? '✅' : result.threatIntel.stirShaken.attestation === 'unknown' ? '❓' : '⚠️'}
                    </span>
                    <div>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold">STIR/SHAKEN:</span>{' '}
                        <span
                          className="font-mono px-1.5 py-0.5 rounded text-xs font-bold"
                          style={{
                            background: result.threatIntel.stirShaken.attestation === 'A' ? 'rgba(74,222,128,0.15)' :
                              result.threatIntel.stirShaken.attestation === 'B' ? 'rgba(251,191,36,0.15)' :
                              result.threatIntel.stirShaken.attestation === 'C' ? 'rgba(239,68,68,0.15)' : 'rgba(156,163,175,0.1)',
                            color: result.threatIntel.stirShaken.attestation === 'A' ? '#4ade80' :
                              result.threatIntel.stirShaken.attestation === 'B' ? '#fbbf24' :
                              result.threatIntel.stirShaken.attestation === 'C' ? '#f87171' : '#9ca3af',
                          }}
                        >
                          {result.threatIntel.stirShaken.attestation === 'unknown' ? '?' : result.threatIntel.stirShaken.attestation}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{result.threatIntel.stirShaken.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Behavioral pattern */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <p className="text-sm text-gray-300 leading-relaxed">
                <span className="text-yellow-400 font-semibold">Behavioral Pattern:</span>{' '}
                {result.riskLevel === 'CRITICAL'
                  ? 'This phone number shows strong indicators of being associated with a scam operation. The combination of risk factors suggests this number is used for fraudulent activity. Do not engage, share personal information, or follow any instructions from this number.'
                  : result.riskLevel === 'HIGH'
                  ? 'Significant risk indicators detected. This number may be associated with virtual phone services, untraceable carriers, or known scam patterns. Verify the caller through official channels before engaging.'
                  : result.riskLevel === 'MEDIUM'
                  ? 'Some concerning patterns detected. The number may have legitimate uses but shows characteristics that warrant caution. Verify independently before sharing sensitive information.'
                  : 'No significant risk indicators. The number appears to be a standard legitimate phone line. Always verify caller identity independently before sharing sensitive information.'}
              </p>
            </div>

            {/* Recommendation */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="text-sm text-gray-300">
                <span className="text-purple-400 font-semibold">💡 Recommendation:</span>{' '}
                {result.recommendation}
              </p>
            </div>

            {/* Report button row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white transition-colors">
                ← Verify another number
              </button>
              <div className="flex items-center gap-2">
                {reportDone && (
                  <span className="text-xs text-green-400 font-semibold">✓ Report submitted</span>
                )}
                {!reportDone && (
                  <button
                    onClick={() => setShowReport(true)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105"
                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}
                  >
                    🚩 Report this number
                  </button>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs text-gray-500">
                📋 {result.disclaimer} | Scan date: {result.scanDate}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Report modal ──────────────────────────────────────────────────── */}
      {showReport && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReport(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: 'rgba(15,15,25,0.98)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">🚩 Report {result.formatted}</h3>
              <button onClick={() => setShowReport(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
            </div>

            <p className="text-xs text-gray-400">
              Your report helps other AgenticBro users avoid this number. Reports are public and anonymous.
            </p>

            {/* Report type selector */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold block">Report type</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, { emoji: string; label: string }][]).map(([type, { emoji, label }]) => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all"
                    style={{
                      background: reportType === type ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${reportType === type ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      color: reportType === type ? '#fca5a5' : '#9ca3af',
                    }}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                Notes <span className="normal-case font-normal">(optional — max 500 chars)</span>
              </label>
              <textarea
                value={reportNotes}
                onChange={e => setReportNotes(e.target.value)}
                placeholder="e.g. Claimed to be IRS, asked for gift cards…"
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/40"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <p className="text-xs text-gray-600 text-right mt-0.5">{reportNotes.length}/500</p>
            </div>

            {reportError && (
              <p className="text-xs text-red-400">❌ {reportError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={reportSending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
              >
                {reportSending ? '⏳ Submitting…' : '🚩 Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
