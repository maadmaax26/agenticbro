/**
 * useApprovalManager.ts — Manage Active Approvals Hook
 * 
 * Tracks and manages active wallet approvals:
 * - View all active approvals
 * - Revoke individual approvals
 * - Approval history
 */

import { useState, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Approval {
  id: string;
  domain: string;
  address: PublicKey;
  authority: string;
  amount: number | 'unlimited';
  token?: string;
  tokenSymbol?: string;
  timestamp: number;
  expiresAt?: number;
  revoked: boolean;
  revokedAt?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ApprovalHistory {
  id: string;
  approval: Approval;
  action: 'created' | 'used' | 'revoked';
  timestamp: number;
  transactionId?: string;
}

export interface ApprovalStats {
  totalActive: number;
  byDomain: Record<string, number>;
  byToken: Record<string, number>;
  unlimitedApprovals: number;
  highRiskApprovals: number;
}

// ─── Storage Keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'agentic_bro_approvals';
const HISTORY_KEY = 'agentic_bro_approval_history';

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useApprovalManager() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load from Storage ────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const historyStored = localStorage.getItem(HISTORY_KEY);

        if (stored) {
          const parsed = JSON.parse(stored);
          setApprovals(
            parsed.map((a: Approval) => ({
              ...a,
              address: new PublicKey(a.address),
            }))
          );
        }

        if (historyStored) {
          setHistory(JSON.parse(historyStored));
        }
      } catch (error) {
        console.error('Failed to load approvals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromStorage();
  }, []);

  // ── Save to Storage ──────────────────────────────────────────────────────────────

  const saveToStorage = useCallback((approvals: Approval[], history: ApprovalHistory[]) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          approvals.map((a) => ({
            ...a,
            address: a.address.toBase58(),
          }))
        )
      );
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save approvals:', error);
    }
  }, []);

  // ── Add Approval ──────────────────────────────────────────────────────────────────

  const addApproval = useCallback(
    (approval: Omit<Approval, 'id' | 'timestamp' | 'revoked'>): Approval => {
      const newApproval: Approval = {
        ...approval,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        revoked: false,
      };

      const historyEntry: ApprovalHistory = {
        id: crypto.randomUUID(),
        approval: newApproval,
        action: 'created',
        timestamp: Date.now(),
      };

      setApprovals((prev) => {
        const next = [...prev, newApproval];
        saveToStorage(next, [...history, historyEntry]);
        return next;
      });

      setHistory((prev) => [...prev, historyEntry]);

      return newApproval;
    },
    [history, saveToStorage]
  );

  // ── Revoke Approval ────────────────────────────────────────────────────────────────

  const revokeApproval = useCallback(
    (id: string): boolean => {
      const approval = approvals.find((a) => a.id === id);
      if (!approval || approval.revoked) {
        return false;
      }

      const revokedApproval: Approval = {
        ...approval,
        revoked: true,
        revokedAt: Date.now(),
      };

      const historyEntry: ApprovalHistory = {
        id: crypto.randomUUID(),
        approval: revokedApproval,
        action: 'revoked',
        timestamp: Date.now(),
      };

      setApprovals((prev) => {
        const next = prev.map((a) => (a.id === id ? revokedApproval : a));
        saveToStorage(next, [...history, historyEntry]);
        return next;
      });

      setHistory((prev) => [...prev, historyEntry]);

      return true;
    },
    [approvals, history, saveToStorage]
  );

  // ── Revoke All for Domain ──────────────────────────────────────────────────────────

  const revokeAllForDomain = useCallback(
    (domain: string): number => {
      let count = 0;

      setApprovals((prev) => {
        const next = prev.map((a) => {
          if (a.domain === domain && !a.revoked) {
            count++;
            return {
              ...a,
              revoked: true,
              revokedAt: Date.now(),
            };
          }
          return a;
        });

        saveToStorage(next, history);
        return next;
      });

      return count;
    },
    [history, saveToStorage]
  );

  // ── Get Active Approvals ────────────────────────────────────────────────────────────

  const getActiveApprovals = useCallback((): Approval[] => {
    return approvals.filter((a) => !a.revoked);
  }, [approvals]);

  // ── Get Stats ──────────────────────────────────────────────────────────────────────

  const getStats = useCallback((): ApprovalStats => {
    const active = approvals.filter((a) => !a.revoked);

    return {
      totalActive: active.length,
      byDomain: active.reduce(
        (acc, a) => {
          acc[a.domain] = (acc[a.domain] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      byToken: active.reduce(
        (acc, a) => {
          if (a.tokenSymbol) {
            acc[a.tokenSymbol] = (acc[a.tokenSymbol] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      ),
      unlimitedApprovals: active.filter((a) => a.amount === 'unlimited').length,
      highRiskApprovals: active.filter((a) => a.riskLevel === 'high').length,
    };
  }, [approvals]);

  // ── Get History ─────────────────────────────────────────────────────────────────────

  const getHistory = useCallback(
    (limit = 50): ApprovalHistory[] => {
      return history.slice(-limit).reverse();
    },
    [history]
  );

  // ── Clear All ──────────────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setApprovals([]);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────────────

  return {
    approvals,
    history,
    isLoading,
    addApproval,
    revokeApproval,
    revokeAllForDomain,
    getActiveApprovals,
    getStats,
    getHistory,
    clearAll,
  };
}

export default useApprovalManager;