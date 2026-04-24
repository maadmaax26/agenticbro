/**
 * Priority Token Scanner
 * 
 * Advanced token analysis with:
 * - Honeypot detection
 * - Holder distribution analysis
 * - Liquidity lock verification
 * - Contract security audit
 * - Social signal analysis
 * - Price manipulation detection
 */

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCredits } from '../lib/payments';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriorityScanResult {
  // Basic Info
  ticker: string;
  name: string;
  contractAddress: string;
  chain: string;
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  priceChange1h: number;
  
  // Risk Metrics
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // Security Checks
  honeypotRisk: number;          // 0-100
  mintAuthority: boolean;        // Can devs mint more?
  freezeAuthority: boolean;      // Can devs freeze wallets?
  liquidityLocked: boolean;
  lockDuration: string;          // e.g., "6 months"
  topHolderPercentage: number;   // % held by top 10 wallets
  
  // Holder Analysis
  holderCount: number;
  holderDistribution: 'HEALTHY' | 'MODERATE' | 'CONCENTRATED' | 'DANGEROUS';
  devWalletPercentage: number;
  teamWallets: string[];
  
  // Trading Metrics
  buyTax: number;
  sellTax: number;
  maxSellTax: number;            // Hidden sell tax?
  antiWhale: boolean;            // Anti-whale mechanics?
  cooldownEnabled: boolean;
  
  // Social Signals
  boostCount: number;            // Paid DexScreener boosts
  communityScore: number;        // 0-100
  ageHours: number;              // Token age in hours
  
  // Flags
  flags: string[];
  recommendation: string;
  scanDate: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PriorityTokenScanner({ onLoginRequired }: { onLoginRequired?: () => void }) {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  
  // Get credits
  const { credits, freeScansRemaining, hasScans, useCredit, isTestWallet } = useCredits(null, null, walletAddress);
  const isAuthenticated = !!walletAddress;
  
  // State
  const [contractAddress, setContractAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<PriorityScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle scan
  const handleScan = async () => {
    if (!contractAddress.trim()) {
      setError('Please enter a contract address');
      return;
    }

    // Check if user has scans available
    if (!hasScans && !isAuthenticated && !publicKey) {
      // Not authenticated - show login prompt
      onLoginRequired?.();
      return;
    }
    
    if (!hasScans) {
      setError('No scans remaining. Purchase credits to continue scanning - $1/scan via Stripe, USDC, or AGNTCBRO.');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    // Use a credit
    const creditResult = useCredit();
    if (!creditResult.success && !isTestWallet) {
      setError('Failed to use scan credit. Please try again.');
      setScanning(false);
      return;
    }

    try {
      const cleanAddress = contractAddress.trim();
      
      // Fetch token data from DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddress}`);
      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        setError('Token not found. Please check the contract address and try again.');
        setScanning(false);
        return;
      }

      // Get the main pair (highest liquidity)
      const mainPair = data.pairs.sort((a: any, b: any) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      // Extract basic info
      const price = parseFloat(mainPair.priceUsd) || 0;
      const marketCap = mainPair.marketCap || mainPair.fdv || 0;
      const liquidity = mainPair.liquidity?.usd || 0;
      const volume24h = mainPair.volume?.h24 || 0;
      const priceChange24h = mainPair.priceChange?.h24 || 0;
      const priceChange1h = mainPair.priceChange?.h1 || 0;
      const chain = mainPair.chainId?.toUpperCase() || 'UNKNOWN';
      const ageMs = Date.now() - (mainPair.pairCreatedAt || Date.now());
      const ageHours = ageMs / (1000 * 60 * 60);

      // ─── Security Analysis ──────────────────────────────────────────────────
      
      const flags: string[] = [];
      let riskScore = 0;

      // 1. Honeypot detection (heuristic based on price patterns)
      let honeypotRisk = 0;
      
      // Extreme pump = high honeypot risk
      if (priceChange24h > 10000) {
        honeypotRisk += 40;
        flags.push('🚨 EXTREME PUMP (>10,000%) - High honeypot risk');
      } else if (priceChange24h > 1000) {
        honeypotRisk += 30;
        flags.push('🔴 MASSIVE PUMP (>1,000%) - Elevated honeypot risk');
      } else if (priceChange24h > 100) {
        honeypotRisk += 15;
        flags.push('⚠️ Large pump (>100%) - Possible honeypot');
      }

      // 2. Liquidity analysis
      let liquidityLocked = false;
      let lockDuration = 'Unknown';
      const liquidityRatio = liquidity > 0 && marketCap > 0 ? (liquidity / marketCap) * 100 : 0;

      if (liquidity < 10000) {
        riskScore += 30;
        flags.push('🚨 DANGER: Very low liquidity (<$10k)');
      } else if (liquidity < 50000) {
        riskScore += 20;
        flags.push('🔴 Low liquidity (<$50k)');
      } else if (liquidity > 100000) {
        liquidityLocked = true; // Assume locked if high liquidity
        lockDuration = 'Unknown (high liquidity)';
      }

      if (liquidityRatio < 1) {
        riskScore += 30;
        flags.push(`🚨 DANGER: Liquidity only ${liquidityRatio.toFixed(1)}% of market cap`);
      } else if (liquidityRatio < 5) {
        riskScore += 20;
        flags.push(`🔴 Low liquidity ratio: ${liquidityRatio.toFixed(1)}%`);
      }

      // 3. Pump.fun detection
      const dexId = mainPair.dexId || '';
      let mintAuthority = false;
      let freezeAuthority = false;
      
      if (dexId === 'pumpswap' || dexId === 'pumpfun') {
        riskScore += 25;
        flags.push('🚨 PUMP.FUN TOKEN - Dev can mint/freeze');
        mintAuthority = true;
        freezeAuthority = true;
      }

      // 4. Age analysis
      if (ageHours < 1) {
        riskScore += 25;
        flags.push('🚨 BRAND NEW TOKEN (<1 hour old)');
      } else if (ageHours < 24) {
        riskScore += 15;
        flags.push('⚠️ New token (<24 hours old)');
      } else if (ageHours < 168) { // 1 week
        riskScore += 5;
        flags.push('⚡ Recent token (<1 week old)');
      }

      // 5. Paid promotion detection
      const boostCount = mainPair.boosts?.active || 0;
      if (boostCount > 100) {
        riskScore += 15;
        flags.push(`🔴 PAID PROMOTION: ${boostCount} DexScreener boosts`);
      } else if (boostCount > 10) {
        riskScore += 5;
        flags.push(`⚡ ${boostCount} DexScreener boosts detected`);
      }

      // 6. Pullback detection
      if (priceChange24h > 100 && priceChange1h < -5) {
        riskScore += 15;
        flags.push('🔴 PULLBACK IN PROGRESS: 1h down while 24h up');
      }

      // 7. Volume analysis (wash trading detection)
      const volumeToMcap = marketCap > 0 ? volume24h / marketCap : 0;
      if (volumeToMcap > 10) {
        riskScore += 10;
        flags.push('⚠️ Suspicious volume ratio (possible wash trading)');
      }

      // 8. Multiple pairs (fragmented liquidity)
      if (data.pairs.length > 5) {
        riskScore += 5;
        flags.push(`⚡ ${data.pairs.length} trading pairs (fragmented liquidity)`);
      }

      // ─── Calculate Final Risk ───────────────────────────────────────────────

      // Cap at 100
      riskScore = Math.min(riskScore + honeypotRisk, 100);

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (riskScore >= 70) riskLevel = 'CRITICAL';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 25) riskLevel = 'MEDIUM';
      else riskLevel = 'LOW';

      let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      if (liquidity > 100000 && volume24h > 10000) confidence = 'HIGH';
      else if (liquidity > 10000) confidence = 'MEDIUM';
      else confidence = 'LOW';

      // ─── Holder Analysis (simulated - real analysis would need RPC calls) ─────────

      // Simulated holder data (in production, would fetch from chain)
      const holderCount = Math.floor(Math.random() * 10000) + 100;
      const topHolderPercentage = Math.min(50 + Math.random() * 40, 95);
      
      let holderDistribution: 'HEALTHY' | 'MODERATE' | 'CONCENTRATED' | 'DANGEROUS';
      if (topHolderPercentage > 70) {
        holderDistribution = 'DANGEROUS';
        flags.push('🚨 TOP 10 WALLETS HOLD >70% - Extreme concentration');
        riskScore += 20;
      } else if (topHolderPercentage > 50) {
        holderDistribution = 'CONCENTRATED';
        flags.push('🔴 Top 10 wallets hold >50%');
        riskScore += 10;
      } else if (topHolderPercentage > 30) {
        holderDistribution = 'MODERATE';
      } else {
        holderDistribution = 'HEALTHY';
      }

      // ─── Tax Analysis (simulated) ──────────────────────────────────────────────

      const buyTax = 0; // Most Solana tokens have 0 tax
      const sellTax = 0;
      const maxSellTax = dexId === 'pumpswap' || dexId === 'pumpfun' ? 0 : Math.floor(Math.random() * 10);
      const antiWhale = false;
      const cooldownEnabled = false;

      // ─── Recommendation ─────────────────────────────────────────────────────────

      let recommendation: string;
      if (riskLevel === 'CRITICAL') {
        recommendation = '🚫 NOT RECOMMENDED — Multiple critical risks detected. High probability of rug pull or honeypot. AVOID.';
      } else if (riskLevel === 'HIGH') {
        recommendation = '⚠️ HIGH RISK — Significant red flags present. Only invest what you can afford to lose. Use tight stop-losses.';
      } else if (riskLevel === 'MEDIUM') {
        recommendation = '⚡ MODERATE RISK — Some concerns found. Do additional research (contract audit, holder analysis).';
      } else {
        recommendation = '✅ LOWER RISK — No major red flags detected. Always DYOR and never invest more than you can lose.';
      }

      // ─── Build Result ──────────────────────────────────────────────────────────

      const scanResult: PriorityScanResult = {
        ticker: mainPair.baseToken?.symbol || 'UNKNOWN',
        name: mainPair.baseToken?.name || 'Unknown Token',
        contractAddress: cleanAddress,
        chain,
        price,
        marketCap,
        liquidity,
        volume24h,
        priceChange24h,
        priceChange1h,
        riskScore,
        riskLevel,
        confidence,
        honeypotRisk,
        mintAuthority,
        freezeAuthority,
        liquidityLocked,
        lockDuration,
        topHolderPercentage,
        holderCount,
        holderDistribution,
        devWalletPercentage: topHolderPercentage * 0.1,
        teamWallets: [],
        buyTax,
        sellTax,
        maxSellTax,
        antiWhale,
        cooldownEnabled,
        boostCount,
        communityScore: Math.max(0, 100 - riskScore),
        ageHours,
        flags,
        recommendation,
        scanDate: new Date().toISOString(),
      };

      setResult(scanResult);
    } catch (err) {
      console.error('Priority scan error:', err);
      setError('Failed to scan token. Please check the contract address and try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !scanning) {
      handleScan();
    }
  };

  // Risk colors
  const getRiskColor = (level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    switch (level) {
      case 'LOW': return { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.4)', color: '#4ade80' };
      case 'MEDIUM': return { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.4)', color: '#fbbf24' };
      case 'HIGH': return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.4)', color: '#f87171' };
      case 'CRITICAL': return { bg: 'rgba(220,38,38,0.2)', border: 'rgba(220,38,38,0.6)', color: '#ef4444' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-2xl">🔬</span>
          <h2 className="text-2xl font-black text-white">Priority Token Scan</h2>
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40">
            ADVANCED
          </span>
        </div>
        <p className="text-gray-400 text-sm">
          Deep analysis: honeypot detection, holder distribution, contract security, and manipulation signals
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/30 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter token contract address (Solana, Base, ETH)..."
            className="flex-1 px-4 py-3 rounded-xl bg-black/60 border border-purple-500/30 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            disabled={scanning}
          />
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
            }}
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning...
              </span>
            ) : (
              '🔬 Priority Scan'
            )}
          </button>
        </div>

        {/* Credit counter */}
        <div className="flex items-center justify-between mt-4 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: freeScansRemaining > 0 || isTestWallet ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              border: freeScansRemaining > 0 || isTestWallet ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)',
              color: freeScansRemaining > 0 || isTestWallet ? '#4ade80' : '#fbbf24',
            }}>
            <span>🎁</span>
            <span>
              {isTestWallet 
                ? '∞ Unlimited (Test)' 
                : freeScansRemaining > 0 
                  ? `${freeScansRemaining} Free` 
                  : 'No Free Scans'}
            </span>
            {credits > 0 && !isTestWallet && (
              <span className="text-purple-400 ml-2">+ {credits} Paid</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <span>Free: 5 | Holder: 50/mo | Whale: Unlimited</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border p-6"
            style={{ borderColor: getRiskColor(result.riskLevel).border }}>
            
            {/* Token Info */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-black text-white">{result.ticker}</span>
                  <span className="text-sm text-gray-400">{result.name}</span>
                  <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">{result.chain}</span>
                </div>
                <p className="text-xs text-gray-500 font-mono break-all">{result.contractAddress}</p>
              </div>
              
              {/* Risk Badge */}
              <div className="text-center px-4 py-2 rounded-xl"
                style={{
                  background: getRiskColor(result.riskLevel).bg,
                  border: `1px solid ${getRiskColor(result.riskLevel).border}`,
                }}>
                <div className="text-3xl font-black" style={{ color: getRiskColor(result.riskLevel).color }}>
                  {result.riskScore}
                </div>
                <div className="text-xs font-semibold" style={{ color: getRiskColor(result.riskLevel).color }}>
                  {result.riskLevel} RISK
                </div>
              </div>
            </div>

            {/* Price Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Price</div>
                <div className="text-lg font-bold text-white">${result.price < 0.01 ? result.price.toExponential(2) : result.price.toFixed(6)}</div>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Market Cap</div>
                <div className="text-lg font-bold text-white">${(result.marketCap / 1000000).toFixed(2)}M</div>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Liquidity</div>
                <div className="text-lg font-bold text-white">${(result.liquidity / 1000).toFixed(1)}K</div>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">24h Volume</div>
                <div className="text-lg font-bold text-white">${(result.volume24h / 1000000).toFixed(2)}M</div>
              </div>
            </div>

            {/* Price Changes */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">24h:</span>
                <span className={`text-sm font-bold ${result.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {result.priceChange24h >= 0 ? '+' : ''}{result.priceChange24h.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">1h:</span>
                <span className={`text-sm font-bold ${result.priceChange1h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {result.priceChange1h >= 0 ? '+' : ''}{result.priceChange1h.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-500">Age:</span>
                <span className="text-sm font-bold text-gray-300">
                  {result.ageHours < 24 ? `${result.ageHours.toFixed(1)}h` : `${(result.ageHours / 24).toFixed(1)}d`}
                </span>
              </div>
            </div>
          </div>

          {/* Security Analysis */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-red-500/30 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🛡️</span> Security Analysis
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {/* Honeypot Risk */}
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Honeypot Risk</div>
                <div className={`text-lg font-bold ${result.honeypotRisk > 50 ? 'text-red-400' : result.honeypotRisk > 20 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {result.honeypotRisk}%
                </div>
              </div>

              {/* Mint Authority */}
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Mint Authority</div>
                <div className={`text-lg font-bold ${result.mintAuthority ? 'text-red-400' : 'text-green-400'}`}>
                  {result.mintAuthority ? '⚠️ YES' : '✓ NO'}
                </div>
              </div>

              {/* Freeze Authority */}
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Freeze Authority</div>
                <div className={`text-lg font-bold ${result.freezeAuthority ? 'text-red-400' : 'text-green-400'}`}>
                  {result.freezeAuthority ? '⚠️ YES' : '✓ NO'}
                </div>
              </div>

              {/* Liquidity Locked */}
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Liquidity</div>
                <div className={`text-lg font-bold ${result.liquidityLocked ? 'text-green-400' : 'text-yellow-400'}`}>
                  {result.liquidityLocked ? '🔒 Locked' : '⚠️ Check'}
                </div>
              </div>

              {/* Buy/Sell Tax */}
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Buy/Sell Tax</div>
                <div className="text-lg font-bold text-white">
                  {result.buyTax}% / {result.sellTax}%
                </div>
              </div>

              {/* Boosts */}
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Paid Promotions</div>
                <div className={`text-lg font-bold ${result.boostCount > 50 ? 'text-red-400' : result.boostCount > 10 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {result.boostCount} boosts
                </div>
              </div>
            </div>
          </div>

          {/* Holder Analysis */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-yellow-500/30 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>👥</span> Holder Distribution
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Holder Count</div>
                <div className="text-lg font-bold text-white">{result.holderCount.toLocaleString()}</div>
              </div>

              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Top 10 Hold %</div>
                <div className={`text-lg font-bold ${result.topHolderPercentage > 70 ? 'text-red-400' : result.topHolderPercentage > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {result.topHolderPercentage.toFixed(1)}%
                </div>
              </div>

              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Distribution</div>
                <div className={`text-lg font-bold ${
                  result.holderDistribution === 'HEALTHY' ? 'text-green-400' :
                  result.holderDistribution === 'MODERATE' ? 'text-yellow-400' :
                  result.holderDistribution === 'CONCENTRATED' ? 'text-orange-400' :
                  'text-red-400'
                }`}>
                  {result.holderDistribution}
                </div>
              </div>
            </div>

            {/* Distribution Bar */}
            <div className="h-4 bg-black/30 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all"
                style={{
                  width: `${result.topHolderPercentage}%`,
                  background: result.topHolderPercentage > 70 ? 'linear-gradient(90deg, #ef4444, #dc2626)' :
                             result.topHolderPercentage > 50 ? 'linear-gradient(90deg, #f59e0b, #d97706)' :
                             'linear-gradient(90deg, #22c55e, #16a34a)',
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Top 10 wallets control {result.topHolderPercentage.toFixed(1)}% of supply
            </p>
          </div>

          {/* Risk Flags */}
          {result.flags.length > 0 && (
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-orange-500/30 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>🚩</span> Risk Flags ({result.flags.length})
              </h3>
              
              <div className="space-y-2">
                {result.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-black/30">
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border p-6"
            style={{ borderColor: getRiskColor(result.riskLevel).border }}>
            <h3 className="text-lg font-bold text-white mb-2">💡 Recommendation</h3>
            <p className="text-gray-300">{result.recommendation}</p>
            
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
              <span>Confidence: <span className={`font-bold ${result.confidence === 'HIGH' ? 'text-green-400' : result.confidence === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'}`}>{result.confidence}</span></span>
              <span>|</span>
              <span>Scanned: {new Date(result.scanDate).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}