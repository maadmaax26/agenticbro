/**
 * Wallet Proxy — Phase 3 Components
 * 
 * This module provides the core wallet protection functionality:
 * - WalletProxyProvider: Mock wallet adapter that intercepts transactions
 * - useWalletSimulator: State management for the simulator
 * - useTransactionAnalysis: Real-time transaction analysis
 * - useApprovalManager: Track and manage active approvals
 */

// Core Classes
export { WalletProxyProvider, createWalletProxy } from './WalletProxyProvider';
export type { WalletProxyConfig, TransactionDecision, PendingRequest } from './WalletProxyProvider';

// Hooks
export { useWalletSimulator } from './useWalletSimulator';
export type { 
  SimulatorMode, 
  ConnectionRequest, 
  TransactionRequest, 
  TransactionRecord,
  WalletSimulatorState,
  WalletSimulatorActions,
} from './useWalletSimulator';

export { useTransactionAnalysis } from './useTransactionAnalysis';
export type { 
  AnalysisResult, 
  AnalysisOptions, 
  AnalysisStatus,
} from './useTransactionAnalysis';

export { useApprovalManager } from './useApprovalManager';
export type { 
  Approval, 
  ApprovalHistory, 
  ApprovalStats,
} from './useApprovalManager';

// Re-export from Phase 1 (functions, not classes)
export {
  parseTransaction,
  parseInstruction,
  parseTransactionFromBase58,
  PROGRAMS,
} from './TransactionParser';
export type {
  ParsedTransaction,
  ParsedInstruction,
  RiskAssessment as TransactionRiskAssessment,
} from './TransactionParser';

export { RiskEngine, getRiskEngine, analyzeTransactionRisk } from './RiskEngine';
export type {
  RiskRule,
  RiskModifier,
  EnhancedRiskAssessment,
} from './RiskEngine';

export {
  Token2022Detector,
  getToken2022Detector,
  hasPermanentDelegate,
  getTransferFee,
} from './Token2022Detector';
export type {
  TokenExtension,
  Token2022Analysis,
} from './Token2022Detector';

export { PROGRAM_REGISTRY } from './InstructionLibrary';
export type { ProgramInfo } from './InstructionLibrary';