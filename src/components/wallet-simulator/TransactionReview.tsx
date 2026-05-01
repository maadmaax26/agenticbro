/**
 * TransactionReview.tsx — Analysis Overlay
 * 
 * Shows risk assessment for intercepted transactions before signing.
 * Displays risk score, instruction breakdown, and recommendations.
 */

import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { ParsedTransaction, ParsedInstruction } from '../../lib/wallet-proxy/TransactionParser';
import type { EnhancedRiskAssessment } from '../../lib/wallet-proxy/RiskEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransactionReviewProps {
  transaction: ParsedTransaction;
  url: string;
  onApprove: () => void;
  onReject: () => void;
}

type InstructionVisibility = Record<string, boolean>;

// ─── Helper Functions ──────────────────────────────────────────────────────────

function getRiskColor(level: EnhancedRiskAssessment['level']): string {
  switch (level) {
    case 'SAFE':
      return '#22c55e'; // green
    case 'LOW':
      return '#84cc16'; // lime
    case 'MEDIUM':
      return '#eab308'; // yellow
    case 'HIGH':
      return '#f97316'; // orange
    case 'CRITICAL':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
}

function getRiskBg(level: EnhancedRiskAssessment['level']): string {
  switch (level) {
    case 'SAFE':
      return 'bg-green-900/30 border-green-500/30';
    case 'LOW':
      return 'bg-lime-900/30 border-lime-500/30';
    case 'MEDIUM':
      return 'bg-yellow-900/30 border-yellow-500/30';
    case 'HIGH':
      return 'bg-orange-900/30 border-orange-500/30';
    case 'CRITICAL':
      return 'bg-red-900/30 border-red-500/30';
    default:
      return 'bg-gray-900/30 border-gray-500/30';
  }
}

function getRecommendationIcon(recommendation: EnhancedRiskAssessment['recommendation']) {
  switch (recommendation) {
    case 'APPROVE':
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'CAUTION':
      return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    case 'REJECT':
      return <XCircle className="w-5 h-5 text-orange-400" />;
    case 'BLOCK':
      return <XCircle className="w-5 h-5 text-red-400" />;
    default:
      return null;
  }
}

function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function TransactionReview({
  transaction,
  url,
  onApprove,
  onReject,
}: TransactionReviewProps) {
  const [expandedInstructions, setExpandedInstructions] = useState<InstructionVisibility>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const { overallRisk, instructions, fee } = transaction;

  // ── Toggle instruction expansion ────────────────────────────────────────────────

  const toggleInstruction = (index: string) => {
    setExpandedInstructions(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // ── Handle approve/reject ───────────────────────────────────────────────────────

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject();
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Group instructions by program ───────────────────────────────────────────────

  const instructionsByProgram = useMemo(() => {
    const groups: Record<string, ParsedInstruction[]> = {};
    for (const instr of instructions) {
      const key = instr.programName || instr.programId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(instr);
    }
    return groups;
  }, [instructions]);

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-gradient-to-b from-gray-900 to-black">
        {/* ── Header ──────────────────────────────────────────────────────────────── */}
        <div className={`p-4 border-b ${getRiskBg(overallRisk.level)}`}>
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${getRiskColor(overallRisk.level)}20` }}
            >
              <span className="text-2xl font-bold" style={{ color: getRiskColor(overallRisk.level) }}>
                {overallRisk.score}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Transaction Review
                </h2>
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: getRiskColor(overallRisk.level), color: 'white' }}
                >
                  {overallRisk.level}
                </span>
              </div>
              <p className="text-sm text-gray-400 truncate">
                From: {url}
              </p>
            </div>
            {getRecommendationIcon(overallRisk.recommendation)}
          </div>
        </div>

        {/* ── Risk Flags ────────────────────────────────────────────────────────────── */}
        {overallRisk.flags.length > 0 && (
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              ⚠️ Risk Flags
            </h3>
            <div className="space-y-1">
              {overallRisk.flags.map((flag, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-300">{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Instructions Breakdown ────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            📋 Instructions ({instructions.length})
          </h3>
          <div className="space-y-3">
            {Object.entries(instructionsByProgram).map(([program, instrs]) => (
              <div key={program} className="space-y-2">
                <div className="text-xs text-gray-500 font-mono">
                  {program}
                </div>
                {instrs.map((instr, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-black/40 border border-white/5 cursor-pointer hover:border-white/10 transition-colors"
                    onClick={() => toggleInstruction(`${program}-${index}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getRiskColor(instr.riskLevel) }}
                        />
                        <span className="text-sm text-white">
                          {instr.instructionLabel || instr.instructionType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${getRiskColor(instr.riskLevel)}20`, color: getRiskColor(instr.riskLevel) }}
                        >
                          {instr.riskLevel}
                        </span>
                        {expandedInstructions[`${program}-${index}`] ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {expandedInstructions[`${program}-${index}`] && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                        <p className="text-sm text-gray-300">{instr.humanReadable}</p>
                        {instr.details.source && (
                          <div className="text-xs text-gray-400">
                            From: <span className="font-mono">{shortenAddress(instr.details.source)}</span>
                          </div>
                        )}
                        {instr.details.destination && (
                          <div className="text-xs text-gray-400">
                            To: <span className="font-mono">{shortenAddress(instr.details.destination)}</span>
                          </div>
                        )}
                        {instr.details.amount !== undefined && (
                          <div className="text-xs text-gray-400">
                            Amount: {instr.details.amount} {instr.details.token || 'SOL'}
                          </div>
                        )}
                        {instr.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {instr.flags.map((flag, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded bg-orange-900/30 text-orange-300"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Fee ───────────────────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Estimated Fee</span>
            <span className="text-white font-mono">{fee.toFixed(9)} SOL</span>
          </div>
        </div>

        {/* ── Recommendation ─────────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-white/5">
          <div className={`p-3 rounded-lg ${getRiskBg(overallRisk.level)}`}>
            <div className="flex items-center gap-2 mb-1">
              {getRecommendationIcon(overallRisk.recommendation)}
              <span className="font-semibold text-white">
                Recommendation: {overallRisk.recommendation}
              </span>
            </div>
            <p className="text-sm text-gray-300">{overallRisk.explanation}</p>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────────────────────── */}
        <div className="p-4 flex gap-3">
          {overallRisk.recommendation === 'BLOCK' ? (
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                '✕ Transaction Blocked'
              )}
            </button>
          ) : (
            <>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  '✕ Reject'
                )}
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  '✓ Approve'
                )}
              </button>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────────────── */}
        <div className="p-3 text-center border-t border-white/5">
          <p className="text-xs text-gray-500">
            Always verify transaction details before approving. When in doubt, reject.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TransactionReview;