/**
 * FingerprintManager.tsx — Brand visual fingerprint management
 * Register, auto-discover, and list visual fingerprints for brand image protection
 */

import { useState, useEffect, useCallback } from 'react';

interface FingerprintManagerProps {
  brandId: string;
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

interface Fingerprint {
  id: string;
  brand_id: string;
  image_url: string;
  image_type: string;
  phash: string;
  created_at: string;
}

export function FingerprintManager({ brandId, brandDomain, authToken, dark, isMobile, apiBase }: FingerprintManagerProps) {
  const [fingerprints, setFingerprints] = useState<Fingerprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageType, setImageType] = useState('logo');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFingerprints = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${apiBase}/fingerprint/${brandId}`, { headers });
      const data = await res.json();
      setFingerprints(Array.isArray(data) ? data : []);
    } catch {
      setFingerprints([]);
    } finally { setLoading(false); }
  }, [brandId, authToken, apiBase]);

  useEffect(() => { fetchFingerprints(); }, [fetchFingerprints]);

  const handleRegister = async () => {
    if (!imageUrl.trim()) return;
    setRegistering(true);
    setMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${apiBase}/fingerprint/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brandId,
          images: [{ url: imageUrl.trim(), type: imageType }],
        }),
      });
      const data = await res.json();
      if (data.registered > 0) {
        setMessage({ type: 'success', text: `✅ Registered ${data.registered} fingerprint(s)` });
        setImageUrl('');
        fetchFingerprints();
      } else {
        setMessage({ type: 'error', text: 'Failed to generate fingerprint — image may be inaccessible or too small' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Registration failed' });
    } finally { setRegistering(false); }
  };

  const handleAutoDiscover = async () => {
    if (!brandDomain) {
      setMessage({ type: 'error', text: 'Brand domain is required for auto-discover' });
      return;
    }
    setDiscovering(true);
    setMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const websiteUrl = brandDomain.startsWith('http') ? brandDomain : `https://${brandDomain}`;
      const res = await fetch(`${apiBase}/fingerprint/auto-discover`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ brandId, websiteUrl }),
      });
      const data = await res.json();
      setMessage({ type: 'success', text: `🔍 Found ${data.discovered} images, registered ${data.registered} fingerprints` });
      fetchFingerprints();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Auto-discover failed' });
    } finally { setDiscovering(false); }
  };

  const typeIcon = (t: string) => t === 'logo' ? '🏷️' : t === 'product' ? '📦' : '🖼️';
  const hashDisplay = (h: string) => h === '0000000000000000' ? '⏳ pending' : h.substring(0, 12) + '…';

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Message */}
      {message && (
        <div style={{
          padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px',
          background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: message.type === 'success' ? dark.green : dark.red,
        }}>
          {message.text}
        </div>
      )}

      {/* Register form */}
      <div style={{
        padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)',
        border: `1px solid ${dark.border}`, marginBottom: '10px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>📌 Register Fingerprint</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="Image URL (jpg, png, webp)"
            style={{
              flex: 1, minWidth: '200px', padding: '8px 10px', borderRadius: '8px',
              border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.3)',
              color: '#fff', fontSize: '13px', outline: 'none',
            }}
          />
          <select
            value={imageType}
            onChange={e => setImageType(e.target.value)}
            style={{
              padding: '8px 10px', borderRadius: '8px',
              border: `1px solid ${dark.border}`, background: 'rgba(0,0,0,0.3)',
              color: '#fff', fontSize: '13px',
            }}
          >
            <option value="logo">Logo</option>
            <option value="product">Product</option>
            <option value="other">Other</option>
          </select>
          <button
            onClick={handleRegister}
            disabled={registering || !imageUrl.trim()}
            style={{
              padding: '8px 16px', borderRadius: '8px',
              border: `1px solid rgba(139,92,246,0.4)`, background: 'rgba(139,92,246,0.15)',
              color: '#fff', fontSize: '13px', fontWeight: 600, cursor: registering ? 'wait' : 'pointer',
            }}
          >
            {registering ? 'Registering...' : 'Register'}
          </button>
        </div>
      </div>

      {/* Auto-discover */}
      <button
        onClick={handleAutoDiscover}
        disabled={discovering || !brandDomain}
        style={{
          width: '100%', padding: '10px', borderRadius: '10px', marginBottom: '12px',
          border: `1px solid ${brandDomain ? 'rgba(139,92,246,0.4)' : dark.border}`,
          background: brandDomain ? 'rgba(139,92,246,0.1)' : 'rgba(0,0,0,0.2)',
          color: brandDomain ? '#fff' : dark.textMuted, fontSize: '13px', fontWeight: 600,
          cursor: discovering ? 'wait' : 'pointer',
        }}
      >
        {discovering ? '🔍 Scanning website...' : `🔍 Auto-Discover from ${brandDomain || 'brand domain'}`}
      </button>

      {/* Fingerprint list */}
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
        🗂️ Registered Fingerprints {fingerprints.length > 0 && `(${fingerprints.length})`}
      </div>
      {loading ? (
        <div style={{ color: dark.textMuted, fontSize: '12px', textAlign: 'center', padding: '12px' }}>Loading...</div>
      ) : fingerprints.length === 0 ? (
        <div style={{ color: dark.textMuted, fontSize: '12px', textAlign: 'center', padding: '12px' }}>
          No fingerprints registered yet. Register an image or auto-discover from your website.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '6px' }}>
          {fingerprints.map((fp) => (
            <div key={fp.id} style={{
              padding: '8px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)',
              border: `1px solid rgba(255,255,255,0.08)`, display: 'flex',
              alignItems: 'center', gap: '10px',
            }}>
              <img src={fp.image_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {typeIcon(fp.image_type)} {fp.image_type}
                </div>
                <div style={{ fontSize: '10px', color: dark.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fp.image_url}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: dark.textMuted, fontFamily: 'monospace' }}>
                {hashDisplay(fp.phash)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}