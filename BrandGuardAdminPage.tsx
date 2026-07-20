/**
 * BrandGuardAdminPage.tsx — Admin Dashboard for Brand Guard
 *
 * Route: /brand-guard/admin
 * Only accessible to agenticbro@agenticbro.app
 * Shows all registered users, promo codes, credit balances, and scan stats.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BrandGuardDraftsReview from '../components/brand-guard/BrandGuardDraftsReview';

// Mobile breakpoint hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

const API_BASE = '/api/brand-guard';

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  signup_source: string | null;
  signup_app: string | null;
  user_created_at: string;
  free_credits_total: number;
  free_credits_used: number;
  paid_credits: number;
  paid_credits_total_purchased: number;
  total_remaining: number;
  promo_code: string | null;
  promo_credits: number;
  first_brand_at: string | null;
  brand_count: number;
  total_scans: number;
}

interface AdminStats {
  total_users: number;
  total_brands: number;
  total_scans: number;
  promo_users: number;
  beta2026_users: number;
  scan_types: Record<string, number>;
  recent_signups: Array<{ email: string; created_at: string; promo_code: string | null }>;
  recent_scans: Array<{ scan_type: string; created_at: string; email: string }>;
  credits: {
    free_total: number;
    free_used: number;
    paid_balance: number;
    paid_purchased: number;
    promo_bonus: number;
  };
}

export function BrandGuardAdminPage() {
  const navigate = useNavigate();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState(10);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'activity' | 'notifications' | 'operations' | 'outreach'>('outreach');
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [operations, setOperations] = useState<any>(null);
  const isMobile = useIsMobile();

  const ADMIN_EMAIL = 'agenticbro@agenticbro.app';

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data } = await supabase!.auth.getSession();
        if (data?.session?.access_token) {
          setAuthToken(data.session.access_token);
          const email = data.session.user.email || '';
          setUserEmail(email);
          setIsAdmin(email.toLowerCase() === ADMIN_EMAIL);
        }
      } catch { /* not authenticated */ }
      setLoading(false);
    }
    checkAuth();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          setAuthToken(session.access_token);
          const email = session.user.email || '';
          setUserEmail(email);
          setIsAdmin(email.toLowerCase() === ADMIN_EMAIL);
        } else {
          setAuthToken(null);
          setIsAdmin(false);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!authToken || !isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users?limit=200${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
      else setError(data.error || 'Failed to fetch users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  }, [authToken, isAdmin, searchQuery]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!authToken || !isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch { /* ignore */ }
  }, [authToken, isAdmin]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!authToken || !isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/admin/notifications?limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread || 0);
      }
    } catch { /* ignore */ }
  }, [authToken, isAdmin]);

  const fetchOperations = useCallback(async () => {
    if (!authToken || !isAdmin) return;
    try {
      const [deliveryResponse, managerResponse] = await Promise.all([
        fetch(`${API_BASE}/admin/delivery-monitoring`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/admin/account-managers`, { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      setOperations({ delivery: await deliveryResponse.json(), accounts: await managerResponse.json() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operations');
    }
  }, [authToken, isAdmin]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchOperations(); }, [fetchOperations]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!supabase || !authToken || !isAdmin) return;
    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authToken, isAdmin]);

  // Grant credits
  const handleGrantCredits = async (userId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/admin/grant-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ user_id: userId, amount: grantAmount, description: `Admin granted ${grantAmount} credits` }),
      });
      const data = await res.json();
      if (data.success) {
        setGrantingUserId(null);
        fetchUsers();
        fetchStats();
      } else {
        setError(data.error || 'Failed to grant credits');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  };

  const handleMarkRead = async (ids?: string[]) => {
    if (!authToken) return;
    try {
      await fetch(`${API_BASE}/admin/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(ids ? { ids } : { mark_all: true }),
      });
      fetchNotifications();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#8b5cf6' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔐</div>
          <div>Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h2 style={{ color: '#fff', marginBottom: '8px' }}>Access Denied</h2>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
            This admin dashboard is restricted to authorized accounts.
          </p>
          <button
            onClick={() => navigate('/brand-guard')}
            style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
          >
            ← Back to Brand Guard
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 24px',
        borderBottom: '1px solid rgba(139,92,246,0.2)',
        background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
          <button onClick={() => navigate('/brand-guard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: isMobile ? '12px' : '14px' }}>← Brand Guard</button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(139,92,246,0.3)' }} />
          <span style={{ fontSize: isMobile ? '16px' : '20px' }}>🔐</span>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: isMobile ? '14px' : '16px' }}>Brand Guard Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: isMobile ? '10px' : '12px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.3)' }}>
            ● Admin
          </span>
          {!isMobile && <span style={{ fontSize: '13px', color: '#9ca3af' }}>{userEmail}</span>}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '12px 8px' : '24px' }}>
        {/* Stats Cards */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: isMobile ? '8px' : '12px',
            marginBottom: isMobile ? '16px' : '24px',
          }}>
            {[
              { label: 'Total Users', value: stats.total_users, icon: '👥', color: '#8b5cf6' },
              { label: 'Brands', value: stats.total_brands, icon: '🏢', color: '#3b82f6' },
              { label: 'Total Scans', value: stats.total_scans, icon: '🔍', color: '#22c55e' },
              { label: 'Beta Testers', value: stats.beta2026_users, icon: '🧪', color: '#f59e0b' },
              { label: 'Promo Users', value: stats.promo_users, icon: '🎟️', color: '#ec4899' },
              { label: 'Credits Granted', value: stats.credits.free_total + stats.credits.paid_purchased, icon: '💎', color: '#06b6d4' },
            ].map(card => (
              <div key={card.label} style={{
                background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: '12px', padding: isMobile ? '10px 8px' : '16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: isMobile ? '16px' : '20px', marginBottom: '4px' }}>{card.icon}</div>
                <div style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: isMobile ? '9px' : '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs — dropdown on mobile, scrollable bar on desktop */}
        {(() => {
          const tabs = [
            { id: 'outreach', label: '🎯 Outreach' },
            { id: 'users', label: '👥 Users' },
            { id: 'stats', label: '📊 Stats' },
            { id: 'activity', label: '🕐 Activity' },
            { id: 'notifications', label: '🔔 Notifications' },
            { id: 'operations', label: '⚙ Operations' },
          ] as const;
          if (isMobile) {
            return (
              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => setTabMenuOpen(!tabMenuOpen)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid rgba(139,92,246,0.4)',
                    background: 'rgba(139,92,246,0.15)', color: '#fff',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>{tabs.find(t => t.id === activeTab)?.label}{activeTab === 'notifications' && unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
                  <span style={{ fontSize: '12px' }}>{tabMenuOpen ? '▲' : '▼'}</span>
                </button>
                {tabMenuOpen && (
                  <div style={{ marginTop: '4px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(139,92,246,0.3)' }}>
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setTabMenuOpen(false); }}
                        style={{
                          width: '100%', padding: '10px 14px', border: 'none',
                          background: activeTab === tab.id ? 'rgba(139,92,246,0.25)' : 'rgba(15,15,25,0.8)',
                          color: activeTab === tab.id ? '#fff' : '#9ca3af',
                          fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                          borderBottom: '1px solid rgba(139,92,246,0.1)',
                        }}
                      >
                        {tab.label}
                        {tab.id === 'notifications' && unreadCount > 0 && (
                          <span style={{ marginLeft: '6px', padding: '2px 6px', borderRadius: '10px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 700 }}>{unreadCount}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', flexWrap: 'nowrap' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px',
                    border: activeTab === tab.id ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)',
                    background: activeTab === tab.id ? 'rgba(139,92,246,0.2)' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : '#9ca3af',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap', position: 'relative',
                  }}
                >
                  {tab.label}
                  {tab.id === 'notifications' && unreadCount > 0 && (
                    <span style={{ marginLeft: '6px', padding: '2px 6px', borderRadius: '10px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 700 }}>{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          );
        })()}

        {error && (
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>
            {error} <button onClick={() => setError(null)} style={{ marginLeft: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {activeTab === 'users' && (
          <>
            {/* Search */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email or promo code..."
                style={{
                  width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '14px',
                }}
              />
            </div>

            {/* Users — card view on mobile, table on desktop */}
            {isMobile ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                {users.map(user => (
                  <div key={user.user_id} style={{
                    background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: '10px', padding: '12px', fontSize: '13px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: '14px', wordBreak: 'break-all' }}>{user.email}</span>
                      {user.promo_code && (
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: 'rgba(139,92,246,0.2)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.4)', flexShrink: 0 }}>{user.promo_code}</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', color: '#9ca3af', fontSize: '12px' }}>
                      <div>Free: <span style={{ color: '#22c55e' }}>{user.free_credits_total}</span></div>
                      <div>Used: <span style={{ color: '#9ca3af' }}>{user.free_credits_used}</span></div>
                      <div>Paid: <span style={{ color: '#3b82f6' }}>{user.paid_credits}</span></div>
                      <div>Left: <span style={{ color: user.total_remaining > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{user.total_remaining ?? 0}</span></div>
                      <div>Brands: {user.brand_count}</div>
                      <div>Scans: {user.total_scans}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>{formatDate(user.user_created_at)}</span>
                      {grantingUserId === user.user_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input type="number" value={grantAmount} onChange={e => setGrantAmount(parseInt(e.target.value) || 1)}
                            style={{ width: '40px', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', textAlign: 'center' }} />
                          <button onClick={() => handleGrantCredits(user.user_id)} style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>✓</button>
                          <button onClick={() => setGrantingUserId(null)} style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setGrantingUserId(user.user_id); setGrantAmount(10); }} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '11px', cursor: 'pointer' }}>+ Credits</button>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No users found</div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(139,92,246,0.3)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#9ca3af', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Source</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#9ca3af', fontWeight: 600 }}>Promo</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Free</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Used</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Paid</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Remaining</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Brands</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Scans</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#9ca3af', fontWeight: 600 }}>Joined</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.user_id} style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                      <td style={{ padding: '10px 8px', color: '#fff', fontWeight: 500 }}>{user.email}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {user.signup_source === 'brand-guard' || user.signup_app === 'brand-guard' ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>Brand Guard</span>
                        ) : user.signup_source ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>{user.signup_source}</span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: 'rgba(156,163,175,0.1)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.2)' }}>AgenticBro</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {user.promo_code ? (
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                            background: user.promo_code === 'beta2026' ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)',
                            color: user.promo_code === 'beta2026' ? '#f59e0b' : '#8b5cf6',
                            border: `1px solid ${user.promo_code === 'beta2026' ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.4)'}`,
                          }}>
                            {user.promo_code}
                          </span>
                        ) : <span style={{ color: '#6b7280' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#22c55e' }}>{user.free_credits_total}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af' }}>{user.free_credits_used}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#3b82f6' }}>{user.paid_credits}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: user.total_remaining > 0 ? '#22c55e' : '#ef4444' }}>{user.total_remaining ?? 0}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af' }}>{user.brand_count}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af' }}>{user.total_scans}</td>
                      <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '12px' }}>{formatDate(user.user_created_at)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {grantingUserId === user.user_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number" value={grantAmount} onChange={e => setGrantAmount(parseInt(e.target.value) || 1)}
                              style={{ width: '50px', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', textAlign: 'center' }}
                            />
                            <button onClick={() => handleGrantCredits(user.user_id)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>✓</button>
                            <button onClick={() => setGrantingUserId(null)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setGrantingUserId(user.user_id); setGrantAmount(10); }} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '11px', cursor: 'pointer' }}>+ Credits</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No users found</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'stats' && stats && (
          <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: isMobile ? '16px 12px' : '24px' }}>
            <h3 style={{ color: '#fff', marginBottom: '16px' }}>Credit Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? '8px' : '16px' }}>
              <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Free Credits Granted</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{stats.credits.free_total}</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Free Credits Used</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{stats.credits.free_used}</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Paid Credits Balance</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{stats.credits.paid_balance}</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Paid Credits Total Purchased</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#8b5cf6' }}>{stats.credits.paid_purchased}</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Promo Bonus Credits</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>{stats.credits.promo_bonus}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && stats && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Scan Type Breakdown */}
            {stats.scan_types && Object.keys(stats.scan_types).length > 0 && (
              <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ color: '#fff', marginBottom: '12px' }}>🔍 Scan Breakdown</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                  {Object.entries(stats.scan_types).map(([type, count]) => {
                    const icons: Record<string, string> = { impersonator: '🔍', domain: '🌐', website: '🔗', threat: '⚡', vendor: '📞', email: '📧' };
                    const labels: Record<string, string> = { impersonator: 'Impersonator', domain: 'Domain Sweep', website: 'Link Scanner', threat: 'Threat Correlate', vendor: 'Vendor Verify', email: 'Email Spoof' };
                    return (
                      <div key={type} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.15)', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icons[type] || '🔎'}</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#8b5cf6' }}>{String(count)}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{labels[type] || type}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Signups */}
            {stats.recent_signups && stats.recent_signups.length > 0 && (
              <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ color: '#fff', marginBottom: '12px' }}>👥 Recent Signups</h3>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {stats.recent_signups.map((signup, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#8b5cf6' }}>{signup.email.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>{signup.email}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(signup.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      {signup.promo_code && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: signup.promo_code === 'beta2026' ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)', color: signup.promo_code === 'beta2026' ? '#f59e0b' : '#8b5cf6', border: `1px solid ${signup.promo_code === 'beta2026' ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.4)'}` }}>{signup.promo_code}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Scans */}
            {stats.recent_scans && stats.recent_scans.length > 0 && (
              <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ color: '#fff', marginBottom: '12px' }}>🔎 Recent Scans</h3>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {stats.recent_scans.map((scan, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                      <div>
                        <span style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>{scan.email}</span>
                        <span style={{ fontSize: '11px', color: '#8b5cf6', marginLeft: '8px' }}>{scan.scan_type}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(scan.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Mark all read button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', color: '#9ca3af' }}>{notifications.length} notification{notifications.length !== 1 ? 's' : ''} • {unreadCount} unread</div>
              {unreadCount > 0 && (
                <button onClick={() => handleMarkRead()} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '13px', cursor: 'pointer' }}>Mark all read</button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔕</div>
                <div>No notifications yet</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>New user signups and brand creations will appear here</div>
              </div>
            ) : (
              notifications.map((n: any) => {
                const typeIcons: Record<string, string> = { new_user: '👤', new_brand: '🏢', new_subscription: '💎', high_risk_scan: '🚨' };
                const typeColors: Record<string, string> = { new_user: '#3b82f6', new_brand: '#22c55e', new_subscription: '#8b5cf6', high_risk_scan: '#ef4444' };
                const typeLabels: Record<string, string> = { new_user: 'New User', new_brand: 'New Brand', new_subscription: 'New Subscription', high_risk_scan: 'High Risk' };
                const icon = typeIcons[n.type] || '📌';
                const color = typeColors[n.type] || '#9ca3af';
                const label = typeLabels[n.type] || n.type;
                const data = n.data || {};
                return (
                  <div key={n.id} style={{
                    display: 'flex', gap: '12px', padding: '14px', borderRadius: '10px',
                    background: n.read ? 'rgba(15,15,25,0.5)' : 'rgba(15,15,25,0.9)',
                    border: n.read ? '1px solid rgba(139,92,246,0.1)' : `1px solid ${color}40`,
                    opacity: n.read ? 0.7 : 1,
                  }}>
                    <div style={{ fontSize: '24px', lineHeight: 1 }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{n.title}</div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: `${color}20`, color, border: `1px solid ${color}40` }}>{label}</span>
                          {!n.read && (
                            <button onClick={() => handleMarkRead([n.id])} style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: 'rgba(139,92,246,0.2)', color: '#8b5cf6', fontSize: '10px', cursor: 'pointer' }}>✓</button>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>{n.message}</div>
                      {data.email && <div style={{ fontSize: '12px', color: '#64748b' }}>📧 {data.email}</div>}
                      {data.brand_name && <div style={{ fontSize: '12px', color: '#64748b' }}>🏢 {data.brand_name} (@{data.brand_handle})</div>}
                      {data.plan_id && <div style={{ fontSize: '12px', color: '#64748b' }}>💎 {data.plan_id} • {data.monthly_credits} credits/mo</div>}
                      {data.platforms && <div style={{ fontSize: '12px', color: '#64748b' }}>📱 {Array.isArray(data.platforms) ? data.platforms.join(', ') : data.platforms}</div>}
                      {data.domain && <div style={{ fontSize: '12px', color: '#64748b' }}>🌐 {data.domain}</div>}
                      {!n.email_sent && <div style={{ fontSize: '11px', color: '#f59e0b' }}>⚠️ Email pending</div>}
                      <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        {activeTab === 'operations' && operations && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Queued Deliveries', value: operations.delivery?.summary?.queued || 0, color: '#f59e0b' },
                { label: 'Delivered (24h)', value: operations.delivery?.summary?.delivered_24h || 0, color: '#22c55e' },
                { label: 'Dead Letters', value: operations.delivery?.summary?.unresolved_dead_letters || 0, color: '#ef4444' },
                { label: 'Degraded Endpoints', value: operations.delivery?.summary?.degraded_endpoints || 0, color: '#f97316' },
                { label: 'Account Managers', value: operations.accounts?.managers?.length || 0, color: '#8b5cf6' },
                { label: 'Open Cases', value: operations.accounts?.open_cases?.length || 0, color: '#3b82f6' },
              ].map(item => (
                <div key={item.label} style={{ padding: '16px', borderRadius: '10px', background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ color: '#fff', marginBottom: '12px' }}>Delivery Queue</h3>
              {(operations.delivery?.jobs || []).slice(0, 20).map((job: any) => (
                <div key={job.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(139,92,246,0.1)', fontSize: '12px' }}>
                  <span style={{ color: '#d1d5db' }}>{job.event_type} · {job.id}</span>
                  <span style={{ color: job.status === 'delivered' ? '#22c55e' : job.status === 'dead_letter' ? '#ef4444' : '#f59e0b' }}>{job.status}</span>
                  <span style={{ color: '#9ca3af' }}>{job.attempt_count} tries</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ color: '#fff', marginBottom: '12px' }}>Account Manager Cases</h3>
              {(operations.accounts?.open_cases || []).map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                  <div><div style={{ color: '#fff', fontSize: '13px' }}>{item.subject}</div><div style={{ color: '#6b7280', fontSize: '11px' }}>{item.owner_id}</div></div>
                  <div style={{ fontSize: '12px', color: item.priority === 'urgent' ? '#ef4444' : '#f59e0b' }}>{item.priority} · {item.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'outreach' && (
          <div>
            <BrandGuardDraftsReview authToken={authToken} />
          </div>
        )}
      </div>
    </div>
  );
}

export default BrandGuardAdminPage;
