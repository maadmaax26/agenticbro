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

const API_BASE = '/api/brand-guard';

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
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
  const [activeTab, setActiveTab] = useState<'users' | 'stats'>('users');

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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

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
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(139,92,246,0.2)', background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/brand-guard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '14px' }}>← Brand Guard</button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(139,92,246,0.3)' }} />
          <span style={{ fontSize: '20px' }}>🔐</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>Brand Guard Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.3)' }}>
            ● Admin
          </span>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>{userEmail}</span>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Stats Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
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
                borderRadius: '12px', padding: '16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{card.icon}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: activeTab === 'users' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)',
              background: activeTab === 'users' ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: activeTab === 'users' ? '#fff' : '#9ca3af', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >👥 Users</button>
          <button
            onClick={() => setActiveTab('stats')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: activeTab === 'stats' ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(139,92,246,0.2)',
              background: activeTab === 'stats' ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: activeTab === 'stats' ? '#fff' : '#9ca3af', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >📊 Stats</button>
        </div>

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

            {/* Users Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(139,92,246,0.3)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#9ca3af', fontWeight: 600 }}>Email</th>
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
          </>
        )}

        {activeTab === 'stats' && stats && (
          <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ color: '#fff', marginBottom: '16px' }}>Credit Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
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
      </div>
    </div>
  );
}

export default BrandGuardAdminPage;