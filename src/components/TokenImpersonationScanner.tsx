/**
 * Token Impersonation Scanner Component
 *
 * Allows users to scan for tokens impersonating a legitimate token by contract address
 */

import { useState } from 'react';

// Direct to local backend
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  price: string;
  volume: number;
  liquidity: number;
  chain: string;
  dex: string;
  url: string;
  websites: { url: string; label: string }[];
  socials: { type: string; url: string }[];
}

interface ImpersonatorToken {
  symbol: string;
  name: string;
  address: string;
  price: string;
  liquidity: number;
  volume: number;
  chain: string;
  dex: string;
  url: string;
  risk_score: number;
  risk_factors: string[];
}

interface ScanResults {
  high_risk: ImpersonatorToken[];
  medium_risk: ImpersonatorToken[];
  low_risk: ImpersonatorToken[];
  unrelated: ImpersonatorToken[];
}

interface ScanSummary {
  totalAnalyzed: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  unrelated: number;
  suspicious: number;
}

interface ScanResult {
  success: boolean;
  legitimateToken: TokenInfo;
  impersonators: ScanResults;
  summary: ScanSummary;
  alert: string;
  scanDate: string;
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TokenImpersonationScanner() {
  const [contractAddress, setContractAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!contractAddress.trim()) {
      setError('Please enter a contract address');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/token-impersonation-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contractAddress: contractAddress.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scan failed');
      }

      if (data.success) {
        setResult(data);
      } else {
        throw new Error(data.error || 'Scan failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform scan');
    } finally {
      setScanning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !scanning) {
      handleScan();
    }
  };

  const copyAlert = () => {
    if (result?.alert) {
      navigator.clipboard.writeText(result.alert);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Input Section ── */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'rgba(139,92,246,0.05)',
          border: '1px solid rgba(139,92,246,0.15)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔍</span>
          <div>
            <h2 className="text-xl font-bold text-white">Token Impersonation Scanner</h2>
            <p className="text-sm text-gray-400">Scan for tokens impersonating a legitimate token</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Contract Address
            </label>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
              disabled={scanning}
              className="w-full px-4 py-3 rounded-lg bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <button
            onClick={handleScan}
            disabled={scanning || !contractAddress.trim()}
            className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
              boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
            }}
          >
            {scanning ? '🔄 Scanning...' : '🚀 Start Scan'}
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

