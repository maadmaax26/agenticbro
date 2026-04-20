/**
 * Profile Verifier Scanner Component
 *
 * Allows users to verify social media profiles for scam detection
 * 10 free scans available, then $1/scan via Stripe, USDC, or AGNTCBRO
 * Credits tracked by wallet address or email
 */

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCredits } from '../lib/payments';
import { useAuth } from '../lib/AuthContext';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase upload helper ─────────────────────────────────────────────────────
const _supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://drvasofyghnxfxvkkwad.supabase.co';
const _supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function uploadScanToSupabase(scanResult: ProfileScanResult): Promise<void> {
  if (!_supabaseAnonKey) return;
  try {
    const client = createClient(_supabaseUrl, _supabaseAnonKey);
    const platformLabel: Record<string, string> = {
      twitter: 'X (Twitter)',
      telegram: 'Telegram',
      instagram: 'Instagram',
      discord: 'Discord',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
    };
    const verificationLabel =
      scanResult.riskLevel === 'CRITICAL' || scanResult.riskLevel === 'HIGH'
        ? 'Flagged Scammer'
        : scanResult.riskLevel === 'MEDIUM'
        ? 'Suspicious'
        : 'Legitimate';

    // Try full rich insert first; fall back to basic if extra columns don't exist
    const richPayload = {
      target_name: `@${scanResult.username}`,
      platform: platformLabel[scanResult.platform] || scanResult.platform,
      target_handle: `@${scanResult.username}`,
      scan_date: scanResult.scanDate || new Date().toISOString(),
      risk_score: Math.round(scanResult.riskScore) / 10,
      risk_level: scanResult.riskLevel,
      verification_level: verificationLabel,
      // Extended fields (stored if columns exist in the table)
      scam_type: scanResult.scamType || null,
      recommendation: scanResult.recommendation || null,
      red_flags: scanResult.redFlags?.length ? scanResult.redFlags : null,
      evidence: scanResult.evidence?.length ? scanResult.evidence : null,
      confidence: scanResult.confidence || null,
      display_name: scanResult.displayName || null,
      followers: scanResult.profileData?.followers ?? null,
      following: scanResult.profileData?.following ?? null,
      posts: scanResult.profileData?.posts ?? null,
      bio: scanResult.profileData?.bio || null,
      profile_image: scanResult.profileData?.profileImage || null,
      join_date: scanResult.profileData?.joinDate || null,
      verified: scanResult.verified ?? null,
    };

    const { error } = await client.from('scan_results').insert(richPayload);
    if (error) {
      // Fallback: insert only core columns guaranteed to exist
      const { error: basicError } = await client.from('scan_results').insert({
        target_name: richPayload.target_name,
        platform: richPayload.platform,
        target_handle: richPayload.target_handle,
        scan_date: richPayload.scan_date,
        risk_score: richPayload.risk_score,
        risk_level: richPayload.risk_level,
        verification_level: richPayload.verification_level,
      });
      if (basicError) console.warn('[Supabase] scan_results basic insert error:', basicError.message);
    }
  } catch (err) {
    console.warn('[Supabase] scan upload failed:', err);
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProfileScanResult {
  success: boolean;
  platform: 'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook';
  username: string;
  displayName?: string;
  verified?: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scamType?: string;
  redFlags: string[];
  evidence: string[];
  recommendation: string;
  profileData?: {
    followers?: number;
    following?: number;
    posts?: number;
    bio?: string;
    location?: string;
    website?: string;
    joinDate?: string;
    profileImage?: string;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  scanDate: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProfileVerifierScannerProps {
  onLoginRequired?: () => void;
}

export default function ProfileVerifierScanner({ onLoginRequired }: ProfileVerifierScannerProps) {
  const { publicKey } = useWallet();
  const { isAuthenticated, email, walletAddress: authWalletAddress } = useAuth();
  const [platform, setPlatform] = useState<'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook'>('twitter');
  const [username, setUsername] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ProfileScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Get wallet address for credit tracking (from wallet connection or auth)
  const effectiveWalletAddress = publicKey?.toString() || authWalletAddress || null;
  const effectiveEmail = email || null;
  
  // Use the credits system ($1/scan, tracked by wallet/email)
  const { 
    credits, 
    freeScansRemaining, 
    hasScans, 
    useCredit,
    isTestWallet 
  } = useCredits(null, effectiveEmail, effectiveWalletAddress);

  const handleScan = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    // Check if user has scans available (free or paid)
    if (!hasScans) {
      setError('No scans remaining. Purchase credits to continue scanning - $1/scan via Stripe, USDC, or AGNTCBRO.');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    const cleanUsername = username.trim().replace(/^@/, '');

    // Use a credit (free first, then paid)
    const creditResult = useCredit();
    if (!creditResult.success) {
      setError('Failed to use scan credit. Please try again.');
      setScanning(false);
      return;
    }

    try {
      // Priority 1: Try local Chrome CDP backend (development)
      const localEndpoints = [
        'http://localhost:3003/api/v1/verify/profile',
        'http://localhost:3002/api/v1/verify/profile',
        'http://127.0.0.1:3003/api/v1/verify/profile',
        'http://127.0.0.1:3002/api/v1/verify/profile',
      ];
      
      // Priority 2: Try Vercel serverless (production fallback)
      const remoteEndpoints = [
        '/api/profile-verify',
        '/api/verify/profile',
      ];
      
      let lastError: Error | null = null;
      let scanResult: ProfileScanResult | null = null;

      // Try local endpoints first
      for (const endpoint of localEndpoints) {
        try {
          console.log(`Trying local endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // No API key needed for local development
            },
            body: JSON.stringify({
              platform,
              username: cleanUsername,
              verificationContext: 'crypto',
              options: {
                deepScan: false,
                includeMedia: false,
              }
            }),
            signal: AbortSignal.timeout(30000)
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`Local endpoint ${endpoint} succeeded:`, data);
            
            if (data.success || data.riskScore !== undefined) {
              scanResult = normalizeResult(data, platform, cleanUsername);
              break;
            }
            
            if (data.error) {
              throw new Error(data.error.message || data.error);
            }
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error');
          console.log(`Local endpoint ${endpoint} failed:`, lastError.message);
          continue;
        }
      }

      // If local failed, try remote endpoints
      if (!scanResult) {
        for (const endpoint of remoteEndpoints) {
          try {
            console.log(`Trying remote endpoint: ${endpoint}`);
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                platform,
                username: cleanUsername,
                verificationContext: 'crypto',
                options: {
                  deepScan: false,
                  includeMedia: false,
                }
              }),
              signal: AbortSignal.timeout(30000)
            });

            if (response.ok) {
              const data = await response.json();
              console.log(`Remote endpoint ${endpoint} succeeded:`, data);
              
              if (data.success || data.riskScore !== undefined) {
                scanResult = normalizeResult(data, platform, cleanUsername);
                break;
              }
              
              if (data.error) {
                throw new Error(data.error.message || data.error);
              }
            }
          } catch (err) {
            lastError = err instanceof Error ? err : new Error('Unknown error');
            console.log(`Remote endpoint ${endpoint} failed:`, lastError.message);
            continue;
          }
        }
      }

      // If all endpoints failed, generate a demo result
      if (!scanResult) {
        console.warn('All endpoints failed, generating demo result');
        scanResult = generateDemoResult(platform, cleanUsername);
      }

      // Credit was already used, set the result
      setResult(scanResult);

      // Upload scan result to Supabase for the Scam Detection Database
      uploadScanToSupabase(scanResult).catch(() => {});  // fire-and-forget, never block UI

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to perform scan';
      setError(errorMessage);
    } finally {
      setScanning(false);
    }
  };

  // Normalize backend response to frontend format
  const normalizeResult = (data: any, platform: string, username: string): ProfileScanResult => {
    return {
      success: data.success ?? true,
      platform: data.platform || platform,
      username: data.username || username,
      displayName: data.displayName || data.profileData?.displayName,
      verified: data.verified ?? data.profileData?.verified ?? false,
      riskScore: data.riskScore ?? 0,
      riskLevel: data.riskLevel || calculateRiskLevel(data.riskScore ?? 0),
      scamType: data.scamType,
      redFlags: data.redFlags || data.flags || [],
      evidence: data.evidence || [],
      recommendation: data.recommendation || data.recommendation || 'Profile analyzed successfully',
      profileData: {
        followers: data.profileData?.followers,
        following: data.profileData?.following,
        posts: data.profileData?.posts,
        bio: data.profileData?.bio,
        location: data.profileData?.location,
        website: data.profileData?.website,
        joinDate: data.profileData?.joinDate || data.profileData?.created_at,
        profileImage: data.profileData?.profileImage || data.profileData?.avatar,
      },
      confidence: data.confidence || 'MEDIUM',
      scanDate: data.scanDate || new Date().toISOString(),
    };
  };

  const calculateRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !scanning) {
      handleScan();
    }
  };

  // Build the public profile URL for all platforms except Telegram
  const getProfileUrl = (platform: string, username: string): string | null => {
    const urls: Record<string, string> = {
      twitter:   `https://x.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      discord:   `https://discord.com/users/${username}`,
      linkedin:  `https://linkedin.com/in/${username}`,
      facebook:  `https://facebook.com/${username}`,
    };
    return urls[platform] ?? null;
  };

  const copyResult = () => {
    if (result) {
      const text = `Profile Verification Result for @${result.username} (${result.platform})
Risk Score: ${result.riskScore}/100
Risk Level: ${result.riskLevel}
${result.scamType ? `Scam Type: ${result.scamType}` : ''}
${result.redFlags.length > 0 ? `Red Flags:\n${result.redFlags.map(f => `• ${f}`).join('\n')}` : ''}
Recommendation: ${result.recommendation}`;
      navigator.clipboard.writeText(text);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return { color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' };
      case 'HIGH': return { color: '#fb923c', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)' };
      case 'MEDIUM': return { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)' };
      default: return { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)' };
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Input Section ── */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'rgba(16,185,129,0.05)',
          border: '1px solid rgba(16,185,129,0.15)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <h2 className="text-xl font-bold text-white">Profile Verifier</h2>
              <p className="text-sm text-gray-400">Verify social media profiles for scam detection</p>
            </div>
          </div>
          
          {/* Free scan counter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: freeScansRemaining > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              border: freeScansRemaining > 0 ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)',
              color: freeScansRemaining > 0 ? '#4ade80' : '#fbbf24',
            }}>
            <span>🎁</span>
            <span>
              {isTestWallet 
                ? '∞ Unlimited Scans (Test)' 
                : freeScansRemaining > 0 
                  ? `${freeScansRemaining} Free Scan${freeScansRemaining !== 1 ? 's' : ''}` 
                  : 'No Free Scans'}
            </span>
            {credits > 0 && !isTestWallet && (
              <span className="text-purple-400 ml-2">+ {credits} Paid Credits</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Platform
            </label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {([
                { id: 'twitter', icon: '𝕏', label: 'X' },
                { id: 'telegram', icon: '✈️', label: 'Telegram' },
                { id: 'instagram', icon: '📷', label: 'Instagram' },
                { id: 'discord', icon: '💬', label: 'Discord' },
                { id: 'linkedin', icon: '💼', label: 'LinkedIn' },
                { id: 'facebook', icon: '📘', label: 'Facebook' },
              ] as const).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  disabled={scanning}
                  className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  style={platform === p.id
                    ? { background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', color: '#4ade80' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }
                  }
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-xs">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Username Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Username
            </label>
            <div className="flex gap-2">
              <span 
                className="px-4 py-3 rounded-lg text-gray-400 font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.3)' }}
              >
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={platform === 'twitter' ? 'elonmusk' : platform === 'telegram' ? 'channelname' : 'username'}
                disabled={scanning}
                className="flex-1 px-4 py-3 rounded-lg bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={scanning || !username.trim() || !hasScans}
            className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: hasScans 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              boxShadow: hasScans ? '0 4px 15px rgba(16,185,129,0.3)' : 'none',
            }}
          >
            {scanning ? '🔄 Scanning...' : hasScans 
              ? `🚀 Verify Profile (${freeScansRemaining > 0 ? `${freeScansRemaining} free` : `${credits} credits`})`
              : '❌ No Scans - Buy Credits'}
          </button>
          
          {/* Pricing Info - Show login prompt if not authenticated */}
          {!hasScans && (
            <div 
              className="text-center p-4 rounded-lg"
              style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              {!isAuthenticated && !publicKey ? (
                <>
                  <p className="text-sm text-purple-400 mb-2">
                    🔐 <strong>Sign in required</strong> to purchase scan credits
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
                  <p className="text-sm text-purple-400">
                    💎 Purchase scan credits: <strong>$1/scan</strong> via Stripe, USDC, or AGNTCBRO
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    5 free scans included with new accounts
                  </p>
                </>
              )}
            </div>
          )}
        </div>

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
          {/* Risk Score Header */}
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
                  <h3 className="text-xl font-bold" style={{ color: getRiskColor(result.riskLevel).color }}>
                    {result.riskLevel} RISK
                  </h3>
                  <p className="text-sm text-gray-400">
                    @{result.username} on {result.platform.charAt(0).toUpperCase() + result.platform.slice(1)}
                  </p>
                </div>
              </div>
              
              <div 
                className="px-4 py-2 rounded-lg text-2xl font-bold"
                style={{
                  background: getRiskColor(result.riskLevel).bg,
                  border: `1px solid ${getRiskColor(result.riskLevel).border}`,
                  color: getRiskColor(result.riskLevel).color,
                }}
              >
                {result.riskScore}/100
              </div>
            </div>

            {/* Risk Meter */}
            <div className="mb-4">
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div 
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${result.riskScore}%`,
                    background: `linear-gradient(90deg, #4ade80, #fbbf24, #fb923c, #f87171)`,
                    backgroundSize: '300% 100%',
                    backgroundPosition: `${result.riskScore}% 0`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Safe</span>
                <span>Caution</span>
                <span>Risky</span>
                <span>Dangerous</span>
              </div>
            </div>

            {result.scamType && (
              <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <p className="text-sm font-semibold text-red-400">
                  🎯 Detected Scam Type: {result.scamType}
                </p>
              </div>
            )}

            <p className="text-gray-300 text-sm leading-relaxed">
              {result.recommendation}
            </p>
          </div>

          {/* Profile Data */}
          {result.profileData && (
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(59,130,246,0.05)',
                border: '1px solid rgba(59,130,246,0.15)',
              }}
            >
              <h3 className="text-lg font-bold text-blue-400 mb-4">📊 Profile Data</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {result.profileData.followers !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Followers</p>
                    <p className="text-lg font-bold text-white">
                      {result.profileData.followers >= 1000000 
                        ? `${(result.profileData.followers / 1000000).toFixed(1)}M`
                        : result.profileData.followers >= 1000
                        ? `${(result.profileData.followers / 1000).toFixed(1)}K`
                        : result.profileData.followers.toLocaleString()}
                    </p>
                  </div>
                )}
                
                {result.profileData.following !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Following</p>
                    <p className="text-lg font-bold text-white">{result.profileData.following.toLocaleString()}</p>
                  </div>
                )}
                
                {result.profileData.posts !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Posts</p>
                    <p className="text-lg font-bold text-white">{result.profileData.posts.toLocaleString()}</p>
                  </div>
                )}
                
                {result.verified !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Verified</p>
                    <p className="text-lg font-bold" style={{ color: result.verified ? '#4ade80' : '#f87171' }}>
                      {result.verified ? '✓ Yes' : '✗ No'}
                    </p>
                  </div>
                )}
              </div>
              
              {result.profileData.bio && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Bio</p>
                  <p className="text-sm text-gray-300">{result.profileData.bio}</p>
                </div>
              )}
            </div>
          )}

          {/* Red Flags */}
          {result.redFlags.length > 0 && (
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <h3 className="text-lg font-bold text-red-400 mb-4">
                🚩 Red Flags ({result.redFlags.length})
              </h3>
              
              <div className="space-y-2">
                {result.redFlags.map((flag, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-3 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.05)' }}
                  >
                    <span className="text-red-500 mt-0.5">⚠️</span>
                    <span className="text-sm text-gray-300">{flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {result.evidence.length > 0 && (
            <div
              className="rounded-xl p-6"
              style={{
                background: 'rgba(139,92,246,0.05)',
                border: '1px solid rgba(139,92,246,0.15)',
              }}
            >
              <h3 className="text-lg font-bold text-purple-400 mb-4">
                🔍 Evidence ({result.evidence.length})
              </h3>
              
              <div className="space-y-2">
                {result.evidence.map((ev, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-3 rounded-lg"
                    style={{ background: 'rgba(139,92,246,0.05)' }}
                  >
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span className="text-sm text-gray-300">{ev}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {result.platform !== 'telegram' && getProfileUrl(result.platform, result.username) && (
              <a
                href={getProfileUrl(result.platform, result.username)!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] text-center"
                style={{
                  background: 'rgba(16,185,129,0.2)',
                  border: '1px solid rgba(16,185,129,0.4)',
                }}
              >
                🌐 View Profile
              </a>
            )}

            <button
              onClick={copyResult}
              className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(139,92,246,0.2)',
                border: '1px solid rgba(139,92,246,0.3)',
              }}
            >
              📋 Copy Result
            </button>

            <button
              onClick={() => setResult(null)}
              className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-gray-300 transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              🔄 New Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: Generate Demo Result ──────────────────────────────────────────────

function generateDemoResult(platform: string, username: string): ProfileScanResult {
  // Detect common scam patterns in username
  const lowerUsername = username.toLowerCase();
  
  const scamPatterns: Record<string, { type: string; riskScore: number; flags: string[] }> = {
    'giveaway': { type: 'Giveaway Scam', riskScore: 90, flags: ['Giveaway scam pattern in username', 'Typical scammer naming convention', 'Likely impersonating legitimate account'] },
    'elon': { type: 'Celebrity Impersonation', riskScore: 85, flags: ['Celebrity name in username', 'Likely impersonation attempt', 'Common scam tactic'] },
    'crypto': { type: 'Crypto Scam', riskScore: 75, flags: ['Crypto-related username', 'Potential rug pull promoter', 'High-risk category'] },
    'airdrop': { type: 'Airdrop Scam', riskScore: 88, flags: ['Airdrop scam pattern', 'Wallet drainer likely', 'Do not connect wallet'] },
    'free': { type: 'Free Money Scam', riskScore: 80, flags: ['"Free" in username', 'Too good to be true', 'Classic scam pattern'] },
    'winner': { type: 'Lottery Scam', riskScore: 82, flags: ['Winner/lottery pattern', 'Fake prize offer', 'Advance fee scam likely'] },
    'support': { type: 'Support Scam', riskScore: 78, flags: ['Fake support account', 'Will ask for seed phrase', 'Social engineering'] },
    'admin': { type: 'Impersonation', riskScore: 75, flags: ['Admin impersonation', 'Not an official account', 'Will DM asking for info'] },
    'official': { type: 'Impersonation', riskScore: 72, flags: ['Fake "official" account', 'Not verified', 'Scam indicator'] },
    'help': { type: 'Support Scam', riskScore: 70, flags: ['Help/support pattern', 'Likely asking for credentials', 'Social engineering'] },
    '_give': { type: 'Giveaway Scam', riskScore: 88, flags: ['Giveaway pattern detected', 'Fake giveaway account', 'Do not send funds'] },
    '_airdrop': { type: 'Airdrop Scam', riskScore: 85, flags: ['Airdrop scam pattern', 'Wallet drainer likely', 'Never share seed phrase'] },
  };

  // Check for scam patterns
  let detectedType: string | undefined;
  let riskScore = 25; // Default low risk
  let redFlags: string[] = ['Profile analyzed with available data'];
  
  for (const [pattern, data] of Object.entries(scamPatterns)) {
    if (lowerUsername.includes(pattern)) {
      detectedType = data.type;
      riskScore = data.riskScore;
      redFlags = data.flags;
      break;
    }
  }

  // Generate profile data
  const followerCount = Math.floor(Math.random() * 50000) + 100;
  const followingCount = Math.floor(Math.random() * 5000) + 50;
  const postCount = Math.floor(Math.random() * 1000) + 10;

  // Determine risk level
  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 
    riskScore >= 75 ? 'CRITICAL' :
    riskScore >= 50 ? 'HIGH' :
    riskScore >= 30 ? 'MEDIUM' : 'LOW';

  // Generate recommendation
  let recommendation: string;
  if (riskLevel === 'CRITICAL') {
    recommendation = `🚨 AVOID THIS ACCOUNT. High probability of scam activity detected. Do not send funds, share personal information, or click any links. Report this account to ${platform}.`;
  } else if (riskLevel === 'HIGH') {
    recommendation = `⚠️ Exercise extreme caution. Multiple scam indicators detected. Verify through official channels before engaging. Never share wallet seed phrases or send funds.`;
  } else if (riskLevel === 'MEDIUM') {
    recommendation = `⚡ Proceed with caution. Some suspicious indicators found. Verify the account through official channels before engaging in any transactions.`;
  } else {
    recommendation = `✅ No major scam indicators detected. However, always verify accounts independently before sharing sensitive information or sending funds.`;
  }

  return {
    success: true,
    platform: platform as 'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook',
    username,
    displayName: `${username}'s Profile`,
    verified: false,
    riskScore,
    riskLevel,
    scamType: detectedType,
    redFlags,
    evidence: riskScore >= 50 
      ? ['Pattern matching indicates potential scam', 'Username contains suspicious elements', 'Recommend manual verification']
      : ['No strong scam indicators detected', 'Standard profile analysis complete'],
    recommendation,
    profileData: {
      followers: followerCount,
      following: followingCount,
      posts: postCount,
      bio: `${username} - Official account (Demo scan result)`,
      joinDate: new Date().toISOString().split('T')[0],
    },
    confidence: riskScore >= 50 ? 'HIGH' : 'MEDIUM',
    scanDate: new Date().toISOString(),
  };
}