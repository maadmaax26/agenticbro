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
  subscription_plan: string | null;
  subscription_status: string | null;
}

interface AdminBrand {
  id: string;
  brand_name: string;
  brand_handle: string | null;
  brand_domain: string | null;
  platforms: string[] | null;
  scan_frequency: string | null;
  last_scan_at: string | null;
  is_active: boolean;
  scan_count: number;
}

interface AdminSubscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  monthly_credits_included: number;
  stripe_subscription_id: string | null;
}

interface AdminPilot {
  id: string;
  promo_code: string;
  status: 'active' | 'expired' | 'canceled';
  source: 'signup' | 'admin';
  started_at: string;
  ends_at: string;
  notification_sent_at: string | null;
}

type EditSection = 'account' | 'brands' | 'subscription' | 'brand-details';

interface EditAccountState {
  user: AdminUser;
  brands: AdminBrand[];
  subscription: AdminSubscription | null;
  subscriptionDraft: { plan_id: string; status: string; cancel_at_period_end: boolean } | null;
  pilot: AdminPilot | null;
  promoCodeDraft: string;
  loading: boolean;
  activeSection: EditSection;
  editingBrand: AdminBrand | null;
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

interface PilotRequest {
  id: string;
  email: string;
  company_name: string;
  brand_name: string;
  website: string;
  concern: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'fulfilled' | 'declined';
  approval_mode: 'direct' | 'invite' | null;
  approval_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  fulfilled_at: string | null;
  matched_user: { user_id: string; email: string; subscription_plan: string | null; subscription_status: string | null } | null;
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
  const [activeTab, setActiveTab] = useState<'users' | 'pilots' | 'stats' | 'activity' | 'notifications' | 'operations' | 'threats' | 'sla'>('threats');
  const [slaStatus, setSlaStatus] = useState<any>(null);
  const [outreachTab, setOutreachTab] = useState<'review' | 'hunt' | 'prospects'>('review');
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [operations, setOperations] = useState<any>(null);
  const isMobile = useIsMobile();
  const [editAccountState, setEditAccountState] = useState<EditAccountState | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [pilotRequests, setPilotRequests] = useState<PilotRequest[]>([]);
  const [pilotRequestStatus, setPilotRequestStatus] = useState<'pending' | 'approved' | 'fulfilled' | 'declined' | 'all'>('pending');
  const [pilotActionSaving, setPilotActionSaving] = useState<string | null>(null);

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

