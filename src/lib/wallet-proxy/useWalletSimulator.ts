/**
 * useWalletSimulator.ts — State Management Hook
 * 
 * Manages the wallet simulator state including:
 * - Connection status
 * - Pending transactions
 * - Transaction history
 * - Risk assessments
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { WalletProxyProvider, TransactionDecision } from './WalletProxyProvider';
import type { ParsedTransaction } from './TransactionParser';
import { RiskEngine } from './RiskEngine';
import type { EnhancedRiskAssessment } from './RiskEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimulatorMode = 
  | 'enter_url' 
  | 'browsing' 
  | 'connection_request' 
  | 'transaction_pending';

export interface ConnectionRequest {
  origin: string;
  timestamp: number;
}

export interface TransactionRequest {
  id: string;
  transaction: ParsedTransaction;
  risk: EnhancedRiskAssessment;
  url: string;
  timestamp: number;
  resolve: (decision: TransactionDecision) => void;
}

export interface TransactionRecord {
  id: string;
  transaction: ParsedTransaction;
  risk: EnhancedRiskAssessment;
  decision: 'approved' | 'rejected' | 'blocked';
  url: string;
  timestamp: number;
}

export interface WalletSimulatorState {
  mode: SimulatorMode;
  url: string;
  isConnected: boolean;
  connectedAddress: PublicKey | null;
  pendingConnection: ConnectionRequest | null;
  pendingTransaction: TransactionRequest | null;
  transactionHistory: TransactionRecord[];
  error: string | null;
}

export interface WalletSimulatorActions {
  navigate: (url: string) => void;
  goBack: () => void;
  approveConnection: () => Promise<void>;
  rejectConnection: () => void;
  approveTransaction: () => Promise<void>;
  rejectTransaction: () => void;
  clearError: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useWalletSimulator() {
  const [state, setState] = useState<WalletSimulatorState>({
    mode: 'enter_url',
    url: '',
    isConnected: false,
    connectedAddress: null,
    pendingConnection: null,
    pendingTransaction: null,
    transactionHistory: [],
    error: null,
  });

  const walletProxyRef = useRef<WalletProxyProvider | null>(null);
  const pendingResolveRef = useRef<((decision: TransactionDecision) => void) | null>(null);

  // ── Initialize Wallet Proxy ──────────────────────────────────────────────────────

  useEffect(() => {
    const _riskEngine = new RiskEngine(); // Used for risk assessment

    walletProxyRef.current = new WalletProxyProvider({
      realWallet: null, // Demo mode
      onConnectionRequest: async (origin: string) => {
        return new Promise((resolve) => {
          setState((prev) => ({
            ...prev,
            mode: 'connection_request',
            pendingConnection: {
              origin,
              timestamp: Date.now(),
            },
          }));
          pendingResolveRef.current = (decision) => {
            resolve(decision === 'approve');
          };
        });
      },
      onTransactionRequest: async (tx: ParsedTransaction, risk: EnhancedRiskAssessment) => {
        return new Promise((resolve) => {
          setState((prev) => ({
            ...prev,
            mode: 'transaction_pending',
            pendingTransaction: {
              id: crypto.randomUUID(),
              transaction: tx,
              risk,
              url: prev.url,
              timestamp: Date.now(),
              resolve,
            },
          }));
        });
      },
      onBlockedTransaction: (tx: ParsedTransaction, risk: EnhancedRiskAssessment) => {
        // Log blocked transaction
        // _tx is parsed transaction, _risk is risk assessment
        console.warn('[WalletSimulator] Blocked transaction:', {
          riskScore: risk.score,
          flags: risk.flags,
        });
      },
    });

    return () => {
      walletProxyRef.current = null;
    };
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────────────

  const navigate = useCallback((url: string) => {
    // Validate URL
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setState((prev) => ({ ...prev, error: 'Only HTTP/HTTPS URLs allowed' }));
        return;
      }
    } catch {
      setState((prev) => ({ ...prev, error: 'Invalid URL format' }));
      return;
    }

    setState((prev) => ({
      ...prev,
      mode: 'browsing',
      url: url.startsWith('http') ? url : `https://${url}`,
      error: null,
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mode: 'enter_url',
      url: '',
      isConnected: false,
      connectedAddress: null,
      pendingConnection: null,
      pendingTransaction: null,
    }));
  }, []);

  // ── Connection ────────────────────────────────────────────────────────────────────

  const approveConnection = useCallback(async () => {
    if (!pendingResolveRef.current) return;

    pendingResolveRef.current('approve');
    pendingResolveRef.current = null;

    // Demo address
    const demoAddress = new PublicKey('DemoWallet11111111111111111111111111111111111');

    setState((prev) => ({
      ...prev,
      mode: 'browsing',
      isConnected: true,
      connectedAddress: demoAddress,
      pendingConnection: null,
    }));
  }, []);

  const rejectConnection = useCallback(() => {
    if (!pendingResolveRef.current) return;

    pendingResolveRef.current('reject');
    pendingResolveRef.current = null;

    setState((prev) => ({
      ...prev,
      mode: 'browsing',
      pendingConnection: null,
    }));
  }, []);

  // ── Transaction ─────────────────────────────────────────────────────────────────────

  const approveTransaction = useCallback(async () => {
    if (!state.pendingTransaction) return;

    const { transaction, risk, resolve } = state.pendingTransaction;
    const decision = risk.level === 'CRITICAL' ? 'block' : 'approve';

    resolve(decision);

    const record: TransactionRecord = {
      id: crypto.randomUUID(),
      transaction,
      risk,
      decision: decision === 'block' ? 'blocked' : 'approved',
      url: state.url,
      timestamp: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      mode: 'browsing',
      pendingTransaction: null,
      transactionHistory: [record, ...prev.transactionHistory].slice(0, 100),
    }));
  }, [state.pendingTransaction, state.url]);

  const rejectTransaction = useCallback(() => {
    if (!state.pendingTransaction) return;

    const { transaction, risk, resolve } = state.pendingTransaction;

    resolve('reject');

    const record: TransactionRecord = {
      id: crypto.randomUUID(),
      transaction,
      risk,
      decision: 'rejected',
      url: state.url,
      timestamp: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      mode: 'browsing',
      pendingTransaction: null,
      transactionHistory: [record, ...prev.transactionHistory].slice(0, 100),
    }));
  }, [state.pendingTransaction, state.url]);

  // ── Error Handling ────────────────────────────────────────────────────────────────

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────────────

  return {
    state,
    actions: {
      navigate,
      goBack,
      approveConnection,
      rejectConnection,
      approveTransaction,
      rejectTransaction,
      clearError,
    },
    walletProxy: walletProxyRef.current,
  };
}

export default useWalletSimulator;