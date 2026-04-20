/**
 * Authentication Context Provider
 * 
 * Manages user authentication state via:
 * - Email/password (Supabase or localStorage fallback)
 * - Wallet connect (Solana wallet adapter)
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  supabase,
  signUpWithEmail,
  signInWithEmail,
  signOut,
  getCurrentUser,
  getUserProfile,
  linkWalletToUser,
  UserProfile,
} from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  // User state
  user: UserProfile | null;
  email: string | null;
  walletAddress: string | null;
  isAuthenticated: boolean;
  authMethod: 'email' | 'wallet' | null;
  
  // Loading states
  loading: boolean;
  
  // Auth actions
  loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  registerWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  loginWithWallet: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  
  // Wallet linking
  linkWallet: () => Promise<{ error: string | null }>;
  
  // Scan tracking
  scanCredits: number;
  freeScansRemaining: number;
  useScanCredit: () => boolean;
  addScanCredits: (amount: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, connect, disconnect } = useWallet();
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanCredits, setScanCredits] = useState(0);
  const [freeScansRemaining, setFreeScansRemaining] = useState(3);

  // Get storage key for current user
  const getStorageKey = useCallback(() => {
    if (user?.id) return user.id;
    if (user?.email) return user.email;
    if (publicKey) return publicKey.toBase58();
    return 'anonymous';
  }, [user, publicKey]);

  // Load credits from storage
  useEffect(() => {
    const key = getStorageKey();
    const storedCredits = localStorage.getItem(`agenticbro_credits_${key}`);
    const storedFree = localStorage.getItem(`agenticbro_free_${key}`);
    
    if (storedCredits) {
      setScanCredits(parseInt(storedCredits, 10) || 0);
    }
    if (storedFree) {
      setFreeScansRemaining(Math.max(0, parseInt(storedFree, 10)));
    } else {
      // New user gets 10 free scans
      setFreeScansRemaining(3);
      localStorage.setItem(`agenticbro_free_${key}`, '5');
    }
  }, [getStorageKey]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      
      try {
        // Check for wallet session
        if (connected && publicKey) {
          const walletAddr = publicKey.toBase58();
          const storedUser = localStorage.getItem(`agenticbro_wallet_${walletAddr}`);
          
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          } else {
            // Create new wallet user
            const newUser: UserProfile = {
              id: `wallet_${walletAddr}`,
              wallet_address: walletAddr,
              scan_credits: 0,
              free_scans_used: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            localStorage.setItem(`agenticbro_wallet_${walletAddr}`, JSON.stringify(newUser));
            setUser(newUser);
          }
        }
        // Check for email session
        else if (supabase) {
          const currentUser = await getCurrentUser();
          if (currentUser) {
            const profile = await getUserProfile(currentUser.id);
            setUser(profile);
          }
        }
        // Check localStorage fallback
        else {
          const storedUser = localStorage.getItem('agenticbro_current_user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      }
      
      setLoading(false);
    };

    checkSession();
  }, [connected, publicKey]);

  // Sync wallet connection changes
  useEffect(() => {
    if (connected && publicKey && !user) {
      // Wallet connected but no user - create wallet user
      const walletAddr = publicKey.toBase58();
      const newUser: UserProfile = {
        id: `wallet_${walletAddr}`,
        wallet_address: walletAddr,
        scan_credits: 0,
        free_scans_used: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(`agenticbro_wallet_${walletAddr}`, JSON.stringify(newUser));
      setUser(newUser);
    }
  }, [connected, publicKey, user]);

  // ─── Auth Actions ────────────────────────────────────────────────────────────

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    try {
      const { user: authUser, error } = await signInWithEmail(email, password);
      
      if (error) {
        setLoading(false);
        return { error: typeof error === 'string' ? error : error.message };
      }

      if (authUser) {
        let profile: UserProfile | null = null;
        
        if (supabase) {
          profile = await getUserProfile(authUser.id);
        }
        
        if (!profile) {
          profile = {
            id: authUser.id,
            email: authUser.email || email,
            scan_credits: 0,
            free_scans_used: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        
        setUser(profile);
        localStorage.setItem('agenticbro_current_user', JSON.stringify(profile));
      }
      
      setLoading(false);
      return { error: null };
    } catch (err) {
      setLoading(false);
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    try {
      const { user: authUser, error } = await signUpWithEmail(email, password);
      
      if (error) {
        setLoading(false);
        return { error: typeof error === 'string' ? error : error.message };
      }

      if (authUser) {
        const profile: UserProfile = {
          id: authUser.id,
          email: authUser.email || email,
          scan_credits: 0,
          free_scans_used: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setUser(profile);
        localStorage.setItem('agenticbro_current_user', JSON.stringify(profile));
      }
      
      setLoading(false);
      return { error: null };
    } catch (err) {
      setLoading(false);
      return { error: err instanceof Error ? err.message : 'Registration failed' };
    }
  }, []);

  const loginWithWallet = useCallback(async () => {
    try {
      await connect();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Wallet connection failed' };
    }
  }, [connect]);

  const logout = useCallback(async () => {
    if (supabase) {
      await signOut();
    }
    
    if (connected) {
      await disconnect();
    }
    
    localStorage.removeItem('agenticbro_current_user');
    setUser(null);
    setScanCredits(0);
    setFreeScansRemaining(3);
  }, [connected, disconnect]);

  const linkWallet = useCallback(async () => {
    if (!user || !publicKey) {
      return { error: 'No user or wallet connected' };
    }

    try {
      const walletAddr = publicKey.toBase58();
      
      if (supabase) {
        await linkWalletToUser(user.id, walletAddr);
      }
      
      const updatedUser = {
        ...user,
        wallet_address: walletAddr,
        updated_at: new Date().toISOString(),
      };
      
      setUser(updatedUser);
      localStorage.setItem('agenticbro_current_user', JSON.stringify(updatedUser));
      
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to link wallet' };
    }
  }, [user, publicKey]);

  // ─── Scan Credits ────────────────────────────────────────────────────────────

  const useScanCredit = useCallback((): boolean => {
    const key = getStorageKey();
    
    // Try free scans first
    if (freeScansRemaining > 0) {
      const newFree = freeScansRemaining - 1;
      setFreeScansRemaining(newFree);
      localStorage.setItem(`agenticbro_free_${key}`, String(newFree));
      return true;
    }
    
    // Use paid credits
    if (scanCredits > 0) {
      const newCredits = scanCredits - 1;
      setScanCredits(newCredits);
      localStorage.setItem(`agenticbro_credits_${key}`, String(newCredits));
      return true;
    }
    
    return false;
  }, [freeScansRemaining, scanCredits, getStorageKey]);

  const addScanCredits = useCallback((amount: number) => {
    const key = getStorageKey();
    const newCredits = scanCredits + amount;
    setScanCredits(newCredits);
    localStorage.setItem(`agenticbro_credits_${key}`, String(newCredits));
  }, [scanCredits, getStorageKey]);

  // ─── Context Value ───────────────────────────────────────────────────────────

  const value: AuthContextType = {
    user,
    email: user?.email || null,
    walletAddress: user?.wallet_address || (publicKey?.toBase58() || null),
    isAuthenticated: !!user || !!publicKey,
    authMethod: user?.email ? 'email' : (publicKey ? 'wallet' : null),
    loading,
    loginWithEmail,
    registerWithEmail,
    loginWithWallet,
    logout,
    linkWallet,
    scanCredits,
    freeScansRemaining,
    useScanCredit,
    addScanCredits,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}