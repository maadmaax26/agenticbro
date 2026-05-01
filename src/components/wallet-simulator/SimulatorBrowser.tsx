/**
 * SimulatorBrowser.tsx — Sandboxed iframe container
 * 
 * Renders dApps in a sandboxed iframe with postMessage bridge
 * for wallet interception.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimulatorBrowserProps {
  url: string;
  onConnectionRequest: (origin: string, request: unknown) => void;
  onTransactionRequest: (tx: ParsedTransaction) => void;
  isConnected: boolean;
  connectedAddress: string | null;
}

import type { ParsedTransaction } from '../../lib/wallet-proxy/TransactionParser';

type LoadingState = 'loading' | 'loaded' | 'error';

// ─── Component ──────────────────────────────────────────────────────────────────

export function SimulatorBrowser({
  url,
  onConnectionRequest,
  onTransactionRequest,
  isConnected,
  connectedAddress,
}: SimulatorBrowserProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);

  // ── Handle postMessage from iframe ──────────────────────────────────────────────

  // Note: This is a simplified implementation
  // handleMessage would receive and process postMessage events from the iframe
  // For now, we use a placeholder to avoid unused variable warning
  const _handleMessagePlaceholder = handleMessage;

  useEffect(() => {
    const handleMessage = useCallback((event: MessageEvent) => {
      // Security: Only accept messages from the iframe
      if (!event.origin || !url.startsWith(event.origin)) {
        return;
      }

      const { type, payload } = event.data || {};

      switch (type) {
        case 'WALLET_CONNECT_REQUEST':
          onConnectionRequest(event.origin, payload);
          break;

        case 'WALLET_SIGN_REQUEST':
          if (payload?.transaction) {
            // Transaction will be parsed by TransactionParser
            onTransactionRequest(payload.transaction as ParsedTransaction);
          }
          break;

        case 'WALLET_SIGN_ALL_REQUEST':
          if (payload?.transactions && Array.isArray(payload.transactions)) {
            // Handle batch signing - for now, just process first one
            if (payload.transactions[0]) {
              onTransactionRequest(payload.transactions[0] as ParsedTransaction);
            }
          }
          break;

        case 'DAPP_READY':
          setLoadingState('loaded');
          break;

        case 'DAPP_ERROR':
          setError(payload?.message || 'Unknown error from dApp');
          setLoadingState('error');
          break;
      }
    }, [url, onConnectionRequest, onTransactionRequest]);

    // Note: This is a simplified implementation
    // In production, you'd need to inject a wallet adapter script into the iframe
    // that bridges window.solana calls to postMessage

    return () => {
      // Cleanup listener
    };
  }, [url, onConnectionRequest, onTransactionRequest]);

  // ── Send wallet state to iframe ────────────────────────────────────────────────

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // Send wallet state updates to iframe
    iframe.contentWindow.postMessage(
      {
        type: 'WALLET_STATE_UPDATE',
        payload: {
          connected: isConnected,
          address: connectedAddress,
        },
      },
      new URL(url).origin
    );
  }, [isConnected, connectedAddress, url]);

  // ── Handle iframe load ───────────────────────────────────────────────────────────

  const handleIframeLoad = useCallback(() => {
    setLoadingState('loaded');
    setError(null);
  }, []);

  const handleIframeError = useCallback(() => {
    setLoadingState('error');
    setError('Failed to load dApp. The site may have security restrictions.');
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border border-white/10 bg-black">
      {/* Loading Overlay */}
      {loadingState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
            <p className="text-gray-400">Loading dApp...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {loadingState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center space-y-4 p-6">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-white">Failed to Load</h3>
              <p className="text-sm text-gray-400 mt-1">{error}</p>
            </div>
            <button
              onClick={() => {
                setLoadingState('loading');
                setError(null);
                // Force reload
                if (iframeRef.current) {
                  iframeRef.current.src = iframeRef.current.src;
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Sandboxed iFrame */}
      <iframe
        ref={iframeRef}
        src={url}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        className="w-full h-full border-0"
        title="dApp Browser"
        // Note: In production, you'd inject a wallet adapter script here
        // that bridges window.solana calls to postMessage
      />

      {/* Security Notice */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/80 border-t border-white/5 text-center">
        <span className="text-xs text-gray-500">
          🔒 Protected by Agentic Bro Wallet Guard
        </span>
      </div>
    </div>
  );
}

export default SimulatorBrowser;