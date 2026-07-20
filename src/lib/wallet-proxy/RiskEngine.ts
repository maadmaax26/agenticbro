/**
 * RiskEngine.ts — Public wallet-risk client boundary
 * ========================================================================
 * Private transaction scoring, known-drainer intelligence, and scoring weights
 * live behind /api/wallet-risk. This client preserves the public TypeScript
 * interface without shipping those rules in the browser bundle.
 */

import type { ParsedInstruction, ParsedTransaction, RiskAssessment } from './TransactionParser';
import { API_BASE } from '../apiBase';

export interface WalletContext {
  address: string;
  solBalance: number;
  tokenBalances: Record<string, number>;
  recentTransactions: number;
  knownInteractions: string[];
}

export interface RiskModifier {
  name: string;
  description: string;
  scoreDelta: number;
}

export interface InstructionRiskDetail {
  index: number;
  instructionType: string;
  instructionLabel: string;
  baseRisk: number;
  appliedModifiers: RiskModifier[];
  finalRisk: number;
  flags: string[];
}

export interface AddressFlag {
  address: string;
  label: string;
  risk: 'safe' | 'known' | 'suspicious' | 'malicious';
  source: string;
}

export interface WalletImpactEstimate {
  solAtRisk: number;
  tokensAtRisk: number;
  approvalsRequested: number;
  authorityChanges: number;
  totalDrainRisk: boolean;
}

export interface EnhancedRiskAssessment extends RiskAssessment {
  instructionRisks: InstructionRiskDetail[];
  combinedPatterns: string[];
  addressFlags: AddressFlag[];
  walletImpact: WalletImpactEstimate;
}

export class RiskEngine {
  private walletContext: WalletContext | null = null;
  private customDrainers: Map<string, { name: string; risk: number }> = new Map();

  constructor(_config?: unknown) {}

  setWalletContext(context: WalletContext): void {
    this.walletContext = context;
  }

  addKnownDrainer(address: string, name: string, risk: number = 10): void {
    this.customDrainers.set(address, { name, risk });
  }

  async assessRisk(parsedTx: ParsedTransaction): Promise<EnhancedRiskAssessment> {
    const response = await fetch(`${API_BASE}/api/wallet-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parsedTransaction: parsedTx,
        walletContext: this.walletContext,
        customDrainers: Array.from(this.customDrainers.entries()).map(([address, value]) => ({ address, ...value })),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'Wallet risk service failed');
    }
    return data.result || data;
  }
}

function fallbackAssessment(parsedTx: ParsedTransaction): EnhancedRiskAssessment {
  return {
    score: parsedTx.overallRisk.score,
    level: parsedTx.overallRisk.level,
    flags: parsedTx.overallRisk.flags,
    recommendation: parsedTx.overallRisk.recommendation,
    explanation: parsedTx.overallRisk.explanation,
    instructionRisks: parsedTx.instructions.map((ix: ParsedInstruction, index: number) => ({
      index,
      instructionType: ix.instructionType,
      instructionLabel: ix.label,
      baseRisk: ix.riskScore,
      appliedModifiers: [],
      finalRisk: ix.riskScore,
      flags: ix.riskScore >= 7 ? ['high_risk_instruction'] : [],
    })),
    combinedPatterns: [],
    addressFlags: [],
    walletImpact: {
      solAtRisk: 0,
      tokensAtRisk: 0,
      approvalsRequested: 0,
      authorityChanges: 0,
      totalDrainRisk: false,
    },
  };
}

let engineInstance: RiskEngine | null = null;

export function getRiskEngine(): RiskEngine {
  if (!engineInstance) engineInstance = new RiskEngine();
  return engineInstance;
}

export async function analyzeTransactionRisk(
  parsedTx: ParsedTransaction,
  walletContext?: WalletContext
): Promise<EnhancedRiskAssessment> {
  try {
    const engine = getRiskEngine();
    if (walletContext) engine.setWalletContext(walletContext);
    return await engine.assessRisk(parsedTx);
  } catch {
    return fallbackAssessment(parsedTx);
  }
}
