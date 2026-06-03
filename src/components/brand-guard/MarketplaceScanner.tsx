/**
 * MarketplaceScanner.tsx — Marketplace impersonation scanner with visual fingerprinting
 * Scans Shopify/Etsy for brand impersonators and matches against visual fingerprints
 */

import { useState, useEffect, useCallback } from 'react';

interface MarketplaceScannerProps {
  brandId: string;
  brandName: string;
  brandDomain: string | null;
  authToken: string | null;
  dark: {
    bg: string; cardBg: string; border: string; accent: string;
    accentLight: string; green: string; red: string; yellow: string;
    text: string; textMuted: string;
  };
  isMobile: boolean;
  apiBase: string;
}

interface MarketplaceResult {
  id: string;
  brand_id: string;
  platform: string;
  store_url: string;
  store_name: string | null;
  risk_score: number;
  risk_level: string;
  match_types: string[];
  visual_matches?: VisualMatch[];
  created_at: string;
}

interface VisualMatch {
  reference_url: string;
  candidate_url: string;
  hamming_distance: number;
  similarity_pct: number;
}

export function MarketplaceScanner({ brandId, brandName, brandDomain, authToken, dark, isMobile, apiBase }: MarketplaceScannerProps) {
  const [results, setResults] = useState<MarketplaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanJobId, setScanJobId] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(['shopify']);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${apiBase}/marketplace/results/${brandId}`, { headers });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally { setLoading(false); }
  }, [brandId, authToken, apiBase]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  // Poll for results after starting a scan
  useEffect(() => {
    if (!scanJobId || !scanning) return;
    const interval = setInterval(async () => {
      await fetchResults();
      // Check if results appeared (scan completed)
      setScanning(prev => {
        if (!prev) clearInterval(interval);
        return prev;
      });
    }, 5000);
    // Stop polling after 90 seconds
    const timeout = setTimeout(() => {
      setScanning(false);
      setScanJobId(null);
      clearInterval(interval);
      setMessage({ type: 'info', text: 'Scan completed (or timed out). Check results below.' });
    }, 90000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [scanJobId, scanning, fetchResults]);

  const handleScan = async () => {
    if (!brandId || !brandName) return;
    setScanning(true);
    setMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${apiBase}/marketplace/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brandId,
          brandName,
          brandWebsite: brandDomain || '',
          platforms,
        }),
      });
      const data = await res.json();
      if (data.jobId) {
        setScanJobId(data.jobId);
        setMessage({ type: 'info', text: `🔍 Scan started (Job: ${data.jobId}). Results will appear below...` });
      } else if (data.error) {
        setMessage({ type: 'error', text: data.error });
        setScanning(false);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Scan failed' });
      setScanning(false);
    }
  };

  const riskColor = (level: string) => {
    const l = level.toUpperCase();
    if (l === 'CRITICAL') return dark.red;
    if (l === 'HIGH') return '#f59e0b';
    if (l === 'MEDIUM') return dark.yellow;
    return dark.green;
  };

  const riskBg = (level: string) => {
    const l = level.toUpperCase();
    if (l === 'CRITICAL' || l === 'HIGH') return 'rgba(239,68,68,0.1)';
    if (l === 'MEDIUM') return 'rgba(234,179,8,0.1)';
    return 'rgba(34,197,94,0.1)';
  };

  const platformIcon = (p: string) => p === 'shopify' ? '🛒' : p === 'etsy' ? '🎨' : '🏪';

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Message */}
      {message && (
        <div style={{
          padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px',
          background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}`,
          color: message.type === 'success' ? dark.green : message.type === 'error' ? dark.red : dark.accent,
        }}>
          {message.text}
        </div>
      )}

      {/* Platform selector + scan button */}
      <div style={{
        padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)',
        border: `1px solid ${dark.border}`, marginBottom: '12px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>🛍️ Scan Marketplaces</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {['shopify', 'etsy'].map(p => (
            <button
              key={p}
              onClick={() => setPlatforms(prev =>
                prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
              )}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                border: `1px solid ${platforms.includes(p) ? 'rgba(139,92,246,0.4)' : dark.border}`,
                background: platforms.includes(p) ? 'rgba(139,92,246,0.2)' : 'rgba(0,0,0,0.2)',
                color: platforms.includes(p) ? '#fff' : dark.textMuted, cursor: 'pointer',
              }}
            >
              {platformIcon(p)} {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={handleScan}
          disabled={scanning || platforms.length === 0}
          style={{
            width: '100%', padding: '10px', borderRadius: '10px',
            border: `1px solid rgba(139,92,246,0.4)`, background: 'rgba(139,92,246,0.15)',
            color: '#fff', fontSize: '13px', fontWeight: 600,
            cursor: scanning ? 'wait' : platforms.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {scanning ? '🔄 Scanning marketplaces...' : `🔍 Scan ${platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' + ')} for "${brandName}" impersonators`}
        </button>
      </div>

      {/* Results */}
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
        📋 Scan Results {results.length > 0 && `(${results.length})`}
      </div>
      {loading && results.length === 0 ? (
        <div style={{ color: dark.textMuted, fontSize: '12px', textAlign: 'center', padding: '12px' }}>Loading results...</div>
      ) : results.length === 0 ? (
        <div style={{ color: dark.textMuted, fontSize: '12px', textAlign: 'center', padding: '16px',
          background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: `1px solid ${dark.border}`,
        }}>
          No marketplace impersonators found yet. Run a scan above to check for brand violations on Shopify and Etsy.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {results.map((r) => (
            <div key={r.id} style={{
              padding: '10px 12px', borderRadius: '10px',
              background: riskBg(r.risk_level),
              border: `1px solid ${riskColor(r.risk_level)}33`,
            }}>
              <div
                onClick={() => setExpandedResult(prev => prev === r.id ? null : r.id)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{platformIcon(r.platform)}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                      {r.store_name || 'Unknown Store'}
                    </div>
                    <div style={{ fontSize: '11px', color: dark.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '180px' : '300px' }}>
                      {r.store_url}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    fontSize: '12px', fontWeight: 700, color: riskColor(r.risk_level),
                    padding: '2px 8px', borderRadius: '6px', background: `${riskColor(r.risk_level)}22`,
                  }}>
                    {r.risk_level.toUpperCase()} {r.risk_score}/10
                  </div>
                  <span style={{ color: dark.textMuted, fontSize: '12px' }}>
                    {expandedResult === r.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {expandedResult === r.id && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${dark.border}` }}>
                  {/* Match types */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: dark.textMuted, marginBottom: '4px' }}>MATCH TYPES</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {r.match_types.map((m, i) => (
                        <span key={i} style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                          background: 'rgba(0,0,0,0.3)', color: riskColor(r.risk_level), fontWeight: 600,
                        }}>
                          {String(m).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Visual matches */}
                  {r.visual_matches && r.visual_matches.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: dark.textMuted, marginBottom: '4px' }}>
                        👁️ VISUAL MATCHES
                      </div>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        {r.visual_matches.map((vm, i) => (
                          <div key={i} style={{
                            padding: '6px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.06)', fontSize: '11px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#fff' }}>{vm.similarity_pct}% match</span>
                              <span style={{ color: dark.textMuted }}>distance: {vm.hamming_distance}</span>
                            </div>
                            <div style={{ color: dark.textMuted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Candidate: {vm.candidate_url}
                            </div>
                            <div style={{ color: dark.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Reference: {vm.reference_url}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Store link */}
                  <a href={r.store_url} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-block', marginTop: '8px', fontSize: '12px', color: dark.accent,
                    textDecoration: 'none', fontWeight: 600,
                  }}>
                    Visit Store ↗
                  </a>

                  {/* Takedown button hint */}
                  {['HIGH', 'CRITICAL'].includes(r.risk_level.toUpperCase()) && (
                    <div style={{
                      marginTop: '8px', padding: '6px 8px', borderRadius: '6px',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      fontSize: '11px', color: dark.red,
                    }}>
                      ⚠️ High-risk match detected — consider generating a takedown report
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}