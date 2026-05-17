/**
 * InstructionLibrary.ts
 * 
 * Known Solana program IDs, instruction discriminators, and metadata.
 * Maps raw on-chain instruction data to human-readable descriptions.
 * 
 * Reference: https://github.com/solana-labs/solana-program-library
 */

// ─── Program IDs ────────────────────────────────────────────────────────────────

export const PROGRAM_IDS: Record<string, string> = {
  System: '11111111111111111111111111111111',
  Token: 'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR',
  Token2022: 'TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q',
  AssociatedToken: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X',
  MetaplexTokenMetadata: 'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ',
  MetaplexToken: 'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR',
  ComputeBudget: 'ComputeBudget1111111111111111111111111111',
  Memo: 'Memo1UhkJRfRhvq3q6t8S3pUM1Kkq5R9Z3ZYvZ7Rf9a5M',
  Stake: 'Stake11111111111111111111111111111111111111',
  Vote: 'Vote111111111111111111111111111111111111111',
  Config: 'Config111111111111111111111111111111111111111',
  SPLStakePool: 'SPoo1Ku8WfuBBXZ5bm2Hj4sjT8pWgh6V9bM4hRdK3BkQ',
  NameService: 'namesLPneVptA9Z5rqUDD9tMTWE7wTta9tErKtx6rWqM',
  TokenSwap: 'SwaPpAmpgXX7aMt5j63qY5S3QpK3LP7s3a66sZr3b3Y',
  AmmV4: '675kPT9jvKq3vXA4XK3hj2o5K5eA5Rf3vQ6j4r2Z1iVj', // Raydium AMM
  AmmV3: 'CAMMCzo5YL8384rtV1C3VLZ5T8s3n2c5j7j7j2j7j9j', // Raydium Concentrated
  Jupiter: 'JUP4aqbBV6V6bmj3Ks1v7G4Z7j2j3E4j5j6j7j8j9j', // placeholder
  Serum: '9xQeWvG816bUx9EPjHbmB3f6w5j4j3j2j1j0j9j8j7', // placeholder
  Wormhole: 'WormT3McKh9TR3q3Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q2Q', // placeholder
};

// Reverse lookup: address → name
export const PROGRAM_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(PROGRAM_IDS).map(([name, id]) => [id, name])
);

// ─── Instruction Types ───────────────────────────────────────────────────────────

export type RiskCategory = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface InstructionDef {
  /** Short method name matching on-chain discriminator */
  name: string;
  /** Human-readable label shown to users */
  label: string;
  /** Detailed description of what this instruction does */
  description: string;
  /** Base risk score 0-10 before modifiers */
  baseRisk: number;
  /** Default risk category */
  riskCategory: RiskCategory;
  /** Which program this belongs to */
  program: string;
  /** Discriminator bytes (first 1-8 bytes of instruction data) */
  discriminator: number[];
  /** Number of accounts this instruction expects */
  accountCount?: number;
  /** Whether this instruction moves assets out of the user's wallet */
  movesAssets: boolean;
  /** Whether this instruction grants permissions to another party */
  grantsPermission: boolean;
  /** Whether this instruction changes account ownership */
  changesOwnership: boolean;
  /** Human-readable explanation of risk for this instruction */
  riskExplanation: string;
  /** Tags for categorization and filtering */
  tags: string[];
}

// ─── System Program Instructions ─────────────────────────────────────────────────

