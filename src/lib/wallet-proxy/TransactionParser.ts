/**
 * TransactionParser.ts — Decodes raw Solana transactions into human-readable instructions
 * Part of the Agentic Bro Wallet Protection System
 *
 * Takes a serialized Solana transaction and:
 * 1. Identifies each instruction's program (System, SPL Token, Token-2022, etc.)
 * 2. Decodes instruction type from discriminators
 * 3. Extracts parameters (amounts, addresses, authorities)
 * 4. Produces a human-readable summary for each instruction
 */

import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as bs58 from 'bs58';

// ─── Known Program IDs ───────────────────────────────────────────────

export const PROGRAMS: Record<string, string> = {
  System: '11111111111111111111111111111111',
  Token: 'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR',
  Token2022: 'TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q',
  AssociatedToken: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X',
  Metaplex: 'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ',
  ComputeBudget: 'ComputeBudget1111111111111111111111111111',
  Memo: 'Memo1UhkJRfHYvkd3q5E2hQ3QaiV3JqfB3E3',
  Stake: 'Stake1111111111111111111111111111111111111',
  Vote: 'Vote111111111111111111111111111111111111111',
  Config: 'Config1111111111111111111111111111111111111',
  // DEX / DeFi
  Jupiter: 'JUP4aqbBV6V6Tr3gWr4aPZp2FcGg1z7eeVjGpnQJYpQ',
  JupiterV6: '***REMOVED***',
  RaydiumAmm: '675kPT9YHRvQz2vXz4y2a2RqXvGfJGTdz9Ef8VcB8nkQ',
  RaydiumClmm: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaWM7hMMFQfE',
  OrcaWhirlpool: 'whirLbMiicVdio4qvUfM5KAg6Ct8VbpYd9w6YiHsQKE',
  Marinade: 'MarBmsSgKXdrN9ex2ym5Qkd1MstRs7GUyGhYrHHQHRk',
  Serum: '9xQeWvG816bUx9EOjH5EJkZM5v4jQrB1vEo3rX7G2d2',
  OpenBook: 'srmqPvymJeFKQ1zRme1LQ5yeHQE9B3AXZkGv1BL7S2Y',
  Wormhole: 'WormT3McT3Kq7m3MXs59nGQW8nhU9rZKryVE2qZo9qJ',
  // NFT / Metadata
  TokenMetadata: 'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ',
  CandyMachine: 'CndyVrkE5Rkr3KbF4fG3Ky3nK7hiRqQ8c1G2Q9b2F2z',
  CandyGuard: 'Guard1ZwP77V5GvM2pD3FhKb6q7V7j3sE1LqY2N7VfDv',
  // Utility
  Clock: 'SysvarC1ock11111111111111111111111111111111',
  Rent: 'SysvarRent111111111111111111111111111111111',
  RecentBlockhashes: 'SysvarRecentB1ockHashes11111111111111111111',
  Instructions: 'Sysvar1nstructions1111111111111111111111111',
  Feature: 'Feature11111111111111111111111111111111111',
};

// Reverse lookup: programId → name
const PROGRAM_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(PROGRAMS).map(([name, id]) => [id, name])
);

// ─── Instruction Discriminators ──────────────────────────────────────

