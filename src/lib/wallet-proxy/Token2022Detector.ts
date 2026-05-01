/**
 * Token2022Detector.ts — Detect dangerous Token-2022 extensions via RPC
 * Part of the Agentic Bro Wallet Protection System
 *
 * Token-2022 (Token Extensions program) adds powerful features that can be
 * abused by scammers. This module detects and scores dangerous extensions:
 *
 * 🚨 CRITICAL (always block):
 * - Permanent Delegate: Creator can transfer/burn ANY holder's tokens
 *
 * ⚠️ HIGH RISK:
 * - Transfer Fee: Hidden fees on transfers (can drain value)
 * - Mint Close Authority: Creator can close the mint (freezes supply)
 * - Metadata Pointer: Can point to malicious metadata
 *
 * ⚡ MEDIUM RISK:
 * - Confidential Transfer: Hidden transfer amounts (privacy, but obscures trails)
 * - Default Account State: Accounts start frozen by default
 * - CPI Guard: Restricts cross-program invocation
 *
 * ✅ LOW RISK:
 * - Interest Bearing: Token accrues interest automatically
 * - Non-Transferable: Soulbound tokens (cannot be transferred)
 */

import { Connection, PublicKey } from '@solana/web3.js';

// ─── Token-2022 Extension Types ─────────────────────────────────────────

export enum TokenExtensionType {
  Uninitialized = 0,
  TransferFeeConfig = 1,
  TransferFeeAmount = 2,
  MintCloseAuthority = 3,
  ConfidentialTransferMint = 4,
  ConfidentialTransferAccount = 5,
  DefaultAccountState = 6,
  ImmutableOwner = 7,
  MemoTransfer = 8,
  NonTransferable = 9,
  InterestBearingConfig = 10,
  CpiGuard = 11,
  PermanentDelegate = 12,
  ConfidentialTransferFeeConfig = 13,
  ConfidentialTransferFeeAmount = 14,
  MetdataPointer = 15,
  Metadata = 16,
  GroupPointer = 17,
  GroupMemberPointer = 18,
}

export interface TokenExtension {
  type: TokenExtensionType;
  typeName: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  description: string;
  details?: Record<string, unknown>;
  raw?: unknown;
}

export interface Token2022Analysis {
  mint: string;
  hasExtensions: boolean;
  extensions: TokenExtension[];
  overallRisk: number; // 0-10
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK';
  flags: string[];
  explanation: string;
}

// ─── Extension Risk Definitions ─────────────────────────────────────────

