/**
 * WalletProxyProvider.ts — Mock Wallet Adapter
 * 
 * This is the key innovation: a mock Solana wallet provider that intercepts
 * all wallet calls and routes them through our analyzer before signing.
 * 
 * Flow:
 * 1. dApp calls window.solana.connect() → We show connection modal
 * 2. dApp calls window.solana.signTransaction() → We parse + analyze
 * 3. User approves → Forward to real wallet (Phantom/Solflare)
 * 4. User rejects → Throw error to dApp
 */

import {
  WalletAdapter,
  WalletNotReadyError,
  WalletName,
} from '@solana/wallet-adapter-base';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { parseTransaction } from './TransactionParser';
import type { ParsedTransaction } from './TransactionParser';
import type { EnhancedRiskAssessment } from './RiskEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletProxyConfig {
  realWallet: WalletAdapter | null;
  onConnectionRequest?: (origin: string) => Promise<boolean>;
  onTransactionRequest?: (tx: ParsedTransaction, risk: EnhancedRiskAssessment) => Promise<'approve' | 'reject' | 'block'>;
  onBlockedTransaction?: (tx: ParsedTransaction, risk: EnhancedRiskAssessment) => void;
  autoApproveThreshold?: number; // Default: 2 (0-2 = auto-approve)
}

export type TransactionDecision = 'approve' | 'reject' | 'block';

export interface PendingRequest {
  id: string;
  type: 'connection' | 'sign' | 'signAndSend' | 'signAll';
  origin: string;
  payload: unknown;
  timestamp: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

// ─── Wallet Proxy Provider ──────────────────────────────────────────────────────

export class WalletProxyProvider implements WalletAdapter {
  // WalletAdapter properties
  public name: WalletName = 'Agentic Bro Wallet Guard' as WalletName;
  public icon = '/agenticbro-icon.png';
  public url = 'https://agenticbro.app';
  public readyState = 'Installed' as const;
  public supportedTransactionVersions = new Set(['legacy', 0]);

  // Reactive state
  public connected = false;
  public connecting = false;
  public publicKey: PublicKey | null = null;

  // Internal state
  private realWallet: WalletAdapter | null;
  private autoApproveThreshold: number;
  
  // Callbacks
  private onConnectionRequest?: WalletProxyConfig['onConnectionRequest'];
  private onTransactionRequest?: WalletProxyConfig['onTransactionRequest'];
  private onBlockedTransaction?: WalletProxyConfig['onBlockedTransaction'];

  // Event listeners
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  // ─── Constructor ────────────────────────────────────────────────────────────────

  constructor(config: WalletProxyConfig) {
    this.realWallet = config.realWallet;
    this.autoApproveThreshold = config.autoApproveThreshold ?? 2;
    this.onConnectionRequest = config.onConnectionRequest;
    this.onTransactionRequest = config.onTransactionRequest;
    this.onBlockedTransaction = config.onBlockedTransaction;
  }

  // ─── WalletAdapter Methods ───────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return;

    this.connecting = true;

    try {
      // Step 1: Request user approval via callback
      const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      
      if (this.onConnectionRequest) {
        const approved = await this.onConnectionRequest(origin);
        if (!approved) {
          throw new Error('Connection request rejected by user');
        }
      }

      // Step 2: Connect to real wallet if available
      if (this.realWallet) {
        await this.realWallet.connect();
        this.publicKey = this.realWallet.publicKey;
        this.connected = this.realWallet.connected;
      } else {
        // Demo mode - use mock address
        this.publicKey = new PublicKey('DemoWallet11111111111111111111111111111111111');
        this.connected = true;
      }

      this.emit('connect', this.publicKey);
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.realWallet) {
      await this.realWallet.disconnect();
    }

    this.connected = false;
    this.publicKey = null;
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    // CRITICAL: Intercept signing request
    this.ensureConnected();

    // Parse and analyze transaction
    const parsed = parseTransaction(tx as Transaction);
    
    // For now, use a simple risk assessment
    // In production, this would call RiskEngine.assessRisk()
    const risk: EnhancedRiskAssessment = {
      score: 0,
      level: 'SAFE',
      flags: [],
      recommendation: 'APPROVE',
      explanation: 'Transaction analysis pending',
      instructionRisks: [],
      addressFlags: [],
    };

    // Check auto-approve threshold
    if (risk.score <= this.autoApproveThreshold && risk.recommendation === 'APPROVE') {
      // Auto-approve low-risk transactions
      return this.forwardToRealWallet(tx, 'signTransaction');
    }

    // Show analysis in UI, wait for user decision
    const decision = await this.requestUserDecision(parsed, risk);

