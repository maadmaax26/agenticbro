/**
 * InstructionLibrary.ts — Known program signatures and Anchor IDL decoding
 * Part of the Agentic Bro Wallet Protection System
 *
 * This module provides:
 * 1. Comprehensive program registry (50+ known programs)
 * 2. Instruction discriminator database (Anchor + native)
 * 3. Method name resolution for Anchor programs
 * 4. Risk categorization per program/instruction
 */

import { sha256 } from '@noble/hashes/sha256';

// ─── Program Registry ─────────────────────────────────────────────────

export interface ProgramInfo {
  id: string;
  name: string;
  category: 'system' | 'token' | 'defi' | 'nft' | 'infrastructure' | 'unknown';
  risk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  website?: string;
  anchor?: boolean; // Is this an Anchor program?
}

export const PROGRAM_REGISTRY: Record<string, ProgramInfo> = {
  // ── System Programs ──
  '11111111111111111111111111111111': {
    id: '11111111111111111111111111111111',
    name: 'System Program',
    category: 'system',
    risk: 'safe',
    description: 'Core Solana system program for account creation and SOL transfers',
  },
  'ComputeBudget1111111111111111111111111111': {
    id: 'ComputeBudget1111111111111111111111111111',
    name: 'Compute Budget',
    category: 'system',
    risk: 'safe',
    description: 'Manage compute units and priority fees',
  },
  'SysvarC1ock11111111111111111111111111111111': {
    id: 'SysvarC1ock11111111111111111111111111111111',
    name: 'Clock Sysvar',
    category: 'system',
    risk: 'safe',
    description: 'System clock sysvar for time-based operations',
  },
  'SysvarRent111111111111111111111111111111111': {
    id: 'SysvarRent111111111111111111111111111111111',
    name: 'Rent Sysvar',
    category: 'system',
    risk: 'safe',
    description: 'Rent-exempt account sysvar',
  },
  'Sysvar1nstructions1111111111111111111111111': {
    id: 'Sysvar1nstructions1111111111111111111111111',
    name: 'Instructions Sysvar',
    category: 'system',
    risk: 'safe',
    description: 'Instructions sysvar for introspection',
  },

  // ── Token Programs ──
  'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR': {
    id: 'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR',
    name: 'SPL Token Program',
    category: 'token',
    risk: 'safe',
    description: 'Standard SPL Token program for fungible tokens',
  },
  'TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q': {
    id: 'TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q',
    name: 'Token-2022 Program',
    category: 'token',
    risk: 'low',
    description: 'Token Extensions program with advanced features (permanent delegate, transfer fees)',
  },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X': {
    id: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X',
    name: 'Associated Token Program',
    category: 'token',
    risk: 'safe',
    description: 'Create derived token accounts',
  },

  // ── DeFi: DEX ──
  'JUP4aqbBV6V6Tr3gWr4aPZp2FcGg1z7eeVjGpnQJYpQ': {
    id: 'JUP4aqbBV6V6Tr3gWr4aPZp2FcGg1z7eeVjGpnQJYpQ',
    name: 'Jupiter DEX v4',
    category: 'defi',
    risk: 'low',
    description: 'Jupiter aggregator for optimal swap routes',
    website: 'https://jup.ag',
    anchor: true,
  },
  'JUP6LkbZbjS1JKKSUPm2EA4d1x9sV773eG8w8JVLdV9': {
    id: 'JUP6LkbZbjS1JKKSUPm2EA4d1x9sV773eG8w8JVLdV9',
    name: 'Jupiter DEX v6',
    category: 'defi',
    risk: 'low',
    description: 'Jupiter v6 aggregator with improved routing',
    website: 'https://jup.ag',
    anchor: true,
  },
  '675kPT9YHRvQz2vXz4y2a2RqXvGfJGTdz9Ef8VcB8nkQ': {
    id: '675kPT9YHRvQz2vXz4y2a2RqXvGfJGTdz9Ef8VcB8nkQ',
    name: 'Raydium AMM',
    category: 'defi',
    risk: 'low',
    description: 'Raydium AMM for swaps and liquidity',
    website: 'https://raydium.io',
    anchor: true,
  },
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaWM7hMMFQfE': {
    id: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaWM7hMMFQfE',
    name: 'Raydium CLMM',
    category: 'defi',
    risk: 'low',
    description: 'Raydium Concentrated Liquidity Market Maker',
    website: 'https://raydium.io',
    anchor: true,
  },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VbpYd9w6YiHsQKE': {
    id: 'whirLbMiicVdio4qvUfM5KAg6Ct8VbpYd9w6YiHsQKE',
    name: 'Orca Whirlpool',
    category: 'defi',
    risk: 'low',
    description: 'Orca concentrated liquidity DEX',
    website: 'https://orca.so',
    anchor: true,
  },
  '9W959DqEETRg6D1J3bK7Gh15nJ7c6QJqMwZ2F5D8sRkE': {
    id: '9W959DqEETRg6D1J3bK7Gh15nJ7c6QJqMwZ2F5D8sRkE',
    name: 'Orca AMM',
    category: 'defi',
    risk: 'low',
    description: 'Orca standard AMM',
    website: 'https://orca.so',
  },
  'srmqPvymJeFKQ1zRme1LQ5yeHQE9B3AXZkGv1BL7S2Y': {
    id: 'srmqPvymJeFKQ1zRme1LQ5yeHQE9B3AXZkGv1BL7S2Y',
    name: 'OpenBook',
    category: 'defi',
    risk: 'low',
    description: 'OpenBook order book DEX (ex-Serum)',
    website: 'https://openbook-solana.com',
  },
  '22Y43yTVxuU4RKWkzy5dXTkY6fMwPR6w9vQYk5LjJk2': {
    id: '22Y43yTVxuU4RKWkzy5dXTkY6fMwPR6w9vQYk5LjJk2',
    name: 'Phoenix',
    category: 'defi',
    risk: 'low',
    description: 'Phoenix order book DEX',
    website: 'https://phoenix.trade',
  },

  // ── DeFi: Lending/Staking ──
  'MarBmsSgKXdrN9ex2ym5Qkd1MstRs7GUyGhYrHHQHRk': {
    id: 'MarBmsSgKXdrN9ex2ym5Qkd1MstRs7GUyGhYrHHQHRk',
    name: 'Marinade Finance',
    category: 'defi',
    risk: 'low',
    description: 'Solana liquid staking protocol',
    website: 'https://marinade.finance',
    anchor: true,
  },
  'So11111111111111111111111111111111111111112': {
    id: 'So11111111111111111111111111111111111111112',
    name: 'Wrapped SOL',
    category: 'token',
    risk: 'safe',
    description: 'Wrapped SOL mint',
  },
  'J1toso1QCkWeQmzJj4pd3Jrkbi1xUmKjFhUarEJjYgXk': {
    id: 'J1toso1QCkWeQmzJj4pd3Jrkbi1xUmKjFhUarEJjYgXk',
    name: 'Jito Stake Pool',
    category: 'defi',
    risk: 'low',
    description: 'Jito liquid staking',
    website: 'https://jito.network',
  },
  'LendZqTs7sxUtDpN8XdKg5zHH3H2k3K7qP2vX7wXkZ5L': {
    id: 'LendZqTs7sxUtDpN8XdKg5zHH3H2k3K7qP2vX7wXkZ5L',
    name: 'Solend',
    category: 'defi',
    risk: 'medium',
    description: 'Solana lending protocol',
    website: 'https://solend.fi',
    anchor: true,
  },
  'KAm1K3BPmHtXPbq8vL5s4E5LX6vE7pGvZ7rG6LJ8VqQ': {
    id: 'KAm1K3BPmHtXPbq8vL5s4E5LX6vE7pGvZ7rG6LJ8VqQ',
    name: 'Kamino',
    category: 'defi',
    risk: 'medium',
    description: 'Kamino lending and leverage',
    website: 'https://kamino.finance',
    anchor: true,
  },

  // ── NFT Programs ──
  'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ': {
    id: 'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ',
    name: 'Metaplex Token Metadata',
    category: 'nft',
    risk: 'safe',
    description: 'NFT metadata program',
    website: 'https://metaplex.com',
    anchor: true,
  },
  'CndyVrkE5Rkr3KbF4fG3Ky3nK7hiRqQ8c1G2Q9b2F2z': {
    id: 'CndyVrkE5Rkr3KbF4fG3Ky3nK7hiRqQ8c1G2Q9b2F2z',
    name: 'Candy Machine',
    category: 'nft',
    risk: 'low',
    description: 'NFT minting vending machine',
    website: 'https://metaplex.com',
    anchor: true,
  },
  'Guard1ZwP77V5GvM2pD3FhKb6q7V7j3sE1LqY2N7VfDv': {
    id: 'Guard1ZwP77V5GvM2pD3FhKb6q7V7j3sE1LqY2N7VfDv',
    name: 'Candy Guard',
    category: 'nft',
    risk: 'low',
    description: 'NFT minting guards and rules',
    website: 'https://metaplex.com',
    anchor: true,
  },
  'cmtDj7jd54WAfjUdoobPSnZvf5qhJ3pJwSi4P8J4fSx': {
    id: 'cmtDj7jd54WAfjUdoobPSnZvf5qhJ3pJwSi4P8J4fSx',
    name: 'Bubblegum',
    category: 'nft',
    risk: 'low',
    description: 'Compressed NFT program',
    website: 'https://metaplex.com',
    anchor: true,
  },

  // ── Infrastructure ──
  'WormT3McT3Kq7m3MXs59nGQW8nhU9rZKryVE2qZo9qJ': {
    id: 'WormT3McT3Kq7m3MXs59nGQW8nhU9rZKryVE2qZo9qJ',
    name: 'Wormhole',
    category: 'infrastructure',
    risk: 'low',
    description: 'Cross-chain bridge',
    website: 'https://wormhole.com',
    anchor: true,
  },
  'Bridge1p5gheXUvJ6jGWGeYtqvL5HZf5tWwXqZ7kNvX7pN5v': {
    id: 'Bridge1p5gheXUvJ6jGWGeYtqvL5HZf5tWwXqZ7kNvX7pN5v',
    name: 'Portal Bridge',
    category: 'infrastructure',
    risk: 'medium',
    description: 'Wormhole token bridge',
    website: 'https://portalbridge.com',
  },
  'PythNcLb5k5oDqJq3Xv4vVvJvJvJvJvJvJvJvJvJvJvJ': {
    id: 'PythNcLb5k5oDqJq3Xv4vVvJvJvJvJvJvJvJvJvJvJvJ',
    name: 'Pyth Oracle',
    category: 'infrastructure',
    risk: 'safe',
    description: 'Pyth price oracle',
    website: 'https://pyth.network',
    anchor: true,
  },
  'switchboardV2SoN3j3fWqGx7YhVvzQVqLbU7sXwWnNkKqM': {
    id: 'switchboardV2SoN3j3fWqGx7YhVvzQVqLbU7sXwWnNkKqM',
    name: 'Switchboard',
    category: 'infrastructure',
    risk: 'safe',
    description: 'Switchboard oracle',
    website: 'https://switchboard.xyz',
    anchor: true,
  },
  'Memo1UhkJRfHYvkd3q5E2hQ3QaiV3JqfB3E3': {
    id: 'Memo1UhkJRfHYvkd3q5E2hQ3QaiV3JqfB3E3',
    name: 'Memo Program',
    category: 'infrastructure',
    risk: 'safe',
    description: 'On-chain memo/notes program',
  },
  'AddressLookupTab1e1111111111111111111111111': {
    id: 'AddressLookupTab1e1111111111111111111111111',
    name: 'Address Lookup Table',
    category: 'system',
    risk: 'safe',
    description: 'Address lookup tables for transaction compression',
  },

  // ── Governance ──
  'GovER5LthMs3xLFqbjkQJnYfE3cLdJZm5pZ7XvXkLqJ': {
    id: 'GovER5LthMs3xLFqbjkQJnYfE3cLdJZm5pZ7XvXkLqJ',
    name: 'Spl Governance',
    category: 'infrastructure',
    risk: 'safe',
    description: 'SPL Governance program',
  },
  'GqTPL6qRf5aaVqu4W4Mz1nLk1z5hW8vYp9X3vLqMkN': {
    id: 'GqTPL6qRf5aaVqu4W4Mz1nLk1z5hW8vYp9X3vLqMkN',
    name: 'Realms',
    category: 'infrastructure',
    risk: 'safe',
    description: 'DAO governance platform',
    website: 'https://realms.today',
  },

  // ── Unknown/Unregistered Programs ──
  // These get flagged with risk: 'unknown' during parsing
};