// SPL Token instruction indices (little-endian u32)
const SPL_TOKEN_DISCRIMINATORS: Record<number, { name: string; label: string; baseRisk: number }> = {
  0: { name: 'initializeMint', label: 'Initialize Mint', baseRisk: 3 },
  1: { name: 'initializeAccount', label: 'Initialize Token Account', baseRisk: 1 },
  2: { name: 'initializeMultisig', label: 'Initialize Multisig', baseRisk: 2 },
  3: { name: 'transfer', label: 'Transfer Tokens', baseRisk: 1 },
  4: { name: 'approve', label: 'Approve Token Spending', baseRisk: 2 },
  5: { name: 'revoke', label: 'Revoke Approval', baseRisk: 0 },
  6: { name: 'setAuthority', label: 'Set Authority', baseRisk: 8 },
  7: { name: 'mintTo', label: 'Mint Tokens', baseRisk: 4 },
  8: { name: 'burn', label: 'Burn Tokens', baseRisk: 3 },
  9: { name: 'closeAccount', label: 'Close Token Account', baseRisk: 2 },
  10: { name: 'freezeAccount', label: 'Freeze Account', baseRisk: 6 },
  11: { name: 'thawAccount', label: 'Thaw Account', baseRisk: 1 },
  12: { name: 'transferChecked', label: 'Transfer Tokens (Checked)', baseRisk: 1 },
  13: { name: 'approveChecked', label: 'Approve Token Spending (Checked)', baseRisk: 2 },
  14: { name: 'mintToChecked', label: 'Mint Tokens (Checked)', baseRisk: 4 },
  15: { name: 'burnChecked', label: 'Burn Tokens (Checked)', baseRisk: 3 },
  16: { name: 'initializeAccount2', label: 'Initialize Account (v2)', baseRisk: 1 },
  17: { name: 'syncNative', label: 'Sync Native Balance', baseRisk: 1 },
  18: { name: 'initializeAccount3', label: 'Initialize Account (v3)', baseRisk: 1 },
  19: { name: 'initializeMultisig2', label: 'Initialize Multisig (v2)', baseRisk: 2 },
  20: { name: 'initializeMintCloseAuthority', label: 'Set Mint Close Authority', baseRisk: 5 },
  21: { name: 'initializePermanentDelegate', label: 'Set Permanent Delegate', baseRisk: 10 },
};

// System Program instruction indices
const SYSTEM_PROGRAM_DISCRIMINATORS: Record<number, { name: string; label: string; baseRisk: number }> = {
  0: { name: 'createAccount', label: 'Create Account', baseRisk: 1 },
  1: { name: 'assign', label: 'Assign Account', baseRisk: 3 },
  2: { name: 'transfer', label: 'Transfer SOL', baseRisk: 1 },
  3: { name: 'createAccountWithSeed', label: 'Create Account with Seed', baseRisk: 1 },
  4: { name: 'advanceNonceAccount', label: 'Advance Nonce', baseRisk: 0 },
  5: { name: 'withdrawNonceAccount', label: 'Withdraw from Nonce', baseRisk: 2 },
  6: { name: 'initializeNonceAccount', label: 'Initialize Nonce', baseRisk: 1 },
  7: { name: 'authorizeNonceAccount', label: 'Authorize Nonce', baseRisk: 3 },
  8: { name: 'allocate', label: 'Allocate Account Space', baseRisk: 1 },
  9: { name: 'allocateWithSeed', label: 'Allocate with Seed', baseRisk: 1 },
  10: { name: 'assignWithSeed', label: 'Assign with Seed', baseRisk: 3 },
  11: { name: 'transferWithSeed', label: 'Transfer SOL with Seed', baseRisk: 1 },
  12: { name: 'upgradeNonceAccount', label: 'Upgrade Nonce Account', baseRisk: 2 },
};

// Compute Budget instruction indices
const COMPUTE_BUDGET_DISCRIMINATORS: Record<number, { name: string; label: string; baseRisk: number }> = {
  0: { name: 'requestUnits', label: 'Request Compute Units', baseRisk: 0 },
  1: { name: 'requestHeapFrame', label: 'Request Heap Frame', baseRisk: 0 },
  2: { name: 'requestComputeBudget', label: 'Set Compute Budget', baseRisk: 0 },
  3: { name: 'setComputeUnitLimit', label: 'Set Compute Unit Limit', baseRisk: 0 },
  4: { name: 'setComputeUnitPrice', label: 'Set Priority Fee', baseRisk: 0 },
  5: { name: 'setLoadedAccountsDataSizeLimit', label: 'Set Loaded Accounts Limit', baseRisk: 0 },
};

// Associated Token Program only has one instruction
const ASSOCIATED_TOKEN_DISCRIMINATORS: Record<number, { name: string; label: string; baseRisk: number }> = {
  0: { name: 'create', label: 'Create Associated Token Account', baseRisk: 1 },
  1: { name: 'createIdempotent', label: 'Create ATA (Idempotent)', baseRisk: 1 },
  2: { name: 'recoverNested', label: 'Recover Nested ATA', baseRisk: 2 },
};

