/**
 * WebsiteSecurityScanner — Enhanced with:
 *   • Scan progress steps
 *   • Google Safe Browsing verdict
 *   • urlscan.io verdict + report link
 *   • Redirect chain display
 *   • IP & hosting info block
 *   • TLD risk display
 *   • Community report count + "Report this URL" button/modal
 */

import { useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ThreatDetection {
  type:        string;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?:   string;
  weight:      number;
}

interface SafeBrowsingResult {
  flagged:  boolean;
  threats:  { type: string; platform: string }[];
}

interface UrlScanIoResult {
  found:         boolean;
  verdict:       'malicious' | 'suspicious' | 'benign' | 'unknown';
  score:         number | null;
  screenshotUrl: string | null;
  reportUrl:     string | null;
  country:       string | null;
  asnName:       string | null;
  scanDate:      string | null;
}

interface IPHostingInfo {
  ip:              string | null;
  country:         string | null;
  countryCode:     string | null;
  city:            string | null;
  isp:             string | null;
  org:             string | null;
  asn:             string | null;
  isHosting:       boolean;
  isBulletproof:   boolean;
  hostingProvider: string | null;
}

interface WebsiteScanResult {
  success:           boolean;
  url:               string;
  finalUrl?:         string;
  domain:            string;
  riskScore:         number;
  riskLevel:         'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threats:           ThreatDetection[];
  recommendations:   string[];
  reputation?:       { source: string; verdict: string; details?: string }[];
  scamIndicators?:   string[];
  scanDate:          string;
  scanCategory?:     string;
  domainInfo?:       { domainAgeDays?: number; registeredDate?: string; registrar?: string; isNewDomain?: boolean };
  paymentAnalysis?:  { detectedMethods: string[]; safeMethods: string[]; riskyMethods: string[]; paymentProviders: string[]; hasBuyerProtection: boolean; riskAssessment: string };
  redirectChain?:    string[];
  safeBrowsing?:     SafeBrowsingResult | null;
  urlScanInfo?:      UrlScanIoResult | null;
  ipInfo?:           IPHostingInfo | null;
  ownCommunityReports?: number;
}

type ScanStep    = 'idle' | 'checking' | 'fetching' | 'scoring' | 'done' | 'error';
type ScanMode    = 'general' | 'ticket' | 'crypto_casino';
type ReportType  = 'phishing' | 'scam' | 'malware' | 'fake_store' | 'investment_fraud' | 'impersonation' | 'unknown';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRiskColors(level: string) {
  switch (level) {
    case 'CRITICAL': return { color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.35)' };
    case 'HIGH':     return { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.35)' };
    case 'MEDIUM':   return { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)' };
    default:         return { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.3)' };
  }
}

function getSeverityIcon(s: string) {
  switch (s) { case 'CRITICAL': return '🚨'; case 'HIGH': return '⚠️'; case 'MEDIUM': return '⚡'; default: return 'ℹ️'; }
}

const REPORT_TYPE_LABELS: Record<ReportType, { emoji: string; label: string }> = {
  phishing:          { emoji: '🎣', label: 'Phishing / Credential Theft' },
  scam:              { emoji: '🚨', label: 'Scam / Fraud' },
  malware:           { emoji: '🦠', label: 'Malware / Virus' },
  fake_store:        { emoji: '🏪', label: 'Fake Store / Counterfeit' },
  investment_fraud:  { emoji: '💸', label: 'Investment / Financial Fraud' },
  impersonation:     { emoji: '🎭', label: 'Brand Impersonation' },
  unknown:           { emoji: '❓', label: 'Suspicious but Unsure' },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function WebsiteSecurityScanner() {
  const [url,      setUrl]      = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('general');
  const [step,     setStep]     = useState<ScanStep>('idle');
  const [result,   setResult]   = useState<WebsiteScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Report modal
  const [showReport,    setShowReport]    = useState(false);
  const [reportType,    setReportType]    = useState<ReportType>('phishing');
  const [reportNotes,   setReportNotes]   = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone,    setReportDone]    = useState(false);
  const [reportError,   setReportError]   = useState('');

  const handleScan = useCallback(async () => {
    if (!url.trim()) return;
    setResult(null);
    setErrorMsg('');
    setReportDone(false);
    setStep('checking');

    try {
      await new Promise(r => setTimeout(r, 400));
      setStep('fetching');

      const res = await fetch('/api/website-scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || 'Scan failed');
      }

      setStep('scoring');
      await new Promise(r => setTimeout(r, 300));

      const data = await res.json() as WebsiteScanResult;
      setResult(data);
      setStep('done');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Website scan failed');
      setStep('error');
    }
  }, [url]);

  const handleReport = useCallback(async () => {
    if (!result) return;
    setReportSending(true);
    setReportError('');
    try {
      const res = await fetch('/api/website-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ domain: result.domain, url: result.url, report_type: reportType, notes: reportNotes.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).error || 'Submission failed'); }
      setReportDone(true);
      setShowReport(false);
      setResult(prev => prev ? { ...prev, ownCommunityReports: (prev.ownCommunityReports || 0) + 1 } : prev);
    } catch (err: any) {
      setReportError(err?.message || 'Failed to submit report');
    } finally {
      setReportSending(false);
    }
  }, [result, reportType, reportNotes]);

  const handleReset = () => { setUrl(''); setResult(null); setStep('idle'); setErrorMsg(''); setReportDone(false); setReportNotes(''); setShowReport(false); };

  const rc     = result ? getRiskColors(result.riskLevel) : null;
  const isTicket  = result?.scanCategory === 'ticket'       || result?.threats.some(t => ['fake_event_ticket','fifa_impersonation'].includes(t.type));
  const isCasino  = result?.scanCategory === 'crypto_casino' || result?.threats.some(t => ['fake_casino','casino_lure','casino_withhold'].includes(t.type));

  const modeColor = scanMode === 'ticket' ? '#eab308' : scanMode === 'crypto_casino' ? '#ef4444' : '#8b5cf6';
  const modeBg    = `rgba(${scanMode === 'ticket' ? '234,179,8' : scanMode === 'crypto_casino' ? '239,68,68' : '139,92,246'},0.05)`;
  const modeBorder = `rgba(${scanMode === 'ticket' ? '234,179,8' : scanMode === 'crypto_casino' ? '239,68,68' : '139,92,246'},0.2)`;

  return (
    <div className="space-y-6">
      {/* ── Header + Input ────────────────────────────────────────────────── */}
      <div className="rounded-xl p-6" style={{ background: modeBg, border: `1px solid ${modeBorder}` }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{scanMode === 'ticket' ? '🎫' : scanMode === 'crypto_casino' ? '🎰' : '🌐'}</span>
          <div>
            <h2 className="text-xl font-bold text-white">
              {scanMode === 'ticket' ? 'Event Ticket Scam Scanner' : scanMode === 'crypto_casino' ? 'Crypto Casino Scanner' : 'Website Security Scanner'}
            </h2>
            <p className="text-sm text-gray-400">
              {scanMode === 'ticket'
                ? 'Detect fake World Cup 2026 tickets, FIFA impersonation & ticket fraud'
                : scanMode === 'crypto_casino'
                ? 'Detect fake/unlicensed crypto casinos, withdrawal traps & rigged games'
                : '9 checks: Safe Browsing • urlscan.io • TLD risk • IP/hosting • redirects • domain age + more'}
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          {(['general', 'crypto_casino', 'ticket'] as ScanMode[]).map(m => (
            <button
              key={m}
              onClick={() => setScanMode(m)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: scanMode === m ? `rgba(${m === 'ticket' ? '234,179,8' : m === 'crypto_casino' ? '239,68,68' : '139,92,246'},0.25)` : 'rgba(255,255,255,0.04)',
                border:     `1px solid ${scanMode === m ? `rgba(${m === 'ticket' ? '234,179,8' : m === 'crypto_casino' ? '239,68,68' : '139,92,246'},0.5)` : 'rgba(255,255,255,0.08)'}`,
                color:      scanMode === m ? (m === 'ticket' ? '#fde047' : m === 'crypto_casino' ? '#fca5a5' : '#c4b5fd') : '#9ca3af',
              }}
            >
              {m === 'general' ? '🌐 General Scan' : m === 'crypto_casino' ? '🎰 Casino Scan' : '🎫 Ticket Scan'}
            </button>
          ))}
        </div>

        {/* Contextual warning banners */}
        {scanMode === 'crypto_casino' && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-sm text-red-300 font-semibold">🎰 Crypto Casino Warning</p>
            <p className="text-xs text-gray-400 mt-1">Many crypto casinos are unlicensed, rigged, or refuse withdrawals. Verify licensing (Curacao, Malta, UK) before depositing.</p>
          </div>
        )}
        {scanMode === 'ticket' && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
            <p className="text-sm text-yellow-300 font-semibold">⚽ World Cup 2026 Ticket Scams</p>
            <p className="text-xs text-gray-400 mt-1">FIFA is the ONLY authorized seller of World Cup 2026 tickets. Buy only at <span className="text-yellow-300">FIFA.com/tickets</span>.</p>
          </div>
        )}

        {/* URL input */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-300">
            {scanMode === 'ticket' ? '🎫 Ticket Website URL' : scanMode === 'crypto_casino' ? '🎰 Casino Website URL' : '🌐 Website URL'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && step === 'idle' && handleScan()}
              placeholder={scanMode === 'ticket' ? 'https://suspicious-ticket-site.com' : scanMode === 'crypto_casino' ? 'https://crypto-casino.xyz' : 'https://suspicious-site.com'}
              disabled={step !== 'idle' && step !== 'error'}
              className="flex-1 px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}
            />
            <button
              onClick={handleScan}
              disabled={(step !== 'idle' && step !== 'error') || !url.trim()}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{ background: `linear-gradient(135deg, ${modeColor}, ${modeColor}cc)` }}
            >
              {step === 'idle' || step === 'error' ? '🔍 Scan' : '⏳ Scanning…'}
            </button>
          </div>

          {/* Progress steps */}
          {step !== 'idle' && step !== 'error' && (
            <div className="flex items-center gap-4 text-xs flex-wrap pt-1">
              {[
                { key: 'checking', label: 'Checking databases' },
                { key: 'fetching', label: 'Fetching 9 sources' },
                { key: 'scoring',  label: 'Scoring threats' },
                { key: 'done',     label: 'Done' },
              ].map(({ key, label }) => {
                const steps: ScanStep[] = ['checking', 'fetching', 'scoring', 'done'];
                const idx    = steps.indexOf(key as ScanStep);
                const curIdx = steps.indexOf(step);
                const past   = curIdx > idx;
                const active = curIdx === idx;
                return (
                  <span key={key} className={active ? 'text-purple-400 animate-pulse' : past ? 'text-green-400' : 'text-gray-600'}>
                    {active ? '🔄' : past ? '✅' : '⏳'} {label}
                  </span>
                );
              })}
            </div>
          )}

          {step === 'error' && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-red-400 text-sm">❌ {errorMsg}</p>
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-white mt-1 transition-colors">← Try again</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4">

          {/* Risk score header */}
          <div className="rounded-xl p-5" style={{ background: rc!.bg, border: `2px solid ${rc!.border}` }}>
            <p className="text-sm text-gray-400 mb-1">
              🌐 Domain: <span className="text-white font-medium">{result.domain}</span>
              {result.finalUrl && result.finalUrl !== result.url && (
                <span className="ml-2 text-orange-400 text-xs">→ redirects to {new URL(result.finalUrl).hostname}</span>
              )}
              {result.ownCommunityReports !== undefined && result.ownCommunityReports > 0 && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                  {result.ownCommunityReports} community report{result.ownCommunityReports !== 1 ? 's' : ''}
                </span>
              )}
            </p>
            <h3 className="text-xl font-bold" style={{ color: rc!.color }}>
              🛡️ Risk Score: {result.riskScore}/10 — {result.riskLevel} RISK{' '}
              {result.riskLevel === 'CRITICAL' ? '🚨' : result.riskLevel === 'HIGH' ? '⚠️' : result.riskLevel === 'MEDIUM' ? '⚡' : '✅'}
            </h3>
            <div className="h-2 rounded-full overflow-hidden mt-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${result.riskScore * 10}%`, background: 'linear-gradient(90deg, #4ade80, #fbbf24, #fb923c, #f87171)' }} />
            </div>
          </div>

          {/* ── Google Safe Browsing verdict (prominent if flagged) ────────── */}
          {result.safeBrowsing?.flagged && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.5)' }}>
              <p className="text-base font-bold text-red-400">🔴 Flagged by Google Safe Browsing</p>
              <p className="text-sm text-gray-300 mt-1">
                Google's live database has classified this URL as:{' '}
                <span className="text-red-300 font-semibold">{result.safeBrowsing.threats.map(t => t.type.replace(/_/g, ' ').toLowerCase()).join(', ')}</span>
              </p>
              <p className="text-xs text-red-400 mt-1">❌ Do NOT enter any credentials or interact with this site.</p>
            </div>
          )}
          {result.safeBrowsing && !result.safeBrowsing.flagged && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <p className="text-sm text-green-400">✅ Google Safe Browsing: Not in phishing/malware database</p>
            </div>
          )}

          {/* ── urlscan.io verdict ────────────────────────────────────────── */}
          {result.urlScanInfo?.found && (
            <div
              className="rounded-xl p-4"
              style={{
                background: result.urlScanInfo.verdict === 'malicious' ? 'rgba(239,68,68,0.08)' : result.urlScanInfo.verdict === 'suspicious' ? 'rgba(251,146,60,0.08)' : 'rgba(74,222,128,0.05)',
                border:     `1px solid ${result.urlScanInfo.verdict === 'malicious' ? 'rgba(239,68,68,0.3)' : result.urlScanInfo.verdict === 'suspicious' ? 'rgba(251,146,60,0.3)' : 'rgba(74,222,128,0.2)'}`,
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: result.urlScanInfo.verdict === 'malicious' ? '#f87171' : result.urlScanInfo.verdict === 'suspicious' ? '#fb923c' : '#4ade80' }}>
                    {result.urlScanInfo.verdict === 'malicious' ? '🔴' : result.urlScanInfo.verdict === 'suspicious' ? '🟠' : '🟢'}{' '}
                    urlscan.io: {result.urlScanInfo.verdict.charAt(0).toUpperCase() + result.urlScanInfo.verdict.slice(1)}
                    {result.urlScanInfo.score !== null && <span className="ml-1 text-xs font-mono opacity-70">(score: {result.urlScanInfo.score})</span>}
                  </p>
                  {result.urlScanInfo.country && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Hosted in: {result.urlScanInfo.country}
                      {result.urlScanInfo.asnName && ` — ${result.urlScanInfo.asnName}`}
                    </p>
                  )}
                </div>
                {result.urlScanInfo.reportUrl && (
                  <a href={result.urlScanInfo.reportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline">
                    View full urlscan.io report →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Redirect chain ────────────────────────────────────────────── */}
          {result.redirectChain && result.redirectChain.length > 1 && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)' }}>
              <p className="text-sm font-semibold text-orange-400 mb-2">🔀 Redirect Chain ({result.redirectChain.length - 1} hop{result.redirectChain.length > 2 ? 's' : ''})</p>
              <div className="space-y-1">
                {result.redirectChain.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {i > 0 && <span className="text-gray-600">↓</span>}
                    <span className={i === result.redirectChain!.length - 1 ? 'text-orange-300 font-medium' : 'text-gray-400'} style={{ wordBreak: 'break-all' }}>
                      {i === 0 ? '🔗 Input: ' : i === result.redirectChain!.length - 1 ? '🎯 Final: ' : `   Hop ${i}: `}{u}
                    </span>
                  </div>
                ))}
              </div>
              {result.redirectChain[0] !== result.redirectChain[result.redirectChain.length - 1] && (
                <p className="text-xs text-orange-300 mt-2">⚠️ The input URL redirects to a different domain — verify the final destination is what you expected.</p>
              )}
            </div>
          )}

          {/* ── IP & Hosting Info ─────────────────────────────────────────── */}
          {result.ipInfo?.ip && (
            <div
              className="rounded-xl p-4"
              style={{
                background: result.ipInfo.isBulletproof ? 'rgba(239,68,68,0.07)' : 'rgba(59,130,246,0.05)',
                border:     `1px solid ${result.ipInfo.isBulletproof ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.15)'}`,
              }}
            >
              <p className="text-sm font-semibold mb-2" style={{ color: result.ipInfo.isBulletproof ? '#f87171' : '#60a5fa' }}>
                🖥️ IP & Hosting{result.ipInfo.isBulletproof ? ' — ⚠️ Bulletproof Provider Detected' : ''}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                {result.ipInfo.ip && <p className="text-gray-300"><span className="text-gray-500">IP:</span> <span className="font-mono">{result.ipInfo.ip}</span></p>}
                {result.ipInfo.country && <p className="text-gray-300"><span className="text-gray-500">Country:</span> {result.ipInfo.country} {result.ipInfo.countryCode && `(${result.ipInfo.countryCode})`}</p>}
                {result.ipInfo.city && <p className="text-gray-300"><span className="text-gray-500">City:</span> {result.ipInfo.city}</p>}
                {result.ipInfo.isp && <p className="text-gray-300 col-span-2"><span className="text-gray-500">ISP:</span> {result.ipInfo.isp}</p>}
                {result.ipInfo.asn && <p className="text-gray-300"><span className="text-gray-500">ASN:</span> <span className="font-mono">{result.ipInfo.asn}</span></p>}
                {result.ipInfo.isHosting && !result.ipInfo.isBulletproof && <p className="text-blue-400"><span className="text-gray-500">Type:</span> Data center / hosting</p>}
              </div>
              {result.ipInfo.isBulletproof && (
                <p className="text-xs text-red-300 mt-2">⚠️ This provider is known to host scam, malware, and phishing infrastructure with minimal abuse enforcement.</p>
              )}
            </div>
          )}

          {/* ── Domain Registration ───────────────────────────────────────── */}
          {result.domainInfo && Object.keys(result.domainInfo).length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{
                background: result.domainInfo.isNewDomain ? 'rgba(251,146,60,0.07)' : 'rgba(139,92,246,0.05)',
                border:     `1px solid ${result.domainInfo.isNewDomain ? 'rgba(251,146,60,0.2)' : 'rgba(139,92,246,0.15)'}`,
              }}
            >
              <p className="text-sm font-semibold mb-1.5" style={{ color: result.domainInfo.isNewDomain ? '#fb923c' : '#a78bfa' }}>
                {result.domainInfo.isNewDomain ? '🆕 Recently Registered Domain' : '📅 Domain Registration'}
              </p>
              <div className="text-xs space-y-0.5 text-gray-300">
                {result.domainInfo.domainAgeDays !== undefined && <p><span className="text-gray-500">Age:</span> <span style={{ color: result.domainInfo.isNewDomain ? '#fb923c' : '#4ade80' }}>{result.domainInfo.domainAgeDays} days old{result.domainInfo.isNewDomain ? ' (less than 6 months — high scam risk)' : ''}</span></p>}
                {result.domainInfo.registeredDate && <p><span className="text-gray-500">Registered:</span> {result.domainInfo.registeredDate}</p>}
                {result.domainInfo.registrar && <p><span className="text-gray-500">Registrar:</span> {result.domainInfo.registrar}</p>}
              </div>
            </div>
          )}

          {/* ── Detected Threats ─────────────────────────────────────────── */}
          {result.threats.filter(t => t.type !== 'fetch_error').length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <h4 className="text-base font-bold text-red-400 mb-3">
                🚨 Detected Threats ({result.threats.filter(t => t.type !== 'fetch_error').length})
              </h4>
              <div className="space-y-2">
                {result.threats.filter(t => t.type !== 'fetch_error').map((threat, idx) => {
                  const tc = getRiskColors(threat.severity);
                  return (
                    <div key={idx} className="p-3 rounded-lg" style={{ background: tc.bg, border: `1px solid ${tc.border}` }}>
                      <div className="flex items-start gap-2">
                        <span className="text-base">{getSeverityIcon(threat.severity)}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{threat.description}</p>
                          {threat.evidence && <p className="text-xs text-gray-400 mt-0.5" style={{ wordBreak: 'break-all' }}>{threat.evidence}</p>}
                          <p className="text-xs mt-1" style={{ color: tc.color }}>Severity: {threat.severity} · {threat.weight}pts</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Payment Method Analysis ───────────────────────────────────── */}
          {result.paymentAnalysis && result.paymentAnalysis.detectedMethods.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{
                background: ['DANGEROUS','RISKY'].includes(result.paymentAnalysis.riskAssessment) ? 'rgba(239,68,68,0.07)' : result.paymentAnalysis.riskAssessment === 'MIXED' ? 'rgba(251,191,36,0.07)' : 'rgba(74,222,128,0.05)',
                border: `1px solid ${['DANGEROUS','RISKY'].includes(result.paymentAnalysis.riskAssessment) ? 'rgba(239,68,68,0.2)' : result.paymentAnalysis.riskAssessment === 'MIXED' ? 'rgba(251,191,36,0.2)' : 'rgba(74,222,128,0.15)'}`,
              }}
            >
              <h4 className="text-base font-bold mb-3" style={{ color: result.paymentAnalysis.riskAssessment === 'DANGEROUS' ? '#f87171' : result.paymentAnalysis.riskAssessment === 'RISKY' ? '#fb923c' : result.paymentAnalysis.riskAssessment === 'MIXED' ? '#fbbf24' : '#4ade80' }}>
                💳 Payment Method Analysis — {result.paymentAnalysis.riskAssessment}
              </h4>
              <div className="space-y-2 text-xs">
                {result.paymentAnalysis.paymentProviders.length > 0 && (
                  <p className="text-gray-300">Processors: {result.paymentAnalysis.paymentProviders.map(p => <span key={p} className="ml-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{p}</span>)}</p>
                )}
                {result.paymentAnalysis.safeMethods.length > 0 && (
                  <p className="text-gray-300">✅ Safe: {result.paymentAnalysis.safeMethods.join(', ')}</p>
                )}
                {result.paymentAnalysis.riskyMethods.length > 0 && (
                  <p className="text-red-300">⚠️ Risky (no protection): {result.paymentAnalysis.riskyMethods.join(', ')}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Contextual warnings ───────────────────────────────────────── */}
          {isCasino && result.riskLevel !== 'LOW' && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-sm font-semibold text-red-300">🎰 Crypto Casino Safety Warning</p>
              <p className="text-xs text-gray-400 mt-1">Unlicensed crypto casinos often refuse withdrawals. Wagering requirements (30–100× deposit) trap funds. NEVER deposit more than you can afford to lose entirely. Verify licensing: Curacao, Malta Gaming Authority, UKGC.</p>
            </div>
          )}
          {isTicket && !isCasino && result.riskLevel !== 'LOW' && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)' }}>
              <p className="text-sm font-semibold text-yellow-300">⚽ World Cup 2026 Ticket Safety</p>
              <p className="text-xs text-gray-400 mt-1">FIFA.com/tickets is the ONLY official source. Authorized resale: StubHub, Ticketmaster, ViaGogo, SeatGeek. NEVER pay via wire transfer, crypto, or gift cards.</p>
            </div>
          )}

          {/* ── Recommendations ───────────────────────────────────────────── */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <h4 className="text-base font-bold text-green-400 mb-3">✅ Recommendations</h4>
            <ul className="space-y-1.5">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-gray-600 mt-0.5">•</span><span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Report + Reset row ────────────────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white transition-colors">
              ← Scan another URL
            </button>
            <div className="flex items-center gap-2">
              {reportDone && <span className="text-xs text-green-400 font-semibold">✓ Report submitted</span>}
              {!reportDone && (
                <button
                  onClick={() => setShowReport(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105"
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}
                >
                  🚩 Report this URL
                </button>
              )}
            </div>
          </div>

          {/* ── Disclaimer ────────────────────────────────────────────────── */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs text-gray-500">
              📋 Educational purposes only. Not a guarantee of safety. Always verify URLs before entering credentials.
              {isCasino && ' Unlicensed casinos may refuse withdrawals.'}
              {isTicket && !isCasino && ' For World Cup 2026 tickets, buy ONLY from FIFA.com/tickets.'}
              {' '}Scan date: {result.scanDate}
            </p>
          </div>
        </div>
      )}

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
              <h3 className="text-base font-bold text-white">🚩 Report {result.domain}</h3>
              <button onClick={() => setShowReport(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-gray-400">Help protect other users. Reports are public and anonymous.</p>

            {/* Report type */}
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
                    <span>{emoji}</span><span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                Notes <span className="normal-case font-normal">(optional · max 500 chars)</span>
              </label>
              <textarea
                value={reportNotes}
                onChange={e => setReportNotes(e.target.value)}
                placeholder="e.g. Fake FIFA ticket store, asks for wire transfer…"
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/40"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <p className="text-xs text-gray-600 text-right mt-0.5">{reportNotes.length}/500</p>
            </div>

            {reportError && <p className="text-xs text-red-400">❌ {reportError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowReport(false)} className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
              <button onClick={handleReport} disabled={reportSending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
                {reportSending ? '⏳ Submitting…' : '🚩 Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
