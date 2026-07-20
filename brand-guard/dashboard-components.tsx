/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in this directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * Brand Guard Dashboard — React Components
 * ============================================================
 * UI components for the Reputation Dashboard + Takedown Center.
 * These components are designed to be integrated into the agenticbro.app
 * Next.js frontend.
 *
 * Components:
 *   - BrandGuardDashboard — Main dashboard layout
 *   - ThreatFeed — Real-time threat feed
 *   - BrandHealthScore — Health score visualization
 *   - TakedownCenter — Takedown action management
 *   - AlertBanner — Alert notification banner
 *
 * Usage:
 *   Import into your Next.js page:
 *   import { BrandGuardDashboard } from '@/components/BrandGuardDashboard';
 */

import React, { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
interface ThreatItem {
  id: string;
  type: 'social_impersonator' | 'phone_scam' | 'domain_lookalike' | 'cross_channel' | 'scammer_db';
  severity: 'critical' | 'high' | 'medium' | 'low';
  platform: string;
  target: string;
  risk_score: number;
  risk_level: string;
  evidence: string[];
  detected_at: string;
  status: 'new' | 'monitoring' | 'reported' | 'resolved' | 'dismissed';
}

interface TakedownAction {
  id: string;
  platform: string;
  action_type: 'report' | 'cease_desist' | 'evidence_package' | 'monitor';
  target: string;
  url: string;
  status: 'pending' | 'submitted' | 'acknowledged' | 'removed' | 'rejected';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  created_at: string;
}

interface BrandHealthScore {
  overall_score: number;
  overall_level: string;
  breakdown: {
    social_health: number;
    domain_health: number;
    phone_health: number;
    scammer_db_exposure: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}

// ── Severity Colors ─────────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

const SEVERITY_BG: Record<string, string> = {
  critical: '#fef2f2',
  high: '#fff7ed',
  medium: '#fefce8',
  low: '#f0fdf4',
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🚨',
  high: '⚠️',
  medium: 'ℹ️',
  low: '✅',
};

const THREAT_TYPE_ICONS: Record<string, string> = {
  social_impersonator: '👤',
  phone_scam: '📞',
  domain_lookalike: '🌐',
  cross_channel: '🔗',
  scammer_db: '🕵️',
};

// ── Health Score Component ───────────────────────────────────────────────────
export function BrandHealthScore({ health }: { health: BrandHealthScore }) {
  const scoreColor = health.overall_score >= 80 ? '#16a34a'
    : health.overall_score >= 60 ? '#ca8a04'
    : health.overall_score >= 40 ? '#ea580c' : '#dc2626';

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#374151' }}>
        Brand Health Score
      </h3>

      {/* Main score circle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: `6px solid ${scoreColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: scoreColor }}>
            {health.overall_score}
          </span>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            /100
          </span>
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: scoreColor }}>
            {health.overall_level}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Trend: {health.trend === 'improving' ? '📈 Improving' : health.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
          </div>
        </div>
      </div>

      {/* Breakdown bars */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {[
          { label: 'Social', value: health.breakdown.social_health, icon: '👤' },
          { label: 'Domain', value: health.breakdown.domain_health, icon: '🌐' },
          { label: 'Phone', value: health.breakdown.phone_health, icon: '📞' },
          { label: 'DB Exposure', value: health.breakdown.scammer_db_exposure, icon: '🕵️' },
        ].map(item => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>
                {item.icon} {item.label}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                {item.value}%
              </span>
            </div>
            <div style={{
              height: '6px',
              backgroundColor: '#f3f4f6',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${item.value}%`,
                backgroundColor: item.value >= 80 ? '#16a34a' : item.value >= 60 ? '#ca8a04' : item.value >= 40 ? '#ea580c' : '#dc2626',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
            RECOMMENDATIONS
          </div>
          {health.recommendations.map((rec, i) => (
            <div key={i} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
              • {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Threat Feed Component ────────────────────────────────────────────────────
export function ThreatFeed({ threats }: { threats: ThreatItem[] }) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? threats :
    threats.filter(t => t.severity === filter);

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#374151' }}>
          Threat Feed
        </h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                border: '1px solid',
                borderColor: filter === s ? SEVERITY_COLORS[s === 'all' ? 'low' : s] : '#e5e7eb',
                backgroundColor: filter === s ? (s === 'all' ? '#f3f4f6' : SEVERITY_BG[s]) : 'white',
                color: filter === s ? (s === 'all' ? '#374151' : SEVERITY_COLORS[s]) : '#6b7280',
                cursor: 'pointer',
                fontWeight: filter === s ? '600' : '400',
              }}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontSize: '14px' }}>No threats found</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {filtered.map(threat => (
            <div
              key={threat.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: SEVERITY_BG[threat.severity] || '#f9fafb',
                border: `1px solid ${SEVERITY_COLORS[threat.severity]}20`,
              }}
            >
              <span style={{ fontSize: '18px' }}>
                {SEVERITY_ICONS[threat.severity]}
              </span>
              <span style={{ fontSize: '16px' }}>
                {THREAT_TYPE_ICONS[threat.type] || '⚠️'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  {threat.target}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {threat.platform} • {threat.type.replace('_', ' ')}
                </div>
              </div>
              <div style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: 'white',
                backgroundColor: SEVERITY_COLORS[threat.severity],
              }}>
                {threat.risk_score}/10
              </div>
              <div style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: threat.status === 'new' ? '#fef3c7' :
                  threat.status === 'reported' ? '#dbeafe' :
                  threat.status === 'resolved' ? '#d1fae5' : '#f3f4f6',
                color: threat.status === 'new' ? '#92400e' :
                  threat.status === 'reported' ? '#1e40af' :
                  threat.status === 'resolved' ? '#065f46' : '#6b7280',
              }}>
                {threat.status.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Takedown Center Component ────────────────────────────────────────────────
export function TakedownCenter({ actions }: { actions: TakedownAction[] }) {
  const pending = actions.filter(a => a.status === 'pending');
  const inProgress = actions.filter(a => ['submitted', 'acknowledged'].includes(a.status));
  const completed = actions.filter(a => ['removed', 'rejected'].includes(a.status));

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#374151' }}>
        Takedown Center
      </h3>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#fef3c7' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#92400e' }}>{pending.length}</span>
          <span style={{ fontSize: '12px', color: '#92400e', marginLeft: '4px' }}>Pending</span>
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#dbeafe' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>{inProgress.length}</span>
          <span style={{ fontSize: '12px', color: '#1e40af', marginLeft: '4px' }}>In Progress</span>
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#d1fae5' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#065f46' }}>{completed.length}</span>
          <span style={{ fontSize: '12px', color: '#065f46', marginLeft: '4px' }}>Completed</span>
        </div>
      </div>

      {/* Actions list */}
      {actions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
          <div style={{ fontSize: '14px' }}>No takedown actions yet</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>Run a brand scan to detect threats and generate takedown actions</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {actions.slice(0, 10).map(action => (
            <div key={action.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: action.priority === 'urgent' ? '#dc2626' :
                  action.priority === 'high' ? '#ea580c' : '#ca8a04',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  [{action.priority.toUpperCase()}] {action.platform}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {action.action_type} → {action.target}
                </div>
              </div>
              {action.url && (
                <a href={action.url} target="_blank" rel="noopener noreferrer" style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  textDecoration: 'none',
                }}>
                  File Report
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard Component ────────────────────────────────────────────────
export function BrandGuardDashboard({ brandId }: { brandId: string }) {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`/api/brand-guard/dashboard?brand_id=${brandId}`);
        if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
        const data = await res.json();
        setDashboard(data.dashboard || data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [brandId]);

  // Responsive breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔐</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Loading Brand Guard Dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
        <div style={{ fontSize: '14px' }}>Error loading dashboard: {error}</div>
      </div>
    );
  }

  if (!dashboard) return null;

  const health = dashboard.health_score as BrandHealthScore;
  const threats = (dashboard.threats || []) as ThreatItem[];
  const takedowns = (dashboard.takedown_actions || []) as TakedownAction[];
  const summary = dashboard.summary as Record<string, number>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '12px' : '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>
            🔐 Brand Guard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
            {(dashboard.brand as Record<string, string>).name} — {(dashboard.brand as Record<string, string>).handle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}>
            🔍 Run Scan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Threats', value: summary?.total_threats || 0, color: '#6b7280', bg: '#f3f4f6' },
          { label: 'Critical', value: summary?.critical_threats || 0, color: '#dc2626', bg: '#fef2f2' },
          { label: 'High', value: summary?.high_threats || 0, color: '#ea580c', bg: '#fff7ed' },
          { label: 'Medium', value: summary?.medium_threats || 0, color: '#ca8a04', bg: '#fefce8' },
          { label: 'Low', value: summary?.low_threats || 0, color: '#16a34a', bg: '#f0fdf4' },
        ].map(card => (
          <div key={card.label} style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: card.bg,
            border: `1px solid ${card.color}20`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: card.color }}>
              {card.value}
            </div>
            <div style={{ fontSize: '12px', color: card.color, marginTop: '4px' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '24px' }}>
        {/* Left Column: Health Score */}
        <div>
          {health && <BrandHealthScore health={health} />}
        </div>

        {/* Right Column: Threat Feed + Takedown Center */}
        <div style={{ display: 'grid', gap: '24px' }}>
          <ThreatFeed threats={threats} />
          <TakedownCenter actions={takedowns} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
        Brand Guard by Jeeevs / AgenticBro — Scan first, trust later! 🔐
        <br />
        Educational purposes only. Not financial advice. Not a guarantee of safety.
      </div>
    </div>
  );
}

export default BrandGuardDashboard;