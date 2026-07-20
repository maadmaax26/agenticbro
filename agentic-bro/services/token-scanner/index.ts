/**
 * Token Scanner Service
 * 
 * Real-time token risk assessment for Solana tokens
 * Scans multiple sources and calculates comprehensive risk score
 */

import { DexScreenerClient, TokenPair } from '../../clients/dexscreener';
import { GoPlusClient, SecurityInfo } from '../../clients/goplus';
import { RugCheckClient, TokenReport } from '../../clients/rugcheck';
import { SolanaClient, TokenAuthority } from '../../clients/solana';
import { Cache } from '../../utils/cache';
import { Pool } from 'pg';

export interface TokenScanResult {
  token: {
    symbol: string;
    name: string;
    contract: string;
    platform?: string;
    createdAt?: string;
  };
  riskScore: number;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categories: {
    liquidity: CategoryResult;
    developer: CategoryResult;
    honeypot: CategoryResult;
    authority: CategoryResult;
    market: CategoryResult;
  };
  redFlags: string[];
  warnings: string[];
  recommendation: string;
  scanTime: string;
  scanDuration: string;
  cached: boolean;
}

interface CategoryResult {
  score: number;
  status: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, any>;
}

export class TokenScanner {
  private dexScreener: DexScreenerClient;
  private goPlus: GoPlusClient;
  private rugCheck: RugCheckClient;
  private solana: SolanaClient;
  private cache: Cache;
  private db: Pool;

  constructor(deps: {
    dexScreener?: DexScreenerClient;
    goPlus?: GoPlusClient;
    rugCheck?: RugCheckClient;
    solana?: SolanaClient;
    cache: Cache;
    db: Pool;
  }) {
    this.dexScreener = deps.dexScreener || new DexScreenerClient();
    this.goPlus = deps.goPlus || new GoPlusClient(process.env.GOPUS_API_KEY);
    this.rugCheck = deps.rugCheck || new RugCheckClient();
    this.solana = deps.solana || new SolanaClient(process.env.SOLANA_RPC_URL);
    this.cache = deps.cache;
    this.db = deps.db;
  }

