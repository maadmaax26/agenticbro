/**
 * RugCheck API Client
 * 
 * Fetches token reports including developer holdings and distribution
 */

import fetch from 'node-fetch';

export interface TokenReport {
  // Token info
  address: string;
  name: string;
  symbol: string;
  createdAt?: string;

  // Liquidity info
  liquidity?: {
    locked?: boolean;
    percent?: number;
    duration?: string;
    unlockDate?: string;
    usd?: number;
  };

  // Developer info
  developer?: {
    address?: string;
    holdingsPercent?: number;
    soldPercent?: number;
    transactions?: number;
    firstBuyTime?: string;
    lastSellTime?: string;
  };

  // Distribution info
  distribution?: {
    top10Percent?: number;
    top20Percent?: number;
    giniCoefficient?: number;
  };

  // Holder info
  holders?: {
    count?: number;
    active24h?: number;
  };

  // Risk signals
  riskLevel?: string;
  flags?: string[];
  score?: number;
}

export class RugCheckClient {
  private baseUrl = 'https://api.rugcheck.xyz/v1';

  /**
   * Get token report
   */
  async getTokenReport(contractAddress: string): Promise<TokenReport | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/tokens/${contractAddress}/report`
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Token not found in RugCheck
          return null;
        }
        if (response.status === 429) {
          await this.wait(1000);
          return this.getTokenReport(contractAddress);
        }
        throw new Error(`RugCheck API error: ${response.status}`);
      }

      const data = await response.json() as any;

      return {
        address: contractAddress,
        name: data.token?.name || data.name || 'Unknown',
        symbol: data.token?.symbol || data.symbol || 'Unknown',
        createdAt: data.token?.created_at || data.created_at,

        liquidity: {
          locked: data.liquidity?.locked ?? false,
          percent: this.parsePercent(data.liquidity?.locked_percent),
          duration: data.liquidity?.lock_duration,
          unlockDate: data.liquidity?.unlock_date,
          usd: data.liquidity?.usd || 0,
        },

        developer: {
          address: data.developer?.address,
          holdingsPercent: this.parsePercent(data.developer?.holdings_percent),
          soldPercent: this.parsePercent(data.developer?.sold_percent),
          transactions: data.developer?.transactions || 0,
          firstBuyTime: data.developer?.first_buy,
          lastSellTime: data.developer?.last_sell,
        },

        distribution: {
          top10Percent: this.parsePercent(data.distribution?.top_10_percent),
          top20Percent: this.parsePercent(data.distribution?.top_20_percent),
          giniCoefficient: data.distribution?.gini,
        },

        holders: {
          count: data.holders?.count || 0,
          active24h: data.holders?.active_24h || 0,
        },

        riskLevel: data.risk_level || 'Unknown',
        flags: data.flags || [],
        score: data.score || 0,
      };
    } catch (error) {
      console.error('RugCheck fetch error:', error);
      return null;
    }
  }

  /**
   * Get token summary (lighter response)
   */
  async getTokenSummary(contractAddress: string): Promise<{ risk: string; score: number } | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/tokens/${contractAddress}/summary`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as any;
      return {
        risk: data.risk || 'Unknown',
        score: data.score || 0,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is flagged
   */
  async isTokenFlagged(contractAddress: string): Promise<boolean> {
    const report = await this.getTokenReport(contractAddress);
    if (!report) return false;
    
    return (report.flags?.length || 0) > 0 || report.riskLevel === 'Dangerous';
  }

  /**
   * Parse percentage value
   */
  private parsePercent(value: string | number | undefined): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    return parseFloat(value) || 0;
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RugCheckClient;