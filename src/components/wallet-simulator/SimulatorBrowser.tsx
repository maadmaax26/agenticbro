/**
 * SimulatorBrowser.tsx — Sandboxed iframe container
 * 
 * Renders dApps in a sandboxed iframe with postMessage bridge
 * for wallet interception.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import type { ParsedTransaction } from '../../lib/wallet-proxy/TransactionParser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimulatorBrowserProps {
  url: string;
  onConnectionRequest: (origin: string, request: unknown) => void;
  onTransactionRequest: (tx: ParsedTransaction) => void;
  isConnected: boolean;
  connectedAddress: string | null;
}

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
  const [isExpanded, setIsExpanded] = useState(false);

  // ── Handle postMessage from iframe ──────────────────────────────────────────────

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from our proxy (agenticbro.app) since iframe loads from there
      // The actual dApp content is proxied through our API
      if (event.origin !== window.location.origin) {
        return;
      }

      const { type, payload } = event.data || {};

      switch (type) {
        case 'WALLET_CONNECT_REQUEST':
          onConnectionRequest(url, payload);
          break;

        case 'WALLET_SIGN_REQUEST':
          if (payload?.transaction) {
            onTransactionRequest(payload.transaction as ParsedTransaction);
          }
          break;

        case 'WALLET_SIGN_ALL_REQUEST':
          if (payload?.transactions && Array.isArray(payload.transactions)) {
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
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [url, onConnectionRequest, onTransactionRequest]);

  // ── Send wallet state to iframe ────────────────────────────────────────────────

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    iframe.contentWindow.postMessage(
      {
        type: 'WALLET_STATE_UPDATE',
        payload: {
          connected: isConnected,
          address: connectedAddress,
        },
      },
      '*' // Allow any origin since iframe is proxied
    );
  }, [isConnected, connectedAddress]);

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

  const containerHeight = isExpanded ? '90vh' : '70vh';
  const minHeight = '500px';

  // Use our wallet proxy to bypass CSP/X-Frame-Options
  const proxyUrl = `/api/wallet-proxy?url=${encodeURIComponent(url)}`;

  return (
    <div 
      className="relative w-full rounded-lg overflow-hidden border border-white/10 bg-black transition-all duration-300"
      style={{ height: containerHeight, minHeight }}
    >
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-2 bg-black/90 border-b border-white/10">
        <div className="flex items-center gap-2">
          {loadingState === 'loaded' && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

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
            <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-white">Unable to Load dApp</h3>
              <p className="text-sm text-gray-400 mt-1">{error || 'The dApp may have security restrictions.'}</p>
            </div>
            <div className="text-xs text-gray-500 bg-white/5 rounded-lg p-3 text-left">
              <p className="mb-2"><strong>Why this happens:</strong></p>
              <p className="mb-2">Many DeFi dApps use security headers (CSP, X-Frame-Options) that prevent loading in iframes.</p>
              <p><strong>Note:</strong> Simple sites and many phishing/scam sites will work. Try a different URL.</p>
            </div>
            <button
              onClick={() => {
                setLoadingState('loading');
                setError(null);
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
        src={proxyUrl}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
        className="w-full h-full border-0 pt-10"
        title="dApp Browser"
        allow="clipboard-read; clipboard-write"
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