const EXTENSION_RISKS: Record<TokenExtensionType, Omit<TokenExtension, 'raw'>> = {
  [TokenExtensionType.Uninitialized]: {
    type: TokenExtensionType.Uninitialized,
    typeName: 'Uninitialized',
    riskLevel: 'safe',
    riskScore: 0,
    description: 'Extension slot is uninitialized',
  },
  [TokenExtensionType.TransferFeeConfig]: {
    type: TokenExtensionType.TransferFeeConfig,
    typeName: 'Transfer Fee Config',
    riskLevel: 'high',
    riskScore: 7,
    description: 'Transfer fees configured — fee deducted from every transfer',
  },
  [TokenExtensionType.TransferFeeAmount]: {
    type: TokenExtensionType.TransferFeeAmount,
    typeName: 'Transfer Fee Amount',
    riskLevel: 'medium',
    riskScore: 4,
    description: 'Pending transfer fee amount on this account',
  },
  [TokenExtensionType.MintCloseAuthority]: {
    type: TokenExtensionType.MintCloseAuthority,
    typeName: 'Mint Close Authority',
    riskLevel: 'high',
    riskScore: 7,
    description: 'Mint can be closed — creator can freeze total supply',
  },
  [TokenExtensionType.ConfidentialTransferMint]: {
    type: TokenExtensionType.ConfidentialTransferMint,
    typeName: 'Confidential Transfer (Mint)',
    riskLevel: 'medium',
    riskScore: 5,
    description: 'Confidential transfers enabled — amounts hidden on-chain',
  },
  [TokenExtensionType.ConfidentialTransferAccount]: {
    type: TokenExtensionType.ConfidentialTransferAccount,
    typeName: 'Confidential Transfer (Account)',
    riskLevel: 'medium',
    riskScore: 4,
    description: 'Account configured for confidential transfers',
  },
  [TokenExtensionType.DefaultAccountState]: {
    type: TokenExtensionType.DefaultAccountState,
    typeName: 'Default Account State',
    riskLevel: 'medium',
    riskScore: 5,
    description: 'New accounts may start frozen by default',
  },
  [TokenExtensionType.ImmutableOwner]: {
    type: TokenExtensionType.ImmutableOwner,
    typeName: 'Immutable Owner',
    riskLevel: 'safe',
    riskScore: 0,
    description: 'Token account owner cannot be changed — safer',
  },
  [TokenExtensionType.MemoTransfer]: {
    type: TokenExtensionType.MemoTransfer,
    typeName: 'Memo Required',
    riskLevel: 'low',
    riskScore: 1,
    description: 'Transfers require memo — used for exchange deposits',
  },
  [TokenExtensionType.NonTransferable]: {
    type: TokenExtensionType.NonTransferable,
    typeName: 'Non-Transferable',
    riskLevel: 'safe',
    riskScore: 0,
    description: 'Soulbound token — cannot be transferred',
  },
  [TokenExtensionType.InterestBearingConfig]: {
    type: TokenExtensionType.InterestBearingConfig,
    typeName: 'Interest Bearing',
    riskLevel: 'low',
    riskScore: 2,
    description: 'Token accrues interest automatically',
  },
  [TokenExtensionType.CpiGuard]: {
    type: TokenExtensionType.CpiGuard,
    typeName: 'CPI Guard',
    riskLevel: 'medium',
    riskScore: 4,
    description: 'Cross-program invocation restrictions — may block certain operations',
  },
  [TokenExtensionType.PermanentDelegate]: {
    type: TokenExtensionType.PermanentDelegate,
    typeName: 'Permanent Delegate',
    riskLevel: 'critical',
    riskScore: 10,
    description: '🚨 CRITICAL: Creator can transfer/burn ANY holder\'s tokens at any time!',
  },
  [TokenExtensionType.ConfidentialTransferFeeConfig]: {
    type: TokenExtensionType.ConfidentialTransferFeeConfig,
    typeName: 'Confidential Transfer Fee',
    riskLevel: 'high',
    riskScore: 7,
    description: 'Hidden transfer fees on confidential transfers',
  },
  [TokenExtensionType.ConfidentialTransferFeeAmount]: {
    type: TokenExtensionType.ConfidentialTransferFeeAmount,
    typeName: 'Confidential Transfer Fee Amount',
    riskLevel: 'medium',
    riskScore: 4,
    description: 'Pending confidential transfer fee',
  },
  [TokenExtensionType.MetdataPointer]: {
    type: TokenExtensionType.MetdataPointer,
    typeName: 'Metadata Pointer',
    riskLevel: 'medium',
    riskScore: 3,
    description: 'Points to off-chain metadata — can be changed to malicious content',
  },
  [TokenExtensionType.Metadata]: {
    type: TokenExtensionType.Metadata,
    typeName: 'Token Metadata',
    riskLevel: 'safe',
    riskScore: 1,
    description: 'Embedded token metadata',
  },
  [TokenExtensionType.GroupPointer]: {
    type: TokenExtensionType.GroupPointer,
    typeName: 'Group Pointer',
    riskLevel: 'low',
    riskScore: 2,
    description: 'Points to token group configuration',
  },
  [TokenExtensionType.GroupMemberPointer]: {
    type: TokenExtensionType.GroupMemberPointer,
    typeName: 'Group Member Pointer',
    riskLevel: 'low',
    riskScore: 2,
    description: 'Points to group membership info',
  },
};

// ─── Transfer Fee Parsing ──────────────────────────────────────────────

interface TransferFeeConfig {
  transferFeeConfigAuthority: string;
  withdrawWithheldAuthority: string;
  withheldAmount: bigint;
  olderTransferFee: {
    epoch: bigint;
    maximumFee: bigint;
    transferFeeBasisPoints: number;
  };
  newerTransferFee: {
    epoch: bigint;
    maximumFee: bigint;
    transferFeeBasisPoints: number;
  };
}