      {/* ── Results Section ── */}
      {result && (
        <div className="space-y-4">
          {/* Legitimate Token Info */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.15)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-lg font-bold text-green-400">
                  Legitimate Token Verified
                </h3>
                <p className="text-sm text-gray-400">
                  {result.legitimateToken.symbol} ({result.legitimateToken.name})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Contract
                </p>
                <p
                  className="text-sm font-mono text-gray-300 truncate"
                  title={result.legitimateToken.address}
                >
                  {result.legitimateToken.address.slice(0, 8)}...
                  {result.legitimateToken.address.slice(-6)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Price
                </p>
                <p className="text-sm font-semibold text-white">
                  ${result.legitimateToken.price}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  24h Volume
                </p>
                <p className="text-sm font-semibold text-white">
                  ${result.legitimateToken.volume.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Chain
                </p>
                <p className="text-sm font-semibold text-white">
                  {result.legitimateToken.chain}
                </p>
              </div>
            </div>
          </div>

          {/* Scan Summary */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.15)',
            }}
          >
            <h3 className="text-lg font-bold text-blue-400 mb-4">📊 Scan Summary</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{result.summary.totalAnalyzed}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Analyzed
                </p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-white">{result.summary.suspicious}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Suspicious
                </p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{result.summary.highRisk}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  High Risk
                </p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{result.summary.mediumRisk}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Medium Risk
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyAlert}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  boxShadow: '0 4px 15px rgba(59,130,246,0.3)',
                }}
              >
                📋 Copy Alert
              </button>

              {result.legitimateToken.url && (
                <a
                  href={result.legitimateToken.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-center text-white transition-all hover:scale-[1.02]"
                  style={{
                    background: 'rgba(139,92,246,0.2)',
                    border: '1px solid rgba(139,92,246,0.3)',
                  }}
                >
                  🔗 View on DexScreener
                </a>
              )}
            </div>
          </div>

          {/* High Risk Tokens */}
          {result.impersonators.high_risk.length > 0 && (
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <h3 className="text-lg font-bold text-red-400 mb-4">
                🚨 High Risk Impersonators ({result.impersonators.high_risk.length})
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {result.impersonators.high_risk.map((token, index) => (
                  <div
                    key={index}
                    className="bg-black/30 rounded-lg p-4 border border-red-500/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-white">
                          {token.symbol} ({token.name})
                        </p>
                        <p
                          className="text-xs font-mono text-gray-400"
                          title={token.address}
                        >
                          {token.address.slice(0, 12)}...{token.address.slice(-6)}
                        </p>
                      </div>
                      <div
                        className="px-3 py-1 rounded-lg text-sm font-bold"
                        style={{
                          background: 'rgba(239,68,68,0.2)',
                          border: '1px solid rgba(239,68,68,0.4)',
                          color: '#f87171',
                        }}
                      >
                        {token.risk_score}/10
                      </div>
                    </div>

                    <div className="space-y-1">
                      {token.risk_factors.slice(0, 3).map((factor, idx) => (
                        <p key={idx} className="text-xs text-gray-300">
                          ⚠️ {factor}
                        </p>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{token.chain} • {token.dex}</span>
                      <span>Liq: ${token.liquidity.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medium Risk Tokens */}
          {result.impersonators.medium_risk.length > 0 && (
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(234,179,8,0.05)',
                border: '1px solid rgba(234,179,8,0.15)',
              }}
            >
              <h3 className="text-lg font-bold text-yellow-400 mb-4">
                ⚠️ Medium Risk ({result.impersonators.medium_risk.length})
              </h3>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.impersonators.medium_risk.slice(0, 10).map((token, index) => (
                  <div
                    key={index}
                    className="bg-black/30 rounded-lg p-3 border border-yellow-500/20"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-semibold text-white">
                          {token.symbol} ({token.name})
                        </p>
                        <p
                          className="text-xs font-mono text-gray-400"
                          title={token.address}
                        >
                          {token.address.slice(0, 10)}...{token.address.slice(-4)}
                        </p>
                      </div>
                      <div
                        className="px-2 py-1 rounded-lg text-xs font-bold"
                        style={{
                          background: 'rgba(234,179,8,0.2)',
                          border: '1px solid rgba(234,179,8,0.4)',
                          color: '#fbbf24',
                        }}
                      >
                        {token.risk_score}/10
                      </div>
                    </div>

                    <p className="text-xs text-gray-300">
                      {token.risk_factors[0] || 'Suspicious pattern detected'}
                    </p>
                  </div>
                ))}
              </div>

              {result.impersonators.medium_risk.length > 10 && (
                <p className="text-xs text-gray-500 mt-2">
                  +{result.impersonators.medium_risk.length - 10} more medium-risk tokens...
                </p>
              )}
            </div>
          )}

          {/* Generated Alert */}
          {result.alert && (
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(139,92,246,0.05)',
                border: '1px solid rgba(139,92,246,0.15)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-purple-400">
                  📢 Generated Alert
                </h3>
                <button
                  onClick={copyAlert}
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{
                    background: 'rgba(139,92,246,0.2)',
                    border: '1px solid rgba(139,92,246,0.3)',
                  }}
                >
                  📋 Copy
                </button>
              </div>

              <div className="bg-black/30 rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                  {result.alert}
                </pre>
              </div>
            </div>
          )}

          {/* No Threats Found */}
          {result.summary.suspicious === 0 && (
            <div
              className="rounded-xl p-6 text-center"
              style={{
                background: 'rgba(34,197,94,0.05)',
                border: '1px solid rgba(34,197,94,0.15)',
              }}
            >
              <span className="text-4xl mb-2 block">✅</span>
              <h3 className="text-lg font-bold text-green-400 mb-2">
                No Impersonators Found
              </h3>
              <p className="text-sm text-gray-400">
                No tokens attempting to impersonate this contract address were detected.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}