const SYSTEM_INSTRUCTIONS: InstructionDef[] = [
  {
    name: 'createAccount',
    label: 'Create Account',
    description: 'Creates a new account on Solana with the specified space and owner',
    baseRisk: 1,
    riskCategory: 'LOW',
    program: 'System',
    discriminator: [0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Creating a new account. This transfers SOL for rent exemption.',
    tags: ['account_creation', 'system'],
  },
  {
    name: 'transfer',
    label: 'Transfer SOL',
    description: 'Transfers SOL from one account to another',
    baseRisk: 2,
    riskCategory: 'LOW',
    program: 'System',
    discriminator: [2, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Transferring SOL to another address.',
    tags: ['transfer', 'sol', 'system'],
  },
  {
    name: 'assign',
    label: 'Assign Program Owner',
    description: 'Changes the program owner of an account',
    baseRisk: 6,
    riskCategory: 'HIGH',
    program: 'System',
    discriminator: [1, 0, 0, 0],
    movesAssets: false,
    grantsPermission: true,
    changesOwnership: true,
    riskExplanation: 'Changing the program that owns this account. This gives the new program full control.',
    tags: ['ownership', 'system'],
  },
  {
    name: 'createAccountWithSeed',
    label: 'Create Account with Seed',
    description: 'Creates a new account derived from a seed',
    baseRisk: 1,
    riskCategory: 'LOW',
    program: 'System',
    discriminator: [3, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Creating a derived account. This transfers SOL for rent.',
    tags: ['account_creation', 'system'],
  },
  {
    name: 'advanceNonceAccount',
    label: 'Advance Nonce',
    description: 'Advances the nonce on a nonce account',
    baseRisk: 0,
    riskCategory: 'SAFE',
    program: 'System',
    discriminator: [4, 0, 0, 0],
    movesAssets: false,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Advancing nonce. This is a safe operation.',
    tags: ['nonce', 'system'],
  },
  {
    name: 'withdrawNonceAccount',
    label: 'Withdraw Nonce Balance',
    description: 'Withdraws SOL from a nonce account',
    baseRisk: 3,
    riskCategory: 'MEDIUM',
    program: 'System',
    discriminator: [5, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Withdrawing SOL from a nonce account.',
    tags: ['withdraw', 'nonce', 'system'],
  },
];

// ─── SPL Token Program Instructions ──────────────────────────────────────────────

const TOKEN_INSTRUCTIONS: InstructionDef[] = [
  {
    name: 'initializeMint',
    label: 'Initialize Token Mint',
    description: 'Creates a new token mint with specified authorities',
    baseRisk: 3,
    riskCategory: 'MEDIUM',
    program: 'Token',
    discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Creating a new token. Check if mint/freeze authority is set.',
    tags: ['token', 'mint', 'initialization'],
  },
  {
    name: 'initializeAccount',
    label: 'Initialize Token Account',
    description: 'Initializes a new token account to hold tokens',
    baseRisk: 0,
    riskCategory: 'SAFE',
    program: 'Token',
    discriminator: [1, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Setting up a token account. This is safe.',
    tags: ['token', 'account', 'initialization'],
  },
  {
    name: 'transfer',
    label: 'Transfer Tokens',
    description: 'Transfers tokens from one account to another',
    baseRisk: 2,
    riskCategory: 'LOW',
    program: 'Token',
    discriminator: [3, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Sending tokens to another address.',
    tags: ['token', 'transfer'],
  },
  {
    name: 'approve',
    label: 'Approve Delegate',
    description: 'Approves a delegate to transfer or burn tokens on your behalf',
    baseRisk: 5,
    riskCategory: 'HIGH',
    program: 'Token',
    discriminator: [4, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: true,
    changesOwnership: false,
    riskExplanation: '⚠️ Granting token spending permission to another address. They can transfer or burn your tokens up to the approved amount.',
    tags: ['token', 'approve', 'delegate', 'permission'],
  },
  {
    name: 'revoke',
    label: 'Revoke Delegate',
    description: 'Revokes a previously approved delegate',
    baseRisk: 0,
    riskCategory: 'SAFE',
    program: 'Token',
    discriminator: [5, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: '✅ Revoking token spending permission. This is a safety action.',
    tags: ['token', 'revoke', 'delegate', 'safety'],
  },
  {
    name: 'setAuthority',
    label: 'Transfer Account Ownership',
    description: 'Changes the authority (owner) of a mint or token account — PERMANENT',
    baseRisk: 9,
    riskCategory: 'CRITICAL',
    program: 'Token',
    discriminator: [6, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: true,
    changesOwnership: true,
    riskExplanation: '🚨 CRITICAL: Transferring ownership of this account to another address. Once transferred, you LOSE ALL CONTROL. The new owner can drain all tokens.',
    tags: ['token', 'setAuthority', 'ownership', 'critical'],
  },
  {
    name: 'mintTo',
    label: 'Mint New Tokens',
    description: 'Creates new tokens and adds them to an account',
    baseRisk: 3,
    riskCategory: 'MEDIUM',
    program: 'Token',
    discriminator: [7, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Minting new tokens. This increases supply — check if this is expected.',
    tags: ['token', 'mint'],
  },
  {
    name: 'burn',
    label: 'Burn Tokens',
    description: 'Permanently destroys tokens from an account',
    baseRisk: 4,
    riskCategory: 'MEDIUM',
    program: 'Token',
    discriminator: [8, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Burning (destroying) tokens. This is permanent and irreversible.',
    tags: ['token', 'burn'],
  },
  {
    name: 'closeAccount',
    label: 'Close Token Account',
    description: 'Closes a token account and reclaims rent SOL',
    baseRisk: 2,
    riskCategory: 'LOW',
    program: 'Token',
    discriminator: [9, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Closing a token account. Remaining tokens must be zero. Rent SOL is reclaimed.',
    tags: ['token', 'close', 'account'],
  },
  {
    name: 'freezeAccount',
    label: 'Freeze Account',
    description: 'Freezes a token account, preventing any transfers',
    baseRisk: 6,
    riskCategory: 'HIGH',
    program: 'Token',
    discriminator: [10, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: '⚠️ Freezing this token account. No tokens can be moved until unfrozen.',
    tags: ['token', 'freeze'],
  },
  {
    name: 'thawAccount',
    label: 'Thaw Account',
    description: 'Unfreezes a previously frozen token account',
    baseRisk: 1,
    riskCategory: 'LOW',
    program: 'Token',
    discriminator: [11, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Unfreezing a token account. Normal operation.',
    tags: ['token', 'thaw'],
  },
];

// ─── Token-2022 Specific Instructions ────────────────────────────────────────────

const TOKEN_2022_INSTRUCTIONS: InstructionDef[] = [
  // Standard SPL Token instructions are also valid for Token-2022
  // Additional Token-2022 specific instructions:
  {
    name: 'initializeMintCloseAuthority',
    label: 'Set Mint Close Authority',
    description: 'Sets an authority that can close the mint account',
    baseRisk: 5,
    riskCategory: 'HIGH',
    program: 'Token2022',
    discriminator: [16, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: true,
    changesOwnership: false,
    riskExplanation: '⚠️ Setting a close authority on the mint. Someone can close this mint account.',
    tags: ['token2022', 'authority', 'close'],
  },
  {
    name: 'initializePermanentDelegate',
    label: 'Initialize Permanent Delegate',
    description: 'Sets a permanent delegate that can transfer or burn ANY tokens without owner approval',
    baseRisk: 10,
    riskCategory: 'CRITICAL',
    program: 'Token2022',
    discriminator: [24, 0, 0, 0, 0, 0, 0, 0], // approx discriminator
    movesAssets: false,
    grantsPermission: true,
    changesOwnership: false,
    riskExplanation: '🚨 CRITICAL: A permanent delegate is being set. This address can transfer or burn ALL your tokens in this account AT ANY TIME without your signature. Known scam vector — tokens can be burned seconds after purchase.',
    tags: ['token2022', 'permanent_delegate', 'critical', 'drainer'],
  },
  // Common Token-2022 extension operations encountered in transactions
  {
    name: 'transferChecked',
    label: 'Transfer Tokens (Checked)',
    description: 'Transfers tokens with decimal verification (Token-2022)',
    baseRisk: 2,
    riskCategory: 'LOW',
    program: 'Token2022',
    discriminator: [12, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Sending tokens with decimal verification. Standard safe transfer.',
    tags: ['token2022', 'transfer', 'checked'],
  },
  {
    name: 'approveChecked',
    label: 'Approve Delegate (Checked)',
    description: 'Approves a delegate with decimal verification (Token-2022)',
    baseRisk: 5,
    riskCategory: 'HIGH',
    program: 'Token2022',
    discriminator: [13, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: true,
    changesOwnership: false,
    riskExplanation: '⚠️ Granting token spending permission. The delegate can transfer or burn your tokens.',
    tags: ['token2022', 'approve', 'delegate', 'permission'],
  },
  {
    name: 'setAuthority',
    label: 'Transfer Account Ownership (Token-2022)',
    description: 'Changes authority on a Token-2022 mint or account — PERMANENT',
    baseRisk: 9,
    riskCategory: 'CRITICAL',
    program: 'Token2022',
    discriminator: [6, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: true,
    changesOwnership: true,
    riskExplanation: '🚨 CRITICAL: Transferring ownership of this Token-2022 account. You LOSE ALL CONTROL permanently.',
    tags: ['token2022', 'setAuthority', 'ownership', 'critical'],
  },
];

// ─── Associated Token Account Program ───────────────────────────────────────────

const ATA_INSTRUCTIONS: InstructionDef[] = [
  {
    name: 'createIdempotent',
    label: 'Create Associated Token Account',
    description: 'Creates an associated token account if it doesn\'t already exist',
    baseRisk: 0,
    riskCategory: 'SAFE',
    program: 'AssociatedToken',
    discriminator: [1, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: '✅ Creating a token account. This is standard and safe.',
    tags: ['ata', 'account_creation', 'safe'],
  },
  {
    name: 'create',
    label: 'Create Associated Token Account (Recoverable)',
    description: 'Creates an associated token account (fails if already exists)',
    baseRisk: 0,
    riskCategory: 'SAFE',
    program: 'AssociatedToken',
    discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: '✅ Creating a token account. This is standard and safe.',
    tags: ['ata', 'account_creation', 'safe'],
  },
];

// ─── Compute Budget Instructions ─────────────────────────────────────────────────

const COMPUTE_BUDGET_INSTRUCTIONS: InstructionDef[] = [
  {
    name: 'setComputeUnitLimit',
    label: 'Set Compute Limit',
    description: 'Sets the maximum compute units for the transaction',
    baseRisk: 0,
    riskCategory: 'SAFE',
    program: 'ComputeBudget',
    discriminator: [2, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: false,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Setting compute limits. No security impact.',
    tags: ['compute', 'budget', 'safe'],
  },
  {
    name: 'setComputeUnitPrice',
    label: 'Set Priority Fee',
    description: 'Sets the compute unit price (priority fee) for the transaction',
    baseRisk: 0,
    riskCategory: 'SAFE',
    program: 'ComputeBudget',
    discriminator: [3, 0, 0, 0, 0, 0, 0, 0],
    movesAssets: true,
    grantsPermission: false,
    changesOwnership: false,
    riskExplanation: 'Setting priority fee. Higher fee = faster execution. No security impact.',
    tags: ['compute', 'budget', 'fee', 'safe'],
  },
];

// ─── Compile All Instructions ────────────────────────────────────────────────────

const ALL_INSTRUCTIONS: InstructionDef[] = [
  ...SYSTEM_INSTRUCTIONS,
  ...TOKEN_INSTRUCTIONS,
  ...TOKEN_2022_INSTRUCTIONS,
  ...ATA_INSTRUCTIONS,
  ...COMPUTE_BUDGET_INSTRUCTIONS,
];

// Lookup: programId + discriminator → InstructionDef
const _instructionLookup: Map<string, InstructionDef> = new Map();
for (const ix of ALL_INSTRUCTIONS) {
  const programId = PROGRAM_IDS[ix.program];
  if (programId) {
    const key = `${programId}:${ix.discriminator.join(',')}`;
    _instructionLookup.set(key, ix);
  }
}

/**
 * Look up an instruction definition by program ID and discriminator bytes
 */
export function lookupInstruction(programId: string, discriminator: number[]): InstructionDef | undefined {
  // Try exact match first
  const key = `${programId}:${discriminator.join(',')}`;
  let result = _instructionLookup.get(key);
  if (result) return result;

  // Try with shorter discriminator (some instructions use 4 bytes, some 8)
  for (const len of [4, 2, 1]) {
    if (discriminator.length >= len) {
      const shortKey = `${programId}:${discriminator.slice(0, len).join(',')}`;
      result = _instructionLookup.get(shortKey);
      if (result) return result;
    }
  }

  return undefined;
}

/**
 * Get all known instructions for a program
 */
export function getProgramInstructions(programId: string): InstructionDef[] {
  return ALL_INSTRUCTIONS.filter(ix => PROGRAM_IDS[ix.program] === programId);
}

/**
 * Check if a program ID is a known system-level program (always safe)
 */
export function isSystemProgram(programId: string): boolean {
  const safe = [
    PROGRAM_IDS.System,
    PROGRAM_IDS.ComputeBudget,
    PROGRAM_IDS.AssociatedToken,
  ];
  return safe.includes(programId);
}

/**
 * Check if a program ID is known
 */
export function isKnownProgram(programId: string): boolean {
  return programId in PROGRAM_NAMES;
}

/**
 * Get the human-readable name for a program ID
 */
export function getProgramName(programId: string): string {
  return PROGRAM_NAMES[programId] || `Unknown (${programId.slice(0, 8)}...)`;
}

/**
 * Get all instruction definitions
 */
export function getAllInstructions(): InstructionDef[] {
  return ALL_INSTRUCTIONS;
}

/**
 * Authority types for SetAuthority instruction (SPL Token)
 */
export const AUTHORITY_TYPES: Record<number, { name: string; risk: RiskCategory; explanation: string }> = {
  0: {
    name: 'Mint Tokens',
    risk: 'MEDIUM',
    explanation: 'Transferring who can mint new tokens',
  },
  1: {
    name: 'Freeze Account',
    risk: 'HIGH',
    explanation: 'Transferring who can freeze token accounts',
  },
  2: {
    name: 'Account Owner',
    risk: 'CRITICAL',
    explanation: '🚨 Transferring OWNERSHIP of this token account — you will lose ALL control',
  },
  3: {
    name: 'Close Account',
    risk: 'HIGH',
    explanation: 'Transferring who can close this account',
  },
};

export { ALL_INSTRUCTIONS, SYSTEM_INSTRUCTIONS, TOKEN_INSTRUCTIONS, TOKEN_2022_INSTRUCTIONS };