function parseTransferFeeConfig(raw: unknown): Partial<TransferFeeConfig> {
  if (!raw || typeof raw !== 'object') return {};

  const data = raw as Record<string, unknown>;
  return {
    transferFeeConfigAuthority: (data.transferFeeConfigAuthority as string) ?? 'unknown',
    withdrawWithheldAuthority: (data.withdrawWithheldAuthority as string) ?? 'unknown',
    withheldAmount: BigInt((data.withheldAmount as string | number) ?? 0),
  };
}

function calculateTransferFeePercent(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2) + '%';
}

// ─── Main Detector Class ───────────────────────────────────────────────

export class Token2022Detector {
  private connection: Connection;
  private cache: Map<string, Token2022Analysis> = new Map();
  private cacheTtl: number = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Analyze a Token-2022 mint for dangerous extensions
   */
  async analyzeMint(mintAddress: string): Promise<Token2022Analysis> {
    // Check cache
    const cached = this.cache.get(mintAddress);
    const timestamp = this.cacheTimestamps.get(mintAddress);
    if (cached && timestamp && Date.now() - timestamp < this.cacheTtl) {
      return cached;
    }

    try {
      const mintPubkey = new PublicKey(mintAddress);
      
      // Get account info with parsed data
      const accountInfo = await this.connection.getParsedAccountInfo(mintPubkey);
      
      if (!accountInfo.value) {
        return this.createUnknownMintResult(mintAddress, 'Mint account not found');
      }

      const parsed = accountInfo.value.data;
      
      // Check if this is a Token-2022 mint
      const owner = accountInfo.value.owner.toString();
      const isToken2022 = owner === 'TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q';
      
      if (!isToken2022) {
        // Not a Token-2022 mint, return safe result
        return {
          mint: mintAddress,
          hasExtensions: false,
          extensions: [],
          overallRisk: 0,
          riskLevel: 'safe',
          recommendation: 'APPROVE',
          flags: [],
          explanation: 'Not a Token-2022 mint — standard SPL token',
        };
      }

      // Parse extensions from mint data
      const extensions = this.parseExtensions(parsed as { program: string; parsed: { info: Record<string, unknown> } });
      
      // Calculate overall risk
      const result = this.calculateRisk(mintAddress, extensions);
      
      // Cache result
      this.cache.set(mintAddress, result);
      this.cacheTimestamps.set(mintAddress, Date.now());
      
      return result;
    } catch (error) {
      console.error('Token2022Detector.analyzeMint error:', error);
      return this.createUnknownMintResult(mintAddress, String(error));
    }
  }

  /**
   * Analyze multiple mints in parallel
   */
  async analyzeMints(mintAddresses: string[]): Promise<Record<string, Token2022Analysis>> {
    const results: Record<string, Token2022Analysis> = {};
    
    await Promise.all(
      mintAddresses.map(async (mint) => {
        results[mint] = await this.analyzeMint(mint);
      })
    );
    
    return results;
  }

