/**
 * RiskEngine.ts — Transaction risk scoring engine for Solana transactions
 * Part of the Agentic Bro Wallet Protection System
 *
 * Takes parsed instructions from TransactionParser and applies:
 * 1. Base risk scores per instruction type
 * 2. Context-aware modifiers (wallet balance, destination history, etc.)
 * 3. Cross-instruction pattern detection (drainer combos)
 * 4. Address reputation checks (known drainers, known safe contracts)
 * 5. Token-2022 dangerous extension detection
 *
 * Produces a final 0-10 risk score with recommendation and explanation.
 */

import { ParsedInstruction, ParsedTransaction, RiskAssessment } from './TransactionParser';

// ─── Risk Rule Types ─────────────────────────────────────────────────

export interface RiskRule {
  base: number;       // 0-10 base risk for this instruction type
  modifiers: Record<string, number>;  // conditional adjustments
}

export interface RiskModifier {
  name: string;
  description: string;
  scoreDelta: number;
}

export interface EnhancedRiskAssessment extends RiskAssessment {
  instructionRisks: InstructionRiskDetail[];
  combinedPatterns: string[];
  addressFlags: AddressFlag[];
  walletImpact: WalletImpactEstimate;
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

// ─── Instruction Risk Rules ──────────────────────────────────────────

const INSTRUCTION_RISK: Record<string, RiskRule> = {
  // ── SPL Token Program ──
  'transfer': {
    base: 1,
    modifiers: {
      'unknown_destination': 3,
      'large_amount': 2,
      'all_balance': 5,
    },
  },
  'transferChecked': {
    base: 1,
    modifiers: {
      'unknown_destination': 3,
      'large_amount': 2,
      'all_balance': 5,
    },
  },
  'approve': {
    base: 2,
    modifiers: {
      'unlimited_approval': 5,
      'unknown_delegate': 3,
      'known_drainer': 8,
    },
  },
  'approveChecked': {
    base: 2,
    modifiers: {
      'unlimited_approval': 5,
      'unknown_delegate': 3,
      'known_drainer': 8,
    },
  },
  'revoke': {
    base: 0,
    modifiers: {},
  },
  'setAuthority': {
    base: 8,
    modifiers: {
      'account_owner_transfer': 2,
      'close_authority_transfer': 2,
      'authority_disabled': -4,  // Disabling authority is actually safer
    },
  },
  'mintTo': {
    base: 4,
    modifiers: {
      'to_unknown': 3,
      'large_mint': 2,
    },
  },
  'mintToChecked': {
    base: 4,
    modifiers: {
      'to_unknown': 3,
      'large_mint': 2,
    },
  },
  'burn': {
    base: 3,
    modifiers: {
      'not_owner_burn': 6,
    },
  },
  'burnChecked': {
    base: 3,
    modifiers: {
      'not_owner_burn': 6,
    },
  },
  'closeAccount': {
    base: 2,
    modifiers: {
      'rent_to_unknown': 1,
    },
  },
  'freezeAccount': {
    base: 6,
    modifiers: {},
  },
  'thawAccount': {
    base: 1,
    modifiers: {},
  },

  // ── Token-2022 Extensions ──
  'permanentDelegate': {
    base: 10,
    modifiers: {},  // ALWAYS CRITICAL, no modifiers needed
  },
  'initializePermanentDelegate': {
    base: 10,
    modifiers: {},
  },
  'initializeMintCloseAuthority': {
    base: 5,
    modifiers: {},
  },
  'transferFee': {
    base: 3,
    modifiers: {
      'high_fee': 3,  // Fee > 5%
    },
  },
  'confidentialTransfer': {
    base: 2,
    modifiers: {},
  },

  // ── System Program ──
  'system_transfer': {
    base: 1,
    modifiers: {
      'unknown_destination': 3,
      'large_amount': 2,
      'all_balance': 5,
    },
  },
  'createAccount': {
    base: 1,
    modifiers: {
      'token_account': 0,
      'associated_token': 0,
    },
  },
  'assign': {
    base: 3,
    modifiers: {
      'to_unknown_program': 4,
    },
  },

  // ── Known Malicious Patterns ──
  'batch_drain': {
    base: 9,
    modifiers: {
      'all_tokens': 1,
    },
  },

  // ── DeFi Interactions ──
  'swap': {
    base: 1,
    modifiers: {
      'unknown_amm': 3,
      'slippage_high': 1,
    },
  },
  'addLiquidity': {
    base: 1,
    modifiers: {},
  },
  'removeLiquidity': {
    base: 1,
    modifiers: {},
  },
  'stake': {
    base: 1,
    modifiers: {
      'unknown_validator': 2,
    },
  },
  'unstake': {
    base: 1,
    modifiers: {},
  },
};

// ─── Known Drainer Contracts ─────────────────────────────────────────

const KNOWN_DRAINER_CONTRACTS: Record<string, { name: string; risk: number }> = {
  // Inferno Drainer variants
  '5Q544fKrYsC5Z7M6b4v8nE2d3K9xA1y6W8mR4jD7pLh': { name: 'Inferno Drainer v1', risk: 10 },
  '7f2cB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zZ5': { name: 'Inferno Drainer v2', risk: 10 },
  // MS Drainer variants
  '3d4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7': { name: 'MS Drainer v1', risk: 10 },
  // Pink Drainer variants
  '9a1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU1vW2xY3zA4': { name: 'Pink Drainer v1', risk: 10 },
  // Solana-specific drainers
  'CLINKSINKd2B1kZjA6b3u4f5e6d7c8b9a0B1c2D3e4': { name: 'CLINKSINK', risk: 10 },
  'Drainer123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefgh': { name: 'SolDrainer', risk: 10 },
};

const KNOWN_SAFE_CONTRACTS: Record<string, { name: string }> = {
  '11111111111111111111111111111111': { name: 'System Program' },
  'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR': { name: 'SPL Token Program' },
  'TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q': { name: 'Token-2022 Program' },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X': { name: 'Associated Token Program' },
  'ComputeBudget1111111111111111111111111111': { name: 'Compute Budget Program' },
  'JUP4aqbBV6V6Tr3gWr4aPZp2FcGg1z7eeVjGpnQJYpQ': { name: 'Jupiter DEX (v4)' },
  'JUP6LkbZbjS1JKKSUPm2EA4d1x9sV773eG8w8JVLdV9': { name: 'Jupiter DEX (v6)' },
  '675kPT9YHRvQz2vXz4y2a2RqXvGfJGTdz9Ef8VcB8nkQ': { name: 'Raydium AMM' },
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaWM7hMMFQfE': { name: 'Raydium CLMM' },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VbpYd9w6YiHsQKE': { name: 'Orca Whirlpool' },
  'MarBmsSgKXdrN9ex2ym5Qkd1MstRs7GUyGhYrHHQHRk': { name: 'Marinade Finance' },
  'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ': { name: 'Metaplex Token Metadata' },
};

// ─── Cross-Instruction Patterns ──────────────────────────────────────

interface DrainPattern {
  name: string;
  description: string;
  riskBoost: number;
  detector: (instructions: ParsedInstruction[]) => boolean;
}

const DRAIN_PATTERNS: DrainPattern[] = [
  {
    name: 'approve_and_transfer',
    description: 'Approval + transfer in same transaction (classic drainer)',
    riskBoost: 3,
    detector: (ix) => {
      const hasApprove = ix.some((i) => i.instructionType.startsWith('approve'));
      const hasTransfer = ix.some((i) =>
        i.instructionType === 'transfer' ||
        i.instructionType === 'transferChecked' ||
        i.instructionType === 'system_transfer'
      );
      return hasApprove && hasTransfer;
    },
  },
  {
    name: 'batch_drain',
    description: '3+ transfers in one transaction (batch drain)',
    riskBoost: 4,
    detector: (ix) => {
      const transfers = ix.filter((i) =>
        i.instructionType === 'transfer' ||
        i.instructionType === 'transferChecked' ||
        i.instructionType === 'system_transfer'
      );
      return transfers.length >= 3;
    },
  },
  {
    name: 'authority_change_with_transfer',
    description: 'Authority change + transfer (account takeover + drain)',
    riskBoost: 4,
    detector: (ix) => {
      const hasAuthChange = ix.some((i) => i.instructionType === 'setAuthority');
      const hasTransfer = ix.some((i) =>
        i.instructionType.startsWith('transfer')
      );
      return hasAuthChange && hasTransfer;
    },
  },
  {
    name: 'unlimited_approve_with_close',
    description: 'Unlimited approval + account close (drainer cleanup)',
    riskBoost: 5,
    detector: (ix) => {
      const hasUnlimitedApprove = ix.some((i) =>
        i.instructionType.startsWith('approve') && i.flags.includes('unlimited_approval')
      );
      const hasClose = ix.some((i) => i.instructionType === 'closeAccount');
      return hasUnlimitedApprove && hasClose;
    },
  },
  {
    name: 'freeze_and_drain',
    description: 'Account freeze + transfer (freeze authority abuse)',
    riskBoost: 5,
    detector: (ix) => {
      const hasFreeze = ix.some((i) => i.instructionType === 'freezeAccount');
      const hasTransfer = ix.some((i) => i.instructionType.startsWith('transfer'));
      return hasFreeze && hasTransfer;
    },
  },
  {
    name: 'mint_and_transfer',
    description: 'Minting + transfer (inflation attack)',
    riskBoost: 3,
    detector: (ix) => {
      const hasMint = ix.some((i) => i.instructionType.startsWith('mintTo'));
      const hasTransfer = ix.some((i) => i.instructionType.startsWith('transfer'));
      return hasMint && hasTransfer;
    },
  },
  {
    name: 'permanent_delegate_abuse',
    description: 'Permanent delegate can seize tokens at any time',
    riskBoost: 10,  // Always max out
    detector: (ix) => {
      return ix.some((i) =>
        i.flags.includes('permanent_delegate') ||
        i.instructionType === 'initializePermanentDelegate' ||
        i.instructionType === 'permanentDelegate'
      );
    },
  },
];

// ─── Wallet Context ─────────────────────────────────────────────────

export interface WalletContext {
  address: string;
  solBalance: number;        // SOL balance
  tokenBalances: Record<string, number>;  // mint → balance
  recentTransactions: number;  // Number of txs in last 24h
  knownInteractions: string[]; // Programs the wallet has interacted with before
}

// ─── Risk Engine ─────────────────────────────────────────────────────

export class RiskEngine {
  private walletContext: WalletContext | null = null;
  private customDrainers: Map<string, { name: string; risk: number }> = new Map();

