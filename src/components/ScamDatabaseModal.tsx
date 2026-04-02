// ============================================
// Agentic Bro - Scam Database Modal
// ============================================
// Purpose: Display scammer database and scan results on website
// Created: March 25, 2026
// Updated: Auto-sync scan_results; split by risk into Scammers/Legitimate tabs; clickable detail panel
// ============================================

import { useState, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface Scammer {
  id: string;
  scammer_name: string;
  platform: string;
  x_handle: string | null;
  telegram_channel: string | null;
  victims_count: number;
  total_lost_usd: number;
  verification_level: string;
  scam_type: string;
  risk_score: number;
  risk_level: string;
  last_updated: string;
  // Extended fields from database
  display_name?: string | null;
  impersonating?: string | null;
  status?: string | null;
  notes?: string | null;
  wallet_address?: string | null;
  evidence_urls?: string[] | null;
  red_flags?: string[] | null;
  scan_notes?: string | null;
  first_reported?: string | null;
}

interface LegitimateAccount {
  id: string;
  account_name: string;
  platform: string;
  x_handle: string | null;
  telegram_channel: string | null;
  followers: number;
  verification_badge: boolean;
  risk_score: number;
  risk_level: string;
  scan_date: string;
  // Extended fields from Chrome CDP scan
  posts_count?: number | null;
  bio?: string | null;
  account_age_years?: number | null;
  red_flags_detected?: string[] | null;
  notes?: string | null;
}

interface ScanResult {
  id: string;
  target_name: string;
  platform: string;
  target_handle: string;
  scan_date: string;
  risk_score: number;
  risk_level: string;
  verification_level: string;
  // Extended fields stored by ProfileVerifierScanner
  scam_type?: string | null;
  recommendation?: string | null;
  red_flags?: string[] | null;
  evidence?: string[] | null;
  confidence?: string | null;
  display_name?: string | null;
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  bio?: string | null;
  profile_image?: string | null;
  join_date?: string | null;
  verified?: boolean | null;
}

interface Stats {
  total_scans: number;
  total_scammers_detected: number;
  total_legitimate_accounts: number;
  total_victims: number;
  total_amount_saved_usd: number;
  total_lost_tracked_usd: number;
  ama_giveaway_fraud: number;
  rug_pull: number;
  phishing: number;
  wallet_drainer: number;
  other_scam_types: number;
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
  critical_risk_count: number;
  last_updated: string;
}

type DetailEntry =
  | { kind: 'scan'; data: ScanResult }
  | { kind: 'scammer'; data: Scammer }
  | { kind: 'legitimate'; data: LegitimateAccount };

interface ScamDatabaseModalProps {
  onClose: () => void;
}

// ============================================
// Supabase Client
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://drvasofyghnxfxvkkwad.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = !!(supabaseUrl && supabaseUrl.length > 0 && supabaseAnonKey && supabaseAnonKey.length > 0);

let supabaseClient: any = null;
async function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  if (!supabaseClient) {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

// ============================================
// Local Fallback Data
// ============================================

const LOCAL_SCAMMERS: Scammer[] = [
  { id: '1', scammer_name: 'AGNT Markets', platform: 'Solana Token', x_handle: null, telegram_channel: 'Unknown', victims_count: 0, total_lost_usd: 0, verification_level: 'Partially Verified', scam_type: 'Token Confusion Scam', risk_score: 7.5, risk_level: 'HIGH', last_updated: '2026-03-26' },
  { id: '2', scammer_name: 'AGNT (Base Network)', platform: 'Base Token', x_handle: null, telegram_channel: 'Unknown', victims_count: 0, total_lost_usd: 0, verification_level: 'Partially Verified', scam_type: 'Token Confusion Scam', risk_score: 7.0, risk_level: 'HIGH', last_updated: '2026-03-26' },
  { id: '3', scammer_name: 'AGNTC (Agent Claw)', platform: 'Base Token', x_handle: null, telegram_channel: 'Unknown', victims_count: 0, total_lost_usd: 0, verification_level: 'Partially Verified', scam_type: 'Token Confusion Scam', risk_score: 6.5, risk_level: 'MEDIUM', last_updated: '2026-03-26' },
  { id: '4', scammer_name: 'Crypto_Genius09', platform: 'X (Twitter)', x_handle: '@Crypto_Genius09', telegram_channel: null, victims_count: 1, total_lost_usd: 50, verification_level: 'Verified', scam_type: 'AMA/Giveaway Fraud', risk_score: 8.5, risk_level: 'HIGH', last_updated: '2026-03-25' },
  { id: '5', scammer_name: 'SOL BROTHERS', platform: 'Solana Token', x_handle: null, telegram_channel: 'Unknown', victims_count: 0, total_lost_usd: 0, verification_level: 'Partially Verified', scam_type: 'Token Confusion Scam', risk_score: 6.0, risk_level: 'MEDIUM', last_updated: '2026-03-26' },
];

const LOCAL_LEGITIMATE: LegitimateAccount[] = [
  { id: '1', account_name: 'Agentic Bro', platform: 'X (Twitter)', x_handle: '@AgenticBro11', telegram_channel: '@Agenticbro', followers: 5000, verification_badge: false, risk_score: 0.5, risk_level: 'LOW', scan_date: '2026-03-25' },
];

const LOCAL_SCAN_RESULTS: ScanResult[] = [
  { id: '1', target_name: '@Crypto_Genius09', platform: 'X (Twitter)', target_handle: '@Crypto_Genius09', scan_date: '2026-03-25', risk_score: 8.5, risk_level: 'HIGH', verification_level: 'Flagged Scammer' },
  { id: '2', target_name: '@Web3warrior', platform: 'X (Twitter)', target_handle: '@Web3warrior', scan_date: '2026-03-24', risk_score: 0.5, risk_level: 'LOW', verification_level: 'Legitimate' },
  { id: '3', target_name: 'AGNT Markets Token', platform: 'Solana', target_handle: 'Ct2WWvYBVa2sCZXgSmw2Be1bXpSnsTLK59Yb5RYmpump', scan_date: '2026-03-26', risk_score: 7.5, risk_level: 'HIGH', verification_level: 'Partially Verified' },
];

const LOCAL_STATS: Stats = {
  total_scans: 547, total_scammers_detected: 12, total_legitimate_accounts: 1, total_victims: 1,
  total_amount_saved_usd: 125000, total_lost_tracked_usd: 50,
  ama_giveaway_fraud: 1, rug_pull: 0, phishing: 0, wallet_drainer: 0, other_scam_types: 11,
  low_risk_count: 450, medium_risk_count: 75, high_risk_count: 20, critical_risk_count: 2,
  last_updated: '2026-03-26',
};

// ============================================
// Helpers
// ============================================

const RISK_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)', text: '#f87171', badge: 'bg-red-600' },
  HIGH:     { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.5)', text: '#fb923c', badge: 'bg-orange-500' },
  MEDIUM:   { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.5)', text: '#fbbf24', badge: 'bg-yellow-500' },
  LOW:      { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.5)', text: '#4ade80', badge: 'bg-green-500' },
};