  /**
   * Parse extensions from parsed mint account data
   */
  private parseExtensions(parsed: { program: string; parsed: { info: Record<string, unknown> } }): TokenExtension[] {
    const extensions: TokenExtension[] = [];

    // Check for extensions in parsed data
    // Token-2022 mints have extensions array in the parsed info
    if (parsed.program !== 'spl-token-2022') {
      return extensions;
    }

    const info = parsed.parsed.info;
    const extensionList = (info as Record<string, unknown>).extensions;

    if (!extensionList || !Array.isArray(extensionList)) {
      return extensions;
    }

    for (const ext of extensionList) {
      const extData = ext as Record<string, unknown>;
      const extensionName = extData.extension as string;
      const extType = this.extensionNameToType(extensionName);
      
      if (extType === undefined) continue;

      const baseRisk = EXTENSION_RISKS[extType];
      let details: Record<string, unknown> | undefined;
      
      // Parse specific extension details
      if (extType === TokenExtensionType.TransferFeeConfig) {
        const feeData = parseTransferFeeConfig(extData);
        const basisPoints = (extData as Record<string, unknown>).transferFeeBasisPoints as number;
        details = {
          ...feeData,
          feePercent: calculateTransferFeePercent(basisPoints || 0),
        };
      }
      
      if (extType === TokenExtensionType.PermanentDelegate) {
        details = {
          delegate: (extData as Record<string, unknown>).delegate as string,
          warning: 'This address can transfer/burn ANY holder\'s tokens',
        };
      }

      if (extType === TokenExtensionType.MintCloseAuthority) {
        details = {
          closeAuthority: (extData as Record<string, unknown>).closeAuthority as string,
        };
      }

      if (extType === TokenExtensionType.InterestBearingConfig) {
        const rate = (extData as Record<string, unknown>).rate as number;
        details = {
          interestRateBps: rate,
          interestRatePercent: (rate / 100).toFixed(2) + '%',
        };
      }

      extensions.push({
        ...baseRisk,
        details,
        raw: extData,
      });
    }

    return extensions;
  }

  /**
   * Convert extension name string to enum type
   */
  private extensionNameToType(name: string): TokenExtensionType | undefined {
    const nameMap: Record<string, TokenExtensionType> = {
      'transferFeeConfig': TokenExtensionType.TransferFeeConfig,
      'transferFeeAmount': TokenExtensionType.TransferFeeAmount,
      'mintCloseAuthority': TokenExtensionType.MintCloseAuthority,
      'confidentialTransferMint': TokenExtensionType.ConfidentialTransferMint,
      'confidentialTransferAccount': TokenExtensionType.ConfidentialTransferAccount,
      'defaultAccountState': TokenExtensionType.DefaultAccountState,
      'immutableOwner': TokenExtensionType.ImmutableOwner,
      'memoTransfer': TokenExtensionType.MemoTransfer,
      'nonTransferable': TokenExtensionType.NonTransferable,
      'interestBearingConfig': TokenExtensionType.InterestBearingConfig,
      'cpiGuard': TokenExtensionType.CpiGuard,
      'permanentDelegate': TokenExtensionType.PermanentDelegate,
      'confidentialTransferFeeConfig': TokenExtensionType.ConfidentialTransferFeeConfig,
      'confidentialTransferFeeAmount': TokenExtensionType.ConfidentialTransferFeeAmount,
      'metadataPointer': TokenExtensionType.MetdataPointer,
      'tokenMetadata': TokenExtensionType.Metadata,
      'groupPointer': TokenExtensionType.GroupPointer,
      'groupMemberPointer': TokenExtensionType.GroupMemberPointer,
    };

    return nameMap[name];
  }

  /**
   * Calculate overall risk from extensions
   */
  private calculateRisk(
    mint: string,
    extensions: TokenExtension[]
  ): Token2022Analysis {
    // Critical if any extension has critical risk
    const hasCritical = extensions.some((e) => e.riskLevel === 'critical');
    if (hasCritical) {
      const criticalExt = extensions.find((e) => e.riskLevel === 'critical');
      return {
        mint,
        hasExtensions: true,
        extensions,
        overallRisk: 10,
        riskLevel: 'critical',
        recommendation: 'BLOCK',
        flags: ['permanent_delegate', 'token_2022_critical'],
        explanation: `🚨 CRITICAL: ${criticalExt?.typeName} detected — ${criticalExt?.description}`,
      };
    }

    // Calculate max risk score
    const maxRisk = Math.max(...extensions.map((e) => e.riskScore), 0);
    
    // Count high-risk extensions
    const highRiskCount = extensions.filter((e) => e.riskLevel === 'high').length;
    
    // Combine scores
    let overallRisk = maxRisk;
    if (highRiskCount >= 2) {
      overallRisk = Math.min(10, overallRisk + 1);
    }
    if (highRiskCount >= 3) {
      overallRisk = Math.min(10, overallRisk + 2);
    }

    // Determine risk level
    let riskLevel: Token2022Analysis['riskLevel'];
    if (overallRisk === 0) riskLevel = 'safe';
    else if (overallRisk <= 2) riskLevel = 'low';
    else if (overallRisk <= 5) riskLevel = 'medium';
    else if (overallRisk <= 7) riskLevel = 'high';
    else riskLevel = 'critical';

    // Determine recommendation
    let recommendation: Token2022Analysis['recommendation'];
    if (overallRisk <= 2) recommendation = 'APPROVE';
    else if (overallRisk <= 4) recommendation = 'CAUTION';
    else if (overallRisk <= 6) recommendation = 'REJECT';
    else recommendation = 'BLOCK';

    // Build flags
    const flags = extensions.map((e) => e.typeName.toLowerCase().replace(/\s+/g, '_'));

    // Build explanation
    const highRisk = extensions.filter((e) => e.riskScore >= 5);
    let explanation: string;
    
    if (extensions.length === 0) {
      explanation = 'Token-2022 mint with no dangerous extensions detected';
    } else if (highRisk.length === 0) {
      explanation = `Token-2022 with ${extensions.length} extension(s), all appear safe: ${extensions.map((e) => e.typeName).join(', ')}`;
    } else {
      explanation = `⚠️ Token-2022 with ${extensions.length} extension(s). High-risk: ${highRisk.map((e) => e.typeName).join(', ')}`;
    }

    return {
      mint,
      hasExtensions: extensions.length > 0,
      extensions,
      overallRisk,
      riskLevel,
      recommendation,
      flags,
      explanation,
    };
  }