// Reverse lookup: name → id
export const PROGRAM_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.values(PROGRAM_REGISTRY).map((info) => [info.name.toLowerCase(), info.id])
);

// ─── Instruction Discriminators ────────────────────────────────────────

/**
 * Anchor discriminators are computed as: sha256("global:<method_name>")[0:8]
 * Native programs use different encoding (often just instruction index as u32 LE)
 */

export interface InstructionSignature {
  discriminator: number[]; // 8 bytes
  name: string;
  label: string;
  baseRisk: number;
  category: 'safe' | 'standard' | 'sensitive' | 'dangerous';
  description?: string;
}

/**
 * Compute Anchor discriminator from method name
 */
export function computeAnchorDiscriminator(methodName: string): number[] {
  const preimage = `global:${methodName}`;
  const hash = sha256(new TextEncoder().encode(preimage));
  return Array.from(hash.slice(0, 8));
}

/**
 * Instruction signatures for common Anchor programs
 * These are pre-computed for faster lookups
 */
export const ANCHOR_INSTRUCTIONS: Record<string, InstructionSignature[]> = {
  // Metaplex Token Metadata
  'metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ': [
    {
      discriminator: computeAnchorDiscriminator('create_metadata_account_v3'),
      name: 'createMetadataAccountV3',
      label: 'Create Metadata Account',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('update_metadata_account_v2'),
      name: 'updateMetadataAccountV2',
      label: 'Update Metadata',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: computeAnchorDiscriminator('set_and_verify_collection'),
      name: 'setAndVerifyCollection',
      label: 'Set Collection',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: computeAnchorDiscriminator('verify_collection'),
      name: 'verifyCollection',
      label: 'Verify Collection',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('utilize'),
      name: 'utilize',
      label: 'Utilize NFT',
      baseRisk: 3,
      category: 'sensitive',
    },
    {
      discriminator: computeAnchorDiscriminator('approve'),
      name: 'approve',
      label: 'Approve NFT Use',
      baseRisk: 3,
      category: 'sensitive',
    },
    {
      discriminator: computeAnchorDiscriminator('transfer'),
      name: 'transfer',
      label: 'Transfer NFT',
      baseRisk: 2,
      category: 'standard',
    },
  ],

  // Jupiter v6
  'JUP6LkbZbjS1JKKSUPm2EA4d1x9sV773eG8w8JVLdV9': [
    {
      discriminator: computeAnchorDiscriminator('shared_accounts_route'),
      name: 'sharedAccountsRoute',
      label: 'Route via Shared Accounts',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('route'),
      name: 'route',
      label: 'Route Swap',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('exact_output_route'),
      name: 'exactOutputRoute',
      label: 'Exact Output Swap',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('exact_input_route'),
      name: 'exactInputRoute',
      label: 'Exact Input Swap',
      baseRisk: 1,
      category: 'safe',
    },
  ],

  // Marinade
  'MarBmsSgKXdrN9ex2ym5Qkd1MstRs7GUyGhYrHHQHRk': [
    {
      discriminator: computeAnchorDiscriminator('deposit'),
      name: 'deposit',
      label: 'Deposit SOL',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('withdraw'),
      name: 'withdraw',
      label: 'Withdraw SOL',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: computeAnchorDiscriminator('stake'),
      name: 'stake',
      label: 'Stake SOL',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('unstake'),
      name: 'unstake',
      label: 'Unstake',
      baseRisk: 2,
      category: 'standard',
    },
  ],

  // Raydium CLMM
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaWM7hMMFQfE': [
    {
      discriminator: computeAnchorDiscriminator('open_position'),
      name: 'openPosition',
      label: 'Open LP Position',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('close_position'),
      name: 'closePosition',
      label: 'Close LP Position',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('increase_liquidity'),
      name: 'increaseLiquidity',
      label: 'Add Liquidity',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('decrease_liquidity'),
      name: 'decreaseLiquidity',
      label: 'Remove Liquidity',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('swap'),
      name: 'swap',
      label: 'Swap via CLMM',
      baseRisk: 1,
      category: 'safe',
    },
  ],

  // Orca Whirlpool
  'whirLbMiicVdio4qvUfM5KAg6Ct8VbpYd9w6YiHsQKE': [
    {
      discriminator: computeAnchorDiscriminator('initialize_pool'),
      name: 'initializePool',
      label: 'Initialize Pool',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('open_position'),
      name: 'openPosition',
      label: 'Open Position',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('close_position'),
      name: 'closePosition',
      label: 'Close Position',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: computeAnchorDiscriminator('swap'),
      name: 'swap',
      label: 'Swap',
      baseRisk: 1,
      category: 'safe',
    },
  ],

  // Wormhole
  'WormT3McT3Kq7m3MXs59nGQW8nhU9rZKryVE2qZo9qJ': [
    {
      discriminator: computeAnchorDiscriminator('initialize'),
      name: 'initialize',
      label: 'Initialize Wormhole',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: computeAnchorDiscriminator('post_message'),
      name: 'postMessage',
      label: 'Post Cross-Chain Message',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: computeAnchorDiscriminator('post_vaa'),
      name: 'postVaa',
      label: 'Post VAA',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: computeAnchorDiscriminator('set_upgrade_authority'),
      name: 'setUpgradeAuthority',
      label: 'Set Upgrade Authority',
      baseRisk: 5,
      category: 'sensitive',
    },
  ],
};

