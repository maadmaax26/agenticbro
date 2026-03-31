/**
 * DexScreener API Client
 * 
 * Fetches token pair data from DexScreener
 */

import fetch from 'node-fetch';

export interface TokenPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns?: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  volume?: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange?: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: string;
  platform?: string;
}

export class DexScreenerClient {
  private baseUrl = 'https://api.dexscreener.com/latest';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get token pairs by contract address
   */
  async getTokenPairs(contractAddress: string): Promise<TokenPair[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/dex/tokens/${contractAddress}`,
        {
          headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {},
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait and retry
          await this.wait(1000);
          return this.getTokenPairs(contractAddress);
        }
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as { pairs?: TokenPair[] };
      return data.pairs || [];
    } catch (error) {
      console.error('DexScreener fetch error:', error);
      return [];
    }
  }

  /**
   * Get specific pair by address
   */
  async getPair(pairAddress: string): Promise<TokenPair | null> {
    try {
      const response = await fetch(`${this.baseUrl}/dex/pairs/${pairAddress}`);

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as { pair?: TokenPair };
      return data.pair || null;
    } catch (error) {
      console.error('DexScreener pair fetch error:', error);
      return null;
    }
  }

  /**
   * Search tokens by name or symbol
   */
  async searchTokens(query: string): Promise<TokenPair[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`DexScreener search error: ${response.status}`);
      }

      const data = await response.json() as { pairs?: TokenPair[] };
      return data.pairs || [];
    } catch (error) {
      console.error('DexScreener search error:', error);
      return [];
    }
  }

  /**
   * Wait helper for rate limiting
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default DexScreenerClient;