// Token-2022 additional instructions (beyond SPL Token base)
const TOKEN_2022_EXTRA_DISCRIMINATORS: Record<number, { name: string; label: string; baseRisk: number }> = {
  20: { name: 'initializeMintCloseAuthority', label: 'Set Mint Close Authority', baseRisk: 5 },
  21: { name: 'initializePermanentDelegate', label: 'Set Permanent Delegate', baseRisk: 10 },
  22: { name: 'amountToUiAmount', label: 'Convert Amount to UI Amount', baseRisk: 0 },
  23: { name: 'uiAmountToAmount', label: 'Convert UI Amount to Amount', baseRisk: 0 },
};

// ─── Types ────────────────────────────────────────────────────────────

export interface ParsedInstruction {
  programId: string;
  programName: string;
  instructionType: string;
  instructionLabel: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  humanReadable: string;
  details: {
    source?: string;
    destination?: string;
    amount?: number;
    token?: string;
    authority?: string;
    authorityType?: string;
    delegate?: string;
    amountRaw?: string;
    owner?: string;
    lamports?: number;
    space?: number;
  };
  flags: string[];
  index: number; // instruction index in the transaction
}

export interface ParsedTransaction {
  transactionId: string;
  fee: number;
  instructions: ParsedInstruction[];
  signerKeys: string[];
  overallRisk: RiskAssessment;
  timestamp: string;
}

export interface RiskAssessment {
  score: number;
  level: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  recommendation: 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK';
  explanation: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function readU32LE(data: Buffer, offset: number): number {
  return data.readUInt32LE(offset);
}

function readU64LE(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function readPubkey(data: Buffer, offset: number): string {
  try {
    return new PublicKey(data.slice(offset, offset + 32)).toString();
  } catch {
    return data.slice(offset, offset + 32).toString('hex');
  }
}

function formatAmount(lamports: bigint, decimals: number = 9): number {
  return Number(lamports) / Math.pow(10, decimals);
}

function abbreviateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getRiskLevel(score: number): 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score <= 2) return 'SAFE';
  if (score <= 4) return 'LOW';
  if (score <= 6) return 'MEDIUM';
  if (score <= 8) return 'HIGH';
  return 'CRITICAL';
}

function getDiscriminatorMap(
  programId: string
): Record<number, { name: string; label: string; baseRisk: number }> {
  const name = PROGRAM_BY_ID[programId];
  switch (name) {
    case 'System':
      return SYSTEM_PROGRAM_DISCRIMINATORS;
    case 'Token':
      return SPL_TOKEN_DISCRIMINATORS;
    case 'Token2022':
      return { ...SPL_TOKEN_DISCRIMINATORS, ...TOKEN_2022_EXTRA_DISCRIMINATORS };
    case 'AssociatedToken':
      return ASSOCIATED_TOKEN_DISCRIMINATORS;
    case 'ComputeBudget':
      return COMPUTE_BUDGET_DISCRIMINATORS;
    default:
      return {};
  }
}

// ─── Instruction Decoders ─────────────────────────────────────────────

interface DecodedInstruction {
  name: string;
  label: string;
  baseRisk: number;
  details: ParsedInstruction['details'];
  flags: string[];
  humanReadable: string;
}

function decodeSystemInstruction(
  ix: TransactionInstruction,
  discriminator: number
): DecodedInstruction {
  const data = ix.data;
  const keys = ix.keys;

  switch (discriminator) {
    case 2: { // transfer
      const lamports = readU64LE(data, 4);
      const from = keys[0]?.pubkey.toString() ?? 'unknown';
      const to = keys[1]?.pubkey.toString() ?? 'unknown';
      const solAmount = formatAmount(lamports, 9);

      const flags: string[] = [];
      if (lamports === BigInt(0)) flags.push('zero_transfer');

      return {
        name: 'transfer',
        label: 'Transfer SOL',
        baseRisk: 1,
        details: {
          source: from,
          destination: to,
          lamports: Number(lamports),
          amount: solAmount,
        },
        flags,
        humanReadable: `Sending ${solAmount.toFixed(4)} SOL to ${abbreviateAddress(to)}`,
      };
    }

    case 0: { // createAccount
      const lamports = readU64LE(data, 4);
      const space = readU32LE(data, 12);
      const owner = readPubkey(data, 16);
      const from = keys[0]?.pubkey.toString() ?? 'unknown';
      const newAccount = keys[1]?.pubkey.toString() ?? 'unknown';

      return {
        name: 'createAccount',
        label: 'Create Account',
        baseRisk: 1,
        details: {
          source: from,
          destination: newAccount,
          lamports: Number(lamports),
          amount: formatAmount(lamports, 9),
          owner,
          space,
        },
        flags: [],
        humanReadable: `Create new account ${abbreviateAddress(newAccount)} with ${formatAmount(lamports, 9).toFixed(4)} SOL (${space} bytes)`,
      };
    }

    case 1: { // assign
      const owner = readPubkey(data, 4);
      const account = keys[0]?.pubkey.toString() ?? 'unknown';

      const flags = ['account_reassignment'];
      return {
        name: 'assign',
        label: 'Assign Account Owner',
        baseRisk: 3,
        details: {
          source: account,
          owner,
        },
        flags,
        humanReadable: `Assign account ${abbreviateAddress(account)} to program ${abbreviateAddress(owner)}`,
      };
    }

    default: {
      const discMap = SYSTEM_PROGRAM_DISCRIMINATORS[discriminator];
      return {
        name: discMap?.name ?? `system_${discriminator}`,
        label: discMap?.label ?? `System Instruction #${discriminator}`,
        baseRisk: discMap?.baseRisk ?? 2,
        details: {},
        flags: [],
        humanReadable: discMap?.label ?? `System program instruction #${discriminator}`,
      };
    }
  }
}