    switch (decision) {
      case 'approve':
        return this.forwardToRealWallet(tx, 'signTransaction');
      case 'reject':
        throw new Error('User rejected transaction');
      case 'block':
        this.reportBlockedTransaction(parsed, risk);
        throw new Error('Transaction blocked — malicious pattern detected');
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    this.ensureConnected();

    // Analyze each transaction
    const results = txs.map((tx) => {
      const parsed = parseTransaction(tx as Transaction);
      // Simple risk assessment for now
      const risk: EnhancedRiskAssessment = {
        score: 0,
        level: 'SAFE',
        flags: [],
        recommendation: 'APPROVE',
        explanation: 'Transaction analysis pending',
        instructionRisks: [],
        addressFlags: [],
      };
      return { tx, parsed, risk };
    });

    // Find highest risk
    const highestRisk = results.reduce((max, r) => (r.risk.score > max.risk.score ? r : max));

    // If any transaction is high risk, show review for the batch
    if (highestRisk.risk.score > this.autoApproveThreshold) {
      const decision = await this.requestUserDecision(highestRisk.parsed, highestRisk.risk);
      
      if (decision === 'reject') {
        throw new Error('User rejected transaction batch');
      }
      if (decision === 'block') {
        this.reportBlockedTransaction(highestRisk.parsed, highestRisk.risk);
        throw new Error('Transaction batch blocked — malicious pattern detected');
      }
    }

    // Forward all to real wallet
    return this.forwardToRealWallet(txs, 'signAllTransactions');
  }

  async signAndSendTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
    options?: { skipPreflight?: boolean; maxRetries?: number }
  ): Promise<{ signature: string }> {
    this.ensureConnected();

    const parsed = parseTransaction(tx as Transaction);
    const risk: EnhancedRiskAssessment = {
      score: 0,
      level: 'SAFE',
      flags: [],
      recommendation: 'APPROVE',
      explanation: 'Transaction analysis pending',
      instructionRisks: [],
      addressFlags: [],
    };

    if (risk.score <= this.autoApproveThreshold && risk.recommendation === 'APPROVE') {
      return this.forwardToRealWallet(tx, 'signAndSendTransaction', options);
    }

    const decision = await this.requestUserDecision(parsed, risk);

    switch (decision) {
      case 'approve':
        return this.forwardToRealWallet(tx, 'signAndSendTransaction', options);
      case 'reject':
        throw new Error('User rejected transaction');
      case 'block':
        this.reportBlockedTransaction(parsed, risk);
        throw new Error('Transaction blocked — malicious pattern detected');
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    // Messages are safe - no asset movement
    this.ensureConnected();

    if (this.onTransactionRequest) {
      const decision = await this.onTransactionRequest(
        {
          type: 'signMessage',
          message: message,
          messagePreview: new TextDecoder().decode(message.slice(0, 100)),
        } as unknown as ParsedTransaction,
        {
          score: 0,
          level: 'SAFE',
          flags: [],
          recommendation: 'APPROVE',
          explanation: 'Message signing request',
          instructionRisks: [],
          addressFlags: [],
        }
      );

      if (decision === 'reject') {
        throw new Error('User rejected message signing');
      }
    }

    return this.forwardToRealWallet(message, 'signMessage');
  }

  // ─── Event Handling ─────────────────────────────────────────────────────────────

  on<E extends 'connect' | 'disconnect' | 'error' | 'readyStateChange'>(
    event: E,
    listener: (...args: unknown[]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return cleanup function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: string, ...args: unknown[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error('Error in wallet listener:', error);
        }
      });
    }
  }

  // ─── Internal Methods ─────────────────────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected || !this.publicKey) {
      throw new WalletNotReadyError(
        new Error('Wallet not connected'),
        this.readyState
      );
    }
  }

  private async requestUserDecision(
    parsed: ParsedTransaction,
    risk: EnhancedRiskAssessment
  ): Promise<TransactionDecision> {
    if (!this.onTransactionRequest) {
      // Default: reject if no callback
      throw new Error('No transaction request handler configured');
    }

    return this.onTransactionRequest(parsed, risk);
  }

  private async forwardToRealWallet<T>(
    payload: T,
    method: 'signTransaction' | 'signAllTransactions' | 'signAndSendTransaction' | 'signMessage',
    options?: unknown
  ): Promise<T> {
    if (!this.realWallet) {
      // Demo mode - return mock result
      if (method === 'signAndSendTransaction') {
        return { signature: 'MOCK_SIGNATURE_' + Date.now() } as T;
      }
      return payload;
    }

    switch (method) {
      case 'signTransaction':
        return this.realWallet.signTransaction!(payload as Transaction | VersionedTransaction) as Promise<T>;
      case 'signAllTransactions':
        return this.realWallet.signAllTransactions!(payload as (Transaction | VersionedTransaction)[]) as Promise<T>;
      case 'signAndSendTransaction':
        return this.realWallet.signAndSendTransaction!(payload as Transaction | VersionedTransaction, options as { skipPreflight?: boolean }) as Promise<T>;
      case 'signMessage':
        return this.realWallet.signMessage!(payload as Uint8Array) as Promise<T>;
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private reportBlockedTransaction(parsed: ParsedTransaction, risk: EnhancedRiskAssessment): void {
    if (this.onBlockedTransaction) {
      this.onBlockedTransaction(parsed, risk);
    }

    // Log to analytics
    console.warn('[WalletProxy] Blocked malicious transaction:', {
      riskScore: risk.score,
      flags: risk.flags,
      instructions: parsed.instructions.map((i) => i.instructionType),
    });
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────────

export function createWalletProxy(config: WalletProxyConfig): WalletProxyProvider {
  return new WalletProxyProvider(config);
}

export default WalletProxyProvider;