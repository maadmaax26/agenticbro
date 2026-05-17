/**
 * ScanAnalytics — Dashboard component for scan usage tracking
 * 
 * Displays:
 * - Total scans with growth indicators
 * - Breakdown by scan type (social, phone, website, token, wallet, X CDP)
 * - Breakdown by platform (instagram, tiktok, facebook, X, telegram)
 * - Day-by-day trend chart
 * - High risk / critical counts
 */

import { useState, useEffect } from 'react';

interface AnalyticsData {
  total_scans: number;
  total_high_risk: number;
  total_critical: number;
  avg_risk_score: number;
  unique_days: number;
  by_type: Record<string, { count: number; high_risk: number; critical: number; avg_risk: number }>;
  by_platform: Record<string, { count: number; high_risk: number; critical: number; avg_risk: number }>;
  daily: Array<{
    date: string;
    scan_type: string;
    platform: string;
    count: number;
    high_risk: number;
    critical: number;
    avg_risk: number;
  }>;
  growth: {
    today: number;
    yesterday: number;
    last_7d: number;
    last_30d: number;
    this_week_vs_last_week: number | null;
  };
  period: string;
  source: string;
}

interface TrendRow {
  stat_date: string;
  total_scans: number;
  social_scans: number;
  phone_scans: number;
  website_scans: number;
  token_scans: number;
  wallet_scans: number;
  x_cdp_scans: number;
  high_risk_total: number;
  critical_total: number;
}

const SCAN_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  social: { label: 'Social Profile', emoji: '👤', color: '#8B5CF6' },
  phone: { label: 'Phone Number', emoji: '📱', color: '#3B82F6' },
  website: { label: 'Website', emoji: '🌐', color: '#10B981' },
  token: { label: 'Token', emoji: '🪙', color: '#F59E0B' },
  wallet: { label: 'Wallet', emoji: '💼', color: '#EF4444' },
  x_cdp: { label: 'X/Twitter CDP', emoji: '🐦', color: '#1DA1F2' },
};

const PLATFORM_LABELS: Record<string, { label: string; emoji: string }> = {
  instagram: { label: 'Instagram', emoji: '📸' },
  tiktok: { label: 'TikTok', emoji: '🎵' },
  facebook: { label: 'Facebook', emoji: '📘' },
  twitter: { label: 'X/Twitter', emoji: '🐦' },
  telegram: { label: 'Telegram', emoji: '✈️' },
  linkedin: { label: 'LinkedIn', emoji: '💼' },
  unknown: { label: 'Unknown', emoji: '❓' },
};