function decodeSplTokenInstruction(
  ix: TransactionInstruction,
  discriminator: number,
  isToken2022: boolean = false
): DecodedInstruction {
  const data = ix.data;
  const keys = ix.keys;
  const prefix = isToken2022 ? 'Token-2022' : 'SPL Token';

  switch (discriminator) {
    case 3: // transfer
    case 12: { // transferChecked
      const isTransferChecked = discriminator === 12;
      let amount: bigint;
      let decimals: number = 0;

      if (isTransferChecked) {
        amount = readU64LE(data, 4);
        decimals = data[12];
      } else {
        amount = readU64LE(data, 4);
      }

      const source = keys[0]?.pubkey.toString() ?? 'unknown';
      const destination = keys[1]?.pubkey.toString() ?? 'unknown';
      // For transferChecked, keys[2] is mint, authority is keys[3]
      const authority = isTransferChecked
        ? keys[3]?.pubkey.toString()
        : keys[2]?.pubkey.toString();

      const humanAmount = decimals > 0 ? formatAmount(amount, decimals) : Number(amount);
      const flags: string[] = [];

      return {
        name: isTransferChecked ? 'transferChecked' : 'transfer',
        label: isTransferChecked ? 'Transfer Tokens (Checked)' : 'Transfer Tokens',
        baseRisk: 1,
        details: {
          source,
          destination,
          amount: humanAmount,
          amountRaw: amount.toString(),
          authority,
          token: isTransferChecked ? keys[2]?.pubkey.toString() : undefined,
        },
        flags,
        humanReadable: `Transferring ${humanAmount.toLocaleString()} tokens to ${abbreviateAddress(destination)}`,
      };
    }

    case 4: // approve
    case 13: { // approveChecked
      const isApproveChecked = discriminator === 13;
      let amount: bigint;
      let decimals: number = 0;

      if (isApproveChecked) {
        amount = readU64LE(data, 4);
        decimals = data[12];
      } else {
        amount = readU64LE(data, 4);
      }

      const source = keys[0]?.pubkey.toString() ?? 'unknown';
      const delegate = keys[1]?.pubkey.toString() ?? 'unknown';
      const owner = isApproveChecked
        ? keys[3]?.pubkey.toString()
        : keys[2]?.pubkey.toString();

      const isUnlimited = amount === BigInt('0xffffffffffffffff');
      const humanAmount = isUnlimited ? 'UNLIMITED' : formatAmount(amount, decimals).toLocaleString();

      const flags: string[] = [];
      if (isUnlimited) flags.push('unlimited_approval');

      return {
        name: isApproveChecked ? 'approveChecked' : 'approve',
        label: isApproveChecked ? 'Approve Token Spending (Checked)' : 'Approve Token Spending',
        baseRisk: isUnlimited ? 7 : 2,
        details: {
          source,
          delegate,
          amount: isUnlimited ? Infinity : formatAmount(amount, decimals),
          amountRaw: amount.toString(),
          authority: owner,
          token: isApproveChecked ? keys[2]?.pubkey.toString() : undefined,
        },
        flags,
        humanReadable: `Approve ${humanAmount} token spending for ${abbreviateAddress(delegate)}${isUnlimited ? ' ⚠️ UNLIMITED' : ''}`,
      };
    }

    case 5: { // revoke
      const source = keys[0]?.pubkey.toString() ?? 'unknown';
      const authority = keys[1]?.pubkey.toString() ?? 'unknown';

      return {
        name: 'revoke',
        label: 'Revoke Approval',
        baseRisk: 0,
        details: { source, authority },
        flags: [],
        humanReadable: `Revoking all token approvals on ${abbreviateAddress(source)} — this is SAFE ✅`,
      };
    }

    case 6: { // setAuthority
      const authorityType = data[4]; // 0=MintTokens, 1=FreezeAccount, 2=AccountOwner, 3=CloseAccount
      const newAuthority = data.length > 5 ? readPubkey(data, 5) : null;
      const account = keys[0]?.pubkey.toString() ?? 'unknown';
      const currentAuthority = keys[2]?.pubkey.toString() ?? 'unknown';

      const authorityNames: Record<number, string> = {
        0: 'Mint Authority',
        1: 'Freeze Authority',
        2: 'Account Owner',
        3: 'Close Authority',
      };

      const authName = authorityNames[authorityType] ?? `Authority Type ${authorityType}`;
      const flags = ['authority_transfer'];

      if (authorityType === 2) flags.push('account_owner_transfer');
      if (authorityType === 3) flags.push('close_authority_transfer');
      if (newAuthority === null) flags.push('authority_disabled');

      return {
        name: 'setAuthority',
        label: 'Set Authority',
        baseRisk: 8,
        details: {
          source: account,
          authority: newAuthority ?? 'DISABLED',
          authorityType: authName,
        },
        flags,
        humanReadable: `Transfer ${authName} of ${abbreviateAddress(account)} → ${newAuthority ? abbreviateAddress(newAuthority) : 'DISABLED'}`,
      };
    }

    case 7: // mintTo
    case 14: { // mintToChecked
      const isMintToChecked = discriminator === 14;
      let amount: bigint;
      let decimals: number = 0;

      if (isMintToChecked) {
        amount = readU64LE(data, 4);
        decimals = data[12];
      } else {
        amount = readU64LE(data, 4);
      }

      const mint = keys[0]?.pubkey.toString() ?? 'unknown';
      const destination = keys[1]?.pubkey.toString() ?? 'unknown';
      const authority = keys[2]?.pubkey.toString() ?? 'unknown';
      const humanAmount = decimals > 0 ? formatAmount(amount, decimals) : Number(amount);

      const flags: string[] = ['token_minting'];

      return {
        name: isMintToChecked ? 'mintToChecked' : 'mintTo',
        label: isMintToChecked ? 'Mint Tokens (Checked)' : 'Mint Tokens',
        baseRisk: 4,
        details: {
          destination,
          amount: humanAmount,
          amountRaw: amount.toString(),
          authority,
          token: mint,
        },
        flags,
        humanReadable: `Minting ${humanAmount.toLocaleString()} new tokens to ${abbreviateAddress(destination)}`,
      };
    }

    case 8: // burn
    case 15: { // burnChecked
      const isBurnChecked = discriminator === 15;
      let amount: bigint;
      let decimals: number = 0;

      if (isBurnChecked) {
        amount = readU64LE(data, 4);
        decimals = data[12];
      } else {
        amount = readU64LE(data, 4);
      }

      const source = keys[0]?.pubkey.toString() ?? 'unknown';
      const mint = keys[1]?.pubkey.toString() ?? 'unknown';
      const authority = keys[2]?.pubkey.toString() ?? 'unknown';
      const humanAmount = decimals > 0 ? formatAmount(amount, decimals) : Number(amount);

      return {
        name: isBurnChecked ? 'burnChecked' : 'burn',
        label: isBurnChecked ? 'Burn Tokens (Checked)' : 'Burn Tokens',
        baseRisk: 3,
        details: {
          source,
          amount: humanAmount,
          amountRaw: amount.toString(),
          authority,
          token: mint,
        },
        flags: [],
        humanReadable: `Burning ${humanAmount.toLocaleString()} tokens from ${abbreviateAddress(source)}`,
      };
    }

    case 9: { // closeAccount
      const account = keys[0]?.pubkey.toString() ?? 'unknown';
      const destination = keys[1]?.pubkey.toString() ?? 'unknown';
      const authority = keys[2]?.pubkey.toString() ?? 'unknown';

      return {
        name: 'closeAccount',
        label: 'Close Token Account',
        baseRisk: 2,
        details: {
          source: account,
          destination,
          authority,
        },
        flags: ['account_closure'],
        humanReadable: `Close token account ${abbreviateAddress(account)}, rent to ${abbreviateAddress(destination)}`,
      };
    }

    case 10: { // freezeAccount
      const account = keys[0]?.pubkey.toString() ?? 'unknown';
      const authority = keys[2]?.pubkey.toString() ?? 'unknown';

      return {
        name: 'freezeAccount',
        label: 'Freeze Account',
        baseRisk: 6,
        details: { source: account, authority },
        flags: ['account_freeze'],
        humanReadable: `Freezing token account ${abbreviateAddress(account)} ⚠️`,
      };
    }

    case 20: { // initializeMintCloseAuthority (Token-2022)
      const flags = ['close_authority_set'];
      return {
        name: 'initializeMintCloseAuthority',
        label: 'Set Mint Close Authority',
        baseRisk: 5,
        details: {},
        flags,
        humanReadable: 'Setting close authority on mint — allows mint to be closed ⚠️',
      };
    }

    case 21: { // initializePermanentDelegate (Token-2022) — ALWAYS CRITICAL
      return {
        name: 'initializePermanentDelegate',
        label: 'Set Permanent Delegate',
        baseRisk: 10,
        details: {},
        flags: ['permanent_delegate', 'critical_extension'],
        humanReadable: '🚨 PERMANENT DELEGATE SET — token creator can transfer/burn ANY holder\'s tokens!',
      };
    }

    default: {
      const discMap = getDiscriminatorMap(isToken2022 ? PROGRAMS.Token2022 : PROGRAMS.Token);
      const entry = discMap[discriminator];
      return {
        name: entry?.name ?? `token_ix_${discriminator}`,
        label: entry?.label ?? `Token Instruction #${discriminator}`,
        baseRisk: entry?.baseRisk ?? 2,
        details: {},
        flags: ['unknown_instruction'],
        humanReadable: entry?.label ?? `Unknown ${prefix} instruction #${discriminator}`,
      };
    }
  }
}

