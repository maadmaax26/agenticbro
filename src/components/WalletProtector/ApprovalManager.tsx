/**
 * ApprovalManager.tsx — View and Revoke Active Approvals
 * 
 * Shows all active token approvals and allows users to revoke them.
 * Integrates with the approval tracking system.
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { useApprovalManager, type Approval } from '../../lib/wallet-proxy/useApprovalManager';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalManagerProps {
  onRevoke?: (approval: Approval) => void;
  className?: string;
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRiskBadgeColor(level: Approval['riskLevel']): string {
  switch (level) {
    case 'low':
      return 'bg-green-900/30 text-green-400 border-green-500/30';
    case 'medium':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30';
    case 'high':
      return 'bg-red-900/30 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-900/30 text-gray-400 border-gray-500/30';
  }
}

function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ApprovalManager({ onRevoke, className = '' }: ApprovalManagerProps) {
  const { approvals, isLoading, revokeApproval, revokeAllForDomain, getStats } = useApprovalManager();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const stats = getStats();
  const activeApprovals = approvals.filter((a) => !a.revoked);

  // ── Group approvals by domain ──────────────────────────────────────────────────────

  const approvalsByDomain = activeApprovals.reduce(
    (acc, approval) => {
      const domain = approval.domain;
      if (!acc[domain]) acc[domain] = [];
      acc[domain].push(approval);
      return acc;
    },
    {} as Record<string, Approval[]>
  );

  // ── Handle revoke ────────────────────────────────────────────────────────────────

  const handleRevoke = async (approval: Approval) => {
    setRevokingId(approval.id);
    try {
      const success = revokeApproval(approval.id);
      if (success && onRevoke) {
        onRevoke(approval);
      }
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeDomain = async (domain: string) => {
    if (confirm(`Revoke all approvals for ${domain}?`)) {
      revokeAllForDomain(domain);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`p-6 rounded-lg bg-black/40 border border-white/10 ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
          <span className="text-gray-400">Loading approvals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Stats ────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-2xl font-bold text-white">{stats.totalActive}</div>
          <div className="text-sm text-gray-400">Active Approvals</div>
        </div>
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-2xl font-bold text-yellow-400">{stats.unlimitedApprovals}</div>
          <div className="text-sm text-gray-400">Unlimited</div>
        </div>
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-2xl font-bold text-red-400">{stats.highRiskApprovals}</div>
          <div className="text-sm text-gray-400">High Risk</div>
        </div>
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-2xl font-bold text-purple-400">
            {Object.keys(stats.byDomain).length}
          </div>
          <div className="text-sm text-gray-400">dApps</div>
        </div>
      </div>

      {/* ── Empty State ───────────────────────────────────────────────────────────── */}
      {activeApprovals.length === 0 && (
        <div className="p-8 rounded-lg bg-black/40 border border-white/5 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">No Active Approvals</h3>
          <p className="text-sm text-gray-400">
            You have no active token approvals. When you approve tokens for spending,
            they will appear here.
          </p>
        </div>
      )}

      {/* ── Approvals by Domain ──────────────────────────────────────────────────── */}
      {Object.entries(approvalsByDomain).map(([domain, domainApprovals]) => (
        <div
          key={domain}
          className="rounded-lg bg-black/40 border border-white/5 overflow-hidden"
        >
          {/* Domain Header */}
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
            onClick={() => setSelectedDomain(selectedDomain === domain ? null : domain)}
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-purple-400" />
              <div>
                <div className="font-medium text-white">{domain}</div>
                <div className="text-sm text-gray-400">
                  {domainApprovals.length} approval{domainApprovals.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {domainApprovals.some((a) => a.amount === 'unlimited') && (
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/30 text-yellow-400">
                  Unlimited
                </span>
              )}
              {domainApprovals.some((a) => a.riskLevel === 'high') && (
                <span className="px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-400">
                  High Risk
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRevokeDomain(domain);
                }}
                className="p-2 rounded hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Approval List */}
          {selectedDomain === domain && (
            <div className="border-t border-white/5 divide-y divide-white/5">
              {domainApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="p-4 flex items-center justify-between hover:bg-white/5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-white">
                        {approval.tokenSymbol || 'Unknown Token'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {approval.amount === 'unlimited' ? '∞' : approval.amount}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${getRiskBadgeColor(
                          approval.riskLevel
                        )}`}
                      >
                        {approval.riskLevel}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Spender: {shortenAddress(approval.spenderAddress)}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(approval.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(approval)}
                    disabled={revokingId === approval.id}
                    className="px-3 py-1.5 rounded text-sm bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {revokingId === approval.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* ── Warning Banner ──────────────────────────────────────────────────────── */}
      {stats.unlimitedApprovals > 0 && (
        <div className="p-4 rounded-lg bg-yellow-900/20 border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                Unlimited Approvals Detected
              </h4>
              <p className="text-sm text-yellow-200/80">
                You have {stats.unlimitedApprovals} unlimited token approvals. These allow the
                spender to take any amount of your tokens. Consider revoking them if you're
                no longer using those dApps.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalManager;