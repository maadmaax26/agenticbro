/**
 * useTransactionAnalysis.ts — Real-time Transaction Analysis Hook
 * 
 * Provides real-time transaction analysis with:
 * - Background parsing
 * - Risk scoring
 * - Instruction decoding
 * - Token-2022 extension detection
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { TransactionParser, ParsedTransaction, ParsedInstruction } from './TransactionParser';
import { RiskEngine, RiskAssessment } from './RiskEngine';
import { Token2022Detector, TokenExtensionResult } from './Token2022Detector';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  transaction: ParsedTransaction;
  risk: RiskAssessment;
  tokenExtensions: TokenExtensionResult[];
  analysisTime: number;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  error?: string;
}

export interface AnalysisOptions {
  includeTokenExtensions?: boolean;
  includeWebsiteScan?: boolean;
  timeout?: number;
}

export type AnalysisStatus = AnalysisResult['status'];

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useTransactionAnalysis(options: AnalysisOptions = {}) {
  const {
    includeTokenExtensions = true,
    includeWebsiteScan = false,
    timeout = 30000,
  } = options;

  const [results, setResults] = useState<Map<string, AnalysisResult>>(new Map());
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);

  const parserRef = useRef<TransactionParser | null>(null);
  const riskEngineRef = useRef<RiskEngine | null>(null);
  const tokenDetectorRef = useRef<Token2022Detector | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Initialize ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    parserRef.current = new TransactionParser();
    riskEngineRef.current = new RiskEngine();
    tokenDetectorRef.current = new Token2022Detector();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ── Analyze Transaction ──────────────────────────────────────────────────────────

  const analyzeTransaction = useCallback(
    async (
      tx: Transaction | VersionedTransaction | string,
      txId?: string
    ): Promise<AnalysisResult> => {
      const startTime = Date.now();
      const id = txId || crypto.randomUUID();

      // Abort any previous analysis
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Set pending status
      const pendingResult: AnalysisResult = {
        transaction: {
          transactionId: id,
          fee: 0,
          instructions: [],
          overallRisk: {
            score: 0,
            level: 'SAFE',
            flags: [],
            recommendation: 'APPROVE',
            explanation: 'Analyzing...',
          },
          timestamp: new Date().toISOString(),
        },
        risk: {
          score: 0,
          level: 'SAFE',
          flags: [],
          recommendation: 'APPROVE',
          explanation: 'Analyzing...',
        },
        tokenExtensions: [],
        analysisTime: 0,
        status: 'analyzing',
      };

      setCurrentAnalysis(pendingResult);
      setResults((prev) => new Map(prev).set(id, pendingResult));

      try {
        // Check abort
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Analysis aborted');
        }

        // Parse transaction
        if (!parserRef.current) {
          throw new Error('Parser not initialized');
        }

        const parsed = await parserRef.current.parseTransaction(tx);

        // Update with parsed data
        setCurrentAnalysis((prev) =>
          prev ? { ...prev, transaction: parsed, status: 'analyzing' } : null
        );

        // Check abort
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Analysis aborted');
        }

        // Assess risk
        if (!riskEngineRef.current) {
          throw new Error('Risk engine not initialized');
        }

        const risk = await riskEngineRef.current.assessRisk(parsed);

        // Update with risk assessment
        setCurrentAnalysis((prev) =>
          prev ? { ...prev, risk, status: 'analyzing' } : null
        );

        // Check for token extensions
        let tokenExtensions: TokenExtensionResult[] = [];
        if (includeTokenExtensions && tokenDetectorRef.current) {
          // Find token accounts in instructions
          const tokenAddresses = parsed.instructions
            .filter((i) => i.programName === 'SPL Token' || i.programName === 'Token-2022')
            .flatMap((i) => [i.details.source, i.details.destination, i.details.token])
            .filter((addr): addr is string => !!addr);

          if (tokenAddresses.length > 0) {
            // Check each token for extensions
            const extensionChecks = await Promise.all(
              Array.from(new Set(tokenAddresses)).map(async (address) => {
                try {
                  return await tokenDetectorRef.current!.checkTokenExtensions(address);
                } catch {
                  return null;
                }
              })
            );

            tokenExtensions = extensionChecks.filter(
              (r): r is TokenExtensionResult => r !== null
            );
          }
        }

        // Complete
        const completeResult: AnalysisResult = {
          transaction: parsed,
          risk,
          tokenExtensions,
          analysisTime: Date.now() - startTime,
          status: 'complete',
        };

        setCurrentAnalysis(completeResult);
        setResults((prev) => {
          const next = new Map(prev);
          next.set(id, completeResult);
          return next;
        });

        return completeResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

        const errorResult: AnalysisResult = {
          transaction: pendingResult.transaction,
          risk: pendingResult.risk,
          tokenExtensions: [],
          analysisTime: Date.now() - startTime,
          status: 'error',
          error: errorMessage,
        };

        setCurrentAnalysis(errorResult);
        setResults((prev) => {
          const next = new Map(prev);
          next.set(id, errorResult);
          return next;
        });

        return errorResult;
      }
    },
    [includeTokenExtensions, includeWebsiteScan, timeout]
  );

  // ── Analyze from Base58 ───────────────────────────────────────────────────────────

  const analyzeFromBase58 = useCallback(
    async (base58: string, txId?: string): Promise<AnalysisResult> => {
      // Import bs58 dynamically
      const bs58 = await import('bs58');
      const buffer = bs58.default.decode(base58);
      const tx = Transaction.from(buffer);
      return analyzeTransaction(tx, txId);
    },
    [analyzeTransaction]
  );

  // ── Quick Risk Check ──────────────────────────────────────────────────────────────

  const quickRiskCheck = useCallback(
    (tx: Transaction | VersionedTransaction): RiskAssessment | null => {
      if (!parserRef.current || !riskEngineRef.current) {
        return null;
      }

      try {
        // Synchronous quick check (doesn't do full parsing)
        const instructions = parserRef.current.quickParse(tx);
        const risk = riskEngineRef.current.quickAssess(instructions);
        return risk;
      } catch {
        return null;
      }
    },
    []
  );

  // ── Get Cached Result ─────────────────────────────────────────────────────────────

  const getCachedResult = useCallback(
    (txId: string): AnalysisResult | undefined => {
      return results.get(txId);
    },
    [results]
  );

  // ── Clear Cache ────────────────────────────────────────────────────────────────────

  const clearCache = useCallback(() => {
    setResults(new Map());
    setCurrentAnalysis(null);
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────────────

  return {
    currentAnalysis,
    results,
    analyzeTransaction,
    analyzeFromBase58,
    quickRiskCheck,
    getCachedResult,
    clearCache,
    isAnalyzing: currentAnalysis?.status === 'analyzing',
  };
}

export default useTransactionAnalysis;