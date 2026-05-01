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

// Re-export from Phase 1
export { TransactionParser } from './TransactionParser';
export type { 
  ParsedTransaction, 
  ParsedInstruction, 
  RiskAssessment,
} from './TransactionParser';

export { RiskEngine } from './RiskEngine';
export { InstructionLibrary } from './InstructionLibrary';
export { Token2022Detector } from './Token2022Detector';