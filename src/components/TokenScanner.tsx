/**
 * Token Scanner Component
 *
 * Scan tokens by contract address for risk analysis, scam detection, and trading signals
 * 5 free scans per user, then $1/scan via Stripe, USDC, or AGNTCBRO
 */

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCredits } from '../lib/payments';
import { useAuth } from '../lib/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TokenScanResult {
  success: boolean;
  ticker: string;
  name: string;
  contractAddress: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  liquidity: number;
  marketCap: number;
  volume24h: number;
  price: number;
  priceChange24h: number;
  holders: number;
  topHolderPercentage: number;
  deployerHistory: 'CLEAN' | 'UNKNOWN' | 'SUSPICIOUS' | 'KNOWN_RUGGER';
  flags: string[];
  recommendation: string;
  scanDate: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TokenScannerProps {
  onLoginRequired?: () => void;
}

export default function TokenScanner({ onLoginRequired }: TokenScannerProps) {
  const { publicKey } = useWallet();
  const { isAuthenticated, email, walletAddress: authWalletAddress } = useAuth();
  const [contractAddress, setContractAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<TokenScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Get wallet address for credit tracking (from wallet connection or auth)
  const effectiveWalletAddress = publicKey?.toString() || authWalletAddress || null;
  const effectiveEmail = email || null;
  
  // Use the credits system ($1/scan, tracked by wallet/email)
  const { 
    credits, 
    freeScansRemaining, 
    hasScans, 
    useCredit
  } = useCredits(null, effectiveEmail, effectiveWalletAddress);

  const handleScan = async () => {
    if (!contractAddress.trim()) {
      setError('Please enter a contract address');
      return;
    }

    // Check if user has scans available
    if (!hasScans) {
      setError('No scans remaining. Purchase credits to continue scanning - $1/scan via Stripe, USDC, or AGNTCBRO.');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    // Use a credit (free first, then paid)
    const creditResult = useCredit();
    if (!creditResult.success) {
      setError('Failed to use scan credit. Please try again.');
      setScanning(false);
      return;
    }

    try {
      // Try DexScreener API for token data
      const cleanAddress = contractAddress.trim();
      
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddress}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Get the main pair (highest liquidity)
        const mainPair = data.pairs.sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) => 
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        
        // Calculate risk score based on various factors
        let riskScore = 0;
        const flags: string[] = [];
        
        // Liquidity check
        const liquidity = mainPair.liquidity?.usd || 0;
        if (liquidity < 10000) {
          riskScore += 25;
          flags.push('🚨 Very low liquidity (<$10k)');
        } else if (liquidity < 50000) {
          riskScore += 15;
          flags.push('⚠️ Low liquidity (<$50k)');
        } else if (liquidity < 100000) {
          riskScore += 10;
          flags.push('⚡ Medium liquidity');
        }
        
        // Market cap check
        const marketCap = mainPair.marketCap || 0;
        if (marketCap < 100000) {
          riskScore += 20;
          flags.push('🚨 Very low market cap (<$100k)');
        } else if (marketCap < 1000000) {
          riskScore += 10;
          flags.push('⚠️ Low market cap (<$1M)');
        }
        
        // Volume check
        const volume = mainPair.volume?.h24 || 0;
        if (volume < 1000) {
          riskScore += 20;
          flags.push('🚨 Very low 24h volume (<$1k)');
        } else if (volume < 10000) {
          riskScore += 10;
          flags.push('⚠️ Low 24h volume');
        }
        
        // Price change check (extreme volatility - PUMP INDICATOR)
        const priceChange = mainPair.priceChange?.h24 || 0;
        if (Math.abs(priceChange) > 10000) {
          riskScore += 40;
          flags.push('🚨 EXTREME PUMP: >10,000% in 24h (Pump & Dump risk)');
        } else if (Math.abs(priceChange) > 1000) {
          riskScore += 30;
          flags.push('🔴 MASSIVE PUMP: >1,000% in 24h (High rug risk)');
        } else if (Math.abs(priceChange) > 100) {
          riskScore += 20;
          flags.push('⚠️ Large pump: >100% in 24h (Caution advised)');
        } else if (Math.abs(priceChange) > 50) {
          riskScore += 10;
          flags.push('⚡ High volatility (>50% change)');
        }
        
        // Liquidity to Market Cap ratio (low liquidity relative to cap = RISK)
        if (liquidity > 0 && marketCap > 0) {
          const liquidityRatio = (liquidity / marketCap) * 100;
          if (liquidityRatio < 1) {
            riskScore += 30;
            flags.push(`🚨 DANGER: Liquidity only ${liquidityRatio.toFixed(1)}% of market cap`);
          } else if (liquidityRatio < 5) {
            riskScore += 20;
            flags.push(`🔴 Low liquidity ratio: ${liquidityRatio.toFixed(1)}% of market cap`);
          } else if (liquidityRatio < 10) {
            riskScore += 10;
            flags.push(`⚠️ Moderate liquidity ratio: ${liquidityRatio.toFixed(1)}%`);
          }
        }
        
        // Fdv vs market cap ratio
        const fdv = mainPair.fdv || 0;
        if (fdv && marketCap && fdv / marketCap > 5) {
          riskScore += 20;
          flags.push('🔴 High FDV/MCap ratio');
        }
        
        // Check for pump.fun indicators (if in pair data)
        const dexId = mainPair.dexId || '';
        const pairAddress = mainPair.pairAddress || '';
        if (dexId === 'pumpswap' || dexId === 'pumpfun' || pairAddress.includes('pump')) {
          riskScore += 20;
          flags.push('🚨 PUMP.FUN TOKEN (Highest rug risk platform)');
        }
        
        // Check for paid promotion (boosts)
        const boosts = (mainPair as any).boosts?.active || 0;
        if (boosts > 100) {
          riskScore += 15;
          flags.push(`🔴 PAID PROMOTION: ${boosts} DexScreener boosts`);
        } else if (boosts > 10) {
          riskScore += 5;
          flags.push(`⚡ ${boosts} DexScreener boosts detected`);
        }
        
        // Recent pullback check (1h negative while 24h positive = dump started)
        const priceChange1h = mainPair.priceChange?.h1 || 0;
        if (priceChange > 100 && priceChange1h < -5) {
          riskScore += 15;
          flags.push('🔴 PULLBACK IN PROGRESS: 1h down while 24h up');
        }
        
        // Determine risk level
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        if (riskScore >= 70) riskLevel = 'CRITICAL';
        else if (riskScore >= 50) riskLevel = 'HIGH';
        else if (riskScore >= 25) riskLevel = 'MEDIUM';
        else riskLevel = 'LOW';
        
        // Determine confidence
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
        if (liquidity > 100000 && volume > 10000) confidence = 'HIGH';
        else if (liquidity > 10000) confidence = 'MEDIUM';
        else confidence = 'LOW';
        
        // Generate recommendation
        let recommendation: string;
        if (riskLevel === 'CRITICAL') {
          recommendation = '🚫 NOT RECOMMENDED — High risk detected. Multiple red flags present.';
        } else if (riskLevel === 'HIGH') {
          recommendation = '⚠️ CAUTION — Elevated risk. Proceed with extreme care and only invest what you can afford to lose.';
        } else if (riskLevel === 'MEDIUM') {
          recommendation = '⚡ MODERATE RISK — Some concerns found. Do additional research before investing.';
        } else {
          recommendation = '✅ LOW RISK — Token appears relatively safe. Always DYOR and never invest more than you can lose.';
        }
        
        const scanResult: TokenScanResult = {
          success: true,
          ticker: mainPair.baseToken?.symbol || 'UNKNOWN',
          name: mainPair.baseToken?.name || 'Unknown Token',
          contractAddress: cleanAddress,
          riskScore,
          riskLevel,
          confidence,
          liquidity,
          marketCap,
          volume24h: volume,
          price: parseFloat(mainPair.priceUsd || '0'),
          priceChange24h: priceChange,
          holders: 0, // Not available from DexScreener
          topHolderPercentage: 0,
          deployerHistory: 'UNKNOWN',
          flags,
          recommendation,
          scanDate: new Date().toISOString(),
        };
        
        setResult(scanResult);
      } else {
        setError('Token not found. Please check the contract address and try again.');
      }
    } catch (err) {
      console.error('Scan error:', err);
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

  // Helper function for risk colors
  const getRiskColor = (level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    switch (level) {
      case 'LOW': return { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.4)', color: '#4ade80' };
      case 'MEDIUM': return { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.4)', color: '#fbbf24' };
      case 'HIGH': return { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.4)', color: '#fb923c' };
      case 'CRITICAL': return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.4)', color: '#f87171' };
    }
  };

  // Scan counter colour
  const counterColour =
    !hasScans ? '#f87171'
    : freeScansRemaining === 1 ? '#fbbf24'
    : '#4ade80';

  const totalScansRemaining = freeScansRemaining + credits;

  return (
    <div className="space-y-6">
      {/* ── Input Section ── */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'rgba(34,197,94,0.05)',
          border: '1px solid rgba(34,197,94,0.15)',
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪙</span>
            <div>
              <h2 className="text-xl font-bold text-white">Token Scanner</h2>
              <p className="text-sm text-gray-400">Analyze any token by contract address</p>
            </div>
          </div>

          {/* Scan counter badge */}
          <div
            className="flex flex-col items-center px-4 py-2 rounded-xl text-center"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: `1px solid ${counterColour}40`,
              minWidth: '90px',
            }}
          >
            <span className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
              Scans
            </span>
            <span className="text-xl font-black" style={{ color: counterColour }}>
              {totalScansRemaining}
            </span>
            {freeScansRemaining > 0 && (
              <span className="text-xs text-green-400">
                {freeScansRemaining} free
              </span>
            )}
            {credits > 0 && (
              <span className="text-xs text-emerald-400">
                {credits} paid
              </span>
            )}
          </div>
        </div>

        {/* Tier scan counts */}
        <div className="text-xs text-gray-500 mb-4">
          <span>Free: 5 | Holder: 50/mo | Whale: Unlimited</span>
        </div>

        {/* No scans remaining */}
        {!hasScans ? (
          <div
            className="rounded-xl p-5 text-center"
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <span className="text-3xl mb-3 block">🔒</span>
            <p className="text-white font-bold mb-1">No Scans Remaining</p>
            
            {/* Show login prompt if not authenticated */}
            {!isAuthenticated && !publicKey ? (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  <strong>Sign in required</strong> to purchase scan credits
                </p>
                <button
                  onClick={() => onLoginRequired?.()}
                  className="px-6 py-2 rounded-lg font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                  }}
                >
                  Sign In / Connect Wallet
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Purchase credits to continue scanning — <span className="text-emerald-400 font-semibold">$1/scan</span> via Stripe, USDC, or AGNTCBRO
                </p>
                <p className="text-xs text-gray-500">
                  5 free scans included with new accounts
                </p>
              </>
            )}
          </div>
        ) : (
          /* Normal scan form */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Contract Address
              </label>
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter Solana token address..."
                disabled={scanning}
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-emerald-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
              </p>
            </div>

            <button
              onClick={handleScan}
              disabled={scanning || !contractAddress.trim() || !hasScans}
              className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: hasScans 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                boxShadow: hasScans ? '0 4px 15px rgba(16,185,129,0.3)' : 'none',
              }}
            >
              {scanning ? '🔄 Scanning...' : hasScans 
                ? `🔍 Scan Token (${freeScansRemaining > 0 ? `${freeScansRemaining} free` : `${credits} credits`})`
                : '❌ No Scans - Buy Credits'}
            </button>
          </div>
        )}

        {error && (
          <div
            className="mt-4 p-4 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <p className="text-red-400 text-sm font-medium">⚠️ {error}</p>
          </div>
        )}
      </div>

      {/* ── Results Section ── */}
      {result && (
        <div className="space-y-4">
          {/* Token Info Header */}
          <div
            className="rounded-xl p-6"
            style={{
              background: getRiskColor(result.riskLevel).bg,
              border: `2px solid ${getRiskColor(result.riskLevel).border}`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {result.riskLevel === 'CRITICAL' ? '🚨' : 
                   result.riskLevel === 'HIGH' ? '⚠️' : 
                   result.riskLevel === 'MEDIUM' ? '⚡' : '✅'}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {result.ticker}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {result.name}
                  </p>
                </div>
              </div>
              
              <div 
                className="px-4 py-2 rounded-lg text-xl font-bold"
                style={{
                  background: getRiskColor(result.riskLevel).bg,
                  border: `1px solid ${getRiskColor(result.riskLevel).border}`,
                  color: getRiskColor(result.riskLevel).color,
                }}
              >
                {result.riskLevel} RISK
              </div>
            </div>

            {/* Token Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-black/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Price</p>
                <p className="text-lg font-bold text-white">
                  ${result.price < 0.0001 ? result.price.toExponential(2) : result.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">24h Change</p>
                <p className={`text-lg font-bold ${result.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {result.priceChange24h >= 0 ? '+' : ''}{result.priceChange24h.toFixed(2)}%
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Liquidity</p>
                <p className="text-lg font-bold text-white">
                  ${result.liquidity.toLocaleString()}
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Market Cap</p>
                <p className="text-lg font-bold text-white">
                  ${result.marketCap.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Risk Score Meter */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Risk Score</span>
                <span className="text-sm font-bold" style={{ color: getRiskColor(result.riskLevel).color }}>
                  {result.riskScore}/100
                </span>
              </div>
              <div className="h-3 rounded-full bg-black/30 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${result.riskScore}%`,
                    background: `linear-gradient(90deg, #4ade80, #fbbf24, #fb923c, #f87171)`,
                  }}
                />
              </div>
            </div>

            {/* Flags */}
            {result.flags.length > 0 && (
              <div className="bg-black/20 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-400 mb-2">Flags Detected</p>
                <div className="flex flex-wrap gap-2">
                  {result.flags.map((flag, i) => (
                    <span 
                      key={i}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ 
                        background: 'rgba(239,68,68,0.2)', 
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171'
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="bg-black/20 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                {result.recommendation}
              </p>
            </div>
          </div>

          {/* Contract Address */}
          <div className="bg-black/20 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Contract Address</p>
            <p className="font-mono text-sm text-gray-300 break-all">
              {result.contractAddress}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}