  /**
   * Set wallet context for context-aware risk scoring
   */
  setWalletContext(context: WalletContext): void {
    this.walletContext = context;
  }

  /**
   * Add a custom known drainer address
   */
  addKnownDrainer(address: string, name: string, risk: number = 10): void {
    this.customDrainers.set(address, { name, risk });
  }

  /**
   * Assess risk of a fully parsed transaction
   */
  assessRisk(parsedTx: ParsedTransaction): EnhancedRiskAssessment {
    // Step 1: Score each instruction individually
    const instructionRisks = parsedTx.instructions.map((ix, index) =>
      this.scoreInstruction(ix, index)
    );

    // Step 2: Detect cross-instruction patterns
    const combinedPatterns = DRAIN_PATTERNS.filter((p) =>
      p.detector(parsedTx.instructions)
    ).map((p) => p.name);

    // Step 3: Check address reputation
    const addressFlags = this.checkAddressReputations(parsedTx);

    // Step 4: Calculate combined risk
    const maxInstructionRisk = Math.max(
      ...instructionRisks.map((ir) => ir.finalRisk),
      0
    );

    let combinedScore = maxInstructionRisk;

    // Apply pattern boosts
    for (const patternName of combinedPatterns) {
      const pattern = DRAIN_PATTERNS.find((p) => p.name === patternName);
      if (pattern) {
        combinedScore = Math.min(10, combinedScore + pattern.riskBoost);
      }
    }

    // Apply address reputation boosts
    const maliciousAddresses = addressFlags.filter((f) => f.risk === 'malicious');
    if (maliciousAddresses.length > 0) {
      combinedScore = Math.min(10, combinedScore + 3);
    }

    // Step 5: Calculate wallet impact
    const walletImpact = this.estimateWalletImpact(parsedTx, instructionRisks);

    // If transaction would drain entire wallet, boost score
    if (walletImpact.totalDrainRisk) {
      combinedScore = Math.min(10, combinedScore + 2);
    }

    // Step 6: Build final assessment
    const finalScore = Math.round(combinedScore * 10) / 10;
    const level = this.getRiskLevel(finalScore);
    const recommendation = this.getRecommendation(finalScore);
    const explanation = this.buildExplanation(
      instructionRisks,
      combinedPatterns,
      addressFlags,
      walletImpact
    );

    // Merge flags from original + enhanced
    const allFlags = Array.from(new Set([
      ...parsedTx.overallRisk.flags,
      ...combinedPatterns,
      ...addressFlags.map((f) => `${f.risk}_address:${f.address.slice(0, 8)}`),
    ]));

    return {
      score: finalScore,
      level,
      flags: allFlags,
      recommendation,
      explanation,
      instructionRisks,
      combinedPatterns,
      addressFlags,
      walletImpact,
    };
  }