export default function ScanAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
    loadTrends();
  }, [days]);

  const loadAnalytics = async () => {
    try {
      const res = await fetch(`/api/scan-stats?days=${days}`);
      const data = await res.json();
      setAnalytics(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    try {
      const res = await fetch(`/api/scan-stats?trends=1&days=${days}`);
      const data = await res.json();
      setTrends(data.trends || []);
    } catch {
      // Trends are optional
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const growthPercent = analytics?.growth?.this_week_vs_last_week;
  const growthDisplay = growthPercent != null
    ? `${growthPercent > 0 ? '+' : ''}${growthPercent}%`
    : '—';

  const maxDailyScans = trends.length > 0
    ? Math.max(...trends.map(t => t.total_scans), 1)
    : 1;

  if (loading) {
    return (
      <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-purple-500/10 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-purple-500/10 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="bg-[#1a1035] border border-red-500/20 rounded-xl p-6">
        <p className="text-red-400 text-sm">Unable to load scan analytics. Data will populate as scans are performed.</p>
      </div>
    );
  }

  const a = analytics || {
    total_scans: 0,
    total_high_risk: 0,
    total_critical: 0,
    avg_risk_score: 0,
    by_type: {},
    by_platform: {},
    growth: { today: 0, yesterday: 0, last_7d: 0, last_30d: 0, this_week_vs_last_week: null },
  };

  return (
    <div className="space-y-6">
      {/* Header + Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📊 Scan Analytics
          </h2>
          <p className="text-sm text-purple-300/60 mt-1">
            Track scan volume and usage growth by type and platform
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => { setDays(d); setLoading(true); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-4">
          <p className="text-xs text-purple-300/60 uppercase tracking-wider">Total Scans</p>
          <p className="text-2xl font-bold text-white mt-1">{formatNumber(a.total_scans)}</p>
          {a.growth.this_week_vs_last_week != null && (
            <p className={`text-xs mt-1 ${a.growth.this_week_vs_last_week >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {growthDisplay} vs last week
            </p>
          )}
        </div>
        <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-4">
          <p className="text-xs text-purple-300/60 uppercase tracking-wider">High Risk</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{formatNumber(a.total_high_risk)}</p>
          <p className="text-xs text-purple-300/40 mt-1">
            {a.total_scans > 0 ? ((a.total_high_risk / a.total_scans) * 100).toFixed(1) : 0}% of total
          </p>
        </div>
        <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-4">
          <p className="text-xs text-purple-300/60 uppercase tracking-wider">Critical</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{formatNumber(a.total_critical)}</p>
          <p className="text-xs text-purple-300/40 mt-1">
            {a.total_scans > 0 ? ((a.total_critical / a.total_scans) * 100).toFixed(1) : 0}% of total
          </p>
        </div>
        <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-4">
          <p className="text-xs text-purple-300/60 uppercase tracking-wider">Avg Risk</p>
          <p className="text-2xl font-bold text-white mt-1">{a.avg_risk_score.toFixed(1)}<span className="text-sm text-purple-300/60">/10</span></p>
          <div className="flex gap-3 mt-1 text-xs text-purple-300/40">
            <span>Today: {a.growth.today}</span>
            <span>7d: {a.growth.last_7d}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* By Scan Type */}
        <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-4">
            By Scan Type
          </h3>
          <div className="space-y-3">
            {Object.entries(a.by_type || {}).sort(([,a]: [string, any], [,b]: [string, any]) => b.count - a.count).map(([type, data]: [string, any]) => {
              const info = SCAN_TYPE_LABELS[type] || { label: type, emoji: '🔍', color: '#8B5CF6' };
              const pct = a.total_scans > 0 ? (data.count / a.total_scans) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-purple-100 flex items-center gap-2">
                      <span>{info.emoji}</span>
                      <span>{info.label}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white">{formatNumber(data.count)}</span>
                      {data.high_risk > 0 && (
                        <span className="text-xs text-orange-400">⚠{data.high_risk}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-purple-500/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: info.color }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(a.by_type || {}).length === 0 && (
              <p className="text-sm text-purple-300/40 italic">No scan data yet</p>
            )}
          </div>
        </div>

        {/* By Platform */}
        <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-4">
            By Platform
          </h3>
          <div className="space-y-3">
            {Object.entries(a.by_platform || {}).sort(([,a]: [string, any], [,b]: [string, any]) => b.count - a.count).map(([platform, data]: [string, any]) => {
              const info = PLATFORM_LABELS[platform] || { label: platform, emoji: '🔍' };
              const pct = a.total_scans > 0 ? (data.count / a.total_scans) * 100 : 0;
              return (
                <div key={platform}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-purple-100 flex items-center gap-2">
                      <span>{info.emoji}</span>
                      <span>{info.label}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white">{formatNumber(data.count)}</span>
                      {data.high_risk > 0 && (
                        <span className="text-xs text-orange-400">⚠{data.high_risk}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-purple-500/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(a.by_platform || {}).length === 0 && (
              <p className="text-sm text-purple-300/40 italic">No platform data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily Trend Chart (simple bar chart) */}
      {trends.length > 0 && (
        <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-4">
            Daily Scans — Last {days} Days
          </h3>
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {trends.map((day) => {
              const height = maxDailyScans > 0 ? (day.total_scans / maxDailyScans) * 100 : 0;
              const hasRisk = day.high_risk_total > 0;
              return (
                <div key={day.stat_date} className="flex flex-col items-center gap-1 min-w-[20px]">
                  <div className="relative w-full flex justify-center" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 w-4 rounded-t transition-all duration-300"
                      style={{
                        height: `${Math.max(height, 2)}%`,
                        backgroundColor: hasRisk ? '#F97316' : '#8B5CF6',
                      }}
                      title={`${day.stat_date}: ${day.total_scans} scans, ${day.high_risk_total} high risk`}
                    />
                  </div>
                  <span className="text-[10px] text-purple-300/40 whitespace-nowrap">
                    {new Date(day.stat_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-purple-300/40">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-purple-500 rounded" /> Total scans
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-orange-500 rounded" /> Has high risk
            </span>
          </div>
        </div>
      )}

      {/* Growth Summary */}
      <div className="bg-[#1a1035] border border-purple-500/20 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-3">
          Growth Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-purple-300/60">Today</p>
            <p className="text-lg font-bold text-white">{a.growth.today}</p>
          </div>
          <div>
            <p className="text-xs text-purple-300/60">Yesterday</p>
            <p className="text-lg font-bold text-white">{a.growth.yesterday}</p>
          </div>
          <div>
            <p className="text-xs text-purple-300/60">Last 7 Days</p>
            <p className="text-lg font-bold text-white">{a.growth.last_7d}</p>
          </div>
          <div>
            <p className="text-xs text-purple-300/60">Week over Week</p>
            <p className={`text-lg font-bold ${
              a.growth.this_week_vs_last_week == null ? 'text-purple-300/40'
                : a.growth.this_week_vs_last_week >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {growthDisplay}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}