function riskColor(level: string) {
  return RISK_COLORS[level] ?? RISK_COLORS['LOW'];
}

function RiskBadge({ level, score }: { level: string; score: number }) {
  const c = riskColor(level);
  return (
    <span className={`${c.badge} text-white px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap`}>
      {level} ({(score ?? 0).toFixed(1)})
    </span>
  );
}

function profileUrl(platform: string, handle: string): string | null {
  const h = handle.replace(/^@/, '');
  const map: Record<string, string> = {
    'X (Twitter)': `https://x.com/${h}`,
    'Twitter': `https://x.com/${h}`,
    'Instagram': `https://instagram.com/${h}`,
    'Discord': `https://discord.com/users/${h}`,
    'LinkedIn': `https://linkedin.com/in/${h}`,
    'Facebook': `https://facebook.com/${h}`,
  };
  return map[platform] ?? null;
}

// ============================================
// Stats Dashboard
// ============================================

function StatsDashboard({ stats, totalScans }: { stats: Stats; totalScans: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">{((stats.total_scans ?? 0) + totalScans).toLocaleString()}</div>
        <div className="text-blue-200 text-xs">Total Scans</div>
      </div>
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">{(stats.total_scammers_detected ?? 0).toLocaleString()}</div>
        <div className="text-red-200 text-xs">Scammers</div>
      </div>
      <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">{(stats.total_legitimate_accounts ?? 0).toLocaleString()}</div>
        <div className="text-green-200 text-xs">Legitimate</div>
      </div>
      <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">${(stats.total_lost_tracked_usd ?? 0).toLocaleString()}</div>
        <div className="text-purple-200 text-xs">Loss Tracked</div>
      </div>
    </div>
  );
}