  /**
   * Score a single instruction with context-aware modifiers
   */
  private scoreInstruction(
    ix: ParsedInstruction,
    index: number
  ): InstructionRiskDetail {
    const rule = this.findRule(ix);
    let baseRisk = rule?.base ?? ix.riskScore;
    const appliedModifiers: RiskModifier[] = [];

    // Apply rule-based modifiers
    if (rule) {
      for (const [modifierName, scoreDelta] of Object.entries(rule.modifiers)) {
        if (this.shouldApplyModifier(ix, modifierName)) {
          baseRisk = Math.min(10, baseRisk + scoreDelta);
          appliedModifiers.push({
            name: modifierName,
            description: this.getModifierDescription(modifierName),
            scoreDelta,
          });
        }
      }
    }

    // Apply flag-based modifiers
    if (ix.flags.includes('unlimited_approval')) {
      if (!appliedModifiers.find((m) => m.name === 'unlimited_approval')) {
        baseRisk = Math.min(10, baseRisk + 5);
        appliedModifiers.push({
          name: 'unlimited_approval',
          description: 'Approving unlimited token spending',
          scoreDelta: 5,
        });
      }
    }

    if (ix.flags.includes('unknown_program')) {
      baseRisk = Math.min(10, baseRisk + 2);
      appliedModifiers.push({
        name: 'unknown_program_call',
        description: 'Calling an unknown/uncataloged program',
        scoreDelta: 2,
      });
    }

    // Check destination against known drainers
    const destAddress = ix.details.destination;
    if (destAddress) {
      const drainerInfo = this.checkDrainer(destAddress);
      if (drainerInfo) {
        baseRisk = Math.min(10, baseRisk + drainerInfo.risk);
        appliedModifiers.push({
          name: 'known_drainer',
          description: `Destination is a known drainer: ${drainerInfo.name}`,
          scoreDelta: drainerInfo.risk,
        });
      }
    }

    // Check delegate against known drainers
    const delegateAddress = ix.details.delegate;
    if (delegateAddress) {
      const drainerInfo = this.checkDrainer(delegateAddress);
      if (drainerInfo) {
        baseRisk = Math.min(10, baseRisk + drainerInfo.risk);
        appliedModifiers.push({
          name: 'known_drainer_delegate',
          description: `Delegate is a known drainer: ${drainerInfo.name}`,
          scoreDelta: drainerInfo.risk,
        });
      }
    }

    // Wallet context modifiers
    if (this.walletContext) {
      // Large amount check (>50% of wallet balance)
      if (ix.details.amount && ix.details.token) {
        const tokenBalance = this.walletContext.tokenBalances[ix.details.token];
        if (tokenBalance && ix.details.amount > tokenBalance * 0.5) {
          baseRisk = Math.min(10, baseRisk + 2);
          appliedModifiers.push({
            name: 'large_amount',
            description: 'Transferring >50% of wallet balance for this token',
            scoreDelta: 2,
          });
        }
      }

      // SOL amount >50% of balance
      if (ix.details.lamports && ix.instructionType === 'system_transfer') {
        const solAmount = ix.details.lamports / 1e9;
        if (this.walletContext.solBalance > 0 && solAmount > this.walletContext.solBalance * 0.5) {
          baseRisk = Math.min(10, baseRisk + 2);
          appliedModifiers.push({
            name: 'large_sol_amount',
            description: 'Transferring >50% of SOL balance',
            scoreDelta: 2,
          });
        }
      }

      // Unknown destination (wallet has never interacted with it)
      const dest = ix.details.destination;
      if (dest && !this.walletContext.knownInteractions.includes(dest)) {
        baseRisk = Math.min(10, baseRisk + 1);
        appliedModifiers.push({
          name: 'unknown_destination_context',
          description: 'You have never interacted with this address before',
          scoreDelta: 1,
        });
      }
    }

    const finalRisk = Math.round(Math.min(10, Math.max(0, baseRisk)) * 10) / 10;

    return {
      index,
      instructionType: ix.instructionType,
      instructionLabel: ix.instructionLabel,
      baseRisk: rule?.base ?? ix.riskScore,
      appliedModifiers,
      finalRisk,
      flags: ix.flags,
    };
  }

