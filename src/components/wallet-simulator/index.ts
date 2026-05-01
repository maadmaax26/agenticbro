/**
 * Wallet Simulator Components
 * 
 * Phase 2 UI components for the Agentic Bro Wallet Protection System.
 * These components work together to provide a simulated wallet environment
 * that intercepts and analyzes transactions before signing.
 */

export { WalletSimulator } from './WalletSimulator';
export { SimulatorBrowser } from './SimulatorBrowser';
export { TransactionReview } from './TransactionReview';
export { ConnectionRequest } from './ConnectionRequest';

// Re-export types for convenience
export type { ParsedTransaction, ParsedInstruction, RiskAssessment } from '../../lib/wallet-proxy/TransactionParser';