/**
 * GoPlus Security API Client
 * 
 * Fetches token security info including honeypot detection
 */

import fetch from 'node-fetch';

export interface SecurityInfo {
  // Token info
  address: string;
  chainId: number;

  // Honeypot detection
  honeypot?: boolean;
  buyable?: boolean;
  sellable?: boolean;
  buyTax?: number;
  sellTax?: number;
  maxSellPercent?: number;
  hiddenOwner?: boolean;

  // Authority
  mintable?: boolean;
  freezable?: boolean;
  permanentDelegate?: boolean;
  mintRevoked?: boolean;
  freezeRevoked?: boolean;

  // Developer
  devHoldingsPercent?: number;
  top10HoldersPercent?: number;

  // Market
  holders?: number;
  totalSupply?: string;
  decimals?: number;

  // Risk signals
  isProxy?: boolean;
  isBlacklisted?: boolean;
  cannotBuyAll?: boolean;
  externalCall?: boolean;
}

export class GoPlusClient {
  private baseUrl = 'https://api.gopluslabs.io/api/v1';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get token security info
   */
  async getTokenSecurity(contractAddress: string): Promise<SecurityInfo | null> {
    try {
      // Solana chain ID is -1 (or we use the Solana-specific endpoint)
      const response = await fetch(
        `${this.baseUrl}/solana/token_security/${contractAddress}`,
        {
          headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          await this.wait(1000);
          return this.getTokenSecurity(contractAddress);
        }
        throw new Error(`GoPlus API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (!data.result) {
        return null;
      }

      const result = data.result;

      // Map GoPlus response to our SecurityInfo format
      return {
        address: contractAddress,
        chainId: -1, // Solana
        honeypot: result.honeypot === '1',
        buyable: result.buyable === '1',
        sellable: result.sellable === '1',
        buyTax: this.parseTax(result.buy_tax),
        sellTax: this.parseTax(result.sell_tax),
        maxSellPercent: this.parsePercent(result.max_sell_percent),
        hiddenOwner: result.hidden_owner === '1',
        mintable: result.mintable === '1',
        freezable: result.freezable === '1',
        permanentDelegate: result.permanent_delegate === '1',
        mintRevoked: result.mint_revoked === '1',
        freezeRevoked: result.freeze_revoked === '1',
        devHoldingsPercent: this.parsePercent(result.dev_holdings_percent),
        top10HoldersPercent: this.parsePercent(result.top_10_holders_percent),
        holders: parseInt(result.holders || '0'),
        totalSupply: result.total_supply,
        decimals: parseInt(result.decimals || '9'),
        isProxy: result.is_proxy === '1',
        isBlacklisted: result.is_blacklisted === '1',
        cannotBuyAll: result.cannot_buy_all === '1',
        externalCall: result.external_call === '1',
      };
    } catch (error) {
      console.error('GoPlus fetch error:', error);
      return null;
    }
  }

  /**
   * Get multiple tokens security info
   */
  async getBatchTokenSecurity(
    contractAddresses: string[]
  ): Promise<Map<string, SecurityInfo>> {
    const results = new Map<string, SecurityInfo>();

    // Process in batches of 10 to avoid rate limits
    for (let i = 0; i < contractAddresses.length; i += 10) {
      const batch = contractAddresses.slice(i, i + 10);
      const batchResults = await Promise.all(
        batch.map(addr => this.getTokenSecurity(addr))
      );

      batch.forEach((addr, idx) => {
        if (batchResults[idx]) {
          results.set(addr, batchResults[idx]!);
        }
      });

      // Rate limit delay between batches
      if (i + 10 < contractAddresses.length) {
        await this.wait(500);
      }
    }

    return results;
  }

  /**
   * Parse tax value (can be percentage or basis points)
   */
  private parseTax(value: string | undefined): number {
    if (!value) return 0;
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    // GoPlus sometimes returns basis points (e.g., 100 = 1%)
    if (num > 100) return num / 100;
    return num;
  }

  /**
   * Parse percentage value
   */
  private parsePercent(value: string | undefined): number {
    if (!value) return 0;
    return parseFloat(value) || 0;
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GoPlusClient;