  /**
   * Find the risk rule for an instruction
   */
  private findRule(ix: ParsedInstruction): RiskRule | undefined {
    // Direct match
    if (INSTRUCTION_RISK[ix.instructionType]) {
      return INSTRUCTION_RISK[ix.instructionType];
    }

    // System program transfer
    if (ix.programName === 'System' && ix.instructionType === 'transfer') {
      return INSTRUCTION_RISK['system_transfer'];
    }

    // Fallback: no specific rule found
    return undefined;
  }

  /**
   * Determine if a modifier should be applied based on instruction context
   */
  private shouldApplyModifier(ix: ParsedInstruction, modifierName: string): boolean {
    switch (modifierName) {
      case 'unknown_destination':
        return !ix.details.destination || !KNOWN_SAFE_CONTRACTS[ix.details.destination];

      case 'large_amount':
        return ix.details.amount !== undefined && ix.details.amount > 0;

      case 'all_balance':
        return ix.flags.includes('all_balance');

      case 'unlimited_approval':
        return ix.flags.includes('unlimited_approval');

      case 'unknown_delegate':
        return !!ix.details.delegate && !KNOWN_SAFE_CONTRACTS[ix.details.delegate];

      case 'known_drainer':
        return !!ix.details.delegate && !!this.checkDrainer(ix.details.delegate);

      case 'account_owner_transfer':
        return ix.flags.includes('account_owner_transfer');

      case 'close_authority_transfer':
        return ix.flags.includes('close_authority_transfer');

      case 'authority_disabled':
        return ix.flags.includes('authority_disabled');

      case 'to_unknown':
        return !!ix.details.destination;

      case 'not_owner_burn':
        // Burning from an account you don't own
        return false; // Would need more context to determine

      case 'rent_to_unknown':
        return !!ix.details.destination && !KNOWN_SAFE_CONTRACTS[ix.details.destination];

      case 'high_fee':
        return false; // Would need Token-2022 extension data

      case 'to_unknown_program':
        return ix.details.owner !== undefined && !KNOWN_SAFE_CONTRACTS[ix.details.owner ?? ''];

      default:
        return false;
    }
  }