function decodeAssociatedTokenInstruction(
  ix: TransactionInstruction,
  discriminator: number
): DecodedInstruction {
  const keys = ix.keys;
  const funder = keys[0]?.pubkey.toString() ?? 'unknown';
  const ata = keys[1]?.pubkey.toString() ?? 'unknown';
  const owner = keys[2]?.pubkey.toString() ?? 'unknown';
  const mint = keys[3]?.pubkey.toString() ?? 'unknown';

  switch (discriminator) {
    case 0:
      return {
        name: 'create',
        label: 'Create Associated Token Account',
        baseRisk: 1,
        details: { source: funder, destination: ata, owner, token: mint },
        flags: [],
        humanReadable: `Create token account for ${abbreviateAddress(owner)} (mint: ${abbreviateAddress(mint)})`,
      };
    case 1:
      return {
        name: 'createIdempotent',
        label: 'Create ATA (Idempotent)',
        baseRisk: 1,
        details: { source: funder, destination: ata, owner, token: mint },
        flags: [],
        humanReadable: `Create token account for ${abbreviateAddress(owner)} if not exists`,
      };
    case 2:
      return {
        name: 'recoverNested',
        label: 'Recover Nested ATA',
        baseRisk: 2,
        details: { source: funder, destination: ata, owner },
        flags: [],
        humanReadable: `Recover nested associated token account ${abbreviateAddress(ata)}`,
      };
    default:
      return {
        name: `ata_ix_${discriminator}`,
        label: `ATA Instruction #${discriminator}`,
        baseRisk: 1,
        details: {},
        flags: [],
        humanReadable: `Associated Token program instruction #${discriminator}`,
      };
  }
}