  // Fetch SLA status when SLA tab is active
  const fetchSlaStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/brand-guard/sla-status', { cache: 'no-store' });
      const data = await resp.json();
      setSlaStatus(data);
    } catch (e) {
      console.error('SLA fetch error:', e);
    }
  }, []);
  useEffect(() => {
    if (activeTab === 'sla') {
      fetchSlaStatus();
      const timer = setInterval(fetchSlaStatus, 2 * 60_000); // 2 min — SLA metrics don't change sub-minute
      return () => clearInterval(timer);
    }
  }, [activeTab, fetchSlaStatus]);

  const fetchPilotRequests = useCallback(async () => {
    if (!authToken || !isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/admin/pilot-requests?status=${pilotRequestStatus}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setPilotRequests(data.requests || []);
      else setError(data.error || 'Failed to fetch pilot requests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  }, [authToken, isAdmin, pilotRequestStatus]);

  useEffect(() => { if (activeTab === 'pilots') fetchPilotRequests(); }, [activeTab, fetchPilotRequests]);

  const handlePilotRequestAction = async (requestId: string, action: 'approve_direct' | 'approve_invite' | 'decline') => {
    if (!authToken) return;
    setPilotActionSaving(`${requestId}:${action}`);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/pilot-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update pilot request');
      if (data.approval_url && navigator.clipboard) await navigator.clipboard.writeText(data.approval_url);
      await fetchPilotRequests();
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update pilot request');
    } finally {
      setPilotActionSaving(null);
    }
  };

  // Poll notifications every 2 min (Realtime removed — was saturating DB pool)
  // Admin notifications are rare events; 2-min cadence is more than sufficient.
  useEffect(() => {
    if (!authToken || !isAdmin) return;
    const interval = setInterval(fetchNotifications, 2 * 60_000);
    return () => clearInterval(interval);
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

  // ── Edit Account modal handlers ────────────────────────────────────────

  const handleOpenEdit = async (user: AdminUser) => {
    setEditAccountState({ user, brands: [], subscription: null, subscriptionDraft: null, pilot: null, promoCodeDraft: user.promo_code === 'BGPILOT30' ? user.promo_code : '', loading: true, activeSection: 'account', editingBrand: null });
    try {
      const res = await fetch(`${API_BASE}/admin/user-details?user_id=${user.user_id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        const sub: AdminSubscription | null = data.subscription || null;
        setEditAccountState(s => s ? {
          ...s,
          brands: data.brands || [],
          subscription: sub,
          subscriptionDraft: sub ? { plan_id: sub.plan_id, status: sub.status, cancel_at_period_end: sub.cancel_at_period_end } : null,
          pilot: data.pilot || null,
          promoCodeDraft: data.pilot?.status === 'active' ? data.pilot.promo_code : (s.user.promo_code === 'BGPILOT30' ? s.user.promo_code : ''),
          loading: false,
        } : null);
      } else {
        setEditAccountState(s => s ? { ...s, loading: false } : null);
      }
    } catch {
      setEditAccountState(s => s ? { ...s, loading: false } : null);
    }
  };

  const handleUpdatePilot = async () => {
    if (!authToken || !editAccountState) return;
    setEditingSaving(true);
    setError(null);
    try {
      const promoCode = editAccountState.promoCodeDraft.trim().toUpperCase();
      const res = await fetch(`${API_BASE}/admin/pilot`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ owner_id: editAccountState.user.user_id, promo_code: promoCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update pilot promo code');
      setEditAccountState(s => s ? {
        ...s,
        user: { ...s.user, promo_code: data.promo_code, subscription_plan: data.subscription?.plan_id || null, subscription_status: data.subscription?.status || null },
        promoCodeDraft: data.promo_code || '',
        pilot: data.pilot || null,
        subscription: data.subscription || null,
        subscriptionDraft: data.subscription ? { plan_id: data.subscription.plan_id, status: data.subscription.status, cancel_at_period_end: data.subscription.cancel_at_period_end } : null,
      } : null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pilot');
    } finally {
      setEditingSaving(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    if (!authToken || !window.confirm('Delete this brand? This cannot be undone.')) return;
    setEditingSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/brand`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ brand_id: brandId }),
      });
      const data = await res.json();
      if (data.success) {
        setEditAccountState(s => s ? {
          ...s,
          brands: s.brands.filter(b => b.id !== brandId),
          editingBrand: s.editingBrand?.id === brandId ? null : s.editingBrand,
          activeSection: s.editingBrand?.id === brandId ? 'brands' : s.activeSection,
        } : null);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to delete brand');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
    setEditingSaving(false);
  };

  const handleSaveBrand = async () => {
    const brand = editAccountState?.editingBrand;
    if (!authToken || !brand) return;
    setEditingSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/brand`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          brand_id: brand.id,
          brand_name: brand.brand_name,
          brand_handle: brand.brand_handle,
          brand_domain: brand.brand_domain,
          platforms: brand.platforms,
          scan_frequency: brand.scan_frequency,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditAccountState(s => s ? {
          ...s,
          brands: s.brands.map(b => b.id === brand.id ? { ...b, ...brand } : b),
          activeSection: 'brands',
          editingBrand: null,
        } : null);
      } else {
        setError(data.error || 'Failed to save brand');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
    setEditingSaving(false);
  };

  const handleUpdateSubscription = async (subscriptionId: string, draft: { plan_id: string; status: string; cancel_at_period_end: boolean }) => {
    if (!authToken) return;
    setEditingSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ subscription_id: subscriptionId, ...draft }),
      });
      const data = await res.json();
      if (data.success) {
        const sub: AdminSubscription = data.subscription;
        setEditAccountState(s => s ? {
          ...s,
          subscription: sub,
          subscriptionDraft: { plan_id: sub.plan_id, status: sub.status, cancel_at_period_end: sub.cancel_at_period_end },
        } : null);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to update subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
    setEditingSaving(false);
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (!authToken || !window.confirm("Remove this subscription? The user will revert to the free plan.")) return;
    setEditingSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/subscription`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });
      const data = await res.json();
      if (data.success) {
        setEditAccountState(s => s ? { ...s, subscription: null, subscriptionDraft: null } : null);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to remove subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
    setEditingSaving(false);
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
            { id: 'threats', label: '🔍 Threat Intel' },
            { id: 'pilots', label: '🚀 Pilots' },
            { id: 'users', label: '👥 Users' },
            { id: 'stats', label: '📊 Stats' },
            { id: 'activity', label: '🕐 Activity' },
            { id: 'notifications', label: '🔔 Notifications' },
            { id: 'operations', label: '⚙ Operations' },
            { id: 'sla', label: '🛡️ SLA Monitor' },
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

        {activeTab === 'pilots' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
              <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>Pilot Requests</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={pilotRequestStatus}
                  onChange={e => setPilotRequestStatus(e.target.value as typeof pilotRequestStatus)}
                  style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.35)', color: '#fff' }}
                >
                  {['pending', 'approved', 'fulfilled', 'declined', 'all'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
                <button
                  onClick={fetchPilotRequests}
                  style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.35)', background: 'rgba(139,92,246,0.12)', color: '#fff', cursor: 'pointer' }}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {pilotRequests.length === 0 && (
                <div style={{ padding: '24px', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(15,15,25,0.8)', color: '#9ca3af', textAlign: 'center' }}>
                  No pilot requests in this view.
                </div>
              )}
              {pilotRequests.map(request => {
                const directKey = `${request.id}:approve_direct`;
                const inviteKey = `${request.id}:approve_invite`;
                const declineKey = `${request.id}:decline`;
                return (
                  <div key={request.id} style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(15,15,25,0.86)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{request.brand_name} <span style={{ color: '#9ca3af', fontWeight: 500 }}>({request.company_name})</span></div>
                        <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '3px' }}>{request.email} · {request.website}</div>
                      </div>
                      <span style={{ alignSelf: 'flex-start', color: request.status === 'pending' ? '#f59e0b' : request.status === 'fulfilled' ? '#22c55e' : request.status === 'declined' ? '#ef4444' : '#60a5fa', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {request.status}
                      </span>
                    </div>
                    <div style={{ color: '#d1d5db', fontSize: '13px', lineHeight: 1.5 }}>
                      Concern: <strong>{request.concern.replace(/_/g, ' ')}</strong>
                      {request.notes ? <span> · {request.notes}</span> : null}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
                      Requested: {formatDate(request.created_at)}
                      {request.matched_user ? ` · Account found: ${request.matched_user.subscription_plan || 'free'}` : ' · No account matched yet'}
                    </div>
                    {request.approval_url && (
                      <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', color: '#bfdbfe', fontSize: '12px', wordBreak: 'break-all' }}>
                        Invite: {request.approval_url}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                      <button
                        onClick={() => handlePilotRequestAction(request.id, 'approve_direct')}
                        disabled={pilotActionSaving !== null || request.status === 'fulfilled'}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: request.matched_user ? '#16a34a' : 'rgba(34,197,94,0.25)', color: '#fff', cursor: pilotActionSaving || request.status === 'fulfilled' ? 'not-allowed' : 'pointer', opacity: request.matched_user ? 1 : 0.65 }}
                      >
                        {pilotActionSaving === directKey ? 'Applying...' : 'Apply Pilot'}
                      </button>
                      <button
                        onClick={() => handlePilotRequestAction(request.id, 'approve_invite')}
                        disabled={pilotActionSaving !== null || request.status === 'fulfilled'}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.12)', color: '#bfdbfe', cursor: pilotActionSaving || request.status === 'fulfilled' ? 'not-allowed' : 'pointer' }}
                      >
                        {pilotActionSaving === inviteKey ? 'Creating...' : 'Create Invite Link'}
                      </button>
                      <button
                        onClick={() => handlePilotRequestAction(request.id, 'decline')}
                        disabled={pilotActionSaving !== null || request.status === 'fulfilled'}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', cursor: pilotActionSaving || request.status === 'fulfilled' ? 'not-allowed' : 'pointer' }}
                      >
                        {pilotActionSaving === declineKey ? 'Declining...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
                      <div style={{ gridColumn: 'span 3' }}>
                        Plan: <span style={{ color: user.subscription_plan === 'fortress' ? '#f59e0b' : user.subscription_plan === 'sentinel' ? '#8b5cf6' : user.subscription_plan === 'guardian' ? '#3b82f6' : '#9ca3af', fontWeight: 600, textTransform: 'capitalize' }}>{user.subscription_plan || 'free'}</span>
                      </div>
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
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => { setGrantingUserId(user.user_id); setGrantAmount(10); }} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '11px', cursor: 'pointer' }}>+ Credits</button>
                          <button onClick={() => handleOpenEdit(user)} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '11px', cursor: 'pointer' }}>✏️</button>
                        </div>
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
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af', fontWeight: 600 }}>Plan</th>
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
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {(() => {
                          const plan = user.subscription_plan;
                          const planMap: Record<string, [string, string]> = {
                            guardian: ['rgba(59,130,246,0.2)', '#3b82f6'],
                            sentinel: ['rgba(139,92,246,0.2)', '#8b5cf6'],
                            fortress: ['rgba(245,158,11,0.2)', '#f59e0b'],
                          };
                          const [bg, clr] = plan && planMap[plan] ? planMap[plan] : ['rgba(156,163,175,0.1)', '#9ca3af'];
                          return (
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: bg, color: clr, border: `1px solid ${clr}40`, textTransform: 'capitalize' }}>
                              {plan || 'free'}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#22c55e' }}>{user.free_credits_total}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af' }}>{user.free_credits_used}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#3b82f6' }}>{user.paid_credits}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: user.total_remaining > 0 ? '#22c55e' : '#ef4444' }}>{user.total_remaining ?? 0}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af' }}>{user.brand_count}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#9ca3af' }}>{user.total_scans}</td>
                      <td style={{ padding: '10px 8px', color: '#9ca3af', fontSize: '12px' }}>{formatDate(user.user_created_at)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          {grantingUserId === user.user_id ? (
                            <>
                              <input
                                type="number" value={grantAmount} onChange={e => setGrantAmount(parseInt(e.target.value) || 1)}
                                style={{ width: '50px', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', textAlign: 'center' }}
                              />
                              <button onClick={() => handleGrantCredits(user.user_id)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: '#22c55e', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>✓</button>
                              <button onClick={() => setGrantingUserId(null)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                            </>
                          ) : (
                            <button onClick={() => { setGrantingUserId(user.user_id); setGrantAmount(10); }} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '11px', cursor: 'pointer' }}>+ Credits</button>
                          )}
                          <button onClick={() => handleOpenEdit(user)} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '11px', cursor: 'pointer' }}>✏️ Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No users found</td></tr>
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
        {activeTab === 'threats' && (
          <div>
            {/* Outreach sub-tab nav */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {([
                { id: 'review',    label: '📋 Review Queue',    desc: 'Approve / reject drafts' },
                { id: 'hunt',      label: '🔍 Find Prospects',  desc: 'AI-powered prospect discovery' },
                { id: 'prospects', label: '👥 All Prospects',   desc: 'Browse + edit prospect records' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setOutreachTab(tab.id)}
                  title={tab.desc}
                  style={{
                    fontSize: 11,
                    padding: '8px 16px',
                    background: outreachTab === tab.id ? 'rgba(74,222,128,0.1)' : 'transparent',
                    border: `1px solid ${outreachTab === tab.id ? 'rgba(74,222,128,0.45)' : 'rgba(74,222,128,0.15)'}`,
                    borderRadius: 6,
                    color: outreachTab === tab.id ? '#4ade80' : '#6b7280',
                    cursor: 'pointer',
                    fontFamily: "'DM Mono',monospace",
                    fontWeight: outreachTab === tab.id ? 'bold' : 'normal',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            {outreachTab === 'review' && <BrandGuardDraftsReview authToken={authToken} />}
          </div>
        )}

        {/* ── SLA Monitor Tab ─────────────────────────────────────────── */}
        {activeTab === 'sla' && (
          <div>
            {/* SLA Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {(() => {
                const s = slaStatus || {};
                const overall = s.overall_status || '—';
                const overallColor = overall === 'healthy' ? '#4ade80' : overall === 'degraded' ? '#f87171' : '#fbbf24';
                return (
                  <>
                    <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 'bold', color: overallColor }}>{overall.toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Overall Status</div>
                    </div>
                    <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 'bold', color: '#4ade80' }}>{s.checks_passed ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>✅ Passed</div>
                    </div>
                    <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 'bold', color: '#f87171' }}>{s.checks_failed ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>❌ Failed</div>
                    </div>
                    <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 'bold', color: '#fff' }}>{s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '—'}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Last Updated</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* SLA Check Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(slaStatus?.checks || []).length === 0 && (
                <div style={{ background: 'rgba(15,15,25,0.8)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                  {slaStatus?.message || 'Loading SLA status...'}
                </div>
              )}
              {(slaStatus?.checks || []).map((check: any) => {
                const isPass = check.status === 'pass';
                const borderColor = isPass ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)';
                const bgColor = isPass ? 'rgba(74,222,128,0.05)' : 'rgba(248,113,113,0.05)';
                return (
                  <div key={check.id} style={{
                    background: bgColor, border: `1px solid ${borderColor}`, borderLeft: `4px solid ${borderColor}`,
                    borderRadius: 12, padding: isMobile ? 14 : 18,
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <div style={{ fontSize: 20, flexShrink: 0 }}>{isPass ? '✅' : '❌'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: isMobile ? 13 : 15, color: '#fff' }}>{check.name}</span>
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, flexShrink: 0,
                          background: isPass ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
                          color: isPass ? '#4ade80' : '#f87171',
                        }}>{isPass ? 'PASS' : 'FAIL'}</span>
                      </div>
                      <div style={{ fontSize: isMobile ? 11 : 12, color: '#6b7280', marginBottom: 6 }}>{check.description}</div>
                      <div style={{ fontSize: isMobile ? 12 : 13, color: '#9ca3af' }}>{check.details}</div>
                      {check.metric !== undefined && check.threshold !== undefined && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                            <span>Current: {check.metric}%</span>
                            <span>Threshold: {check.threshold}%</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${Math.min(100, check.metric)}%`,
                              background: check.metric >= check.threshold ? '#4ade80' : '#f87171',
                              borderRadius: 3, transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                onClick={() => fetchSlaStatus()}
                style={{
                  padding: '10px 24px', background: 'rgba(139,92,246,0.2)',
                  border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8,
                  color: '#a78bfa', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                🔄 Refresh Status
              </button>
              <span style={{ marginLeft: 12, fontSize: 11, color: '#6b7280' }}>Auto-refresh: every 30s</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Account Drawer ────────────────────────────────────────────── */}
      {editAccountState && (() => {
        const eas = editAccountState;
        const PLATFORMS = ['instagram', 'twitter', 'facebook', 'tiktok', 'youtube', 'linkedin', 'threads', 'reddit', 'pinterest', 'discord'];
        const PLAN_OPTIONS = ['free', 'guardian', 'sentinel', 'fortress'];
        const STATUS_OPTIONS = ['active', 'trialing', 'trial_ending', 'canceled', 'paused'];
        const FREQ_OPTIONS = ['realtime', 'daily', 'weekly', 'monthly'];

        const planColor = (p: string | null): [string, string] => {
          if (p === 'fortress') return ['rgba(245,158,11,0.2)', '#f59e0b'];
          if (p === 'sentinel') return ['rgba(139,92,246,0.2)', '#8b5cf6'];
          if (p === 'guardian') return ['rgba(59,130,246,0.2)', '#3b82f6'];
          return ['rgba(156,163,175,0.1)', '#9ca3af'];
        };
        const statusColor = (s: string | null) => {
          if (s === 'active') return '#22c55e';
          if (s === 'trialing') return '#3b82f6';
          if (s === 'trial_ending') return '#f59e0b';
          if (s === 'canceled') return '#ef4444';
          return '#9ca3af';
        };

        const tabs = [
          { id: 'account' as EditSection, label: 'Account' },
          { id: 'brands' as EditSection, label: '🏢 Brands' },
          { id: 'subscription' as EditSection, label: '💎 Subscription' },
          ...(eas.editingBrand ? [{ id: 'brand-details' as EditSection, label: '✏️ Edit Brand' }] : []),
        ];

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end' }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditAccountState(null); }}
          >
            <div style={{ width: isMobile ? '100%' : '520px', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f19', borderLeft: '1px solid rgba(139,92,246,0.3)' }}>

              {/* Drawer Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>Edit Account</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', wordBreak: 'break-all' }}>{eas.user.email}</div>
                </div>
                <button onClick={() => setEditAccountState(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}>✕</button>
              </div>

              {/* Drawer Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(139,92,246,0.2)', overflowX: 'auto', flexShrink: 0 }}>
                {tabs.map(tab => (
                  <button key={tab.id}
                    onClick={() => setEditAccountState(s => s ? { ...s, activeSection: tab.id } : null)}
                    style={{
                      padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                      borderBottom: eas.activeSection === tab.id ? '2px solid #8b5cf6' : '2px solid transparent',
                      color: eas.activeSection === tab.id ? '#fff' : '#9ca3af',
                      fontSize: '13px', fontWeight: 600,
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {eas.loading ? (
                  <div style={{ textAlign: 'center', color: '#8b5cf6', padding: '48px 0', fontSize: '14px' }}>Loading account details...</div>

                ) : eas.activeSection === 'account' ? (
                  <div style={{ display: 'grid', gap: '18px' }}>
                    <div>
                      <label htmlFor="admin-pilot-promo" style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pilot promo code</label>
                      <input
                        id="admin-pilot-promo"
                        type="text"
                        value={eas.promoCodeDraft}
                        onChange={e => setEditAccountState(s => s ? { ...s, promoCodeDraft: e.target.value.toUpperCase() } : null)}
                        placeholder="BGPILOT30"
                        autoComplete="off"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px', textTransform: 'uppercase', boxSizing: 'border-box' }}
                      />
                      <div style={{ color: '#9ca3af', fontSize: '12px', lineHeight: 1.5, marginTop: '7px' }}>
                        Add BGPILOT30 to start a one-time 30-day Fortress pilot now. Clear the field to end an active pilot immediately.
                      </div>
                    </div>

                    {eas.pilot && (
                      <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                          <strong style={{ color: '#fff', fontSize: '13px' }}>Pilot history</strong>
                          <span style={{ color: statusColor(eas.pilot.status), fontSize: '12px', fontWeight: 700, textTransform: 'capitalize' }}>{eas.pilot.status}</span>
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '12px', lineHeight: 1.7 }}>Started: {formatDate(eas.pilot.started_at)}</div>
                        <div style={{ color: '#9ca3af', fontSize: '12px', lineHeight: 1.7 }}>Ends: {formatDate(eas.pilot.ends_at)}</div>
                        <div style={{ color: '#9ca3af', fontSize: '12px', lineHeight: 1.7 }}>Source: {eas.pilot.source}</div>
                        {eas.pilot.status !== 'active' && <div style={{ color: '#f59e0b', fontSize: '12px', marginTop: '7px' }}>This account cannot reuse the one-time pilot code.</div>}
                      </div>
                    )}

                    <button
                      onClick={handleUpdatePilot}
                      disabled={editingSaving || (!!eas.promoCodeDraft.trim() && eas.promoCodeDraft.trim().toUpperCase() !== 'BGPILOT30')}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: editingSaving || (!!eas.promoCodeDraft.trim() && eas.promoCodeDraft.trim().toUpperCase() !== 'BGPILOT30') ? 0.5 : 1 }}
                    >
                      {editingSaving ? 'Saving...' : eas.promoCodeDraft.trim() ? 'Apply Pilot Code' : 'Remove Pilot Code'}
                    </button>
                  </div>

                ) : eas.activeSection === 'brands' ? (
                  /* ── Brands list ───────────────────────────────────────── */
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {eas.brands.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏢</div>
                        <div>No brands registered</div>
                      </div>
                    ) : eas.brands.map(brand => (
                      <div key={brand.id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{brand.brand_name}</div>
                            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                              {brand.brand_handle && <span>@{brand.brand_handle}</span>}
                              {brand.brand_domain && <span style={{ marginLeft: brand.brand_handle ? '8px' : 0 }}>🌐 {brand.brand_domain}</span>}
                            </div>
                          </div>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, flexShrink: 0, background: brand.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.1)', color: brand.is_active ? '#22c55e' : '#9ca3af', border: `1px solid ${brand.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(156,163,175,0.2)'}` }}>
                            {brand.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {brand.platforms && brand.platforms.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>📱 {brand.platforms.join(', ')}</div>
                        )}
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
                          Freq: {brand.scan_frequency || 'daily'} · Scans: {brand.scan_count}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setEditAccountState(s => s ? { ...s, editingBrand: { ...brand }, activeSection: 'brand-details' } : null)}
                            style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                          >
                            ✏️ Edit Details
                          </button>
                          <button
                            onClick={() => handleDeleteBrand(brand.id)}
                            disabled={editingSaving}
                            style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 500, opacity: editingSaving ? 0.5 : 1 }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                ) : eas.activeSection === 'subscription' ? (
                  /* ── Subscription ──────────────────────────────────────── */
                  eas.subscription && eas.subscriptionDraft ? (() => {
                    const sub = eas.subscription!;
                    const draft = eas.subscriptionDraft!;
                    const [planBg, planClr] = planColor(sub.plan_id);
                    return (
                      <div style={{ display: 'grid', gap: '16px' }}>
                        {/* Current subscription info */}
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: planBg, color: planClr, border: `1px solid ${planClr}40`, textTransform: 'capitalize' }}>{sub.plan_id}</span>
                            <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: `${statusColor(sub.status)}20`, color: statusColor(sub.status), border: `1px solid ${statusColor(sub.status)}40`, textTransform: 'capitalize' }}>{sub.status.replace(/_/g, ' ')}</span>
                            {sub.cancel_at_period_end && <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>Cancels at period end</span>}
                          </div>
                          {sub.current_period_end && <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Period ends: {formatDate(sub.current_period_end)}</div>}
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>Credits/mo: {sub.monthly_credits_included}</div>
                        </div>

                        {/* Edit fields */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan</label>
                          <select
                            value={draft.plan_id}
                            onChange={e => setEditAccountState(s => s ? { ...s, subscriptionDraft: { ...s.subscriptionDraft!, plan_id: e.target.value } } : null)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px' }}
                          >
                            {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                          <select
                            value={draft.status}
                            onChange={e => setEditAccountState(s => s ? { ...s, subscriptionDraft: { ...s.subscriptionDraft!, status: e.target.value } } : null)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px' }}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            id="cancel-eop"
                            checked={draft.cancel_at_period_end}
                            onChange={e => setEditAccountState(s => s ? { ...s, subscriptionDraft: { ...s.subscriptionDraft!, cancel_at_period_end: e.target.checked } } : null)}
                            style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                          />
                          <label htmlFor="cancel-eop" style={{ fontSize: '13px', color: '#d1d5db', cursor: 'pointer' }}>Cancel at period end</label>
                        </div>
                        <button
                          onClick={() => handleUpdateSubscription(sub.id, draft)}
                          disabled={editingSaving}
                          style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: editingSaving ? 0.6 : 1 }}
                        >
                          {editingSaving ? 'Saving...' : 'Save Changes'}
                        </button>

                        {/* Danger zone */}
                        <div style={{ borderTop: '1px solid rgba(239,68,68,0.15)', paddingTop: '16px' }}>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Danger Zone</div>
                          <button
                            onClick={() => handleDeleteSubscription(sub.id)}
                            disabled={editingSaving}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: editingSaving ? 0.6 : 1 }}
                          >
                            🗑️ Remove Subscription
                          </button>
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>💎</div>
                      <div style={{ fontSize: '14px' }}>No active subscription</div>
                      <div style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>This user is on the free plan</div>
                    </div>
                  )

                ) : eas.activeSection === 'brand-details' && eas.editingBrand ? (() => {
                  /* ── Brand Details Editor ──────────────────────────────── */
                  const brand = eas.editingBrand!;
                  const updateField = (field: string, value: unknown) =>
                    setEditAccountState(s => s ? { ...s, editingBrand: { ...s.editingBrand!, [field]: value } } : null);
                  const togglePlatform = (p: string) =>
                    setEditAccountState(s => {
                      if (!s || !s.editingBrand) return null;
                      const curr = s.editingBrand.platforms || [];
                      return { ...s, editingBrand: { ...s.editingBrand, platforms: curr.includes(p) ? curr.filter(x => x !== p) : [...curr, p] } };
                    });

                  return (
                    <div style={{ display: 'grid', gap: '16px' }}>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        Editing: <strong style={{ color: '#c4b5fd' }}>{brand.brand_name}</strong>
                      </div>

                      {[
                        { field: 'brand_name', label: 'Brand Name', placeholder: 'Acme Corp' },
                        { field: 'brand_handle', label: 'Brand Handle', placeholder: 'acmecorp' },
                        { field: 'brand_domain', label: 'Brand Domain', placeholder: 'acme.com' },
                      ].map(({ field, label, placeholder }) => (
                        <div key={field}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                          <input
                            type="text"
                            value={(brand as unknown as Record<string, string>)[field] || ''}
                            onChange={e => updateField(field, e.target.value)}
                            placeholder={placeholder}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platforms</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {PLATFORMS.map(p => {
                            const active = brand.platforms?.includes(p);
                            return (
                              <button key={p} onClick={() => togglePlatform(p)} style={{ padding: '4px 12px', borderRadius: '20px', border: `1px solid ${active ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)', color: active ? '#c4b5fd' : '#9ca3af', fontSize: '12px', cursor: 'pointer', fontWeight: active ? 600 : 400, textTransform: 'capitalize' }}>
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scan Frequency</label>
                        <select
                          value={brand.scan_frequency || 'daily'}
                          onChange={e => updateField('scan_frequency', e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '14px' }}
                        >
                          {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={handleSaveBrand}
                          disabled={editingSaving}
                          style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: editingSaving ? 0.6 : 1 }}
                        >
                          {editingSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => setEditAccountState(s => s ? { ...s, activeSection: 'brands' } : null)}
                          style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', background: 'transparent', color: '#9ca3af', fontSize: '14px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default BrandGuardAdminPage;