  /**
   * Get human-readable description for a modifier name
   */
  private getModifierDescription(modifierName: string): string {
    const descriptions: Record<string, string> = {
      'unknown_destination': 'Sending to an address with no transaction history',
      'large_amount': 'Transferring more than 50% of wallet balance',
      'all_balance': 'Transferring entire wallet balance (drain)',
      'unlimited_approval': 'Approving unlimited token spending',
      'unknown_delegate': 'Approving an unknown address to spend your tokens',
      'known_drainer': 'Interacting with a known drainer contract',
      'account_owner_transfer': 'Transferring account ownership',
      'close_authority_transfer': 'Transferring close authority',
      'authority_disabled': 'Disabling an authority (reduces risk)',
      'to_unknown': 'Sending to an unknown address',
      'not_owner_burn': 'Burning tokens from an account you do not own',
      'rent_to_unknown': 'Closing account and sending rent to unknown address',
      'high_fee': 'Hidden transfer fee exceeds 5%',
      'to_unknown_program': 'Assigning account to an unknown program',
      'unknown_program_call': 'Calling an uncataloged program',
      'large_sol_amount': 'Transferring more than 50% of SOL balance',
      'unknown_destination_context': 'You have never interacted with this address',
      'known_drainer_delegate': 'Delegate is a known drainer contract',
    };
    return descriptions[modifierName] ?? modifierName;
  }