function decodeComputeBudgetInstruction(
  ix: TransactionInstruction,
  discriminator: number
): DecodedInstruction {
  const data = ix.data;
  const discMap = COMPUTE_BUDGET_DISCRIMINATORS[discriminator];
  let details: ParsedInstruction['details'] = {};

  switch (discriminator) {
    case 0: { // requestUnits
      const units = readU32LE(data, 1);
      const additionalFee = readU32LE(data, 5);
      details = { amount: units, lamports: additionalFee };
      break;
    }
    case 2: { // requestComputeBudget
      const units = readU32LE(data, 1);
      const additionalFee = readU32LE(data, 5);
      details = { amount: units, lamports: additionalFee };
      break;
    }
    case 3: { // setComputeUnitLimit
      const units = readU32LE(data, 1);
      details = { amount: units };
      break;
    }
    case 4: { // setComputeUnitPrice
      const microLamports = readU64LE(data, 1);
      details = { lamports: Number(microLamports) };
      break;
    }
  }

  return {
    name: discMap?.name ?? `compute_${discriminator}`,
    label: discMap?.label ?? `Compute Budget #${discriminator}`,
    baseRisk: 0,
    details,
    flags: [],
    humanReadable: discMap?.label ?? `Compute budget instruction`,
  };
}

// ─── Unknown Program Handler ─────────────────────────────────────────

