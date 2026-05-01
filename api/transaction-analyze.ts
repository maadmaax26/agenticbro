/**
 * API: /api/transaction-analyze
 * 
 * Server-side transaction analysis for complex transactions.
 * Parses instructions, assesses risk, and returns detailed breakdown.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import * as bs58 from 'bs58';

// Risk scoring rules
const INSTRUCTION_RISK: Record<string, { base: number; modifiers: Record<string, number> }> = {
  // SPL Token Program
  'transfer': { base: 1, modifiers: { unknown_destination: 3, large_amount: 2, all_balance: 5 } },
  'transferChecked': { base: 1, modifiers: { unknown_destination: 3, large_amount: 2 } },
  'approve': { base: 2, modifiers: { unlimited_amount: 5, unknown_delegate: 3, known_drainer: 8 } },
  'revoke': { base: -1, modifiers: {} }, // Safe - revokes approval
  'setAuthority': { base: 8, modifiers: { account_owner: 2, close_account: 2 } },
  'mintTo': { base: 4, modifiers: { to_unknown: 3 } },
  'burn': { base: 1, modifiers: { not_owner_burn: 6 } },
  'freezeAccount': { base: 3, modifiers: {} },
  'thawAccount': { base: 1, modifiers: {} },
  
  // Token-2022 Extensions
  'permanentDelegate': { base: 10, modifiers: {} }, // ALWAYS CRITICAL
  'transferFee': { base: 3, modifiers: { high_fee: 3 } },
  'confidentialTransfer': { base: 2, modifiers: {} },
  
  // System Program
  'createAccount': { base: 1, modifiers: {} },
  'transfer': { base: 1, modifiers: { unknown_destination: 3, large_amount: 2, all_balance: 5 } },
  'allocate': { base: 1, modifiers: {} },
  'assign': { base: 2, modifiers: {} },
  
  // Known malicious patterns
  'batch_drain': { base: 9, modifiers: { all_tokens: 1 } },
  'account_creation': { base: 1, modifiers: {} },
};

// Known drainer addresses (subset)
const KNOWN_DRAINER_ADDRESSES = new Set([
  'Drainer11111111111111111111111111111111111',
  'InfernoDrainer1111111111111111111111111',
  'MSDrainer11111111111111111111111111111',
  'PinkDrainer111111111111111111111111111',
]);

// Known safe addresses
const KNOWN_SAFE_ADDRESSES = new Set([
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1vm', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'JUPyiwrYJFskUPiHa7hkeR8VUtA71Fo3jZ4XZftBodLh', // Jupiter
]);

interface AnalyzedInstruction {
  programId: string;
  programName: string;
  instructionType: string;
  instructionLabel: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  details: {
    source?: string;
    destination?: string;
    amount?: number;
    token?: string;
    authority?: string;
  };
  flags: string[];
}

interface AnalysisResult {
  success: boolean;
  transactionId?: string;
  fee: number;
  instructions: AnalyzedInstruction[];
  overallRisk: {
    score: number;
    level: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: string[];
    recommendation: 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK';
    explanation: string;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      fee: 0, 
      instructions: [], 
      overallRisk: { 
        score: 0, 
        level: 'SAFE', 
        flags: [], 
        recommendation: 'REJECT', 
        explanation: 'Method not allowed' 
      },
      error: 'Method not allowed' 
    });
  }

  try {
    const { transaction: serializedTx, base64 } = req.body;

    if (!serializedTx && !base64) {
      return res.status(400).json({
        success: false,
        fee: 0,
        instructions: [],
        overallRisk: {
          score: 0,
          level: 'SAFE',
          flags: [],
          recommendation: 'REJECT',
          explanation: 'Missing transaction data',
        },
        error: 'Missing transaction parameter',
      });
    }

    // Deserialize transaction
    let tx: Transaction;
    try {
      if (base64) {
        const buffer = Buffer.from(base64, 'base64');
        tx = Transaction.from(buffer);
      } else {
        const buffer = bs58.default.decode(serializedTx);
        tx = Transaction.from(buffer);
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        fee: 0,
        instructions: [],
        overallRisk: {
          score: 0,
          level: 'SAFE',
          flags: [],
          recommendation: 'REJECT',
          explanation: 'Failed to deserialize transaction',
        },
        error: 'Invalid transaction format',
      });
    }

    // Analyze instructions
    const instructions: AnalyzedInstruction[] = [];
    let totalRiskScore = 0;
    const allFlags: string[] = [];

    for (const instruction of tx.instructions) {
      const analyzed = analyzeInstruction(instruction);
      instructions.push(analyzed);
      totalRiskScore += analyzed.riskScore;
      allFlags.push(...analyzed.flags);
    }

    // Calculate overall risk
    const avgRisk = instructions.length > 0 ? totalRiskScore / instructions.length : 0;
    const maxRisk = Math.max(...instructions.map(i => i.riskScore), 0);
    const overallScore = Math.min(10, Math.max(avgRisk, maxRisk));

    const level = getRiskLevel(overallScore);
    const recommendation = getRecommendation(overallScore, allFlags);

    const explanation = generateExplanation(instructions, allFlags, recommendation);

    return res.status(200).json({
      success: true,
      transactionId: bs58.default.encode(tx.signature || Buffer.from('')),
      fee: 0.000005, // Placeholder
      instructions,
      overallRisk: {
        score: Math.round(overallScore * 10) / 10,
        level,
        flags: [...new Set(allFlags)],
        recommendation,
        explanation,
      },
    });

  } catch (error) {
    console.error('[Transaction Analyze] Error:', error);
    return res.status(500).json({
      success: false,
      fee: 0,
      instructions: [],
      overallRisk: {
        score: 0,
        level: 'SAFE',
        flags: [],
        recommendation: 'REJECT',
        explanation: 'Internal server error',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function analyzeInstruction(instruction: { programId: { toBase58: () => string }; data: Buffer; keys: { pubkey: { toBase58: () => string }; isSigner: boolean; isWritable: boolean }[] }): AnalyzedInstruction {
  const programId = instruction.programId.toBase58();
  const programName = getProgramName(programId);
  
  // Decode instruction type from data
  const instructionType = decodeInstructionType(instruction.data);
  const riskRule = INSTRUCTION_RISK[instructionType] || { base: 1, modifiers: {} };
  
  // Calculate risk
  let riskScore = riskRule.base;
  const flags: string[] = [];
  const details: AnalyzedInstruction['details'] = {};

  // Check destinations
  for (const key of instruction.keys) {
    const address = key.pubkey.toBase58();
    
    if (key.isWritable && !key.isSigner) {
      // Destination or target account
      if (KNOWN_DRAINER_ADDRESSES.has(address)) {
        riskScore += 10;
        flags.push('known_drainer');
      } else if (!KNOWN_SAFE_ADDRESSES.has(address)) {
        if (riskRule.modifiers.unknown_destination) {
          riskScore += riskRule.modifiers.unknown_destination;
          flags.push('unknown_destination');
        }
      }
    }
  }

  // Check for unlimited approvals
  if (instructionType === 'approve' || instructionType === 'transferChecked') {
    // Check data for max amount
    if (instruction.data.length > 0) {
      const dataHex = instruction.data.toString('hex');
      if (dataHex.includes('ffffffffffffffff')) {
        riskScore += riskRule.modifiers.unlimited_amount || 5;
        flags.push('unlimited_approval');
      }
    }
  }

  // Cap at 10
  riskScore = Math.min(10, Math.max(0, riskScore));

  return {
    programId,
    programName,
    instructionType,
    instructionLabel: getInstructionLabel(instructionType, programName),
    riskLevel: getRiskLevel(riskScore),
    riskScore,
    details,
    flags,
  };
}

function decodeInstructionType(data: Buffer): string {
  if (data.length === 0) return 'unknown';
  
  const discriminator = data[0];
  
  // Common instruction discriminators
  const discriminators: Record<number, string> = {
    // SPL Token
    3: 'transfer',
    12: 'transferChecked',
    4: 'approve',
    13: 'approveChecked',
    5: 'revoke',
    6: 'setAuthority',
    7: 'mintTo',
    8: 'burn',
    9: 'closeAccount',
    10: 'freezeAccount',
    11: 'thawAccount',
    // System
    0: 'createAccount',
    2: 'transfer',
    8: 'allocate',
    1: 'assign',
  };

  return discriminators[discriminator] || 'unknown';
}

function getProgramName(programId: string): string {
  const programs: Record<string, string> = {
    'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR': 'SPL Token',
    'TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q': 'Token-2022',
    '11111111111111111111111111111111': 'System',
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X': 'Associated Token',
    'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ': 'Metaplex',
    '***REMOVED***': 'Jupiter',
    '675kPT9YHRvQz2vXz4y2a2RqXvGfJGTdz9Ef8VcB8nkQ': 'Raydium',
  };
  return programs[programId] || 'Unknown Program';
}

function getInstructionLabel(type: string, program: string): string {
  const labels: Record<string, string> = {
    'transfer': 'Transfer Tokens',
    'transferChecked': 'Transfer Tokens (Checked)',
    'approve': 'Approve Token Spending',
    'approveChecked': 'Approve Token Spending (Checked)',
    'revoke': 'Revoke Approval',
    'setAuthority': 'Change Account Authority',
    'mintTo': 'Mint Tokens',
    'burn': 'Burn Tokens',
    'closeAccount': 'Close Account',
    'freezeAccount': 'Freeze Account',
    'thawAccount': 'Unfreeze Account',
    'createAccount': 'Create Account',
    'transfer': 'Transfer SOL',
    'allocate': 'Allocate Space',
    'assign': 'Assign Account',
  };
  return labels[type] || `${type} (${program})`;
}

function getRiskLevel(score: number): 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score <= 2) return 'SAFE';
  if (score <= 4) return 'LOW';
  if (score <= 6) return 'MEDIUM';
  if (score <= 8) return 'HIGH';
  return 'CRITICAL';
}

function getRecommendation(score: number, flags: string[]): 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK' {
  if (flags.includes('known_drainer')) return 'BLOCK';
  if (flags.includes('permanent_delegate')) return 'BLOCK';
  if (score >= 8) return 'REJECT';
  if (score >= 5) return 'CAUTION';
  return 'APPROVE';
}

function generateExplanation(instructions: AnalyzedInstruction[], flags: string[], recommendation: string): string {
  const parts: string[] = [];

  if (recommendation === 'BLOCK') {
    parts.push('This transaction interacts with a known malicious address.');
  } else if (recommendation === 'REJECT') {
    parts.push('This transaction has a high risk score due to:');
  } else if (recommendation === 'CAUTION') {
    parts.push('This transaction requires careful review:');
  } else {
    parts.push('This transaction appears safe.');
  }

  if (flags.includes('unlimited_approval')) {
    parts.push('Requests unlimited token approval.');
  }
  if (flags.includes('unknown_destination')) {
    parts.push('Sends to an unknown address.');
  }
  if (flags.includes('setAuthority')) {
    parts.push('Attempts to change account ownership.');
  }

  const highRiskCount = instructions.filter(i => i.riskScore >= 5).length;
  if (highRiskCount > 1) {
    parts.push(`Contains ${highRiskCount} high-risk instructions.`);
  }

  return parts.join(' ');
}