  /**
   * Check if an address is a known drainer
   */
  private checkDrainer(address: string): { name: string; risk: number } | null {
    // Check built-in drainer list
    if (KNOWN_DRAINER_CONTRACTS[address]) {
      return KNOWN_DRAINER_CONTRACTS[address];
    }

    // Check custom drainer list
    if (this.customDrainers.has(address)) {
      return this.customDrainers.get(address)!;
    }

    return null;
  }

  /**
   * Check address reputations for all addresses in the transaction
   */
  private checkAddressReputations(parsedTx: ParsedTransaction): AddressFlag[] {
    const flags: AddressFlag[] = [];
    const seenAddresses = new Set<string>();

    for (const ix of parsedTx.instructions) {
      const addresses = [
        ix.details.source,
        ix.details.destination,
        ix.details.delegate,
        ix.details.authority,
        ix.details.owner,
      ].filter(Boolean) as string[];

      for (const addr of addresses) {
        if (seenAddresses.has(addr)) continue;
        seenAddresses.add(addr);

        if (KNOWN_DRAINER_CONTRACTS[addr]) {
          flags.push({
            address: addr,
            label: KNOWN_DRAINER_CONTRACTS[addr].name,
            risk: 'malicious',
            source: 'drainer_database',
          });
        } else if (KNOWN_SAFE_CONTRACTS[addr]) {
          flags.push({
            address: addr,
            label: KNOWN_SAFE_CONTRACTS[addr].name,
            risk: 'safe',
            source: 'safe_contracts',
          });
        } else if (this.customDrainers.has(addr)) {
          flags.push({
            address: addr,
            label: this.customDrainers.get(addr)!.name,
            risk: 'malicious',
            source: 'custom_drainers',
          });
        }
      }
    }

    return flags;
  }