  /**
   * Create result for unknown/error mint
   */
  private createUnknownMintResult(mint: string, error: string): Token2022Analysis {
    return {
      mint,
      hasExtensions: false,
      extensions: [],
      overallRisk: 3,
      riskLevel: 'medium',
      recommendation: 'CAUTION',
      flags: ['unknown_mint', 'analysis_error'],
      explanation: `Unable to analyze mint: ${error}`,
    };
  }

  /**
   * Clear the extension cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Check if a transaction involves any Token-2022 mints
   */
  async checkTransactionMints(
    mintAddresses: string[]
  ): Promise<{ hasDangerousExtensions: boolean; analyses: Record<string, Token2022Analysis> }> {
    const analyses = await this.analyzeMints(mintAddresses);
    const hasDangerousExtensions = Object.values(analyses).some(
      (a) => a.overallRisk >= 5
    );
    return { hasDangerousExtensions, analyses };
  }
}

// ─── Singleton Instance ────────────────────────────────────────────────

let detectorInstance: Token2022Detector | null = null;

/**
 * Get or create the global Token2022Detector instance
 */
export function getToken2022Detector(connection?: Connection): Token2022Detector {
  if (!detectorInstance && connection) {
    detectorInstance = new Token2022Detector(connection);
  }
  if (!detectorInstance) {
    throw new Error('Token2022Detector not initialized. Call getToken2022Detector(connection) first.');
  }
  return detectorInstance;
}

/**
 * Initialize the global detector with a connection
 */
export function initToken2022Detector(connection: Connection): Token2022Detector {
  detectorInstance = new Token2022Detector(connection);
  return detectorInstance;
}

/**
 * Quick check: Is this mint a Token-2022 token with permanent delegate?
 */
export async function hasPermanentDelegate(
  mintAddress: string,
  connection: Connection
): Promise<boolean> {
  const detector = new Token2022Detector(connection);
  const analysis = await detector.analyzeMint(mintAddress);
  return analysis.extensions.some(
    (e) => e.type === TokenExtensionType.PermanentDelegate
  );
}

/**
 * Quick check: What's the transfer fee for this mint?
 */
export async function getTransferFee(
  mintAddress: string,
  connection: Connection
): Promise<number | null> {
  const detector = new Token2022Detector(connection);
  const analysis = await detector.analyzeMint(mintAddress);
  const transferFee = analysis.extensions.find(
    (e) => e.type === TokenExtensionType.TransferFeeConfig
  );
  if (transferFee?.details?.feePercent) {
    const percent = transferFee.details.feePercent as string;
    return parseFloat(percent);
  }
  return null;
}

// ─── Export all ────────────────────────────────────────────────────────

export {
  EXTENSION_RISKS,
};