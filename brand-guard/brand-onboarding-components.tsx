/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * BrandOnboarding + BrandSwitcher — React Components
 * ============================================================
 * Handles the brand creation flow and switching between brands.
 *
 * Flow:
 *   1. User signs up/logs in via Supabase Auth (existing agenticbro.app auth)
 *   2. If no brands exist → show BrandOnboarding
 *   3. If brands exist → load last-used brand into dashboard
 *   4. BrandSwitcher dropdown lets users switch between or add brands
 *
 * Integration into your Next.js app:
 *   In your dashboard page component:
 *
 *   import { BrandGuardDashboard } from '@/components/BrandGuardDashboard';
 *   import { BrandOnboarding, BrandSwitcher } from '@/components/BrandOnboarding';
 *
 *   export default function BrandGuardPage() {
 *     const { user } = useSupabaseAuth();
 *     const [brands, setBrands] = useState([]);
 *     const [activeBrand, setActiveBrand] = useState(null);
 *     const [showOnboarding, setShowOnboarding] = useState(false);
 *
 *     useEffect(() => {
 *       if (user) fetchBrands();
 *     }, [user]);
 *
 *     if (!user) return <LoginPage />;
 *     if (brands.length === 0 || showOnboarding) return <BrandOnboarding ... />;
 *     return (
 *       <>
 *         <BrandSwitcher brands={brands} activeBrand={activeBrand} ... />
 *         <BrandGuardDashboard brandId={activeBrand.id} />
 *       </>
 *     );
 *   }
 */