function decodeUnknownInstruction(
  ix: TransactionInstruction,
  index: number
): DecodedInstruction {
  const programId = ix.programId.toString();
  const programName = PROGRAM_BY_ID[programId];

  // Known DeFi/complex programs — mark as needing manual review
  const complexPrograms = [
    PROGRAMS.Jupiter, PROGRAMS.JupiterV6,
    PROGRAMS.RaydiumAmm, PROGRAMS.RaydiumClmm,
    PROGRAMS.OrcaWhirlpool, PROGRAMS.Marinade,
    PROGRAMS.Serum, PROGRAMS.OpenBook,
  ];

  if (complexPrograms.includes(programId)) {
    return {
      name: `${programName?.toLowerCase()}_instruction`,
      label: `${programName} Instruction`,
      baseRisk: 2, // Known program but can't decode inner instructions
      details: { owner: programId },
      flags: ['known_program_undecoded'],
      humanReadable: `${programName} instruction (inner instructions not decoded — review recommended)`,
    };
  }

  return {
    name: `unknown_program_${index}`,
    label: `Unknown Program Call`,
    baseRisk: 4,
    details: { owner: programId },
    flags: ['unknown_program'],
    humanReadable: `Call to unknown program ${abbreviateAddress(programId)} — unable to decode instruction`,
  };
}

// ─── Main Parser ─────────────────────────────────────────────────────

/**
 * Parse a single TransactionInstruction into a ParsedInstruction
 */
export function parseInstruction(
  ix: TransactionInstruction,
  index: number,
  signerKeys: string[]
): ParsedInstruction {
  const programId = ix.programId.toString();
  const programName = PROGRAM_BY_ID[programId] ?? 'Unknown';

  // Read discriminator (first byte or first 4 bytes for some programs)
  const data = ix.data;
  const discriminator = data.length > 0 ? readU32LE(data, 0) : -1;

  let decoded: DecodedInstruction;

  switch (programId) {
    case PROGRAMS.System:
      decoded = decodeSystemInstruction(ix, discriminator);
      break;

    case PROGRAMS.Token:
      decoded = decodeSplTokenInstruction(ix, discriminator, false);
      break;

    case PROGRAMS.Token2022:
      decoded = decodeSplTokenInstruction(ix, discriminator, true);
      break;

    case PROGRAMS.AssociatedToken:
      decoded = decodeAssociatedTokenInstruction(ix, discriminator);
      break;

    case PROGRAMS.ComputeBudget:
      decoded = decodeComputeBudgetInstruction(ix, discriminator);
      break;

    default:
      decoded = decodeUnknownInstruction(ix, index);
      break;
  }

  return {
    programId,
    programName,
    instructionType: decoded.name,
    instructionLabel: decoded.label,
    riskScore: decoded.baseRisk,
    riskLevel: getRiskLevel(decoded.baseRisk),
    humanReadable: decoded.humanReadable,
    details: decoded.details,
    flags: decoded.flags,
    index,
  };
}

/**
 * Parse a full Solana Transaction into ParsedTransaction
 */
