/**
 * Supabase Client for Authentication and Database
 * 
 * Setup Instructions:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Get your project URL and anon key from Project Settings → API
 * 3. Add to .env.local:
 *    VITE_SUPABASE_URL=your-project-url
 *    VITE_SUPABASE_ANON_KEY=your-anon-key
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://drvasofyghnxfxvkkwad.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using local storage fallback.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email?: string;
  wallet_address?: string;
  scan_credits: number;
  free_scans_used: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'purchase' | 'usage' | 'refund' | 'bonus';
  payment_method?: 'stripe' | 'crypto';
  stripe_payment_intent_id?: string;
  created_at: string;
}

// ─── Scan Result Types ─────────────────────────────────────────────────────────

export interface ScanResult {
  id?: string;
  username: string;
  platform: 'X' | 'Telegram';
  risk_score: number;
  red_flags: string[];
  verification_level?: string;
  scam_type?: string;
  recommended_action?: string;
  full_report?: string;
  x_profile?: Record<string, unknown>;
  victim_reports?: Record<string, unknown>;
  known_scammer_match?: Record<string, unknown>;
  evidence: string[];
  data_source?: string;
  wallet_address?: string;
  scanned_at?: string;
}

export interface KnownScammer {
  id?: string;
  platform: string;
  username: string;
  display_name?: string;
  x_handle?: string;
  telegram_channel?: string;
  scam_type?: string;
  victim_count?: number;
  total_lost_usd?: string;
  verification_level?: string;
  threat_level?: string;
  status?: string;
  notes?: string;
  banned?: boolean;
  created_at?: string;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) {
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('agenticbro_users') || '[]');
    const existingUser = users.find((u: any) => u.email === email);
    if (existingUser) {
      throw new Error('User already exists');
    }
    const newUser = {
      id: `local_${Date.now()}`,
      email,
      scan_credits: 0,
      free_scans_used: 0,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem('agenticbro_users', JSON.stringify(users));
    localStorage.setItem('agenticbro_current_user', JSON.stringify(newUser));
    return { user: newUser, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) return { user: null, error };
  
  // Create profile with 3 free scans
  if (data.user) {
    await supabase.from('user_profiles').insert({
      id: data.user.id,
      email: data.user.email,
      scan_credits: 0,
      free_scans_used: 0,
    });
  }
  
  return { user: data.user, error: null };
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('agenticbro_users') || '[]');
    const user = users.find((u: any) => u.email === email);
    if (!user) {
      return { user: null, error: { message: 'User not found' } };
    }
    localStorage.setItem('agenticbro_current_user', JSON.stringify(user));
    return { user, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { user: data?.user || null, error };
}

export async function signOut() {
  if (!supabase) {
    localStorage.removeItem('agenticbro_current_user');
    return;
  }
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) {
    const user = localStorage.getItem('agenticbro_current_user');
    return user ? JSON.parse(user) : null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) {
    const user = localStorage.getItem('agenticbro_current_user');
    return user ? JSON.parse(user) : null;
  }

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  return data;
}

export async function updateUserCredits(userId: string, creditsToAdd: number) {
  if (!supabase) {
    const user = JSON.parse(localStorage.getItem('agenticbro_current_user') || '{}');
    user.scan_credits = (user.scan_credits || 0) + creditsToAdd;
    localStorage.setItem('agenticbro_current_user', JSON.stringify(user));
    
    // Also update in users list
    const users = JSON.parse(localStorage.getItem('agenticbro_users') || '[]');
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx >= 0) {
      users[idx] = user;
      localStorage.setItem('agenticbro_users', JSON.stringify(users));
    }
    return user;
  }

  await supabase.rpc('add_scan_credits', {
    user_id: userId,
    credits: creditsToAdd,
  });
}

export async function decrementFreeScans(userId: string) {
  if (!supabase) {
    const user = JSON.parse(localStorage.getItem('agenticbro_current_user') || '{}');
    user.free_scans_used = (user.free_scans_used || 0) + 1;
    localStorage.setItem('agenticbro_current_user', JSON.stringify(user));
    
    const users = JSON.parse(localStorage.getItem('agenticbro_users') || '[]');
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx >= 0) {
      users[idx] = user;
      localStorage.setItem('agenticbro_users', JSON.stringify(users));
    }
    return user;
  }

  await supabase.rpc('increment_free_scans_used', {
    user_id: userId,
  });
}

export async function decrementScanCredits(userId: string) {
  if (!supabase) {
    const user = JSON.parse(localStorage.getItem('agenticbro_current_user') || '{}');
    if (user.scan_credits > 0) {
      user.scan_credits -= 1;
      localStorage.setItem('agenticbro_current_user', JSON.stringify(user));
      
      const users = JSON.parse(localStorage.getItem('agenticbro_users') || '[]');
      const idx = users.findIndex((u: any) => u.id === userId);
      if (idx >= 0) {
        users[idx] = user;
        localStorage.setItem('agenticbro_users', JSON.stringify(users));
      }
    }
    return user;
  }

  await supabase.rpc('decrement_scan_credits', {
    user_id: userId,
  });
}

export async function linkWalletToUser(userId: string, walletAddress: string) {
  if (!supabase) {
    const user = JSON.parse(localStorage.getItem('agenticbro_current_user') || '{}');
    user.wallet_address = walletAddress;
    localStorage.setItem('agenticbro_current_user', JSON.stringify(user));
    
    const users = JSON.parse(localStorage.getItem('agenticbro_users') || '[]');
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx >= 0) {
      users[idx] = user;
      localStorage.setItem('agenticbro_users', JSON.stringify(users));
    }
    return user;
  }

  await supabase
    .from('user_profiles')
    .update({ wallet_address: walletAddress })
    .eq('id', userId);
}

// ─── Scan Results (frontend helpers) ──────────────────────────────────────────

/**
 * Fetch recent scan results for a given wallet address or username.
 * Falls back to an empty array when Supabase is not configured.
 */
export async function getScanResults(opts: {
  walletAddress?: string;
  username?: string;
  limit?: number;
}): Promise<ScanResult[]> {
  if (!supabase) return [];

  const { walletAddress, username, limit = 50 } = opts;

  let query = supabase
    .from('scan_results')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (walletAddress) {
    query = query.eq('wallet_address', walletAddress);
  }
  if (username) {
    query = query.ilike('username', username.replace(/^@/, ''));
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Supabase] getScanResults error:', error.message);
    return [];
  }

  return (data as ScanResult[]) ?? [];
}

/**
 * Look up a username in the known_scammers table.
 * Useful for quick frontend checks without hitting the backend.
 */
export async function lookupKnownScammer(username: string): Promise<KnownScammer | null> {
  if (!supabase) return null;

  const clean = username.replace(/^@/, '').toLowerCase();

  const { data, error } = await supabase
    .from('known_scammers')
    .select('*')
    .or(`username.ilike.${clean},x_handle.ilike.%${clean}%,telegram_channel.ilike.%${clean}%`)
    .neq('status', 'suspended')
    .limit(1);

  if (error) {
    console.error('[Supabase] lookupKnownScammer error:', error.message);
    return null;
  }

  return (data?.[0] as KnownScammer) ?? null;
}

// Get user by email or wallet
export async function getUserByIdentifier(identifier: string): Promise<UserProfile | null> {
  if (!supabase) {
    const users = JSON.parse(localStorage.getItem('agenticbro_users') || '[]');
    return users.find((u: any) => u.email === identifier || u.wallet_address === identifier) || null;
  }

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .or(`email.eq.${identifier},wallet_address.eq.${identifier}`)
    .single();
  
  return data;
}