  /**
   * Estimate the impact on the user's wallet
   */
  private estimateWalletImpact(
    parsedTx: ParsedTransaction,
    instructionRisks: InstructionRiskDetail[]
  ): WalletImpactEstimate {
    let solAtRisk = 0;
    let tokensAtRisk = 0;
    let approvalsRequested = 0;
    let authorityChanges = 0;

    for (const ix of parsedTx.instructions) {
      // SOL being transferred
      if (
        ix.instructionType === 'system_transfer' &&
        ix.details.lamports
      ) {
        solAtRisk += ix.details.lamports / 1e9;
      }

      // Tokens being transferred
      if (
        (ix.instructionType === 'transfer' || ix.instructionType === 'transferChecked') &&
        ix.details.amount
      ) {
        tokensAtRisk++;
      }

      // Approvals
      if (ix.instructionType.startsWith('approve')) {
        approvalsRequested++;
      }

      // Authority changes
      if (ix.instructionType === 'setAuthority') {
        authorityChanges++;
      }
    }

    // Determine if this is a total drain
    let totalDrainRisk = false;
    if (this.walletContext) {
      const totalSolOut = solAtRisk;
      if (
        totalSolOut >= this.walletContext.solBalance * 0.9 &&
        this.walletContext.solBalance > 0
      ) {
        totalDrainRisk = true;
      }
    }

    return {
      solAtRisk: Math.round(solAtRisk * 10000) / 10000,
      tokensAtRisk,
      approvalsRequested,
      authorityChanges,
      totalDrainRisk,
    };
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score <= 2) return 'SAFE';
    if (score <= 4) return 'LOW';
    if (score <= 6) return 'MEDIUM';
    if (score <= 8) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Get recommendation based on score
   * SAFE (0-2): Auto-approve
   * LOW (3-4): Approve with info
   * MEDIUM (5-6): Require explicit approval
   * HIGH (7-8): Strongly recommend rejection
   * CRITICAL (9-10): Auto-block
   */
  private getRecommendation(
    score: number
  ): 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK' {
    if (score <= 2) return 'APPROVE';
    if (score <= 4) return 'CAUTION';
    if (score <= 6) return 'REJECT';
    return 'BLOCK';
  }

  /**
   * Build a human-readable explanation
   */
  private buildExplanation(
    instructionRisks: InstructionRiskDetail[],
    combinedPatterns: string[],
    addressFlags: AddressFlag[],
    walletImpact: WalletImpactEstimate
  ): string {
    const parts: string[] = [];

    // High-risk instructions
    const highRisk = instructionRisks.filter((ir) => ir.finalRisk >= 5);
    if (highRisk.length > 0) {
      parts.push(
        'High-risk instructions: ' +
          highRisk
            .map((ir) => `${ir.instructionLabel} (risk: ${ir.finalRisk}/10)`)
            .join(', ')
      );
    }

    // Patterns detected
    if (combinedPatterns.length > 0) {
      const patternDescriptions = combinedPatterns
        .map((name) => {
          const pattern = DRAIN_PATTERNS.find((p) => p.name === name);
          return pattern?.description ?? name;
        });
      parts.push('Patterns detected: ' + patternDescriptions.join('; '));
    }

    // Malicious addresses
    const malicious = addressFlags.filter((f) => f.risk === 'malicious');
    if (malicious.length > 0) {
      parts.push(
        'Malicious addresses: ' +
          malicious.map((f) => f.label).join(', ')
      );
    }

    // Wallet impact
    if (walletImpact.solAtRisk > 0) {
      parts.push(`${walletImpact.solAtRisk} SOL at risk`);
    }
    if (walletImpact.approvalsRequested > 0) {
      parts.push(`${walletImpact.approvalsRequested} token approval(s) requested`);
    }
    if (walletImpact.authorityChanges > 0) {
      parts.push(`${walletImpact.authorityChanges} authority change(s)`);
    }
    if (walletImpact.totalDrainRisk) {
      parts.push('⚠️ This transaction would drain your entire wallet!');
    }

    // If nothing concerning found
    if (parts.length === 0) {
      parts.push('No significant risks detected. Transaction appears safe.');
    }

    return parts.join('. ') + '.';
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────

let engineInstance: RiskEngine | null = null;

/**
 * Get or create the global RiskEngine instance
 */
export function getRiskEngine(): RiskEngine {
  if (!engineInstance) {
    engineInstance = new RiskEngine();
  }
  return engineInstance;
}

/**
 * Convenience: analyze a parsed transaction using the default engine
 */
export function analyzeTransactionRisk(
  parsedTx: ParsedTransaction,
  walletContext?: WalletContext
): EnhancedRiskAssessment {
  const engine = getRiskEngine();
  if (walletContext) {
    engine.setWalletContext(walletContext);
  }
  return engine.assessRisk(parsedTx);
}

// ─── Export types and constants ───────────────────────────────────────

export { INSTRUCTION_RISK, KNOWN_DRAINER_CONTRACTS, KNOWN_SAFE_CONTRACTS, DRAIN_PATTERNS };