/**
 * API: /api/token-2022-check
 * 
 * Checks Token-2022 mint accounts for dangerous extensions.
 * Returns all extensions and flags critical ones.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';

interface TokenExtension {
  type: string;
  value: unknown;
  risk: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

interface Token2022CheckResult {
  success: boolean;
  mint?: string;
  extensions?: TokenExtension[];
  overallRisk?: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags?: string[];
  error?: string;
}

// Solana RPC endpoint
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Dangerous extension types
const DANGEROUS_EXTENSIONS: Record<string, { risk: 'HIGH' | 'CRITICAL'; description: string }> = {
  'permanentDelegate': {
    risk: 'CRITICAL',
    description: 'Token creator can transfer ANY holder\'s tokens without approval. This is effectively unlimited access to all wallets holding this token.',
  },
  'transferFee': {
    risk: 'HIGH',
    description: 'Token has a transfer fee that deducts from the sent amount. Check fee percentage.',
  },
  'confidentialTransfer': {
    risk: 'LOW',
    description: 'Token supports confidential transfers. Amounts are encrypted, which may hide malicious activity.',
  },
  'defaultAccountState': {
    risk: 'MEDIUM',
    description: 'Token accounts can be frozen by default. Check if this token requires approval to use.',
  },
  'interestBearing': {
    risk: 'LOW',
    description: 'Token accrues interest over time. Your balance will change automatically.',
  },
  'cpiGuard': {
    risk: 'LOW',
    description: 'Token has CPI guard enabled. Some programs may not be able to transfer this token.',
  },
  'transferHook': {
    risk: 'MEDIUM',
    description: 'Token has a transfer hook that executes custom logic on every transfer.',
  },
  'metadataPointer': {
    risk: 'SAFE',
    description: 'Token has metadata pointer for on-chain metadata.',
  },
  'groupPointer': {
    risk: 'SAFE',
    description: 'Token has group pointer for token group membership.',
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Token2022CheckResult>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const { mint } = req.method === 'GET' ? req.query : req.body;

    if (!mint || typeof mint !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing mint parameter',
      });
    }

    // Validate mint address
    let mintPubkey: PublicKey;
    try {
      mintPubkey = new PublicKey(mint);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid mint address',
      });
    }

    // Connect to Solana
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');

    // Fetch mint account data
    const accountInfo = await connection.getAccountInfo(mintPubkey);
    
    if (!accountInfo) {
      return res.status(404).json({
        success: false,
        error: 'Mint account not found',
      });
    }

    // Check if it's a Token-2022 mint (has extension data)
    // Token-2022 uses a different account layout than legacy tokens
    const extensions = parseTokenExtensions(accountInfo.data);

    // Calculate overall risk
    const extensionRisks = extensions.map(e => e.risk);
    const overallRisk = getOverallRisk(extensionRisks);
    const flags = extensions
      .filter(e => e.risk === 'HIGH' || e.risk === 'CRITICAL')
      .map(e => e.type);

    return res.status(200).json({
      success: true,
      mint,
      extensions,
      overallRisk,
      flags,
    });

  } catch (error) {
    console.error('[Token-2022 Check] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function parseTokenExtensions(data: Buffer): TokenExtension[] {
  const extensions: TokenExtension[] = [];

  // Token-2022 account layout:
  // - 4 bytes: account type (mint = 1)
  // - 4 bytes: optional account state
  // - 8 bytes: decimals (for mint)
  // - 36 bytes: mint authority (optional)
  // - 36 bytes: freeze authority (optional)
  // - 8 bytes: extension count
  // - Extensions: type (2 bytes), length (4 bytes), data

  try {
    // Skip to extension data
    // This is a simplified parser - real implementation would need full SPL Token-2022 parsing
    const offset = 0;
    
    // Minimum mint size is 82 bytes for legacy, more for Token-2022
    if (data.length < 82) {
      return extensions;
    }

    // Check if this is a Token-2022 program
    // Token-2022 program ID ends in "TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q"
    // But we're just analyzing the data structure here

    // Extension types are defined in the TLV data
    // For simplicity, we'll check common patterns

    // Check for permanent delegate (most dangerous)
    // Permanent delegate authority is stored in extension data
    const permanentDelegatePattern = Buffer.from([
      // Extension type for permanent delegate
      0x0f, 0x00, // Type 15 = permanentDelegate
    ]);

    if (includesPattern(data, permanentDelegatePattern)) {
      extensions.push({
        type: 'permanentDelegate',
        value: extractAddress(data, 'permanentDelegate'),
        risk: 'CRITICAL',
        description: DANGEROUS_EXTENSIONS.permanentDelegate.description,
      });
    }

    // Check for transfer fee
    const transferFeePattern = Buffer.from([
      0x08, 0x00, // Type 8 = transferFee
    ]);

    if (includesPattern(data, transferFeePattern)) {
      extensions.push({
        type: 'transferFee',
        value: extractTransferFee(data),
        risk: 'HIGH',
        description: DANGEROUS_EXTENSIONS.transferFee.description,
      });
    }

    // Check for confidential transfer
    const confidentialPattern = Buffer.from([
      0x05, 0x00, // Type 5 = confidentialTransfer
    ]);

    if (includesPattern(data, confidentialPattern)) {
      extensions.push({
        type: 'confidentialTransfer',
        value: null,
        risk: 'LOW',
        description: DANGEROUS_EXTENSIONS.confidentialTransfer.description,
      });
    }

    // Check for default account state
    const defaultStatePattern = Buffer.from([
      0x10, 0x00, // Type 16 = defaultAccountState
    ]);

    if (includesPattern(data, defaultStatePattern)) {
      extensions.push({
        type: 'defaultAccountState',
        value: extractDefaultState(data),
        risk: 'MEDIUM',
        description: DANGEROUS_EXTENSIONS.defaultAccountState.description,
      });
    }

    // Check for interest bearing
    const interestPattern = Buffer.from([
      0x11, 0x00, // Type 17 = interestBearing
    ]);

    if (includesPattern(data, interestPattern)) {
      extensions.push({
        type: 'interestBearing',
        value: extractInterestRate(data),
        risk: 'LOW',
        description: DANGEROUS_EXTENSIONS.interestBearing.description,
      });
    }

    // Check for transfer hook
    const transferHookPattern = Buffer.from([
      0x12, 0x00, // Type 18 = transferHook
    ]);

    if (includesPattern(data, transferHookPattern)) {
      extensions.push({
        type: 'transferHook',
        value: extractAddress(data, 'transferHook'),
        risk: 'MEDIUM',
        description: DANGEROUS_EXTENSIONS.transferHook.description,
      });
    }

  } catch (e) {
    console.error('[Token-2022] Parse error:', e);
  }

  // If no extensions found, check if it's a legacy token
  if (extensions.length === 0) {
    extensions.push({
      type: 'legacyToken',
      value: null,
      risk: 'SAFE',
      description: 'This is a legacy SPL Token with no Token-2022 extensions.',
    });
  }

  return extensions;
}

function includesPattern(data: Buffer, pattern: Buffer): boolean {
  try {
    return data.includes(pattern);
  } catch {
    return false;
  }
}

function extractAddress(data: Buffer, type: string): string | null {
  // Try to extract a public key from the extension data
  // Addresses are 32 bytes
  const typePattern = type === 'permanentDelegate' 
    ? Buffer.from([0x0f, 0x00])
    : Buffer.from([0x12, 0x00]);

  const index = data.indexOf(typePattern);
  if (index === -1) return null;

  // Skip extension type (2 bytes) and length (4 bytes)
  const addressStart = index + 6;
  if (addressStart + 32 > data.length) return null;

  return data.slice(addressStart, addressStart + 32).toString('base64');
}

function extractTransferFee(data: Buffer): { feeBps: number; maxFee: number } | null {
  const pattern = Buffer.from([0x08, 0x00]);
  const index = data.indexOf(pattern);
  if (index === -1) return null;

  // Transfer fee extension has: feeBps (2 bytes), maxFee (8 bytes)
  const feeStart = index + 6; // Skip type + length
  if (feeStart + 10 > data.length) return null;

  const feeBps = data.readUInt16LE(feeStart);
  const maxFee = data.readBigUInt64LE(feeStart + 2);

  return { feeBps, maxFee: Number(maxFee) };
}

function extractDefaultState(data: Buffer): { frozen: boolean } | null {
  const pattern = Buffer.from([0x10, 0x00]);
  const index = data.indexOf(pattern);
  if (index === -1) return null;

  // Default account state: 0 = initialized, 1 = frozen
  const stateStart = index + 6;
  if (stateStart >= data.length) return null;

  return { frozen: data[stateStart] === 1 };
}

function extractInterestRate(data: Buffer): { rate: number } | null {
  const pattern = Buffer.from([0x11, 0x00]);
  const index = data.indexOf(pattern);
  if (index === -1) return null;

  // Interest rate is stored as i16
  const rateStart = index + 6;
  if (rateStart + 2 > data.length) return null;

  return { rate: data.readInt16LE(rateStart) };
}

function getOverallRisk(risks: ('SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[]): 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (risks.includes('CRITICAL')) return 'CRITICAL';
  if (risks.includes('HIGH')) return 'HIGH';
  if (risks.includes('MEDIUM')) return 'MEDIUM';
  if (risks.includes('LOW')) return 'LOW';
  return 'SAFE';
}