  /**
   * Scan a token by contract address
   */
  async scan(contractAddress: string, options: { forceRefresh?: boolean } = {}): Promise<TokenScanResult> {
    const startTime = Date.now();

    // Normalize address
    const normalizedAddress = contractAddress.trim();
    
    // Validate address
    if (!this.isValidSolanaAddress(normalizedAddress)) {
      throw new Error('INVALID_ADDRESS');
    }

    // Check cache
    const cacheKey = `scan:${normalizedAddress}`;
    if (!options.forceRefresh) {
      const cached = await this.cache.get<TokenScanResult>(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // Fetch data from all sources in parallel
    const [dexData, securityData, rugCheckData, authorityData] = await Promise.allSettled([
      this.dexScreener.getTokenPairs(normalizedAddress),
      this.goPlus.getTokenSecurity(normalizedAddress),
      this.rugCheck.getTokenReport(normalizedAddress),
      this.solana.getTokenAuthority(normalizedAddress),
    ]);

    // Extract successful results
    const pairs = dexData.status === 'fulfilled' ? dexData.value : [];
    const security = securityData.status === 'fulfilled' ? securityData.value : null;
    const rugReport = rugCheckData.status === 'fulfilled' ? rugCheckData.value : null;
    const authority = authorityData.status === 'fulfilled' ? authorityData.value : null;

    // Get primary pair for token info
    const primaryPair = this.getPrimaryPair(pairs);
    
    if (!primaryPair && pairs.length === 0) {
      throw new Error('TOKEN_NOT_FOUND');
    }

    // Calculate risk scores for each category
    const honeypotResult = this.calculateHoneypotScore(security);
    const liquidityResult = this.calculateLiquidityScore(primaryPair, rugReport);
    const developerResult = this.calculateDeveloperScore(rugReport, security);
    const authorityResult = this.calculateAuthorityScore(authority, security);
    const marketResult = this.calculateMarketScore(primaryPair, rugReport);

    // Calculate total risk score (weighted)
    const totalScore = 
      honeypotResult.score * 3.5 +  // 35% weight
      developerResult.score * 2.5 + // 25% weight
      liquidityResult.score * 2.0 + // 20% weight
      authorityResult.score * 1.5 + // 15% weight
      marketResult.score * 0.5;     // 5% weight

    // Determine risk level
    const riskLevel = this.getRiskLevel(totalScore);

    // Collect red flags and warnings
    const { redFlags, warnings } = this.collectFlags(
      honeypotResult,
      liquidityResult,
      developerResult,
      authorityResult,
      marketResult,
      primaryPair
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(riskLevel, redFlags, warnings);

    const result: TokenScanResult = {
      token: {
        symbol: primaryPair?.baseToken?.symbol || 'Unknown',
        name: primaryPair?.baseToken?.name || 'Unknown Token',
        contract: normalizedAddress,
        platform: primaryPair?.platform || undefined,
        createdAt: rugReport?.createdAt || primaryPair?.pairCreatedAt,
      },
      riskScore: Math.round(totalScore * 10) / 10,
      riskLevel,
      categories: {
        honeypot: honeypotResult,
        liquidity: liquidityResult,
        developer: developerResult,
        authority: authorityResult,
        market: marketResult,
      },
      redFlags,
      warnings,
      recommendation,
      scanTime: new Date().toISOString(),
      scanDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      cached: false,
    };

    // Cache result (5 minutes for popular, 1 hour for others)
    const ttl = riskLevel === 'SAFE' ? 3600 : 300;
    await this.cache.set(cacheKey, result, ttl);

    // Save to database
    await this.saveScanResult(normalizedAddress, result);

    return result;
  }

  /**
   * Calculate honeypot risk score
   */
  private calculateHoneypotScore(security: SecurityInfo | null): CategoryResult {
    if (!security) {
      return {
        score: 1.5,
        status: 'MEDIUM',
        details: { error: 'Security data unavailable' },
      };
    }

    let score = 0;
    const details: Record<string, any> = {
      buyable: security.buyable ?? true,
      sellable: security.sellable ?? true,
      sellTax: security.sellTax ?? 0,
      maxSellPercent: security.maxSellPercent ?? 100,
      hiddenOwner: security.hiddenOwner ?? false,
      honeypot: security.honeypot ?? false,
    };

    // Honeypot detection
    if (security.honeypot || !security.sellable) {
      score = 3.5; // CRITICAL
    } else if (security.hiddenOwner) {
      score = 2.5; // HIGH
    } else if (security.sellTax >= 16) {
      score = 2.5; // HIGH
    } else if (security.sellTax >= 6) {
      score = 1.5; // MEDIUM
    } else if (security.sellTax >= 1 || (security.maxSellPercent ?? 100) < 50) {
      score = 0.5; // LOW
    }

    return {
      score,
      status: this.getStatusFromScore(score, 3.5),
      details,
    };
  }

  /**
   * Calculate liquidity risk score
   */
  private calculateLiquidityScore(pair: TokenPair | null, rugReport: TokenReport | null): CategoryResult {
    const details: Record<string, any> = {
      locked: false,
      lockDuration: null,
      lockPercent: 0,
      liquidityUsd: 0,
    };

    if (!pair && !rugReport) {
      return {
        score: 2.0,
        status: 'CRITICAL',
        details: { error: 'No liquidity data available' },
      };
    }

    let score = 0;

    // Get liquidity info
    const liquidityUsd = pair?.liquidity?.usd || 0;
    const liquidityInfo = rugReport?.liquidity;

    details.liquidityUsd = liquidityUsd;
    details.locked = liquidityInfo?.locked ?? false;
    details.lockPercent = liquidityInfo?.percent ?? 0;
    details.lockDuration = liquidityInfo?.duration || null;

    // Calculate score
    if (liquidityUsd < 10000) {
      score = 2.0; // CRITICAL - insufficient liquidity
    } else if (!liquidityInfo?.locked) {
      score = 1.5; // HIGH - unlocked liquidity
    } else if ((liquidityInfo?.percent ?? 0) < 50) {
      score = 1.0; // MEDIUM - partially locked
    } else if ((liquidityInfo?.percent ?? 0) < 80) {
      score = 0.5; // LOW - mostly locked
    }

    return {
      score,
      status: this.getStatusFromScore(score, 2.0),
      details,
    };
  }

  /**
   * Calculate developer risk score
   */
  private calculateDeveloperScore(rugReport: TokenReport | null, security: SecurityInfo | null): CategoryResult {
    const details: Record<string, any> = {
      devHoldingsPercent: 0,
      top10HoldersPercent: 0,
      devTransactions: 0,
      soldPercent: 0,
    };

    if (!rugReport && !security) {
      return {
        score: 1.0,
        status: 'MEDIUM',
        details: { error: 'Developer data unavailable' },
      };
    }

    let score = 0;

    // Get developer holdings
    const devHoldings = rugReport?.developer?.holdingsPercent ?? security?.devHoldingsPercent ?? 0;
    const top10Holders = rugReport?.distribution?.top10Percent ?? security?.top10HoldersPercent ?? 0;
    const devSold = rugReport?.developer?.soldPercent ?? 0;

    details.devHoldingsPercent = devHoldings;
    details.top10HoldersPercent = top10Holders;
    details.soldPercent = devSold;
    details.devTransactions = rugReport?.developer?.transactions ?? 0;

    // Calculate score
    if (devSold === 100) {
      score = 2.5; // CRITICAL - dev rug pulled
    } else if (devHoldings > 40 || top10Holders > 70) {
      score = 2.5; // CRITICAL - highly concentrated
    } else if (devHoldings > 25 || top10Holders > 50) {
      score = 1.5; // HIGH
    } else if (devHoldings > 10 || top10Holders > 35) {
      score = 1.0; // MEDIUM
    } else if (devHoldings > 5 || top10Holders > 20) {
      score = 0.5; // LOW
    }

    return {
      score,
      status: this.getStatusFromScore(score, 2.5),
      details,
    };
  }

  /**
   * Calculate authority risk score
   */
  private calculateAuthorityScore(authority: TokenAuthority | null, security: SecurityInfo | null): CategoryResult {
    const details: Record<string, any> = {
      mintable: false,
      freezable: false,
      permanentDelegate: false,
      mintRevoked: false,
      freezeRevoked: false,
      authorityTransfers: 0,
    };

    if (!authority && !security) {
      return {
        score: 0.7,
        status: 'MEDIUM',
        details: { error: 'Authority data unavailable' },
      };
    }

    let score = 0;

    // Get authority info
    const mintAuthority = authority?.mintAuthority ?? security?.mintable ?? false;
    const freezeAuthority = authority?.freezeAuthority ?? security?.freezable ?? false;
    const permanentDelegate = security?.permanentDelegate ?? false;
    const mintRevoked = authority?.mintRevoked ?? !mintAuthority;
    const freezeRevoked = authority?.freezeRevoked ?? !freezeAuthority;

    details.mintable = mintAuthority && !mintRevoked;
    details.freezable = freezeAuthority && !freezeRevoked;
    details.permanentDelegate = permanentDelegate;
    details.mintRevoked = mintRevoked;
    details.freezeRevoked = freezeRevoked;
    details.authorityTransfers = authority?.authorityTransfers ?? 0;

    // Calculate score
    if (permanentDelegate) {
      score = 1.5; // CRITICAL
    } else if (details.mintable && details.freezable) {
      score = 1.0; // HIGH - multiple dangerous authorities
    } else if (details.freezable) {
      score = 0.7; // MEDIUM - can freeze
    } else if (details.mintable && !mintRevoked) {
      score = 0.3; // LOW - can mint
    }

    return {
      score,
      status: this.getStatusFromScore(score, 1.5),
      details,
    };
  }

  /**
   * Calculate market risk score
   */
  private calculateMarketScore(pair: TokenPair | null, rugReport: TokenReport | null): CategoryResult {
    const details: Record<string, any> = {
      marketCap: 0,
      volume24h: 0,
      holders: 0,
      transactions24h: 0,
      ageDays: 0,
    };

    if (!pair && !rugReport) {
      return {
        score: 0.3,
        status: 'HIGH',
        details: { error: 'Market data unavailable' },
      };
    }

    let score = 0;

    // Get market info
    const marketCap = pair?.marketCap ?? 0;
    const volume24h = pair?.volume?.h24 ?? 0;
    const holders = rugReport?.holders?.count ?? 0;
    const transactions24h = pair?.txns?.h24 ?? 0;
    
    // Calculate age
    const createdAt = rugReport?.createdAt || pair?.pairCreatedAt;
    const ageDays = createdAt ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    details.marketCap = marketCap;
    details.volume24h = volume24h;
    details.holders = holders;
    details.transactions24h = transactions24h;
    details.ageDays = ageDays;

    // Calculate score based on age
    if (ageDays < 1) {
      score = 0.5; // CRITICAL - less than 24 hours
    } else if (ageDays < 3) {
      score = 0.3; // HIGH
    } else if (ageDays < 7) {
      score = 0.2; // MEDIUM
    } else if (ageDays < 30) {
      score = 0.1; // LOW
    }

    // Adjust for holders
    if (holders < 50) {
      score = Math.max(score, 0.5);
    } else if (holders < 100) {
      score = Math.max(score, 0.3);
    }

    return {
      score,
      status: this.getStatusFromScore(score, 0.5),
      details,
    };
  }

  /**
   * Get risk level from total score
   */
  private getRiskLevel(score: number): 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score <= 1.5) return 'SAFE';
    if (score <= 3.0) return 'LOW';
    if (score <= 5.0) return 'MEDIUM';
    if (score <= 7.0) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Get status from category score
   */
  private getStatusFromScore(score: number, maxScore: number): 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const percentage = (score / maxScore) * 100;
    if (percentage === 0) return 'SAFE';
    if (percentage < 20) return 'LOW';
    if (percentage < 50) return 'MEDIUM';
    if (percentage < 80) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Collect red flags and warnings
   */
  private collectFlags(
    honeypot: CategoryResult,
    liquidity: CategoryResult,
    developer: CategoryResult,
    authority: CategoryResult,
    market: CategoryResult,
    pair: TokenPair | null
  ): { redFlags: string[]; warnings: string[] } {
    const redFlags: string[] = [];
    const warnings: string[] = [];

    // Honeypot red flags
    if (honeypot.details.honeypot) {
      redFlags.push('🚨 HONEYPOT DETECTED - Cannot sell this token');
    }
    if (honeypot.details.hiddenOwner) {
      redFlags.push('🚨 Hidden owner detected - Contract may be manipulated');
    }
    if (!honeypot.details.sellable) {
      redFlags.push('🚨 Token is not sellable');
    }
    if (honeypot.details.sellTax > 15) {
      redFlags.push(`🚨 High sell tax: ${honeypot.details.sellTax}%`);
    }

    // Liquidity red flags
    if (liquidity.details.liquidityUsd < 5000) {
      redFlags.push('🚨 Extremely low liquidity - Easy to manipulate');
    }
    if (!liquidity.details.locked && liquidity.details.liquidityUsd > 0) {
      warnings.push('⚠️ Liquidity not locked - Can be removed at any time');
    }

    // Developer red flags
    if (developer.details.soldPercent === 100) {
      redFlags.push('🚨 Developer sold 100% of holdings - RUG PULL');
    }
    if (developer.details.devHoldingsPercent > 30) {
      redFlags.push(`🚨 Developer holds ${developer.details.devHoldingsPercent}% - High concentration risk`);
    }
    if (developer.details.top10HoldersPercent > 70) {
      redFlags.push(`🚨 Top 10 holders own ${developer.details.top10HoldersPercent}% - Highly concentrated`);
    }

    // Authority red flags
    if (authority.details.permanentDelegate) {
      redFlags.push('🚨 Permanent delegate authority - Can transfer any token');
    }
    if (authority.details.freezable) {
      warnings.push('⚠️ Freeze authority active - Tokens can be frozen');
    }
    if (authority.details.mintable) {
      warnings.push('⚠️ Mint authority active - More tokens can be minted');
    }

    // Market warnings
    if (market.details.ageDays < 1) {
      warnings.push('⚠️ Token less than 24 hours old - Extreme caution advised');
    } else if (market.details.ageDays < 7) {
      warnings.push(`⚠️ Token created ${market.details.ageDays} days ago - Newer tokens carry higher risk`);
    }
    if (market.details.holders < 50) {
      warnings.push(`⚠️ Only ${market.details.holders} holders - Low distribution`);
    }

    return { redFlags, warnings };
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(
    riskLevel: string,
    redFlags: string[],
    warnings: string[]
  ): string {
    if (redFlags.length > 0) {
      return `⛔ DO NOT TRADE - ${redFlags.length} critical red flag${redFlags.length > 1 ? 's' : ''} detected. Avoid this token.`;
    }

    switch (riskLevel) {
      case 'SAFE':
        return '✅ SAFE TO TRADE - Low risk profile. Standard due diligence recommended.';
      case 'LOW':
        return `✅ MOSTLY SAFE - ${warnings.length} minor warning${warnings.length > 1 ? 's' : ''}. Proceed with standard caution.`;
      case 'MEDIUM':
        return `⚠️ PROCEED WITH CAUTION - Moderate risk detected. Research thoroughly before trading.`;
      case 'HIGH':
        return `🔴 HIGH RISK - Significant red flags present. Only trade if you fully understand the risks.`;
      case 'CRITICAL':
        return `🟣 CRITICAL RISK - This token has multiple severe issues. Strong recommendation to avoid.`;
      default:
        return '⚠️ Unable to assess risk - Insufficient data. Exercise extreme caution.';
    }
  }

  /**
   * Get primary trading pair
   */
  private getPrimaryPair(pairs: TokenPair[]): TokenPair | null {
    if (!pairs || pairs.length === 0) return null;

    // Sort by liquidity
    const sorted = [...pairs].sort((a, b) => 
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    );

    return sorted[0];
  }

  /**
   * Validate Solana address format
   */
  private isValidSolanaAddress(address: string): boolean {
    // Base58 check (32-44 characters)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  }

  /**
   * Save scan result to database
   */
  private async saveScanResult(contractAddress: string, result: TokenScanResult): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO token_scan_history (
          contract_address,
          symbol,
          name,
          risk_score,
          risk_level,
          honeypot_score,
          liquidity_score,
          developer_score,
          authority_score,
          market_score,
          red_flags,
          warnings,
          recommendation,
          platform,
          scan_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        contractAddress,
        result.token.symbol,
        result.token.name,
        result.riskScore,
        result.riskLevel,
        result.categories.honeypot.score,
        result.categories.liquidity.score,
        result.categories.developer.score,
        result.categories.authority.score,
        result.categories.market.score,
        result.redFlags,
        result.warnings,
        result.recommendation,
        result.token.platform,
        JSON.stringify(result),
      ]);
    } catch (error) {
      console.error('Failed to save scan result:', error);
    }
  }

  /**
   * Get scan history for a token
   */
  async getScanHistory(contractAddress: string, limit: number = 10): Promise<TokenScanResult[]> {
    const result = await this.db.query(`
      SELECT scan_data
      FROM token_scan_history
      WHERE contract_address = $1
      ORDER BY scan_time DESC
      LIMIT $2
    `, [contractAddress, limit]);

    return result.rows.map(row => row.scan_data);
  }

  /**
   * Get trending scans (most scanned tokens)
   */
  async getTrending(limit: number = 10): Promise<Array<{ contract: string; symbol: string; scanCount: number; avgRisk: number }>> {
    const result = await this.db.query(`
      SELECT 
        contract_address as contract,
        symbol,
        COUNT(*) as scan_count,
        AVG(risk_score) as avg_risk
      FROM token_scan_history
      WHERE scan_time > NOW() - INTERVAL '24 hours'
      GROUP BY contract_address, symbol
      ORDER BY scan_count DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      contract: row.contract,
      symbol: row.symbol,
      scanCount: parseInt(row.scan_count),
      avgRisk: parseFloat(row.avg_risk),
    }));
  }
}

export default TokenScanner;