import React, { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Brand {
  id: string;
  brand_name: string;
  brand_handle: string;
  brand_domain: string | null;
  platforms: string[];
  scan_frequency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Platform Options ────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'x', label: 'X (Twitter)', icon: '𝕏' },
  { id: 'instagram', label: 'Instagram', icon: '📷' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'telegram', label: 'Telegram', icon: '✈️' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
];

const FREQUENCIES = [
  { id: 'daily', label: 'Daily', desc: 'Best for high-risk brands' },
  { id: 'weekly', label: 'Weekly', desc: 'Recommended for most brands' },
  { id: 'monthly', label: 'Monthly', desc: 'For low-risk monitoring' },
];

// ── BrandOnboarding Component ────────────────────────────────────────────────
export function BrandOnboarding({
  onSubmit,
  loading = false,
}: {
  onSubmit: (brand: { brand_name: string; brand_handle: string; brand_domain: string; platforms: string[]; scan_frequency: string }) => void;
  loading?: boolean;
}) {
  const [step, setStep] = useState(1);
  const [brandName, setBrandName] = useState('');
  const [brandHandle, setBrandHandle] = useState('');
  const [brandDomain, setBrandDomain] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['x', 'instagram', 'tiktok', 'facebook', 'telegram']);
  const [scanFrequency, setScanFrequency] = useState('weekly');

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const canProceed = (s: number) => {
    if (s === 1) return brandName.trim().length >= 2;
    if (s === 2) return brandHandle.trim().length >= 2;
    return true;
  };

  const handleSubmit = () => {
    onSubmit({
      brand_name: brandName.trim(),
      brand_handle: brandHandle.trim().replace(/^@/, ''),
      brand_domain: brandDomain.trim(),
      platforms: selectedPlatforms,
      scan_frequency: scanFrequency,
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '560px',
        width: '100%',
        background: 'white',
        borderRadius: '16px',
        padding: '48px',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Set Up Brand Guard
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
            Tell us about your brand so we can start monitoring for impersonators, lookalikes, and scams.
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: s <= step ? '#3b82f6' : '#e2e8f0',
              transition: 'background-color .2s',
            }} />
          ))}
        </div>

        {/* Step 1: Brand Name */}
        {step === 1 && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              What's your brand name? *
            </label>
            <input
              type="text"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="e.g. Agentic Bro"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '16px',
                outline: 'none',
                marginBottom: '24px',
              }}
              autoFocus
            />
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>
              This is the name your customers know you by. We'll scan for accounts pretending to be you.
            </p>
            <button
              onClick={() => canProceed(1) && setStep(2)}
              disabled={!canProceed(1)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                fontWeight: '600',
                cursor: canProceed(1) ? 'pointer' : 'not-allowed',
                backgroundColor: canProceed(1) ? '#3b82f6' : '#e2e8f0',
                color: canProceed(1) ? 'white' : '#94a3b8',
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Handle + Domain */}
        {step === 2 && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Your primary social media handle *
            </label>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <span style={{ position: 'absolute', left: '16px', top: '13px', color: '#94a3b8', fontSize: '16px' }}>@</span>
              <input
                type="text"
                value={brandHandle}
                onChange={e => setBrandHandle(e.target.value.replace(/^@/, ''))}
                placeholder="e.g. agenticbro"
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 36px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '16px',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px' }}>
              We'll look for accounts with similar handles that might be impersonating you.
            </p>

            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Your website (optional)
            </label>
            <input
              type="text"
              value={brandDomain}
              onChange={e => setBrandDomain(e.target.value)}
              placeholder="e.g. agenticbro.app"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '16px',
                outline: 'none',
                marginBottom: '24px',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db',
                  fontSize: '16px', fontWeight: '600', cursor: 'pointer', background: 'white', color: '#64748b',
                }}
              >
                Back
              </button>
              <button
                onClick={() => canProceed(2) && setStep(3)}
                disabled={!canProceed(2)}
                style={{
                  flex: 2, padding: '14px', borderRadius: '8px', border: 'none',
                  fontSize: '16px', fontWeight: '600', cursor: canProceed(2) ? 'pointer' : 'not-allowed',
                  backgroundColor: canProceed(2) ? '#3b82f6' : '#e2e8f0', color: canProceed(2) ? 'white' : '#94a3b8',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Platforms + Frequency */}
        {step === 3 && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              Which platforms should we monitor?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', borderRadius: '8px', border: '1px solid',
                    borderColor: selectedPlatforms.includes(p.id) ? '#3b82f6' : '#e2e8f0',
                    backgroundColor: selectedPlatforms.includes(p.id) ? '#eff6ff' : 'white',
                    color: selectedPlatforms.includes(p.id) ? '#1d4ed8' : '#64748b',
                    cursor: 'pointer', fontSize: '14px', fontWeight: selectedPlatforms.includes(p.id) ? '600' : '400',
                  }}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              How often should we scan?
            </label>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '24px' }}>
              {FREQUENCIES.map(f => (
                <button
                  key={f.id}
                  onClick={() => setScanFrequency(f.id)}
                  style={{
                    padding: '12px 16px', borderRadius: '8px', border: '1px solid',
                    borderColor: scanFrequency === f.id ? '#3b82f6' : '#e2e8f0',
                    backgroundColor: scanFrequency === f.id ? '#eff6ff' : 'white',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: scanFrequency === f.id ? '600' : '400', color: scanFrequency === f.id ? '#1d4ed8' : '#374151' }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{f.desc}</div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>
                Setup Summary
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{brandName}</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>@{brandHandle}{brandDomain ? ` • ${brandDomain}` : ''}</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Monitoring {selectedPlatforms.length} platforms • {FREQUENCIES.find(f => f.id === scanFrequency)?.label} scans
              </div>
              <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: '13px', color: '#065f46' }}>
                🔐 25 free scans included to get started — then $1/scan pay-as-you-go
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #d1d5db',
                  fontSize: '16px', fontWeight: '600', cursor: 'pointer', background: 'white', color: '#64748b',
                }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 2, padding: '14px', borderRadius: '8px', border: 'none',
                  fontSize: '16px', fontWeight: '600', cursor: loading ? 'wait' : 'pointer',
                  backgroundColor: '#3b82f6', color: 'white',
                }}
              >
                {loading ? 'Creating...' : '🚀 Start Protecting My Brand'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── BrandSwitcher Component ──────────────────────────────────────────────────
export function BrandSwitcher({
  brands,
  activeBrand,
  onSelectBrand,
  onAddBrand,
}: {
  brands: Brand[];
  activeBrand: Brand | null;
  onSelectBrand: (brand: Brand) => void;
  onAddBrand: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
          background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
        }}
      >
        <span style={{ fontSize: '18px' }}>🔐</span>
        <span>{activeBrand?.brand_name || 'Select Brand'}</span>
        <span style={{ fontSize: '10px', color: '#94a3b8' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '4px',
          minWidth: '260px', background: 'white', borderRadius: '8px',
          border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,.1)',
          zIndex: 50, padding: '4px',
        }}>
          {brands.map(brand => (
            <button
              key={brand.id}
              onClick={() => { onSelectBrand(brand); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 12px', borderRadius: '6px',
                border: 'none', background: activeBrand?.id === brand.id ? '#eff6ff' : 'white',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '18px' }}>🔐</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                  {brand.brand_name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  @{brand.brand_handle}{brand.brand_domain ? ` • ${brand.brand_domain}` : ''}
                </div>
              </div>
              {activeBrand?.id === brand.id && (
                <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: '14px' }}>✓</span>
              )}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
          <button
            onClick={() => { setOpen(false); onAddBrand(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '10px 12px', borderRadius: '6px',
              border: 'none', background: 'white', cursor: 'pointer', color: '#3b82f6',
              fontSize: '14px', fontWeight: '500',
            }}
          >
            <span style={{ fontSize: '18px' }}>＋</span> Add Another Brand
          </button>
        </div>
      )}
    </div>
  );
}

export default BrandOnboarding;