// ============================================
// Scammer Card (from scammers table)
// ============================================

function ScammerCard({ scammer, selected, onClick }: { scammer: Scammer; selected: boolean; onClick: () => void }) {
  const c = riskColor(scammer.risk_level);
  return (
    <div
      onClick={onClick}
      className="rounded-lg p-4 border-l-4 cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        background: selected ? c.bg : 'rgba(255,255,255,0.07)',
        borderLeftColor: c.border,
        outline: selected ? `2px solid ${c.border}` : 'none',
      }}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{scammer.scammer_name}</h3>
          <p className="text-gray-400 text-xs">{scammer.platform}</p>
        </div>
        <RiskBadge level={scammer.risk_level} score={scammer.risk_score} />
      </div>
      <div className="space-y-0.5 text-xs text-gray-400">
        {scammer.scam_type && <p>Type: <span className="text-red-400">{scammer.scam_type}</span></p>}
        {scammer.x_handle && <p>X: <span className="text-blue-400">{scammer.x_handle}</span></p>}
        <p>Victims: <span className="text-red-400">{scammer.victims_count}</span> · Lost: <span className="text-red-400">${(scammer.total_lost_usd ?? 0).toLocaleString()}</span></p>
      </div>
      <p className="text-xs text-gray-600 mt-2">Click for details →</p>
    </div>
  );
}

// ============================================
// Scan Result Card (from scan_results table)
// ============================================

function ScanCard({ scan, selected, onClick }: { scan: ScanResult; selected: boolean; onClick: () => void }) {
  const c = riskColor(scan.risk_level);
  const isScammer = ['CRITICAL', 'HIGH', 'MEDIUM'].includes(scan.risk_level);
  return (
    <div
      onClick={onClick}
      className="rounded-lg p-4 border-l-4 cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        background: selected ? c.bg : 'rgba(255,255,255,0.07)',
        borderLeftColor: c.border,
        outline: selected ? `2px solid ${c.border}` : 'none',
      }}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{scan.target_name}</h3>
          <p className="text-gray-400 text-xs">{scan.platform}</p>
        </div>
        <RiskBadge level={scan.risk_level} score={scan.risk_score} />
      </div>
      <div className="space-y-0.5 text-xs text-gray-400">
        {scan.scam_type && <p>Type: <span style={{ color: c.text }}>{scan.scam_type}</span></p>}
        <p>Status: <span style={{ color: c.text }}>{scan.verification_level}</span></p>
        {isScammer && <p className="text-red-400 font-semibold">⚠ Flagged from user scan</p>}
        {!isScammer && <p className="text-green-400 font-semibold">✓ Verified clean from user scan</p>}
      </div>
      <p className="text-xs text-gray-600 mt-2">Click for details →</p>
    </div>
  );
}

// ============================================
// Legitimate Account Card
// ============================================

