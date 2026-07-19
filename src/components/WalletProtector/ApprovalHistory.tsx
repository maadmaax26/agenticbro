/**
 * ApprovalHistory.tsx — Decision Log
 * 
 * Shows history of approved/rejected/blocked transactions.
 */

import { useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { TransactionRecord } from '../../lib/wallet-proxy/useWalletSimulator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalHistoryProps {
  history: TransactionRecord[];
  className?: string;
}

type FilterType = 'all' | 'approved' | 'rejected' | 'blocked';

// ─── Helper Functions ──────────────────────────────────────────────────────────

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDecisionIcon(decision: TransactionRecord['decision']) {
  switch (decision) {
    case 'approved':
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'rejected':
      return <XCircle className="w-5 h-5 text-yellow-400" />;
    case 'blocked':
      return <Shield className="w-5 h-5 text-red-400" />;
  }
}

function getDecisionColor(decision: TransactionRecord['decision']): string {
  switch (decision) {
    case 'approved':
      return 'bg-green-900/30 border-green-500/30';
    case 'rejected':
      return 'bg-yellow-900/30 border-yellow-500/30';
    case 'blocked':
      return 'bg-red-900/30 border-red-500/30';
  }
}

function getRiskColor(level: string): string {
  switch (level) {
    case 'SAFE':
      return 'text-green-400';
    case 'LOW':
      return 'text-lime-400';
    case 'MEDIUM':
      return 'text-yellow-400';
    case 'HIGH':
      return 'text-orange-400';
    case 'CRITICAL':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ApprovalHistory({ history, className = '' }: ApprovalHistoryProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Filter history ──────────────────────────────────────────────────────────────

  const filteredHistory = history.filter((record) => {
    if (filter === 'all') return true;
    return record.decision === filter;
  });

  // ── Count by decision ────────────────────────────────────────────────────────────

  const counts = {
    all: history.length,
    approved: history.filter((r) => r.decision === 'approved').length,
    rejected: history.filter((r) => r.decision === 'rejected').length,
    blocked: history.filter((r) => r.decision === 'blocked').length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Header ───────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Transaction History</h3>
        <div className="flex gap-2">
          {(['all', 'approved', 'rejected', 'blocked'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-black/40 text-gray-400 hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty State ───────────────────────────────────────────────────────────── */}
      {filteredHistory.length === 0 && (
        <div className="p-8 rounded-lg bg-black/40 border border-white/5 text-center">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            {filter === 'all'
              ? 'No transactions analyzed yet'
              : `No ${filter} transactions`}
          </p>
        </div>
      )}

      {/* ── History List ──────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {filteredHistory.map((record) => {
          const isExpanded = expandedId === record.id;
          const { transaction, decision } = record;

          return (
            <div
              key={record.id}
              className={`rounded-lg border overflow-hidden ${getDecisionColor(decision)}`}
            >
              {/* ── Summary Row ─────────────────────────────────────────────────────── */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
              >
                <div className="flex items-center gap-3">
                  {getDecisionIcon(decision)}
                  <div>
                    <div className="font-medium text-white">
                      {transaction.instructions.length} instruction
                      {transaction.instructions.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      <span className="font-mono">{record.url}</span>
                      <span className="text-gray-600">•</span>
                      <span>{formatDate(record.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Risk Score</div>
                    <div className={`text-lg font-bold ${getRiskColor(transaction.overallRisk.level)}`}>
                      {transaction.overallRisk.score.toFixed(1)}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* ── Expanded Details ─────────────────────────────────────────────────── */}
              {isExpanded && (
                <div className="p-4 border-t border-white/5 bg-black/20">
                  {/* Instructions */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">
                      Instructions
                    </h4>
                    <div className="space-y-1">
                      {transaction.instructions.map((instr, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded bg-black/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{index + 1}.</span>
                            <span className="text-sm text-white">
                              {instr.instructionLabel || instr.instructionType}
                            </span>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${getRiskColor(
                              instr.riskLevel
                            )}`}
                          >
                            {instr.riskLevel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Flags */}
                  {transaction.overallRisk.flags.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">
                        Red Flags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {transaction.overallRisk.flags.map((flag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 rounded bg-red-900/30 text-red-400 text-xs"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  <div className="p-3 rounded bg-black/30">
                    <div className="text-sm text-gray-400 mb-1">Recommendation</div>
                    <div className="text-white">{transaction.overallRisk.explanation}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ApprovalHistory;
