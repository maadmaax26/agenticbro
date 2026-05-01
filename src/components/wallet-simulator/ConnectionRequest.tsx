/**
 * ConnectionRequest.tsx — Wallet Connect Approval Modal
 * 
 * Shows when a dApp requests wallet connection.
 * Displays domain and requested permissions before user approves.
 */

import { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConnectionRequestProps {
  origin: string;
  request: unknown;
  onApprove: () => Promise<void>;
  onReject: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ConnectionRequest({
  origin,
  request: _request,
  onApprove,
  onReject,
}: ConnectionRequestProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Extract domain info ────────────────────────────────────────────────────────

  const getDomain = (origin: string): string => {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      return origin;
    }
  };

  const domain = getDomain(origin);

  // ── Handle approve ──────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await onApprove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsProcessing(false);
    }
  };

  // ── Handle reject ────────────────────────────────────────────────────────────────

  const handleReject = () => {
    if (!isProcessing) {
      onReject();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-black overflow-hidden">
        {/* ── Header ──────────────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-white/5 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Connect Wallet
          </h2>
          <p className="text-sm text-gray-400">
            A dApp is requesting to connect to your wallet
          </p>
        </div>

        {/* ── Site Info ────────────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-black/40 border border-white/5">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-400 mb-1">Requesting site</div>
              <div className="font-mono text-white truncate">{domain}</div>
            </div>
            <a
              href={origin}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* ── Permissions ───────────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-white/5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            This site would like to:
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-sm text-gray-300">
                View your wallet address
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-sm text-gray-300">
                Request approval for transactions
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-sm text-gray-300">
                Request signature for messages
              </span>
            </div>
          </div>
        </div>

        {/* ── Warning ──────────────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-white/5">
          <div className="p-4 rounded-lg bg-yellow-900/20 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                  Always verify the site
                </h4>
                <p className="text-xs text-yellow-200/80">
                  Only connect to sites you trust. Malicious sites can attempt to steal your funds
                  through deceptive transactions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-4 border-b border-white/5">
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────────────────────── */}
        <div className="p-6 flex gap-3">
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject
            </div>
          </button>
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Approve
              </div>
            )}
          </button>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────────────── */}
        <div className="p-3 text-center border-t border-white/5">
          <p className="text-xs text-gray-500">
            Protected by Agentic Bro Wallet Guard
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConnectionRequest;