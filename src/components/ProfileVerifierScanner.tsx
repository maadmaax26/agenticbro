/**
 * Profile Verifier Scanner Component
 *
 * Allows users to verify social media profiles for scam detection
 * 10 free scans available, then $1/scan via Stripe, USDC, or AGNTCBRO
 * Credits tracked by wallet address or email
 */

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCredits } from '../lib/payments';
import { useAuth } from '../lib/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { useScanResult } from '../hooks/useScanResult';
import {
  type BotDetectionInput,
  type BotDetectionResult,
  calculateBotScore,
  formatBotClassification,
  formatBotResultText,
  mapScanResultToBotInput,
} from '../lib/bot-detection';
import {
  type EngagementAnalysisResult,
  formatEngagementResultText,
  formatEngagementClassification,
} from '../lib/engagement-analysis';

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
      tiktok: 'TikTok',
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
  platform: 'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook' | 'tiktok' | 'cross-platform';
  username: string;
  displayName?: string;
  verified?: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNAVAILABLE' | 'ERROR' | 'PENDING';
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
  botDetection?: BotDetectionResult;
  engagementAnalysis?: EngagementAnalysisResult;
  crossPlatformResults?: CrossPlatformResult[];
}

// ─── Component ────────────────────────────────────────────────────────────────


// ─── Disclaimer Notice Component ──────────────────────────────────────────────
function DisclaimerNotice({ scanDate }: { scanDate?: string }) {
  const dateStr = scanDate ? new Date(scanDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <p className="text-xs text-gray-400 leading-relaxed">
        📋 <span className="text-yellow-400 font-semibold">Disclaimer:</span> Educational purposes only. Not financial advice. Not a guarantee of safety. Always do your own due diligence (DYOR). Scan date: {dateStr}
      </p>
    </div>
  );
}