function LegitimateCard({ account, selected, onClick }: { account: LegitimateAccount; selected: boolean; onClick: () => void }) {
  const c = riskColor(account.risk_level);
  return (
    <div
      onClick={onClick}
      className="rounded-lg p-4 border-l-4 cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        background: selected ? c.bg : 'rgba(255,255,255,0.07)',
        borderLeftColor: c.border,
        outline: selected ? `2px solid ${c.border}` : 'none',
      }}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{account.account_name}</h3>
          <p className="text-gray-400 text-xs">{account.platform}</p>
        </div>
        <RiskBadge level={account.risk_level} score={account.risk_score} />
      </div>
      <div className="space-y-0.5 text-xs text-gray-400">
        {account.x_handle && <p>X: <span className="text-blue-400">{account.x_handle}</span></p>}
        {account.verification_badge && <p className="text-green-400">✅ Verified</p>}
        <p>Followers: <span className="text-green-400">{account.followers?.toLocaleString()}</span></p>
      </div>
      <p className="text-xs text-gray-600 mt-2">Click for details →</p>
    </div>
  );
}

// ============================================
// Detail Panel
// ============================================

function DetailPanel({ entry, onClose }: { entry: DetailEntry; onClose: () => void }) {
  if (entry.kind === 'scan') {
    const s = entry.data;
    const c = riskColor(s.risk_level);
    const pUrl = profileUrl(s.platform, s.target_handle);
    const isScammer = ['CRITICAL', 'HIGH', 'MEDIUM'].includes(s.risk_level);
    return (
      <div className="h-full overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white">{s.target_name}</h3>
            <p className="text-xs text-gray-400">{s.platform} · {new Date(s.scan_date).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg flex-shrink-0">✕</button>
        </div>

        {/* Risk gauge */}
        <div className="rounded-lg p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold" style={{ color: c.text }}>
              {isScammer ? '🚨' : '✅'} {s.risk_level} RISK
            </span>
            <span className="text-xl font-bold" style={{ color: c.text }}>{(s.risk_score ?? 0).toFixed(1)}/10</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min((s.risk_score ?? 0) * 10, 100)}%`, background: c.text }} />
          </div>
          <p className="text-xs mt-2" style={{ color: c.text }}>{s.verification_level}</p>
        </div>

        {/* Scam type */}
        {s.scam_type && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs text-gray-400 mb-1">Detected Scam Type</p>
            <p className="text-sm font-bold text-red-400">{s.scam_type}</p>
          </div>
        )}

        {/* Recommendation */}
        {s.recommendation && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <p className="text-xs text-gray-400 mb-1">Recommendation</p>
            <p className="text-sm text-gray-200 leading-relaxed">{s.recommendation}</p>
          </div>
        )}

        {/* Profile data */}
        {(s.followers != null || s.bio || s.verified != null) && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-xs text-gray-400 mb-2">Profile Data</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {s.followers != null && (
                <div><p className="text-gray-500">Followers</p><p className="text-white font-bold">{(s.followers).toLocaleString()}</p></div>
              )}
              {s.following != null && (
                <div><p className="text-gray-500">Following</p><p className="text-white font-bold">{(s.following).toLocaleString()}</p></div>
              )}
              {s.posts != null && (
                <div><p className="text-gray-500">Posts</p><p className="text-white font-bold">{(s.posts).toLocaleString()}</p></div>
              )}
              {s.verified != null && (
                <div><p className="text-gray-500">Verified</p><p className={s.verified ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{s.verified ? '✓ Yes' : '✗ No'}</p></div>
              )}
            </div>
            {s.bio && <p className="text-xs text-gray-300 mt-2 leading-relaxed">{s.bio}</p>}
          </div>
        )}

        {/* Red flags */}
        {s.red_flags && s.red_flags.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-xs text-gray-400 mb-2">🚩 Red Flags ({s.red_flags.length})</p>
            <div className="space-y-1">
              {s.red_flags.map((flag, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">⚠</span>
                  <span className="text-xs text-gray-300">{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence */}
        {s.evidence && s.evidence.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <p className="text-xs text-gray-400 mb-2">🔍 Evidence ({s.evidence.length})</p>
            <div className="space-y-1">
              {s.evidence.map((ev, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
                  <span className="text-xs text-gray-300">{ev}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {pUrl && s.platform !== 'Telegram' && (
            <a href={pUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              🌐 View Profile in Browser Tab
            </a>
          )}
          <div className="text-xs text-gray-500 text-center">
            Scanned: {new Date(s.scan_date).toLocaleString()} · Confidence: {s.confidence || 'N/A'}
          </div>
        </div>
      </div>
    );
  }

  if (entry.kind === 'scammer') {
    const s = entry.data;
    const c = riskColor(s.risk_level);
    return (
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white">{s.display_name || s.scammer_name}</h3>
            <p className="text-xs text-gray-400">{s.platform} · {s.last_updated ? new Date(s.last_updated).toLocaleDateString() : 'Unknown'}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg flex-shrink-0">✕</button>
        </div>

        {/* Risk Score Gauge */}
        <div className="rounded-lg p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold" style={{ color: c.text }}>🚨 {s.risk_level} RISK</span>
            <span className="text-xl font-bold" style={{ color: c.text }}>{(s.risk_score ?? 0).toFixed(1)}/10</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min((s.risk_score ?? 0) * 10, 100)}%`, background: c.text }} />
          </div>
          <p className="text-xs mt-2" style={{ color: c.text }}>{s.verification_level}</p>
        </div>

        {/* Impersonating */}
        {s.impersonating && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs text-gray-400 mb-1">⚠️ Impersonating</p>
            <p className="text-sm text-red-400 font-bold">{s.impersonating}</p>
          </div>
        )}

        {/* Profile Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-gray-500">Scam Type</p>
            <p className="text-red-400 font-bold mt-1">{s.scam_type || 'Unknown'}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-gray-500">Status</p>
            <p className={`font-bold mt-1 ${s.status === 'banned' ? 'text-red-400' : 'text-yellow-400'}`}>
              {s.status === 'banned' ? '🚫 Banned' : s.status === 'active' ? '⚠️ Active' : s.status || 'Unknown'}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-gray-500">Victims</p>
            <p className="text-red-400 font-bold mt-1">{s.victims_count?.toLocaleString() || '0'}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-gray-500">Total Lost</p>
            <p className="text-red-400 font-bold mt-1">${(s.total_lost_usd ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Red Flags Detected */}
        {s.red_flags && s.red_flags.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs text-gray-400 mb-2">🚨 Red Flags Detected</p>
            <div className="flex flex-wrap gap-2">
              {s.red_flags.map((flag, i) => (
                <span key={i} className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                  {flag.replace(/_/g, ' ').toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Known Handles */}
        {(s.x_handle || s.telegram_channel) && (
          <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <p className="text-xs text-gray-400 mb-2">Known Handles</p>
            {s.x_handle && (
              <a href={`https://x.com/${s.x_handle.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-blue-400 hover:underline">
                𝕏 {s.x_handle}
              </a>
            )}
            {s.telegram_channel && (
              <p className="text-xs text-blue-400">✈️ {s.telegram_channel}</p>
            )}
          </div>
        )}

        {/* Wallet Address */}
        {s.wallet_address && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <p className="text-xs text-gray-400 mb-1">💰 Wallet Address</p>
            <p className="text-xs text-yellow-400 font-mono break-all">{s.wallet_address}</p>
          </div>
        )}

        {/* Evidence Links */}
        {s.evidence_urls && s.evidence_urls.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-xs text-gray-400 mb-2">📋 Evidence Links</p>
            <div className="space-y-1">
              {s.evidence_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-blue-400 hover:underline truncate">
                  {url.length > 50 ? url.substring(0, 50) + '...' : url}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {s.notes && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <p className="text-xs text-gray-400 mb-2">📋 Notes</p>
            <p className="text-xs text-gray-300 leading-relaxed">{s.notes}</p>
          </div>
        )}

        {/* First Reported */}
        {s.first_reported && (
          <div className="text-xs text-gray-500 text-center">
            First reported: {new Date(s.first_reported).toLocaleDateString()}
          </div>
        )}
      </div>
    );
  }

  // kind === 'legitimate'
  const a = entry.data;
  const c = riskColor(a.risk_level);
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-white">{a.account_name}</h3>
          <p className="text-xs text-gray-400">{a.platform} · {a.scan_date ? new Date(a.scan_date).toLocaleDateString() : 'Unknown'}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg flex-shrink-0">✕</button>
      </div>

      {/* Risk Score Gauge */}
      <div className="rounded-lg p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold" style={{ color: c.text }}>✅ {a.risk_level} RISK — Legitimate</span>
          <span className="text-xl font-bold" style={{ color: c.text }}>{(a.risk_score ?? 0).toFixed(1)}/10</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min((a.risk_score ?? 0) * 10, 100)}%` }} />
        </div>
      </div>

      {/* Bio */}
      {a.bio && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs text-gray-400 mb-1">Bio</p>
          <p className="text-sm text-gray-200">{a.bio}</p>
        </div>
      )}

      {/* Profile Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-gray-500">Followers</p>
          <p className="text-green-400 font-bold mt-1">{(a.followers ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-gray-500">Posts</p>
          <p className="text-gray-200 font-bold mt-1">{(a.posts_count ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-gray-500">Account Age</p>
          <p className="text-gray-200 font-bold mt-1">{a.account_age_years ? `${a.account_age_years}+ years` : 'Unknown'}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-gray-500">Verified Badge</p>
          <p className={`font-bold mt-1 ${a.verification_badge ? 'text-green-400' : 'text-gray-400'}`}>{a.verification_badge ? '✅ Yes' : 'No'}</p>
        </div>
      </div>

      {/* Red Flags Detected */}
      {a.red_flags_detected && a.red_flags_detected.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-xs text-gray-400 mb-2">⚠️ Red Flags Detected</p>
          <div className="flex flex-wrap gap-2">
            {a.red_flags_detected.map((flag, i) => (
              <span key={i} className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                {flag.replace(/_/g, ' ').toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Handles */}
      {(a.x_handle || a.telegram_channel) && (
        <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <p className="text-xs text-gray-400 mb-2">Handles</p>
          {a.x_handle && (
            <a href={`https://x.com/${a.x_handle.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:underline">
              𝕏 {a.x_handle}
            </a>
          )}
          {a.telegram_channel && <p className="text-xs text-blue-400">✈️ {a.telegram_channel}</p>}
        </div>
      )}

      {/* Scan Notes */}
      {a.notes && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <p className="text-xs text-gray-400 mb-2">📋 Scan Notes</p>
          <p className="text-xs text-gray-300 leading-relaxed">{a.notes}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function ScamDatabaseModal({ onClose }: ScamDatabaseModalProps) {
  const [scammers, setScammers] = useState<Scammer[]>([]);
  const [legitimate, setLegitimate] = useState<LegitimateAccount[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scammers' | 'legitimate' | 'scans'>('scammers');
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DetailEntry | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setScammers(LOCAL_SCAMMERS);
      setLegitimate(LOCAL_LEGITIMATE);
      setScanResults(LOCAL_SCAN_RESULTS);
      setStats(LOCAL_STATS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const supabase = await getSupabaseClient();
      if (!supabase) {
        setScammers(LOCAL_SCAMMERS); setLegitimate(LOCAL_LEGITIMATE);
        setScanResults(LOCAL_SCAN_RESULTS); setStats(LOCAL_STATS);
        setLoading(false);
        return;
      }

      const [scammersRes, legitimateRes, scanResultsRes, statsRes] = await Promise.all([
        supabase.from('known_scammers').select('*').order('risk_score', { ascending: false }).limit(50),
        supabase.from('legitimate_accounts').select('*').order('followers', { ascending: false }).limit(20),
        supabase.from('scan_results').select('*').order('scan_date', { ascending: false }).limit(100),
        supabase.from('stats').select('*').single(),
      ]);

      if (scammersRes.data) {
        // Map known_scammers fields to Scammer interface
        setScammers(scammersRes.data.map((s: any) => ({
          id: s.id,
          scammer_name: s.display_name || s.username || s.id,
          platform: s.platform,
          x_handle: s.x_handle,
          telegram_channel: s.telegram_channel,
          victims_count: s.victim_count || 0,
          total_lost_usd: typeof s.total_lost_usd === 'string' ? parseFloat(s.total_lost_usd?.replace(/[^0-9.]/g, '') || '0') : (s.total_lost_usd || 0),
          verification_level: s.verification_level,
          scam_type: s.scam_type || 'Unknown',
          risk_score: s.risk_score || 50,
          risk_level: s.threat_level || 'MEDIUM',
          last_updated: s.updated_at || s.last_seen,
          display_name: s.display_name,
          impersonating: s.impersonating,
          status: s.status,
          notes: s.notes,
          wallet_address: s.wallet_address,
          evidence_urls: s.evidence_urls || s.evidence_links,
          red_flags: s.red_flags,
          scan_notes: s.scan_notes,
          first_reported: s.first_reported || s.created_at,
        })));
      }
      if (legitimateRes.data) setLegitimate(legitimateRes.data);
      if (scanResultsRes.data) setScanResults(scanResultsRes.data);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Error fetching from Supabase, using local fallback:', err);
      setScammers(LOCAL_SCAMMERS); setLegitimate(LOCAL_LEGITIMATE);
      setScanResults(LOCAL_SCAN_RESULTS); setStats(LOCAL_STATS);
    } finally {
      setLoading(false);
    }
  };

  // Split scan_results by risk level
  const highRiskScans = scanResults.filter(s => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(s.risk_level));
  const lowRiskScans  = scanResults.filter(s => s.risk_level === 'LOW');

  // Split the scammers table the same way — LOW-risk entries belong in Legitimate
  const highRiskScammers = scammers.filter(s => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(s.risk_level));
  const lowRiskScammers  = scammers.filter(s => s.risk_level === 'LOW');

  const totalScammers   = highRiskScammers.length + highRiskScans.length;
  const totalLegitimate = legitimate.length + lowRiskScans.length + lowRiskScammers.length;

  const selectEntry = (e: DetailEntry) => setSelectedEntry(prev =>
    prev && prev.kind === e.kind && (prev.data as any).id === (e.data as any).id ? null : e
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-7xl max-h-[92vh] bg-gradient-to-b from-purple-900 to-black rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 to-cyan-800 px-6 py-4 border-b border-purple-500/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">🔍 Scam Detection Database</h2>
              <p className="text-sm text-purple-200">Protecting the user community from scammers</p>
            </div>
            <button onClick={onClose} className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold transition-colors">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: list */}
          <div className={`flex flex-col overflow-hidden transition-all ${selectedEntry ? 'w-full md:w-3/5' : 'w-full'}`}>
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading scam detection data...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 text-center">
                  <p className="text-red-400 font-semibold mb-2">⚠️ Error Loading Database</p>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  {stats && <StatsDashboard stats={stats} totalScans={scanResults.length} />}

                  {/* Tabs */}
                  <div className="flex space-x-2 mb-4 flex-wrap gap-y-2">
                    <button
                      onClick={() => setActiveTab('scammers')}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'scammers' ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                    >
                      🚨 Scammers ({totalScammers})
                    </button>
                    <button
                      onClick={() => setActiveTab('legitimate')}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'legitimate' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                    >
                      ✅ Legitimate ({totalLegitimate})
                    </button>
                    <button
                      onClick={() => setActiveTab('scans')}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${activeTab === 'scans' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                    >
                      📊 All Scans ({scanResults.length})
                    </button>
                  </div>

                  {/* Scammers tab: scammers table + MEDIUM/HIGH/CRITICAL scan_results */}
                  {activeTab === 'scammers' && (
                    <div className="space-y-3">
                      {highRiskScans.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">From User Scans — High & Medium Risk</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {highRiskScans.map(scan => (
                              <ScanCard
                                key={`scan-${scan.id}`}
                                scan={scan}
                                selected={selectedEntry?.kind === 'scan' && selectedEntry.data.id === scan.id}
                                onClick={() => selectEntry({ kind: 'scan', data: scan })}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      {highRiskScammers.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Known Scammer Database</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {highRiskScammers.map(scammer => (
                              <ScammerCard
                                key={`scammer-${scammer.id}`}
                                scammer={scammer}
                                selected={selectedEntry?.kind === 'scammer' && selectedEntry.data.id === scammer.id}
                                onClick={() => selectEntry({ kind: 'scammer', data: scammer })}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      {totalScammers === 0 && (
                        <div className="text-center py-12">
                          <p className="text-gray-400 text-lg">No scammers detected yet. 🎉</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Legitimate tab: legitimate_accounts + LOW scan_results */}
                  {activeTab === 'legitimate' && (
                    <div className="space-y-3">
                      {lowRiskScans.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">From User Scans — Low Risk (Clean)</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {lowRiskScans.map(scan => (
                              <ScanCard
                                key={`scan-${scan.id}`}
                                scan={scan}
                                selected={selectedEntry?.kind === 'scan' && selectedEntry.data.id === scan.id}
                                onClick={() => selectEntry({ kind: 'scan', data: scan })}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      {lowRiskScammers.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Low Risk — From Scammer Database</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {lowRiskScammers.map(scammer => (
                              <ScammerCard
                                key={`scammer-low-${scammer.id}`}
                                scammer={scammer}
                                selected={selectedEntry?.kind === 'scammer' && selectedEntry.data.id === scammer.id}
                                onClick={() => selectEntry({ kind: 'scammer', data: scammer })}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      {legitimate.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Verified Legitimate Accounts</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {legitimate.map(account => (
                              <LegitimateCard
                                key={`legit-${account.id}`}
                                account={account}
                                selected={selectedEntry?.kind === 'legitimate' && selectedEntry.data.id === account.id}
                                onClick={() => selectEntry({ kind: 'legitimate', data: account })}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      {totalLegitimate === 0 && (
                        <div className="text-center py-12">
                          <p className="text-gray-400 text-lg">No legitimate accounts verified yet.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* All Scans tab */}
                  {activeTab === 'scans' && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-black/30">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Target</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Platform</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Risk</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-500/20">
                          {scanResults.length > 0 ? (
                            scanResults.map(scan => (
                              <tr
                                key={scan.id}
                                className="hover:bg-white/5 cursor-pointer transition-colors"
                                style={{ background: selectedEntry?.kind === 'scan' && selectedEntry.data.id === scan.id ? 'rgba(139,92,246,0.12)' : undefined }}
                                onClick={() => selectEntry({ kind: 'scan', data: scan })}
                              >
                                <td className="px-4 py-3 text-sm font-medium text-white">{scan.target_name}</td>
                                <td className="px-4 py-3 text-sm text-gray-400">{scan.platform}</td>
                                <td className="px-4 py-3 text-sm"><RiskBadge level={scan.risk_level} score={scan.risk_score} /></td>
                                <td className="px-4 py-3 text-sm text-gray-400">{new Date(scan.scan_date).toLocaleDateString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-12 text-center text-gray-400 text-lg">No scan results yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-8 text-center text-gray-500 text-xs">
                    <p>🔐 Scan first, ape later! | $AGNTCBRO</p>
                    <p className="mt-1">Data sourced from Agentic Bro scam detection system • Updated automatically</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          {selectedEntry && (
            <div
              className="hidden md:flex flex-col w-2/5 border-l border-purple-500/20 overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <DetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
            </div>
          )}
        </div>

        {/* Mobile detail panel — full overlay when entry selected */}
        {selectedEntry && (
          <div className="md:hidden fixed inset-0 z-60 bg-black/90 flex flex-col" style={{ zIndex: 60 }}>
            <div className="bg-gradient-to-r from-purple-800 to-cyan-800 px-4 py-3 flex-shrink-0">
              <p className="text-white font-semibold text-sm">Scan Detail</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ============================================
// End of Component
// ============================================
