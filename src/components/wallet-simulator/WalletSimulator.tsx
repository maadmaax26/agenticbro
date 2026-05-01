/**
 * WalletSimulator.tsx — Main Entry Point
 * 
 * The Wallet Protection Simulator lets users interact with dApps safely
 * by intercepting wallet requests and analyzing transactions before signing.
 * 
 * Modes:
 * 1. enter_url — User types a dApp URL
 * 2. browsing — dApp loaded in sandboxed iframe
 * 3. transaction_pending — Transaction intercepted, showing analysis
 */

import { useState, useCallback } from 'react';
import { Shield, Globe, AlertTriangle, CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { SimulatorBrowser } from './SimulatorBrowser';
import { TransactionReview } from './TransactionReview';
import { ConnectionRequest } from './ConnectionRequest';
import type { ParsedTransaction, RiskAssessment } from '../../lib/wallet-proxy/TransactionParser';

// ─── Types ────────────────────────────────────────────────────────────────────

type SimulatorMode = 'enter_url' | 'browsing' | 'transaction_pending' | 'connection_request';

interface SimulatorState {
  mode: SimulatorMode;
  url: string;
  isConnected: boolean;
  connectedAddress: string | null;
  pendingTransaction: ParsedTransaction | null;
  pendingConnection: {
    origin: string;
    request: unknown;
  } | null;
  transactionHistory: TransactionRecord[];
}

interface TransactionRecord {
  id: string;
  timestamp: Date;
  url: string;
  transaction: ParsedTransaction;
  decision: 'approved' | 'rejected' | 'blocked';
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function WalletSimulator() {
  const [state, setState] = useState<SimulatorState>({
    mode: 'enter_url',
    url: '',
    isConnected: false,
    connectedAddress: null,
    pendingTransaction: null,
    pendingConnection: null,
    transactionHistory: [],
  });

  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── URL Validation ──────────────────────────────────────────────────────────────

  const validateUrl = useCallback((url: string): string | null => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'Only HTTP and HTTPS URLs are allowed';
      }
      return null;
    } catch {
      return 'Invalid URL format';
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────────

  const handleNavigate = useCallback(() => {
    setError(null);
    
    let url = inputUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const validationError = validateUrl(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setState(prev => ({
      ...prev,
      mode: 'browsing',
      url,
    }));
  }, [inputUrl, validateUrl]);

  const handleConnectionRequest = useCallback((origin: string, request: unknown) => {
    setState(prev => ({
      ...prev,
      mode: 'connection_request',
      pendingConnection: { origin, request },
    }));
  }, []);

  const handleApproveConnection = useCallback(async () => {
    // In production, this would connect to real wallet
    setState(prev => ({
      ...prev,
      mode: 'browsing',
      isConnected: true,
      connectedAddress: 'DemoWallet11111111111111111111111111111111111',
      pendingConnection: null,
    }));
  }, []);

  const handleRejectConnection = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'browsing',
      pendingConnection: null,
    }));
  }, []);

  const handleTransactionRequest = useCallback((tx: ParsedTransaction) => {
    setState(prev => ({
      ...prev,
      mode: 'transaction_pending',
      pendingTransaction: tx,
    }));
  }, []);

  const handleApproveTransaction = useCallback(() => {
    if (state.pendingTransaction) {
      const record: TransactionRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        url: state.url,
        transaction: state.pendingTransaction,
        decision: state.pendingTransaction.overallRisk.level === 'CRITICAL' ? 'blocked' : 'approved',
      };
      
      setState(prev => ({
        ...prev,
        mode: 'browsing',
        pendingTransaction: null,
        transactionHistory: [record, ...prev.transactionHistory].slice(0, 50),
      }));
    }
  }, [state.pendingTransaction, state.url]);

  const handleRejectTransaction = useCallback(() => {
    if (state.pendingTransaction) {
      const record: TransactionRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        url: state.url,
        transaction: state.pendingTransaction,
        decision: 'rejected',
      };
      
      setState(prev => ({
        ...prev,
        mode: 'browsing',
        pendingTransaction: null,
        transactionHistory: [record, ...prev.transactionHistory].slice(0, 50),
      }));
    }
  }, [state.pendingTransaction, state.url]);

  const handleGoBack = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'enter_url',
      url: '',
      isConnected: false,
      connectedAddress: null,
    }));
    setInputUrl('');
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30">
        <Shield className="w-8 h-8 text-purple-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Wallet Protection Simulator</h1>
          <p className="text-sm text-gray-400">Analyze transactions before signing</p>
        </div>
        {state.isConnected && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-500/30">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300 font-mono">
              {state.connectedAddress?.slice(0, 8)}...{state.connectedAddress?.slice(-4)}
            </span>
          </div>
        )}
      </div>

      {/* ── URL Bar ───────────────────────────────────────────────────────────────── */}
      {state.mode === 'enter_url' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
                placeholder="Enter dApp URL (e.g., jupiter.ag, raydium.io)"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={handleNavigate}
              disabled={!inputUrl.trim()}
              className="px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Launch
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* ── Instructions ───────────────────────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400">1</div>
                <span className="text-white font-medium">Enter URL</span>
              </div>
              <p className="text-sm text-gray-400">Type the dApp URL you want to interact with</p>
            </div>
            <div className="p-4 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400">2</div>
                <span className="text-white font-medium">Analyze Transactions</span>
              </div>
              <p className="text-sm text-gray-400">We intercept and decode every transaction request</p>
            </div>
            <div className="p-4 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400">3</div>
                <span className="text-white font-medium">Approve or Reject</span>
              </div>
              <p className="text-sm text-gray-400">Make informed decisions based on risk analysis</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Browser View ───────────────────────────────────────────────────────────── */}
      {state.mode === 'browsing' && (
        <div className="space-y-3">
          {/* URL Bar */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/10">
            <button
              onClick={handleGoBack}
              className="p-2 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 text-gray-300 text-sm font-mono truncate">
              <Globe className="w-4 h-4 flex-shrink-0" />
              {state.url}
            </div>
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>

          {/* iFrame Container */}
          <SimulatorBrowser
            url={state.url}
            onConnectionRequest={handleConnectionRequest}
            onTransactionRequest={handleTransactionRequest}
            isConnected={state.isConnected}
            connectedAddress={state.connectedAddress}
          />
        </div>
      )}

      {/* ── Connection Request Modal ───────────────────────────────────────────────── */}
      {state.mode === 'connection_request' && state.pendingConnection && (
        <ConnectionRequest
          origin={state.pendingConnection.origin}
          request={state.pendingConnection.request}
          onApprove={handleApproveConnection}
          onReject={handleRejectConnection}
        />
      )}

      {/* ── Transaction Review Overlay ─────────────────────────────────────────────── */}
      {state.mode === 'transaction_pending' && state.pendingTransaction && (
        <TransactionReview
          transaction={state.pendingTransaction}
          url={state.url}
          onApprove={handleApproveTransaction}
          onReject={handleRejectTransaction}
        />
      )}

      {/* ── Transaction History (Collapsed) ─────────────────────────────────────── */}
      {state.transactionHistory.length > 0 && state.mode === 'browsing' && (
        <div className="p-3 rounded-lg bg-black/20 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {state.transactionHistory.length} transaction{state.transactionHistory.length !== 1 ? 's' : ''} analyzed
            </span>
            <div className="flex gap-2">
              {['approved', 'rejected', 'blocked'].map((status) => (
                <span key={status} className="text-xs px-2 py-0.5 rounded bg-white/5">
                  {state.transactionHistory.filter(t => t.decision === status).length} {status}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletSimulator;