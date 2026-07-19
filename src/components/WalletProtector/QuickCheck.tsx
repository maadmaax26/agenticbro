/**
 * QuickCheck.tsx — Paste and Analyze
 * 
 * Quick analysis tool for pasting base58-encoded transactions.
 */

import { useState, useCallback } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Shield,
} from 'lucide-react';
import { analyzeTransaction } from '../../lib/wallet-protection-client';
import type { TransactionAnalysisResult } from '../../lib/wallet-protection-client';
import { RiskBadge, RiskScoreBar } from './RiskBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickCheckProps {
  onAnalyze?: (result: TransactionAnalysisResult) => void;
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function QuickCheck({ onAnalyze, className = '' }: QuickCheckProps) {
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<'base58' | 'base64'>('base58');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TransactionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Handle Analyze ──────────────────────────────────────────────────────────────

  const handleAnalyze = useCallback(async () => {
    if (!input.trim()) {
      setError('Please paste a transaction');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const analysisResult = await analyzeTransaction(input.trim(), format);
      setResult(analysisResult);
      
      if (onAnalyze) {
        onAnalyze(analysisResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze transaction');
    } finally {
      setIsLoading(false);
    }
  }, [input, format, onAnalyze]);

  // ── Handle Clear ─────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setInput('');
    setResult(null);
    setError(null);
  }, []);

  // ── Handle Paste ──────────────────────────────────────────────────────────────────

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch {
      setError('Failed to paste from clipboard');
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Header ───────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Quick Check</h3>
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Format Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setFormat('base58')}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              format === 'base58'
                ? 'bg-purple-600 text-white'
                : 'bg-black/40 text-gray-400 hover:bg-white/10'
            }`}
          >
            Base58
          </button>
          <button
            onClick={() => setFormat('base64')}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              format === 'base64'
                ? 'bg-purple-600 text-white'
                : 'bg-black/40 text-gray-400 hover:bg-white/10'
            }`}
          >
            Base64
          </button>
        </div>

        {/* Text Area */}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your transaction here (base58 or base64 encoded)..."
            className="w-full h-32 p-4 pr-24 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-purple-500 resize-none"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={handlePaste}
              className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Paste from clipboard"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !input.trim()}
            className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Analyze Transaction
              </>
            )}
          </button>
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="py-3 px-6 rounded-lg font-semibold text-white bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-500/30">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── Result ─────────────────────────────────────────────────────────────────── */}
      {result && result.success && (
        <div className="space-y-4">
          {/* Risk Summary */}
          <div className="p-4 rounded-lg bg-black/40 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">Risk Assessment</h4>
              <RiskBadge
                score={result.overallRisk.score}
                level={result.overallRisk.level}
                showLabel
              />
            </div>
            <RiskScoreBar score={result.overallRisk.score} />
            <p className="mt-3 text-sm text-gray-300">{result.overallRisk.explanation}</p>
          </div>

          {/* Instructions */}
          <div className="p-4 rounded-lg bg-black/40 border border-white/10">
            <h4 className="font-semibold text-white mb-3">
              Instructions ({result.instructions.length})
            </h4>
            <div className="space-y-2">
              {result.instructions.map((instr, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded bg-black/30"
                >
                  <div>
                    <div className="text-sm text-white">{instr.instructionLabel}</div>
                    <div className="text-xs text-gray-500">{instr.programName}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      instr.riskLevel === 'SAFE'
                        ? 'bg-green-900/30 text-green-400'
                        : instr.riskLevel === 'LOW'
                        ? 'bg-lime-900/30 text-lime-400'
                        : instr.riskLevel === 'MEDIUM'
                        ? 'bg-yellow-900/30 text-yellow-400'
                        : instr.riskLevel === 'HIGH'
                        ? 'bg-orange-900/30 text-orange-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {instr.riskLevel} ({instr.riskScore.toFixed(1)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Flags */}
          {result.overallRisk.flags.length > 0 && (
            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30">
              <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Red Flags
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.overallRisk.flags.map((flag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full bg-red-900/30 text-red-300 text-sm"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div
            className={`p-4 rounded-lg border ${
              result.overallRisk.recommendation === 'APPROVE'
                ? 'bg-green-900/30 border-green-500/30'
                : result.overallRisk.recommendation === 'CAUTION'
                ? 'bg-yellow-900/30 border-yellow-500/30'
                : 'bg-red-900/30 border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {result.overallRisk.recommendation === 'APPROVE' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : result.overallRisk.recommendation === 'CAUTION' ? (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className="font-semibold text-white">
                Recommendation: {result.overallRisk.recommendation}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickCheck;
