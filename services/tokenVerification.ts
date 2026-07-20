/**
 * Token Verification Service
 *
 * Verifies AGNTCBRO token holdings on Solana
 * Determines user tier (free, holder, whale)
 * Caches results for performance
 */

import { Connection, PublicKey, ParsedAccountData } from '@solana/web3.js';

// Types
export type HolderTier = 'free' | 'holder' | 'whale';

export interface TokenHoldings {
  walletAddress: string;
  holdings: bigint;
  holdingsFormatted: number;
  tier: HolderTier;
  lastVerified: Date;
}

export interface TokenMetadata {
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
}

// Configuration
const TOKEN_THRESHOLDS = {
  HOLDER: 10000, // 10k AGNTCBRO
  WHALE: 100000, // 100k AGNTCBRO
} as const;

// AGNTCBRO token mint address (update this with actual mint)
const AGNTCBRO_MINT = new PublicKey('AgNTCBRoTokenMintAddressHere'); // TODO: Update with actual mint

// Solana RPC endpoint (use Helius for reliability)
const SOLANA_RPC = import.meta.env.VITE_HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

// Connection
const connection = new Connection(SOLANA_RPC, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Cache (in-memory, expires after 5 minutes)
const holdingsCache = new Map<string, { data: TokenHoldings; expires: number }>();

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export class TokenVerifier {
  /**
   * Get AGNTCBRO holdings for a wallet address
   * Uses cache for performance
   */
  async getHoldings(walletAddress: string): Promise<TokenHoldings> {
    // Check cache first
    const cached = holdingsCache.get(walletAddress);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      // Get all token accounts for the wallet
      const publicKey = new PublicKey(walletAddress);
      const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
        mint: AGNTCBRO_MINT,
      });

      // Sum up holdings from all token accounts
      let totalHoldings = BigInt(0);

      for (const account of tokenAccounts.value) {
        const parsedData = account.account.data as ParsedAccountData;
        const amount = parsedData.parsed.info.tokenAmount.amount;
        totalHoldings += BigInt(amount);
      }

      // Format holdings
      const decimals = await this.getTokenDecimals();
      const holdingsFormatted = Number(totalHoldings) / Math.pow(10, decimals);

      // Determine tier
      const tier = this.determineTier(holdingsFormatted);

      const result: TokenHoldings = {
        walletAddress,
        holdings: totalHoldings,
        holdingsFormatted,
        tier,
        lastVerified: new Date(),
      };

      // Cache result
      holdingsCache.set(walletAddress, {
        data: result,
        expires: Date.now() + CACHE_DURATION,
      });

      return result;
    } catch (error) {
      console.error('Error getting token holdings:', error);
      // Return zero holdings on error
      return {
        walletAddress,
        holdings: BigInt(0),
        holdingsFormatted: 0,
        tier: 'free',
        lastVerified: new Date(),
      };
    }
  }

  /**
   * Determine holder tier based on holdings
   */
  determineTier(holdings: number): HolderTier {
    if (holdings >= TOKEN_THRESHOLDS.WHALE) {
      return 'whale';
    } else if (holdings >= TOKEN_THRESHOLDS.HOLDER) {
      return 'holder';
    } else {
      return 'free';
    }
  }

  /**
   * Check if user has access to a feature
   */
  async hasAccess(
    walletAddress: string,
    feature: 'signals' | 'analysis' | 'alerts' | 'api'
  ): Promise<boolean> {
    const { tier } = await this.getHoldings(walletAddress);

    const accessMap: { [tier in HolderTier]: Set<string> } = {
      free: new Set(['signals']), // Free users get limited signals
      holder: new Set(['signals', 'analysis', 'alerts']),
      whale: new Set(['signals', 'analysis', 'alerts', 'api']),
    };

    return accessMap[tier].has(feature);
  }

  /**
   * Get token metadata (decimals, name, symbol)
   */
  async getTokenMetadata(): Promise<TokenMetadata> {
    try {
      const mintInfo = await connection.getParsedAccountInfo(AGNTCBRO_MINT);
      const parsedData = mintInfo.value?.data as ParsedAccountData;

      if (parsedData?.parsed?.info) {
        return {
          tokenMint: AGNTCBRO_MINT.toString(),
          tokenName: parsedData.parsed.info.name || 'Agentic Bro',
          tokenSymbol: parsedData.parsed.info.symbol || 'AGNTCBRO',
          decimals: parsedData.parsed.info.decimals || 9,
        };
      }
    } catch (error) {
      console.error('Error getting token metadata:', error);
    }

    // Fallback defaults
    return {
      tokenMint: AGNTCBRO_MINT.toString(),
      tokenName: 'Agentic Bro',
      tokenSymbol: 'AGNTCBRO',
      decimals: 9,
    };
  }

  /**
   * Get token decimals
   */
  private async getTokenDecimals(): Promise<number> {
    const metadata = await this.getTokenMetadata();
    return metadata.decimals;
  }

  /**
   * Clear cache for a wallet
   */
  clearCache(walletAddress: string): void {
    holdingsCache.delete(walletAddress);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    holdingsCache.clear();
  }

  /**
   * Get multiple holdings at once (batch request)
   */
  async getMultipleHoldings(
    walletAddresses: string[]
  ): Promise<Map<string, TokenHoldings>> {
    const results = new Map<string, TokenHoldings>();

    for (const address of walletAddresses) {
      const holdings = await this.getHoldings(address);
      results.set(address, holdings);
    }

    return results;
  }

  /**
   * Verify webhook authentication (for API access)
   */
  async verifyWebhookAuth(
    walletAddress: string,
    signature: string,
    timestamp: number
  ): Promise<boolean> {
    // Check if timestamp is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return false;
    }

    // Verify token holdings
    const holdings = await this.getHoldings(walletAddress);

    // Only whales get API access
    return holdings.tier === 'whale';
  }
}

// Singleton instance
export const tokenVerifier = new TokenVerifier();

// Helper: Token thresholds constant
export const { TOKEN_THRESHOLDS } = {
  TOKEN_THRESHOLDS,
};