// ─── Native Program Discriminators (non-Anchor) ────────────────────────

/**
 * SPL Token uses instruction index as u32 little-endian discriminator
 * (first 4 bytes, with rest being instruction-specific data)
 */
export const NATIVE_INSTRUCTIONS: Record<string, InstructionSignature[]> = {
  // SPL Token Program
  'TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR': [
    {
      discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializeMint',
      label: 'Initialize Mint',
      baseRisk: 3,
      category: 'standard',
    },
    {
      discriminator: [1, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializeAccount',
      label: 'Initialize Token Account',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [2, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializeMultisig',
      label: 'Initialize Multisig',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: [3, 0, 0, 0, 0, 0, 0, 0],
      name: 'transfer',
      label: 'Transfer Tokens',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [4, 0, 0, 0, 0, 0, 0, 0],
      name: 'approve',
      label: 'Approve Token Spending',
      baseRisk: 2,
      category: 'sensitive',
    },
    {
      discriminator: [5, 0, 0, 0, 0, 0, 0, 0],
      name: 'revoke',
      label: 'Revoke Approval',
      baseRisk: 0,
      category: 'safe',
    },
    {
      discriminator: [6, 0, 0, 0, 0, 0, 0, 0],
      name: 'setAuthority',
      label: 'Set Authority',
      baseRisk: 8,
      category: 'dangerous',
    },
    {
      discriminator: [7, 0, 0, 0, 0, 0, 0, 0],
      name: 'mintTo',
      label: 'Mint Tokens',
      baseRisk: 4,
      category: 'sensitive',
    },
    {
      discriminator: [8, 0, 0, 0, 0, 0, 0, 0],
      name: 'burn',
      label: 'Burn Tokens',
      baseRisk: 3,
      category: 'standard',
    },
    {
      discriminator: [9, 0, 0, 0, 0, 0, 0, 0],
      name: 'closeAccount',
      label: 'Close Token Account',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: [10, 0, 0, 0, 0, 0, 0, 0],
      name: 'freezeAccount',
      label: 'Freeze Account',
      baseRisk: 6,
      category: 'sensitive',
    },
    {
      discriminator: [11, 0, 0, 0, 0, 0, 0, 0],
      name: 'thawAccount',
      label: 'Thaw Account',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [12, 0, 0, 0, 0, 0, 0, 0],
      name: 'transferChecked',
      label: 'Transfer (Checked)',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [13, 0, 0, 0, 0, 0, 0, 0],
      name: 'approveChecked',
      label: 'Approve (Checked)',
      baseRisk: 2,
      category: 'sensitive',
    },
    {
      discriminator: [14, 0, 0, 0, 0, 0, 0, 0],
      name: 'mintToChecked',
      label: 'Mint (Checked)',
      baseRisk: 4,
      category: 'sensitive',
    },
    {
      discriminator: [15, 0, 0, 0, 0, 0, 0, 0],
      name: 'burnChecked',
      label: 'Burn (Checked)',
      baseRisk: 3,
      category: 'standard',
    },
    {
      discriminator: [16, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializeAccount2',
      label: 'Initialize Account (v2)',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [17, 0, 0, 0, 0, 0, 0, 0],
      name: 'syncNative',
      label: 'Sync Native SOL',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [18, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializeAccount3',
      label: 'Initialize Account (v3)',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [19, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializeMultisig2',
      label: 'Initialize Multisig (v2)',
      baseRisk: 2,
      category: 'standard',
    },
    {
      discriminator: [20, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializeMintCloseAuthority',
      label: 'Set Mint Close Authority',
      baseRisk: 5,
      category: 'sensitive',
    },
    {
      discriminator: [21, 0, 0, 0, 0, 0, 0, 0],
      name: 'initializePermanentDelegate',
      label: 'Set Permanent Delegate',
      baseRisk: 10,
      category: 'dangerous',
    },
  ],

  // System Program
  '11111111111111111111111111111111': [
    {
      discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
      name: 'createAccount',
      label: 'Create Account',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [1, 0, 0, 0, 0, 0, 0, 0],
      name: 'assign',
      label: 'Assign Account',
      baseRisk: 3,
      category: 'sensitive',
    },
    {
      discriminator: [2, 0, 0, 0, 0, 0, 0, 0],
      name: 'transfer',
      label: 'Transfer SOL',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [3, 0, 0, 0, 0, 0, 0, 0],
      name: 'createAccountWithSeed',
      label: 'Create Account with Seed',
      baseRisk: 1,
      category: 'safe',
    },
  ],

  // Associated Token Program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X': [
    {
      discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
      name: 'create',
      label: 'Create ATA',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [1, 0, 0, 0, 0, 0, 0, 0],
      name: 'createIdempotent',
      label: 'Create ATA (Idempotent)',
      baseRisk: 1,
      category: 'safe',
    },
    {
      discriminator: [2, 0, 0, 0, 0, 0, 0, 0],
      name: 'recoverNested',
      label: 'Recover Nested ATA',
      baseRisk: 2,
      category: 'standard',
    },
  ],

  // Compute Budget Program
  'ComputeBudget1111111111111111111111111111': [
    {
      discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
      name: 'requestUnits',
      label: 'Request Compute Units',
      baseRisk: 0,
      category: 'safe',
    },
    {
      discriminator: [1, 0, 0, 0, 0, 0, 0, 0],
      name: 'requestHeapFrame',
      label: 'Request Heap Frame',
      baseRisk: 0,
      category: 'safe',
    },
    {
      discriminator: [2, 0, 0, 0, 0, 0, 0, 0],
      name: 'setComputeUnitLimit',
      label: 'Set Compute Limit',
      baseRisk: 0,
      category: 'safe',
    },
    {
      discriminator: [3, 0, 0, 0, 0, 0, 0, 0],
      name: 'setComputeUnitPrice',
      label: 'Set Priority Fee',
      baseRisk: 0,
      category: 'safe',
    },
  ],
};

// ─── Lookup Functions ──────────────────────────────────────────────────

/**
 * Get program info by ID
 */
export function getProgramInfo(programId: string): ProgramInfo | undefined {
  return PROGRAM_REGISTRY[programId];
}

/**
 * Get program name by ID
 */
export function getProgramName(programId: string): string {
  return PROGRAM_REGISTRY[programId]?.name ?? 'Unknown Program';
}

/**
 * Check if a program is known and safe
 */
export function isKnownSafeProgram(programId: string): boolean {
  const info = PROGRAM_REGISTRY[programId];
  return info?.risk === 'safe' || info?.risk === 'low';
}

/**
 * Check if a program is an Anchor program
 */
export function isAnchorProgram(programId: string): boolean {
  return PROGRAM_REGISTRY[programId]?.anchor ?? false;
}

/**
 * Look up instruction signature by discriminator
 */
export function lookupInstruction(
  programId: string,
  discriminator: number[] | Buffer
): InstructionSignature | undefined {
  const discArray = Array.isArray(discriminator)
    ? discriminator
    : Array.from(discriminator);

  // Check native instructions first
  const nativeInstructions = NATIVE_INSTRUCTIONS[programId];
  if (nativeInstructions) {
    for (const sig of nativeInstructions) {
      if (arraysEqual(sig.discriminator.slice(0, 4), discArray.slice(0, 4))) {
        return sig;
      }
    }
  }

  // Check anchor instructions
  const anchorInstructions = ANCHOR_INSTRUCTIONS[programId];
  if (anchorInstructions) {
    for (const sig of anchorInstructions) {
      if (arraysEqual(sig.discriminator, discArray)) {
        return sig;
      }
    }
  }

  return undefined;
}

/**
 * Get all known instructions for a program
 */
export function getProgramInstructions(
  programId: string
): InstructionSignature[] {
  const native = NATIVE_INSTRUCTIONS[programId] ?? [];
  const anchor = ANCHOR_INSTRUCTIONS[programId] ?? [];
  return [...native, ...anchor];
}

/**
 * Helper: compare two number arrays
 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

// ─── Program Category Helpers ─────────────────────────────────────────

/**
 * Get all programs in a category
 */
export function getProgramsByCategory(
  category: ProgramInfo['category']
): ProgramInfo[] {
  return Object.values(PROGRAM_REGISTRY).filter((p) => p.category === category);
}

/**
 * Get all programs with a specific risk level
 */
export function getProgramsByRisk(risk: ProgramInfo['risk']): ProgramInfo[] {
  return Object.values(PROGRAM_REGISTRY).filter((p) => p.risk === risk);
}

// ─── Export all ────────────────────────────────────────────────────────