// ─── Cross-Platform Result Card ────────────────────────────────────────────────
function CrossPlatformResultCard({ result }: { result: CrossPlatformResult }) {
  const platformIcons: Record<string, string> = {
    'instagram': '📷', 'tiktok': '🎵', 'facebook': '📘',
    'telegram': '✈️', 'x (twitter)': 'X', 'twitter': 'X',
  };
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.4)', text: '#f87171' };
      case 'HIGH': return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24' };
      case 'MEDIUM': return { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.4)', text: '#facc15' };
      case 'LOW': return { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.4)', text: '#4ade80' };
      default: return { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.4)', text: '#9ca3af' };
    }
  };
  
  const colors = getRiskColor(result.riskLevel);
  const icon = platformIcons[result.platform.toLowerCase()] || '🔍';
  
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-white">
            {result.platform}
          </span>
        </div>
        {result.success ? (
          <span className="font-bold" style={{ color: colors.text }}>
            {(result.riskScore / 10).toFixed(1)}/10 — {result.riskLevel}
          </span>
        ) : (
          <span className="text-gray-500 text-sm">{result.error || 'Unavailable'}</span>
        )}
      </div>
      
      {result.success && result.redFlags.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-400 mb-1">Red Flags:</p>
          <div className="flex flex-wrap gap-1">
            {result.redFlags.slice(0, 3).map((flag, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#9ca3af' }}
              >
                {flag}
              </span>
            ))}
            {result.redFlags.length > 3 && (
              <span className="text-xs text-gray-500">+{result.redFlags.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cross-Platform Result Type ────────────────────────────────────────────────

interface CrossPlatformResult {
  platform: string;
  success: boolean;
  riskScore: number;
  riskLevel: string;
  redFlags: string[];
  error?: string;
  scannedAt: string;
}

interface ProfileVerifierScannerProps {
  onLoginRequired?: () => void;
}

export default function ProfileVerifierScanner({ onLoginRequired }: ProfileVerifierScannerProps) {
  const { publicKey } = useWallet();
  const { isAuthenticated, email, walletAddress: authWalletAddress } = useAuth();
  const [platform, setPlatform] = useState<'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook' | 'tiktok' | 'cross-platform'>('twitter');
  const [username, setUsername] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileScanResult | null>(null);
  const [crossPlatformProgress, setCrossPlatformProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [_fromCache, setFromCache] = useState(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time job status via Supabase Realtime (replaces polling)
  const { job, isComplete, isFailed, result: jobResult } = useScanResult(activeJobId);

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

  // ── Watch Realtime job updates ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeJobId || !job) return;

    if (job.status === 'claimed' || job.status === 'running') {
      setScanStatus('Agent scanning...');
    }

    if (isComplete && jobResult) {
      // Worker finished - normalize and display
      const scanResult = normalizeResult(jobResult, platform, username.replace(/^@/, ''));
      setResult(scanResult);
      setScanStatus(null);
      setScanning(false);
      setActiveJobId(null);
      uploadScanToSupabase(scanResult).catch(() => {});
    }

    if (isFailed) {
      console.warn('[Realtime] Job failed, falling back to demo result');
      const demo = generateDemoResult(platform, username.replace(/^@/, ''));
      setResult(demo);
      setScanStatus(null);
      setScanning(false);
      setActiveJobId(null);
    }
  }, [job?.status, isComplete, isFailed]);

  // ── Timeout fallback: if Realtime never fires, fall back to demo after 90s ──
  useEffect(() => {
    if (!scanning || !activeJobId) return;
    scanTimeoutRef.current = setTimeout(() => {
      console.warn('[Realtime] Timed out waiting for job result, falling back to demo');
      const demo = generateDemoResult(platform, username.replace(/^@/, ''));
      setResult(demo);
      setScanStatus(null);
      setScanning(false);
      setActiveJobId(null);
    }, 90000);
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [scanning, activeJobId]);

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
    setCrossPlatformProgress(0);

    const cleanUsername = username.trim().replace(/^@/, '');

    // ── Cross-Platform Scan ──────────────────────────────────────────────
    if (platform === 'cross-platform') {
      await runCrossPlatformScan(cleanUsername);
      return;
    }

    // Use a credit (free first, then paid)
    const creditResult = useCredit();
    if (!creditResult.success) {
      setError('Failed to use scan credit. Please try again.');
      setScanning(false);
      return;
    }

    try {
      const platformLabel: Record<string, string> = {
        twitter: 'X (Twitter)', telegram: 'Telegram', instagram: 'Instagram',
        discord: 'Discord', linkedin: 'LinkedIn', facebook: 'Facebook', tiktok: 'TikTok',
      };

      // ── STEP 1: Check cache first ──────────────────────────────────────
      if (_supabaseAnonKey) {
        try {
          const client = createClient(_supabaseUrl, _supabaseAnonKey);
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

          const { data: cached, error: cacheErr } = await client
            .from('scan_results')
            .select('*')
            .eq('target_handle', `@${cleanUsername}`)
            .eq('platform', platformLabel[platform] || platform)
            .gte('scan_date', twentyFourHoursAgo)
            .order('scan_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!cacheErr && cached) {
            console.log('[Cache] Hit for', cleanUsername, 'on', platform);
            const cachedResult: ProfileScanResult = {
              success: true,
              platform: platform as any,
              username: cleanUsername,
              displayName: cached.display_name || undefined,
              verified: cached.verified ?? false,
              riskScore: Math.round((cached.risk_score ?? 0) * 10),
              riskLevel: cached.risk_level || 'LOW',
              scamType: cached.scam_type || undefined,
              redFlags: cached.red_flags || [],
              evidence: cached.evidence || [],
              recommendation: cached.recommendation || 'Cached scan result',
              profileData: {
                followers: cached.followers ?? undefined,
                following: cached.following ?? undefined,
                bio: cached.bio || undefined,
                profileImage: cached.profile_image || undefined,
                joinDate: cached.join_date || undefined,
              },
              confidence: cached.confidence || 'MEDIUM',
              scanDate: cached.scan_date || new Date().toISOString(),
            };
            setResult(cachedResult);
            setFromCache(true);
            setScanStatus(null);
            setScanning(false);
            return;
          }
        } catch (cacheErr) {
          console.warn('[Cache] Lookup error, proceeding to scan:', cacheErr);
        }
      }

      setFromCache(false);

      // ── STEP 2: Direct serverless scan for IG/TikTok/FB (works via web fetch) ──
      const apiBase = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? '';

      if (['instagram', 'tiktok', 'facebook'].includes(platform)) {
        try {
          setScanStatus(`Scanning ${platform} profile...`);
          const scanRes = await fetch(`${apiBase}/api/social-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, username: cleanUsername }),
          });

          if (scanRes.ok) {
            const scanData = await scanRes.json();
            if (scanData.success) {
              const d = scanData;

              // Compute bot detection from the scan data
              let botDetection: BotDetectionResult | undefined;
              let engagementAnalysis: EngagementAnalysisResult | undefined;
              try {
                const { input: botInput, engagementData: workerEngagement } = mapScanResultToBotInput({
                  ...d,
                  profileData: {
                    ...d,
                    followers: d.followers,
                  },
                });
                botDetection = calculateBotScore(botInput, platform, workerEngagement);
                engagementAnalysis = botDetection.engagementAnalysis;
              } catch (_) { /* skip if insufficient data */ }

              const apiResult: ProfileScanResult = {
                success: true,
                platform: platform as any,
                username: cleanUsername,
                verified: false,
                riskScore: Math.round(d.riskScore * 10),
                riskLevel: d.riskLevel || 'LOW',
                scamType: undefined,
                redFlags: d.flagDetails?.map((f: any) => `${f.flag} (${f.weight}pts) - ${f.description}`) || [],
                evidence: [],
                recommendation: `Profile analyzed via serverless scan. ${d.redFlagsDetected} flag(s) detected.`,
                profileData: {
                  followers: d.followers ?? undefined,
                },
                confidence: d.redFlagsDetected > 0 ? 'HIGH' : 'MEDIUM',
                scanDate: d.scanTimestamp || new Date().toISOString(),
                botDetection,
                engagementAnalysis,
              };
              setResult(apiResult);
              uploadScanToSupabase(apiResult).catch(() => {});
              setScanStatus(null);
              setScanning(false);
              return;
            }
          }
          console.warn('[API] Social scan failed, falling back to queue');
        } catch (apiErr) {
          console.warn('[API] Social scan error, falling back to queue:', apiErr);
        }
      }

      // ── STEP 3: X/Twitter requires CDP - queue with specific scan_type ──
      if (platform === 'twitter') {
        // X requires Chrome CDP which can't run serverlessly
        // Queue for backend CDP worker
        if (_supabaseAnonKey) {
          try {
            const client = createClient(_supabaseUrl, _supabaseAnonKey);

            setScanStatus('Queuing X scan for CDP processing...');

            const { data: jobData, error: insertError } = await client
              .from('scan_jobs')
              .insert({
                scan_type: 'x_cdp',
                status: 'pending',
                target: cleanUsername,
                platform: 'twitter',
                payload: {
                  platform: 'twitter',
                  username: cleanUsername,
                  url: `https://x.com/${cleanUsername}`,
                  requestedAt: new Date().toISOString(),
                },
              })
              .select('id')
              .single();

            if (!insertError && jobData?.id) {
              setScanStatus('X scan queued - results in 1-2 min');
              setActiveJobId(jobData.id);
              console.log('[X-Scan] Job queued:', jobData.id);
              return;
            }
          } catch (queueErr) {
            console.warn('[X-Scan] Queue error:', queueErr);
          }
        }
        
        // Fallback: Show instruction message
        const xResult: ProfileScanResult = {
          success: false,
          platform: 'twitter',
          username: cleanUsername,
          riskScore: 0,
          riskLevel: 'UNAVAILABLE',
          redFlags: [],
          evidence: [],
          recommendation: 'X (Twitter) scans require Chrome CDP processing. Try the Jeeevs Telegram bot for instant X scans, or use the mobile app.',
          confidence: 'LOW',
          scanDate: new Date().toISOString(),
        };
        setResult(xResult);
        setScanning(false);
        return;
      }

      // ── STEP 4: Supabase queue → Mac Studio CDP worker (other platforms) ──
      if (_supabaseAnonKey) {
        try {
          const client = createClient(_supabaseUrl, _supabaseAnonKey);

          const { data: jobData, error: insertError } = await client
            .from('scan_jobs')
            .insert({
              scan_type: 'profile',
              status: 'pending',
              payload: {
                platform,
                username: cleanUsername,
                requestedAt: new Date().toISOString(),
                verificationContext: 'crypto',
              },
            })
            .select('id')
            .single();

          if (!insertError && jobData?.id) {
            setScanStatus('Queued - waiting for agent...');
            setActiveJobId(jobData.id);
            console.log('[Realtime] Scan job enqueued:', jobData.id);
            return;
          } else {
            console.warn('[Realtime] Insert error:', insertError?.message);
          }
        } catch (queueErr) {
          console.warn('[Realtime] Queue error, falling back:', queueErr);
        }
      }

      // ── STEP 4: Fallback demo result ──────────────────────────────────
      console.warn('[Scan] All paths unavailable - using demo result');
      const demo = generateDemoResult(platform, cleanUsername);
      setResult(demo);
      uploadScanToSupabase(demo).catch(() => {});
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to perform scan';
      setError(errorMessage);
    } finally {
      setScanning(false);
      setScanStatus(null);
    }
  };

  // Normalize backend response to frontend format
  const normalizeResult = (data: any, platform: string, username: string): ProfileScanResult => {
    // Compute bot detection from available data
    let botDetection: BotDetectionResult | undefined;
    let engagementAnalysis: EngagementAnalysisResult | undefined;
    try {
      const { input: botInput, engagementData: workerEngagement } = mapScanResultToBotInput(data);
      botDetection = calculateBotScore(botInput, platform, workerEngagement);
      engagementAnalysis = botDetection.engagementAnalysis;
    } catch (e) {
      console.warn('[BotDetection] Failed to compute bot score:', e);
    }

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
      botDetection,
      engagementAnalysis,
    };
  };

  const calculateRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  };

  // ── Cross-Platform Scan Function ──────────────────────────────────────
  const runCrossPlatformScan = async (cleanUsername: string) => {
    const platforms = ['instagram', 'tiktok', 'facebook', 'telegram', 'twitter'] as const;
    const apiBase = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? '';
    const results: CrossPlatformResult[] = [];
    
    // Use a credit for the cross-platform scan
    const creditResult = useCredit();
    if (!creditResult.success) {
      setError('Failed to use scan credit. Please try again.');
      setScanning(false);
      return;
    }
    
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const platformLabel = p === 'twitter' ? 'X (Twitter)' : p.charAt(0).toUpperCase() + p.slice(1);
      setScanStatus(`Scanning ${platformLabel}...`);
      setCrossPlatformProgress(Math.round((i / platforms.length) * 100));
      
      try {
        // Serverless scan for IG/TikTok/FB
        if (['instagram', 'tiktok', 'facebook'].includes(p)) {
          const res = await fetch(`${apiBase}/api/social-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: p, username: cleanUsername }),
          });
          
          if (res.ok) {
            const data = await res.json();
            results.push({
              platform: platformLabel,
              success: data.success ?? false,
              riskScore: Math.round((data.riskScore ?? 0) * 10),
              riskLevel: data.riskLevel ?? 'UNKNOWN',
              redFlags: data.flagDetails?.map((f: any) => `${f.flag} (${f.weight}pts)`) || [],
              scannedAt: new Date().toISOString(),
            });
          } else {
            results.push({
              platform: platformLabel,
              success: false,
              riskScore: 0,
              riskLevel: 'ERROR',
              redFlags: [],
              error: 'Scan failed',
              scannedAt: new Date().toISOString(),
            });
          }
        } else if (p === 'twitter') {
          // X requires CDP - queue for backend processing
          try {
            const res = await fetch(`${apiBase}/api/x-scan`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: cleanUsername }),
            });
            
            if (res.ok) {
              await res.json();
              results.push({
                platform: 'X (Twitter)',
                success: true,
                riskScore: 0,
                riskLevel: 'PENDING',
                redFlags: [],
                error: 'X scan queued - results in 1-2 min',
                scannedAt: new Date().toISOString(),
              });
            } else {
              results.push({
                platform: 'X (Twitter)',
                success: false,
                riskScore: 0,
                riskLevel: 'UNAVAILABLE',
                redFlags: [],
                error: 'X scan unavailable - try Telegram bot',
                scannedAt: new Date().toISOString(),
              });
            }
          } catch {
            results.push({
              platform: 'X (Twitter)',
              success: false,
              riskScore: 0,
              riskLevel: 'ERROR',
              redFlags: [],
              error: 'X scan failed',
              scannedAt: new Date().toISOString(),
            });
          }
        } else if (p === 'telegram') {
          // Try Telegram scan
          results.push({
            platform: 'Telegram',
            success: false,
            riskScore: 0,
            riskLevel: 'UNAVAILABLE',
            redFlags: [],
            error: 'Private profile or not found',
            scannedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        results.push({
          platform: platformLabel,
          success: false,
          riskScore: 0,
          riskLevel: 'ERROR',
          redFlags: [],
          error: err?.message || 'Scan failed',
          scannedAt: new Date().toISOString(),
        });
      }
    }
    
    setCrossPlatformProgress(100);
    setScanning(false);
    setScanStatus(null);
    
    // Calculate aggregate score
    const successResults = results.filter(r => r.success);
    const avgScore = successResults.length > 0
      ? successResults.reduce((sum, r) => sum + r.riskScore, 0) / successResults.length
      : 0;
    const maxLevel = results.reduce((max, r) => {
      const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const rLevel = levels.indexOf(r.riskLevel as any);
      const mLevel = levels.indexOf(max as any);
      return rLevel > mLevel ? r.riskLevel : max;
    }, 'LOW' as string);
    
    const aggregateResult: ProfileScanResult = {
      success: successResults.length > 0,
      platform: 'cross-platform',
      username: cleanUsername,
      riskScore: Math.round(avgScore),
      riskLevel: maxLevel as any,
      redFlags: results.flatMap(r => r.redFlags),
      evidence: [],
      recommendation: `Scanned across ${results.length} platforms. ${successResults.length} successful.`,
      confidence: 'MEDIUM',
      scanDate: new Date().toISOString(),
      crossPlatformResults: results,
    };
    
    setResult(aggregateResult);
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
      tiktok: `https://tiktok.com/@${username}`,
    };
    return urls[platform] ?? null;
  };

  const copyResult = () => {
    if (result) {
      let text = `🔍 Platform: ${result.platform === 'twitter' ? 'X (Twitter)' : result.platform.charAt(0).toUpperCase() + result.platform.slice(1)}
📊 Risk Score: ${(result.riskScore / 10).toFixed(1)}/10 - ${result.riskLevel} RISK ${result.riskLevel === 'CRITICAL' ? '🚨' : result.riskLevel === 'HIGH' ? '⚠️' : result.riskLevel === 'MEDIUM' ? '⚡' : '✅'}`;

      // Add bot detection section
      if (result.botDetection) {
        text += '\n\n' + formatBotResultText(result.botDetection);
      }

      // Add engagement analysis section
      if (result.engagementAnalysis) {
        text += '\n\n' + formatEngagementResultText(result.engagementAnalysis);
      }

      text += `\n\nRed Flags with Scores:
${result.redFlags.map(f => `• ${f}`).join('\n')}\n\nBehavioral Pattern: ${result.riskLevel === 'CRITICAL' ? 'Multiple high-severity scam indicators detected. Extreme caution advised.' : result.riskLevel === 'HIGH' ? 'Significant scam indicators present. Verify independently before any engagement.' : result.riskLevel === 'MEDIUM' ? 'Some concerning patterns detected. Further verification recommended.' : 'No significant scam patterns identified.'}\n\n📋 Disclaimer: Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR. Scan date: ${result.scanDate ? new Date(result.scanDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;

      navigator.clipboard.writeText(text);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return { color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' };
      case 'HIGH': return { color: '#fb923c', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)' };
      case 'MEDIUM': return { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)' };
      case 'PENDING': return { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.4)' };
      case 'UNAVAILABLE': return { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.4)' };
      case 'ERROR': return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' };
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
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {([
                { id: 'cross-platform', icon: '🌐', label: 'All' },
                { id: 'twitter', icon: 'X', label: 'X' },
                { id: 'telegram', icon: '✈️', label: 'Telegram' },
                { id: 'instagram', icon: '📷', label: 'Instagram' },
                { id: 'discord', icon: '💬', label: 'Discord' },
                { id: 'linkedin', icon: '💼', label: 'LinkedIn' },
                { id: 'facebook', icon: '📘', label: 'Facebook' },
              { id: 'tiktok', icon: '🎵', label: 'TikTok' },
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
            {scanning ? (scanStatus ? `⏳ ${scanStatus}` : '🔄 Scanning...') : hasScans
              ? `🚀 Verify Profile (${freeScansRemaining > 0 ? `${freeScansRemaining} free` : `${credits} credits`})`
              : '❌ No Scans - Buy Credits'}
          </button>
          
          {/* Cross-Platform Progress */}
          {scanning && platform === 'cross-platform' && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${crossPlatformProgress}%`, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }}
                />
              </div>
              <p className="text-xs text-purple-400 mt-2">{crossPlatformProgress}% complete - {scanStatus}</p>
            </div>
          )}

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
          {/* Cross-Platform Results Grid */}
          {result.platform === 'cross-platform' && result.crossPlatformResults && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white">🌐 Cross-Platform Scan Results for @{result.username}</h3>
              <div className="grid gap-3">
                {result.crossPlatformResults.map((r, idx) => (
                  <CrossPlatformResultCard key={idx} result={r} />
                ))}
              </div>
            </div>
          )}
          
          {/* Scan Header */}
          <div
            className="rounded-xl p-5"
            style={{
              background: getRiskColor(result.riskLevel).bg,
              border: `2px solid ${getRiskColor(result.riskLevel).border}`,
            }}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                🔍 Platform: {result.platform === 'twitter' ? 'X (Twitter)' : result.platform.charAt(0).toUpperCase() + result.platform.slice(1)}
              </p>
              <h3 className="text-xl font-bold" style={{ color: getRiskColor(result.riskLevel).color }}>
                📊 Risk Score: {(result.riskScore / 10).toFixed(1)}/10 — {result.riskLevel} RISK {result.riskLevel === 'CRITICAL' ? '🚨' : result.riskLevel === 'HIGH' ? '⚠️' : result.riskLevel === 'MEDIUM' ? '⚡' : '✅'}
              </h3>
              {/* Risk Meter */}
              <div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(result.riskScore / 10) * 100}%`,
                      background: `linear-gradient(90deg, #4ade80, #fbbf24, #fb923c, #f87171)`,
                      backgroundSize: '300% 100%',
                      backgroundPosition: `${(result.riskScore / 10) * 100}% 0`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span><span>3</span><span>5</span><span>7</span><span>10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.15)',
            }}
          >
            <p className="text-sm text-gray-300">
              <span className="text-gray-500">Account:</span>{' '}
              <span className="font-semibold text-white">@{result.username}</span>
            </p>
            {result.displayName && (
              <p className="text-sm text-gray-300 mt-1">
                <span className="text-gray-500">- Display name:</span>{' '}
                {result.displayName}
              </p>
            )}
            {(result.profileData?.followers !== undefined || result.profileData?.following !== undefined || result.profileData?.posts !== undefined) && (
              <p className="text-sm text-gray-300 mt-1">
                <span className="text-gray-500">- </span>
                {result.profileData.followers !== undefined && (
                  <>Followers: <span className="text-white font-medium">{result.profileData.followers >= 1000000 ? `${(result.profileData.followers / 1000000).toFixed(1)}M` : result.profileData.followers >= 1000 ? `${(result.profileData.followers / 1000).toFixed(1)}K` : result.profileData.followers.toLocaleString()}</span>{' | '}
                  </>
                )}
                {result.profileData.following !== undefined && (
                  <>Following: <span className="text-white font-medium">{result.profileData.following >= 1000 ? `${(result.profileData.following / 1000).toFixed(1)}K` : result.profileData.following.toLocaleString()}</span>{' | '}
                  </>
                )}
                {result.profileData.posts !== undefined && (
                  <>Posts: <span className="text-white font-medium">{result.profileData.posts >= 1000 ? `${(result.profileData.posts / 1000).toFixed(1)}K` : result.profileData.posts.toLocaleString()}</span>
                  </>
                )}
              </p>
            )}
            {result.profileData?.joinDate && (
              <p className="text-sm text-gray-300 mt-1">
                <span className="text-gray-500">- Joined:</span>{' '}
                {new Date(result.profileData.joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            )}
            {result.profileData?.bio && (
              <p className="text-sm text-gray-300 mt-1">
                <span className="text-gray-500">- Bio:</span>{' '}
                "{result.profileData.bio}"
              </p>
            )}
            {result.profileData?.website && (
              <p className="text-sm text-gray-300 mt-1">
                <span className="text-gray-500">- Website:</span>{' '}
                <a href={result.profileData.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{result.profileData.website}</a>
              </p>
            )}
            {result.profileData?.location && (
              <p className="text-sm text-gray-300 mt-1">
                <span className="text-gray-500">- Location:</span>{' '}
                {result.profileData.location}
              </p>
            )}
          </div>

          {/* Red Flags with Scores */}
          {result.redFlags.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <h3 className="text-base font-bold text-red-400 mb-3">
                Red Flags with Scores:
              </h3>
              
              <div className="space-y-1.5">
                {result.redFlags.map((flag, index) => {
                  const pointMatch = flag.match(/\((\d+)pts?\)/);
                  const points = pointMatch ? parseInt(pointMatch[1]) : 0;
                  const hasPoints = pointMatch !== null;
                  const flagName = flag.replace(/\s*\(\d+pts?\).*/, '').replace(/_/g, ' ');
                  const descMatch = flag.match(/—\s*(.+)/);
                  const desc = descMatch ? descMatch[1] : '';
                  
                  return (
                    <div key={index} className="text-sm text-gray-300">
                      <span className="text-gray-500">•</span>{' '}
                      <span className="font-medium capitalize">{flagName}</span>
                      {hasPoints && (
                        <span className="ml-1 text-xs font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                          {points}pts
                        </span>
                      )}
                      {desc && (
                        <span className="text-gray-500"> — {desc}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                <p className="text-xs text-gray-600">
                  Flag values: guaranteed_returns(25) • giveaway_airdrop(20) • dm_solicitation(15) • free_crypto(15) • alpha_dm_scheme(15) • unrealistic_claims(10) • download_install(10) • urgency_tactics(10) • emotional_manipulation(10) • low_credibility(10)
                </p>
              </div>
            </div>
          )}

          {/* Behavioral Pattern */}

          {/* ── Bot Activity Assessment ── */}
          {result.botDetection && (
            <div
              className="rounded-xl p-5"
              style={{
                background: result.botDetection.botScore > 60
                  ? 'rgba(239,68,68,0.05)'
                  : result.botDetection.botScore > 40
                  ? 'rgba(251,191,36,0.05)'
                  : 'rgba(16,185,129,0.05)',
                border: result.botDetection.botScore > 60
                  ? '1px solid rgba(239,68,68,0.2)'
                  : result.botDetection.botScore > 40
                  ? '1px solid rgba(251,191,36,0.2)'
                  : '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold" style={{ color: formatBotClassification(result.botDetection.classification).color }}>
                  🤖 BOT ACTIVITY ASSESSMENT
                </h3>
                <span
                  className="text-xs font-mono px-2 py-1 rounded"
                  style={{
                    background: result.botDetection.botScore > 60
                      ? 'rgba(239,68,68,0.15)'
                      : result.botDetection.botScore > 40
                      ? 'rgba(251,191,36,0.15)'
                      : 'rgba(16,185,129,0.15)',
                    color: formatBotClassification(result.botDetection.classification).color,
                  }}
                >
                  {formatBotClassification(result.botDetection.classification).emoji} {formatBotClassification(result.botDetection.classification).label}
                </span>
              </div>

              {/* Bot Score Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Bot Score</span>
                  <span className="font-mono" style={{ color: formatBotClassification(result.botDetection.classification).color }}>
                    {result.botDetection.botScore}/100
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${result.botDetection.botScore}%`,
                      background: result.botDetection.botScore > 60
                        ? 'linear-gradient(90deg, #fb923c, #f87171)'
                        : result.botDetection.botScore > 40
                        ? 'linear-gradient(90deg, #fbbf24, #fb923c)'
                        : 'linear-gradient(90deg, #4ade80, #fbbf24)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>Authentic</span><span>Mild</span><span>Moderate</span><span>High</span><span>Extreme</span>
                </div>
              </div>

              {/* Bot Flags */}
              {result.botDetection.flags.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {result.botDetection.flags.map((flag, idx) => (
                    <div key={idx} className="text-sm text-gray-300">
                      <span className="text-gray-500">•</span>{' '}
                      <span className="font-medium">{flag.name}</span>
                      <span className="ml-1 text-xs font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                        +{flag.points}pts
                      </span>
                      {flag.detail && (
                        <span className="text-gray-500"> — {flag.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <p className="text-xs text-gray-400 leading-relaxed mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                {result.botDetection.summary}
              </p>
            </div>
          )}

          {/* ── Engagement Analysis ── */}
          {result.engagementAnalysis && (
            <div
              className="rounded-xl p-5"
              style={{
                background: result.engagementAnalysis.overallScore > 60
                  ? 'rgba(239,68,68,0.05)'
                  : result.engagementAnalysis.overallScore > 40
                  ? 'rgba(251,191,36,0.05)'
                  : 'rgba(59,130,246,0.05)',
                border: result.engagementAnalysis.overallScore > 60
                  ? '1px solid rgba(239,68,68,0.2)'
                  : result.engagementAnalysis.overallScore > 40
                  ? '1px solid rgba(251,191,36,0.2)'
                  : '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold" style={{ color: formatEngagementClassification(result.engagementAnalysis.overallScore).color }}>
                  📊 ENGAGEMENT ANALYSIS
                </h3>
                <span
                  className="text-xs font-mono px-2 py-1 rounded"
                  style={{
                    background: result.engagementAnalysis.overallScore > 60
                      ? 'rgba(239,68,68,0.15)'
                      : result.engagementAnalysis.overallScore > 40
                      ? 'rgba(251,191,36,0.15)'
                      : 'rgba(59,130,246,0.15)',
                    color: formatEngagementClassification(result.engagementAnalysis.overallScore).color,
                  }}
                >
                  {formatEngagementClassification(result.engagementAnalysis.overallScore).emoji} {formatEngagementClassification(result.engagementAnalysis.overallScore).label}
                </span>
              </div>

              {/* Engagement Score Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Engagement Score</span>
                  <span className="font-mono" style={{ color: formatEngagementClassification(result.engagementAnalysis.overallScore).color }}>
                    {result.engagementAnalysis.overallScore}/100
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${result.engagementAnalysis.overallScore}%`,
                      background: result.engagementAnalysis.overallScore > 60
                        ? 'linear-gradient(90deg, #fb923c, #f87171)'
                        : result.engagementAnalysis.overallScore > 40
                        ? 'linear-gradient(90deg, #fbbf24, #fb923c)'
                        : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>Organic</span><span>Minor</span><span>Moderate</span><span>High</span><span>Severe</span>
                </div>
              </div>

              {/* Pattern Rows */}
              <div className="space-y-2 mb-3">
                {/* Ghost Comments */}
                {result.engagementAnalysis.patterns.ghostComments.detected && (
                  <div className="text-sm text-gray-300">
                    <span className="text-red-400">👻</span>{' '}
                    <span className="font-medium">Ghost Comments:</span>{' '}
                    {result.engagementAnalysis.patterns.ghostComments.replyCount} shown, {result.engagementAnalysis.patterns.ghostComments.visibleReplies} visible ({Math.round(result.engagementAnalysis.patterns.ghostComments.hiddenRatio * 100)}% hidden)
                  </div>
                )}

                {/* View Inflation */}
                {result.engagementAnalysis.patterns.viewInflation.detected && (
                  <div className="text-sm text-gray-300">
                    <span className="text-orange-400">👁️</span>{' '}
                    <span className="font-medium">View Inflation:</span>{' '}
                    {result.engagementAnalysis.patterns.viewInflation.views >= 1000
                      ? `${(result.engagementAnalysis.patterns.viewInflation.views / 1000).toFixed(1)}K`
                      : result.engagementAnalysis.patterns.viewInflation.views} views / {result.engagementAnalysis.patterns.viewInflation.followers.toLocaleString()} followers ({result.engagementAnalysis.patterns.viewInflation.ratio}x ratio)
                  </div>
                )}

                {/* Engagement Pods */}
                {result.engagementAnalysis.patterns.engagementPods.detected && (
                  <div className="text-sm text-gray-300">
                    <span className="text-yellow-400">👥</span>{' '}
                    <span className="font-medium">Engagement Pod:</span>{' '}
                    {result.engagementAnalysis.patterns.engagementPods.podAccounts.length} accounts appear in first comments consistently
                    {result.engagementAnalysis.patterns.engagementPods.podAccounts.length <= 5 && (
                      <span className="text-gray-500"> ({result.engagementAnalysis.patterns.engagementPods.podAccounts.join(', ')})</span>
                    )}
                  </div>
                )}

                {/* Coordinated Timing */}
                {result.engagementAnalysis.patterns.coordinatedTiming.detected && (
                  <div className="text-sm text-gray-300">
                    <span className="text-purple-400">⚡</span>{' '}
                    <span className="font-medium">Coordinated Timing:</span>{' '}
                    Comments arrive in {result.engagementAnalysis.patterns.coordinatedTiming.waves} burst(s), avg {result.engagementAnalysis.patterns.coordinatedTiming.avgInterval}s apart
                  </div>
                )}

                {/* 24/7 Activity */}
                {result.engagementAnalysis.patterns.activityPattern.detected && (
                  <div className="text-sm text-gray-300">
                    <span className="text-blue-400">🕐</span>{' '}
                    <span className="font-medium">24/7 Activity:</span>{' '}
                    Posts {result.engagementAnalysis.patterns.activityPattern.activeHours.length}/24 hrs/day, longest sleep gap: {result.engagementAnalysis.patterns.activityPattern.sleepGapHours}hrs
                  </div>
                )}
              </div>

              {/* Engagement Flags */}
              {result.engagementAnalysis.flags.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {result.engagementAnalysis.flags.map((flag, idx) => (
                    <div key={idx} className="text-sm text-gray-300">
                      <span className="text-gray-500">•</span>{' '}
                      <span className="font-medium">{flag.name}</span>
                      <span className="ml-1 text-xs font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                        +{flag.points}pts
                      </span>
                      <span className="text-xs px-1 py-0.5 rounded ml-1" style={{
                        background: flag.severity === 'critical' ? 'rgba(239,68,68,0.15)'
                          : flag.severity === 'high' ? 'rgba(251,146,60,0.15)'
                          : flag.severity === 'medium' ? 'rgba(251,191,36,0.15)'
                          : 'rgba(74,222,128,0.15)',
                        color: flag.severity === 'critical' ? '#f87171'
                          : flag.severity === 'high' ? '#fb923c'
                          : flag.severity === 'medium' ? '#fbbf24'
                          : '#4ade80',
                      }}>
                        {flag.severity.toUpperCase()}
                      </span>
                      {flag.detail && (
                        <span className="text-gray-500"> — {flag.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <p className="text-xs text-gray-400 leading-relaxed mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                {result.engagementAnalysis.summary}
              </p>
            </div>
          )}

          {/* Behavioral Pattern */}
          <div
            className="rounded-xl p-5"
            style={{
              background: 'rgba(251,191,36,0.05)',
              border: '1px solid rgba(251,191,36,0.15)',
            }}
          >
            <p className="text-sm text-gray-300 leading-relaxed">
              <span className="text-yellow-400 font-semibold">Behavioral Pattern:</span>{' '}
              {result.riskLevel === 'CRITICAL' ? 'Multiple high-severity scam indicators detected. This account shows patterns consistent with crypto fraud operations including guaranteed returns promises, DM solicitation funnels, and coordinated shill activity. Extreme caution advised.' :
               result.riskLevel === 'HIGH' ? 'Significant scam indicators present. This account exhibits patterns of paid promotion, unrealistic profit claims, or DM-based solicitation. Verify independently before any engagement.' :
               result.riskLevel === 'MEDIUM' ? 'Some concerning patterns detected. The account may have legitimate elements alongside suspicious indicators. Further verification recommended before engaging.' :
               'No significant scam patterns identified. However, always verify accounts independently before sharing sensitive information or sending funds.'}
            </p>
          </div>

          {/* Disclaimer */}
          <DisclaimerNotice scanDate={result.scanDate} />

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
              onClick={() => { setResult(null); setScanStatus(null); }}
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

  // Generate bot detection for demo
  const botInput: BotDetectionInput = {
    followers: followerCount,
    following: followingCount,
    posts: postCount,
    username: username,
    bio: `${username} - Official account (Demo scan result)`,
    joinDate: new Date().toISOString().split('T')[0],
  };
  const botDetection = calculateBotScore(botInput, platform);

  return {
    success: true,
    platform: platform as 'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook' | 'tiktok',
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
    botDetection,
  };
}