export function parseTransaction(tx: Transaction): ParsedTransaction {
  const signerKeys = tx.signatures.map((sig) => {
    try {
      return sig.publicKey.toString();
    } catch {
      return 'unknown';
    }
  });

  const instructions: ParsedInstruction[] = tx.instructions.map((ix, i) =>
    parseInstruction(ix, i, signerKeys)
  );

  // Calculate fee estimate (basic: 5000 lamports per signature + 5000 base)
  const fee = (tx.signatures.length * 5000) + 5000;

  // Calculate overall risk from all instructions
  const maxScore = Math.max(...instructions.map((ix) => ix.riskScore), 0);
  const allFlags = instructions.flatMap((ix) => ix.flags);
  const overallRisk = calculateOverallRisk(instructions, maxScore, allFlags);

  return {
    transactionId: tx.signatures?.[0]?.signature
      ? bs58.encode(tx.signatures[0].signature as unknown as Uint8Array)
      : `pending_${Date.now()}`,
    fee,
    instructions,
    signerKeys,
    overallRisk,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse a base58-encoded serialized transaction
 */
export function parseTransactionFromBase58(
  serializedTx: string
): ParsedTransaction {
  const buffer = bs58.decode(serializedTx);
  const tx = Transaction.from(buffer);
  return parseTransaction(tx);
}

/**
 * Calculate overall transaction risk from all instructions
 */
function calculateOverallRisk(
  instructions: ParsedInstruction[],
  maxScore: number,
  flags: string[]
): RiskAssessment {
  // Boost score for combined patterns
  let boostedScore = maxScore;

  // Multiple high-risk instructions compound risk
  const highRiskCount = instructions.filter((ix) => ix.riskScore >= 7).length;
  if (highRiskCount >= 2) boostedScore = Math.min(10, boostedScore + 2);

  // Batch drain pattern: multiple transfers in one tx
  const transferCount = instructions.filter(
    (ix) => ix.instructionType === 'transfer' || ix.instructionType === 'transferChecked'
  ).length;
  if (transferCount >= 3) {
    boostedScore = Math.min(10, boostedScore + 3);
    flags.push('batch_drain_pattern');
  }

  // Approval + transfer in same tx (classic drainer)
  const hasApprove = instructions.some((ix) => ix.instructionType.startsWith('approve'));
  const hasTransfer = instructions.some((ix) => ix.instructionType.startsWith('transfer'));
  if (hasApprove && hasTransfer) {
    boostedScore = Math.min(10, boostedScore + 2);
    flags.push('approve_and_transfer');
  }

  // Authority transfer + transfer
  const hasAuthorityChange = instructions.some((ix) => ix.instructionType === 'setAuthority');
  if (hasAuthorityChange && hasTransfer) {
    boostedScore = Math.min(10, boostedScore + 3);
    flags.push('authority_change_with_transfer');
  }

  // Permanent delegate is always CRITICAL
  if (flags.includes('permanent_delegate') || flags.includes('critical_extension')) {
    boostedScore = 10;
  }

  const level = getRiskLevel(boostedScore);

  let recommendation: RiskAssessment['recommendation'];
  if (boostedScore <= 2) recommendation = 'APPROVE';
  else if (boostedScore <= 4) recommendation = 'CAUTION';
  else if (boostedScore <= 6) recommendation = 'REJECT';
  else recommendation = 'BLOCK';

  // Build explanation
  const highRisk = instructions.filter((ix) => ix.riskScore >= 5);
  let explanation: string;

  if (highRisk.length === 0) {
    explanation = 'Transaction appears safe — no high-risk instructions detected.';
  } else {
    explanation = highRisk.map((ix) => ix.humanReadable).join('; ');
  }

  if (flags.includes('batch_drain_pattern')) {
    explanation += ' ⚠️ Multiple transfers detected — possible drain pattern.';
  }
  if (flags.includes('approve_and_transfer')) {
    explanation += ' ⚠️ Approval + transfer in same transaction — classic drainer pattern.';
  }
  if (flags.includes('permanent_delegate')) {
    explanation += ' 🚨 PERMANENT DELEGATE — token creator can seize your tokens at any time!';
  }

  return {
    score: boostedScore,
    level,
    flags: Array.from(new Set(flags)), // deduplicate
    recommendation,
    explanation,
  };
}

// ─── Export for RiskEngine integration ────────────────────────────────

export { getRiskLevel, abbreviateAddress, formatAmount };