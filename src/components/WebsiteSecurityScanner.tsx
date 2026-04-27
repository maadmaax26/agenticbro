/**
 * WebsiteSecurityScanner Component
 * 
 * Scans websites for:
 * - Wallet drainer scripts
 * - Fake airdrops
 * - Seed phrase harvesting
 * - Private key theft
 * - Phishing attempts
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
  scanDate: string;
}

export default function WebsiteSecurityScanner() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<WebsiteScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'rgba(139,92,246,0.05)',
          border: '1px solid rgba(139,92,246,0.15)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🌐</span>
          <div>
            <h2 className="text-xl font-bold text-white">Website Security Scanner</h2>
            <p className="text-sm text-gray-400">Detect wallet drainers, fake airdrops & phishing sites</p>
          </div>
        </div>

        {/* URL Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Website URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !scanning && handleScan()}
                placeholder="https://suspicious-site.com"
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
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
            }}
          >
            {scanning ? '🔍 Scanning...' : '🔒 Scan Website'}
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
                🌐 Domain: {result.domain}
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
            </p>
          </div>
        </div>
      )}
    </div>
  );
}