/**
 * WebsiteSecurityScanner Component
 * 
 * Scans websites for:
 * - Wallet drainer scripts
 * - Fake airdrops
 * - Seed phrase harvesting
 * - Private key theft
 * - Phishing attempts
 * - Fake event ticket scams (World Cup 2026)
 */

import { useState } from 'react';

interface ThreatDetection {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?: string;
  weight: number;
}

interface WebsiteScanResult {
  success: boolean;
  url: string;
  domain: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threats: ThreatDetection[];
  recommendations: string[];
  reputation?: { source: string; verdict: string; details?: string }[];
  scanDate: string;
  scanCategory?: 'general' | 'ticket' | 'crypto_casino';
}

type ScanMode = 'general' | 'ticket' | 'crypto_casino';

export default function WebsiteSecurityScanner() {
  const [url, setUrl] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('general');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<WebsiteScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getPlaceholder = () => {
    if (scanMode === 'ticket') {
      return 'https://fifa2026tickets.com or any ticket site';
    }
    if (scanMode === 'crypto_casino') {
      return 'https://fake-crypto-casino.com or any casino site';
    }
    return 'https://suspicious-site.com';
  };

  const handleScan = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/website-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        throw new Error('Scan failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to scan website');
    } finally {
      setScanning(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#f87171' };
      case 'HIGH': return { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)', text: '#fb923c' };
      case 'MEDIUM': return { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24' };
      default: return { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', text: '#4ade80' };
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '⚡';
      default: return 'ℹ️';
    }
  };

  const isTicketRelated = result?.scanCategory === 'ticket' || 
    result?.threats.some(t => ['fake_event_ticket', 'fifa_impersonation', 'ticket_urgency', 'ticket_scam_method', 'no_seller_info', 'recent_domain_ticket'].includes(t.type));
  const isCasinoRelated = result?.scanCategory === 'crypto_casino' ||
    result?.threats.some(t => ['fake_casino', 'casino_lure', 'casino_withhold'].includes(t.type));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-xl p-6"
        style={{
          background: scanMode === 'ticket' 
            ? 'rgba(234,179,8,0.05)' 
            : scanMode === 'crypto_casino'
            ? 'rgba(239,68,68,0.05)'
            : 'rgba(139,92,246,0.05)',
          border: scanMode === 'ticket'
            ? '1px solid rgba(234,179,8,0.3)'
            : scanMode === 'crypto_casino'
            ? '1px solid rgba(239,68,68,0.3)'
            : '1px solid rgba(139,92,246,0.15)',
        }}
      >
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
                : 'Detect wallet drainers, fake airdrops & phishing sites'}
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setScanMode('general')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'general'
                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
            }`}
          >
            🌐 General Scan
          </button>
          <button
            onClick={() => setScanMode('crypto_casino')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'crypto_casino'
                ? 'bg-red-500/30 text-red-300 border border-red-500/40'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
            }`}
          >
            🎰 Casino Scan
          </button>
          <button
            onClick={() => setScanMode('ticket')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'ticket'
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
            }`}
          >
            🎫 Ticket Scan
          </button>
        </div>

        {/* Casino Warning */}
        {scanMode === 'crypto_casino' && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <p className="text-sm text-red-300 font-semibold">🎰 Crypto Casino Warning</p>
            <p className="text-xs text-gray-400 mt-1">
              Many crypto casinos are unlicensed, rigged, or refuse withdrawals. 
              Verify licensing (Curacao, Malta, UK) before depositing. 
              Never deposit more than you can afford to lose.
            </p>
          </div>
        )}

        {/* World Cup 2026 Notice */}
        {scanMode === 'ticket' && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.2)',
            }}
          >
            <p className="text-sm text-yellow-300 font-semibold">⚽ World Cup 2026 Ticket Scams</p>
            <p className="text-xs text-gray-400 mt-1">
              FIFA is the ONLY authorized seller of World Cup 2026 tickets. 
              Buy only at <span className="text-yellow-300">FIFA.com/tickets</span>. 
              Authorized resale: StubHub, Ticketmaster, ViaGogo, SeatGeek.
            </p>
          </div>
        )}

        {/* URL Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              {scanMode === 'ticket' ? '🎫 Ticket Website URL' : scanMode === 'crypto_casino' ? '🎰 Casino Website URL' : '🌐 Website URL'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !scanning && handleScan()}
                placeholder={getPlaceholder()}
                disabled={scanning}
                className="flex-1 px-4 py-3 rounded-lg bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={scanning || !url.trim()}
            className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: scanMode === 'ticket'
                ? 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)'
                : scanMode === 'crypto_casino'
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              boxShadow: scanMode === 'ticket'
                ? '0 4px 15px rgba(234,179,8,0.3)'
                : scanMode === 'crypto_casino'
                ? '0 4px 15px rgba(239,68,68,0.3)'
                : '0 4px 15px rgba(139,92,246,0.3)',
            }}
          >
            {scanning ? '🔍 Scanning...' : scanMode === 'ticket' ? '🎫 Scan for Ticket Scams' : scanMode === 'crypto_casino' ? '🎰 Scan Casino' : '🔒 Scan Website'}
          </button>
        </div>

        {error && (
          <div
            className="mt-4 p-4 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <p className="text-red-400 text-sm font-medium">⚠️ {error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Risk Score Header */}
          <div
            className="rounded-xl p-5"
            style={{
              background: getRiskColor(result.riskLevel).bg,
              border: `2px solid ${getRiskColor(result.riskLevel).border}`,
            }}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                {isCasinoRelated ? '🎰' : isTicketRelated ? '🎫' : '🌐'} Domain: {result.domain}
                {isCasinoRelated && (
                  <span className="ml-2 text-red-300 font-semibold">— CRYPTO CASINO SCAN</span>
                )}
                {isTicketRelated && !isCasinoRelated && (
                  <span className="ml-2 text-yellow-300 font-semibold">— EVENT TICKET SCAN</span>
                )}
              </p>
              <h3 className="text-xl font-bold" style={{ color: getRiskColor(result.riskLevel).text }}>
                🛡️ Risk Score: {result.riskScore}/10 — {result.riskLevel} RISK{' '}
                {result.riskLevel === 'CRITICAL' ? '🚨' : result.riskLevel === 'HIGH' ? '⚠️' : result.riskLevel === 'MEDIUM' ? '⚡' : '✅'}
              </h3>
              
              {/* Risk Meter */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${result.riskScore * 10}%`,
                    background: `linear-gradient(90deg, #4ade80, #fbbf24, #fb923c, #f87171)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Casino Warning for casino scams */}
          {isCasinoRelated && result.riskLevel !== 'LOW' && (
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
            >
              <p className="text-sm font-semibold text-red-300">🎰 Crypto Casino — Safety Warning</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-300">
                <li>• Unlicensed crypto casinos often refuse withdrawals</li>
                <li>• "Wagering requirements" trap deposits — you must bet 30-100x before withdrawing</li>
                <li>• NEVER deposit more than you can afford to lose entirely</li>
                <li>• Verify licensing: Curacao, Malta Gaming Authority, UK Gambling Commission</li>
                <li>• Check reputation: askgamblers.com, casinomeister.com</li>
              </ul>
            </div>
          )}

          {/* FIFA Warning for ticket scams */}
          {isTicketRelated && !isCasinoRelated && result.riskLevel !== 'LOW' && (
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(234,179,8,0.08)',
                border: '1px solid rgba(234,179,8,0.25)',
              }}
            >
              <p className="text-sm font-semibold text-yellow-300">⚽ World Cup 2026 — Ticket Safety</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-300">
                <li>• FIFA.com/tickets is the ONLY official source</li>
                <li>• Authorized resale: StubHub, Ticketmaster, ViaGogo, SeatGeek</li>
                <li>• NEVER pay via wire transfer, crypto, or gift cards</li>
                <li>• Check domain age at who.is — recent domains are suspicious</li>
                <li>• Report FIFA ticket fraud: fifa.com/about-fifa/organisation/integrity</li>
              </ul>
            </div>
          )}

          {/* Threats */}
          {result.threats.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <h4 className="text-lg font-bold text-red-400 mb-3">
                🚨 Detected Threats ({result.threats.length})
              </h4>
              <div className="space-y-2">
                {result.threats.map((threat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg"
                    style={{
                      background: getRiskColor(threat.severity).bg,
                      border: `1px solid ${getRiskColor(threat.severity).border}`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span>{getSeverityIcon(threat.severity)}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{threat.description}</p>
                        {threat.evidence && (
                          <p className="text-xs text-gray-400 mt-1">{threat.evidence}</p>
                        )}
                        <p className="text-xs mt-1" style={{ color: getRiskColor(threat.severity).text }}>
                          Severity: {threat.severity} ({threat.weight} pts)
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Domain Age */}
          {(result as any).domainInfo && (
            <div
              className="rounded-xl p-5"
              style={{
                background: (result as any).domainInfo.isNewDomain ? 'rgba(251,146,60,0.08)' : 'rgba(139,92,246,0.05)',
                border: (result as any).domainInfo.isNewDomain ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(139,92,246,0.15)',
              }}
            >
              <h4 className="text-lg font-bold mb-3" style={{ color: (result as any).domainInfo.isNewDomain ? '#fb923c' : '#a78bfa' }}>
                {(result as any).domainInfo.isNewDomain ? '🆕' : '📅'} Domain Registration
              </h4>
              <div className="space-y-2">
                {(result as any).domainInfo.domainAgeDays !== undefined && (
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">Age:</span>{' '}
                    <span style={{ color: (result as any).domainInfo.isNewDomain ? '#fb923c' : '#4ade80' }}>
                      {(result as any).domainInfo.domainAgeDays} days old
                      {(result as any).domainInfo.isNewDomain && ' (LESS THAN 6 MONTHS!)'}
                    </span>
                  </p>
                )}
                {(result as any).domainInfo.registeredDate && (
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">Registered:</span> {(result as any).domainInfo.registeredDate}
                  </p>
                )}
                {(result as any).domainInfo.registrar && (
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">Registrar:</span> {(result as any).domainInfo.registrar}
                  </p>
                )}
                {(result as any).domainInfo.isNewDomain && (
                  <p className="text-xs text-orange-300 mt-2">
                    ⚠️ Newly registered domains are a common scam indicator. Legitimate businesses typically use domains registered years ago.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Payment Analysis */}
          {(result as any).paymentAnalysis && (
            <div
              className="rounded-xl p-5"
              style={{
                background: (result as any).paymentAnalysis.riskAssessment === 'DANGEROUS' || (result as any).paymentAnalysis.riskAssessment === 'RISKY'
                  ? 'rgba(239,68,68,0.08)'
                  : (result as any).paymentAnalysis.riskAssessment === 'MIXED'
                    ? 'rgba(251,191,36,0.08)'
                    : 'rgba(74,222,128,0.05)',
                border: (result as any).paymentAnalysis.riskAssessment === 'DANGEROUS' || (result as any).paymentAnalysis.riskAssessment === 'RISKY'
                  ? '1px solid rgba(239,68,68,0.2)'
                  : (result as any).paymentAnalysis.riskAssessment === 'MIXED'
                    ? '1px solid rgba(251,191,36,0.2)'
                    : '1px solid rgba(74,222,128,0.15)',
              }}
            >
              <h4 className="text-lg font-bold mb-3" style={{
                color: (result as any).paymentAnalysis.riskAssessment === 'DANGEROUS' ? '#f87171'
                  : (result as any).paymentAnalysis.riskAssessment === 'RISKY' ? '#fb923c'
                  : (result as any).paymentAnalysis.riskAssessment === 'MIXED' ? '#fbbf24'
                  : '#4ade80'
              }}>
                💳 Payment Method Analysis
              </h4>
              <div className="space-y-3">
                {/* Risk assessment badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{
                    color: (result as any).paymentAnalysis.riskAssessment === 'DANGEROUS' ? '#f87171'
                      : (result as any).paymentAnalysis.riskAssessment === 'RISKY' ? '#fb923c'
                      : (result as any).paymentAnalysis.riskAssessment === 'MIXED' ? '#fbbf24'
                      : '#4ade80'
                  }}>
                    {(result as any).paymentAnalysis.riskAssessment === 'DANGEROUS' ? '💀' :
                     (result as any).paymentAnalysis.riskAssessment === 'RISKY' ? '🚨' :
                     (result as any).paymentAnalysis.riskAssessment === 'MIXED' ? '⚠️' : '✅'}
                    {' '}{(result as any).paymentAnalysis.riskAssessment}
                  </span>
                  <span className="text-xs text-gray-400">
                    Buyer protection: {(result as any).paymentAnalysis.hasBuyerProtection ? '✅ Yes' : '❌ No'}
                  </span>
                </div>

                {/* Payment providers */}
                {(result as any).paymentAnalysis.paymentProviders.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Payment Processors:</p>
                    <div className="flex flex-wrap gap-1">
                      {(result as any).paymentAnalysis.paymentProviders.map((provider: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                          {provider}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safe methods */}
                {(result as any).paymentAnalysis.safeMethods.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">✅ Safe Methods:</p>
                    <div className="flex flex-wrap gap-1">
                      {(result as any).paymentAnalysis.safeMethods.map((method: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risky methods */}
                {(result as any).paymentAnalysis.riskyMethods.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">🚨 Risky Methods:</p>
                    <div className="flex flex-wrap gap-1">
                      {(result as any).paymentAnalysis.riskyMethods.map((method: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                          {method}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-red-300 mt-2">
                      ⚠️ These payment methods offer no buyer protection. Once sent, your money cannot be recovered.
                    </p>
                  </div>
                )}

                {/* All methods detected */}
                {(result as any).paymentAnalysis.detectedMethods.length === 0 && (result as any).paymentAnalysis.paymentProviders.length === 0 && (
                  <p className="text-sm text-gray-400">
                    ℹ️ No specific payment methods detected in page content. This could mean they're hidden behind a checkout flow.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.15)',
            }}
          >
            <h4 className="text-lg font-bold text-green-400 mb-3">
              ✅ Recommendations
            </h4>
            <ul className="space-y-2">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-gray-500">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Disclaimer */}
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <p className="text-xs text-gray-400 leading-relaxed">
              📋 <span className="text-yellow-400 font-semibold">Disclaimer:</span> Educational purposes only. Not a guarantee of safety. Always verify URLs and never share seed phrases or private keys.
              {isCasinoRelated && ' Unlicensed casinos may refuse withdrawals. Never deposit more than you can afford to lose.'}
              {isTicketRelated && !isCasinoRelated && ' For World Cup 2026 tickets, buy ONLY from FIFA.com/tickets.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}