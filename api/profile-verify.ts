/**
 * Profile Verification API - Vercel Serverless Function
 *
 * Endpoint: POST /api/profile-verify
 * Verifies social media profiles for scam detection
 * 
 * For Twitter/X: Calls local Chrome CDP scanner for real data
 * For other platforms: Pattern-based detection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProfileVerifyRequest {
  platform: 'twitter' | 'telegram' | 'instagram' | 'discord' | 'linkedin' | 'facebook';
  username: string;
  verificationContext?: 'crypto' | 'romance' | 'employment' | 'marketplace' | 'financial' | 'general';
  options?: {
    deepScan?: boolean;
    includeMedia?: boolean;
    sampleFollowers?: boolean;
    forceRefresh?: boolean;
  };
}

interface ProfileVerifyResult {
  success: boolean;
  platform: string;
  username: string;
  displayName?: string;
  verified?: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  verificationLevel: string;
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
    accountAge?: string;
    promotedTokens?: string[];
    recentPosts?: string[];
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  scanDate: string;
  dataSource: 'chrome_cdp' | 'pattern_analysis' | 'fallback';
}

// ─── Supabase Queue-Based Scanner ───────────────────────────────────────────────
// Replaces the old ngrok / LOCAL_SCANNER_URL approach.
// Submits a profile scan job to Supabase; Mac Studio worker picks it up async.

import { createClient } from '@supabase/supabase-js';

const _supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Submit a profile scan job to the Supabase queue and wait for completion.
 * Times out after 30 s and returns null (falls back to pattern analysis).
 */
async function callLocalScanner(platform: string, username: string): Promise<any> {
  try {
    // 1. Enqueue the job
    const { data: job, error: insertErr } = await _supabase
      .from('scan_jobs')
      .insert({
        scan_type: 'profile',
        payload: { username, platform },
        status: 'pending',
        priority: 3, // profile scans get slightly higher priority
      })
      .select('id')
      .single();

    if (insertErr || !job) {
      console.error('[profile-verify] Failed to enqueue scan job:', insertErr?.message);
      return null;
    }

    // 2. Poll for completion (max 30 s, 1 s interval)
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));

      const { data: row } = await _supabase
        .from('scan_jobs')
        .select('status, result')
        .eq('id', job.id)
        .single();

      if (row?.status === 'completed' && row.result) {
        // Normalise to the shape expected by the handler below
        return { success: true, data: row.result };
      }
      if (row?.status === 'failed' || row?.status === 'timeout') {
        console.error('[profile-verify] Scan job failed:', row);
        return null;
      }
    }

    console.warn('[profile-verify] Scan job timed out waiting for result:', job.id);
    return null;
  } catch (error) {
    console.error('[profile-verify] Queue scan error:', error);
    return null;
  }
}

// ─── Scam Pattern Detection ─────────────────────────────────────────────────────

const SCAM_PATTERNS: Record<string, { type: string; riskScore: number; flags: string[] }> = {
  // Crypto scams
  'giveaway': { type: 'Giveaway Scam', riskScore: 90, flags: ['Giveaway scam pattern in username', 'Typical scammer naming convention', 'Likely impersonating legitimate account'] },
  'airdrop': { type: 'Airdrop Scam', riskScore: 88, flags: ['Airdrop scam pattern', 'Wallet drainer likely', 'Do not connect wallet'] },
  'free': { type: 'Free Money Scam', riskScore: 80, flags: ['"Free" in username', 'Too good to be true', 'Classic scam pattern'] },
  'winner': { type: 'Lottery Scam', riskScore: 82, flags: ['Winner/lottery pattern', 'Fake prize offer', 'Advance fee scam likely'] },
  'crypto_': { type: 'Crypto Impersonation', riskScore: 75, flags: ['Crypto-related username pattern', 'Potential rug pull promoter', 'High-risk category'] },
  'defi_': { type: 'DeFi Scam', riskScore: 78, flags: ['DeFi impersonation', 'Likely fake project', 'Do not invest'] },
  'nft_': { type: 'NFT Scam', riskScore: 76, flags: ['NFT impersonation', 'Fake collection', 'Wallet drainer risk'] },
  
  // Impersonation patterns
  'elon': { type: 'Celebrity Impersonation', riskScore: 85, flags: ['Celebrity name in username', 'Likely impersonation attempt', 'Common scam tactic'] },
  'vitalik': { type: 'Celebrity Impersonation', riskScore: 85, flags: ['Vitalik impersonation', 'Ethereum founder fake', 'Never share keys'] },
  'satoshi': { type: 'Celebrity Impersonation', riskScore: 88, flags: ['Satoshi impersonation', 'Bitcoin creator fake', 'Classic scam'] },
  'support': { type: 'Support Scam', riskScore: 78, flags: ['Fake support account', 'Will ask for seed phrase', 'Social engineering'] },
  'admin': { type: 'Impersonation', riskScore: 75, flags: ['Admin impersonation', 'Not an official account', 'Will DM asking for info'] },
  'official': { type: 'Impersonation', riskScore: 72, flags: ['Fake "official" account', 'Not verified', 'Scam indicator'] },
  'help': { type: 'Support Scam', riskScore: 70, flags: ['Help/support pattern', 'Likely asking for credentials', 'Social engineering'] },
  
  // Username patterns indicating scam
  '_give': { type: 'Giveaway Scam', riskScore: 88, flags: ['Giveaway pattern detected', 'Fake giveaway account', 'Do not send funds'] },
  '_airdrop': { type: 'Airdrop Scam', riskScore: 85, flags: ['Airdrop scam pattern', 'Wallet drainer likely', 'Never share seed phrase'] },
  '_official': { type: 'Impersonation', riskScore: 75, flags: ['Fake official account', 'Not affiliated', 'Scam indicator'] },
  '_support': { type: 'Support Scam', riskScore: 80, flags: ['Fake support account', 'Will request private keys', 'Do not engage'] },
  'real': { type: 'Impersonation', riskScore: 65, flags: ['"real" in username often indicates fake', 'Impersonation tactic', 'Verify independently'] },
  
  // Shill/Promoter patterns
  'promoter': { type: 'Shill Account', riskScore: 70, flags: ['Self-described promoter', 'Likely paid shill', 'Multiple token promotions'] },
  'alpha': { type: 'Alpha Bait', riskScore: 65, flags: ['Alpha hunting pattern', 'Likely pump promoter', 'High-risk category'] },
  'gem': { type: 'Gem Hunter', riskScore: 60, flags: ['Gem/promoter pattern', 'Likely token shill', 'Verify independently'] },
  '1000x': { type: 'Unrealistic Returns', riskScore: 85, flags: ['1000x claims', 'Too good to be true', 'Classic pump pattern'] },
  '100x': { type: 'Unrealistic Returns', riskScore: 80, flags: ['100x claims', 'Unrealistic promise', 'Pump and dump likely'] },
  'moonshot': { type: 'Moonshot Scam', riskScore: 75, flags: ['Moonshot terminology', 'Pump pattern', 'Exit liquidity warning'] },
};

// ─── Bio Analysis ───────────────────────────────────────────────────────────────

const BIO_RED_FLAGS = [
  { pattern: /dm me|dm now|dm for|dm to/i, score: 15, flag: 'DM solicitation' },
  { pattern: /1000x|100x|moonshot|gem|alpha/i, score: 10, flag: 'Unrealistic returns claims' },
  { pattern: /project promoter|crypto promoter|shill/i, score: 12, flag: 'Self-described shill account' },
  { pattern: /limited time|act now|hurry|last chance/i, score: 8, flag: 'Urgency tactics' },
  { pattern: /presale|presale live|presale now/i, score: 10, flag: 'Presale promotion (high risk)' },
  { pattern: /guaranteed|guarantee|sure thing/i, score: 15, flag: 'Guaranteed returns (scam)' },
  { pattern: /airdrop|free|giveaway/i, score: 12, flag: 'Giveaway/airdrop pattern' },
  { pattern: /trusted source|your trusted|verified source/i, score: 8, flag: 'False authority claim' },
];

function analyzeBio(bio: string): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];
  
  for (const { pattern, score: add, flag } of BIO_RED_FLAGS) {
    if (pattern.test(bio)) {
      score += add;
      flags.push(flag);
    }
  }
  
  return { score, flags };
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

function detectScamPatterns(username: string, bio?: string): { type: string; riskScore: number; flags: string[] } | null {
  const lowerUsername = username.toLowerCase();
  const lowerBio = (bio || '').toLowerCase();
  
  let bestMatch: { type: string; riskScore: number; flags: string[] } | null = null;
  let maxScore = 0;
  
  for (const [pattern, data] of Object.entries(SCAM_PATTERNS)) {
    if (lowerUsername.includes(pattern)) {
      if (data.riskScore > maxScore) {
        maxScore = data.riskScore;
        bestMatch = data;
      }
    }
  }
  
  // Check for suspicious patterns
  if (lowerUsername.includes('_') && (lowerUsername.includes('give') || lowerUsername.includes('free'))) {
    if (!bestMatch || 85 > maxScore) {
      bestMatch = { type: 'Giveaway Scam', riskScore: 85, flags: ['Suspicious username pattern', 'Giveaway scam indicator', 'Do not engage'] };
    }
  }
  
  if (/\d{4,}$/.test(username) && !/^\d{4,}$/.test(username)) {
    if (!bestMatch || 55 > maxScore) {
      bestMatch = { type: 'Suspected Bot', riskScore: 55, flags: ['Number suffix pattern', 'Possible bot account', 'Verify independently'] };
    }
  }
  
  // Analyze bio if provided
  if (bio) {
    const bioAnalysis = analyzeBio(bio);
    if (bioAnalysis.score > 0) {
      if (bestMatch) {
        bestMatch.riskScore = Math.min(100, bestMatch.riskScore + bioAnalysis.score);
        bestMatch.flags = [...bestMatch.flags, ...bioAnalysis.flags];
      } else if (bioAnalysis.score >= 15) {
        bestMatch = {
          type: 'Suspicious Profile',
          riskScore: bioAnalysis.score,
          flags: bioAnalysis.flags,
        };
      }
    }
  }
  
  return bestMatch;
}

function calculateRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

// ─── Known Scammers Database Check ───────────────────────────────────────────

async function checkKnownScammers(username: string): Promise<{ found: boolean; level?: string; scamType?: string; riskScore?: number; notes?: string }> {
  const handle = username.replace(/^@/, '').toLowerCase();
  
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('[profile-verify] Checking known scammers for:', handle);
    console.log('[profile-verify] Supabase URL:', supabaseUrl ? 'set' : 'not set');
    console.log('[profile-verify] Supabase Key:', supabaseKey ? 'set' : 'not set');
    
    if (!supabaseUrl || !supabaseKey) {
      // Fallback to local JSON
      console.log('[profile-verify] Using local JSON fallback');
      const dbPath = path.join(process.cwd(), 'api', 'scammer-database.json');
      if (fs.existsSync(dbPath)) {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const match = db.find((row: any) => 
          (row['X Handle'] || row.x_handle || '').toLowerCase().replace('@', '') === handle ||
          (row.username || '').toLowerCase() === handle
        );
        if (match) {
          const level = (match['Verification Level'] || match.verification_level || 'UNVERIFIED').toUpperCase();
          console.log('[profile-verify] Found in local JSON:', level);
          return {
            found: true,
            level,
            scamType: match['Scam Type'] || match.scam_type || 'Unknown',
            riskScore: level === 'HIGH RISK' ? 95 : level === 'LEGITIMATE' ? 5 : 50,
            notes: match['Notes'] || match.notes || '',
          };
        }
      }
      return { found: false };
    }
    
    // Check Supabase
    const queryUrl = `${supabaseUrl}/rest/v1/known_scammers?or=(x_handle.ilike.%25${handle}%25,username.ilike.%25${handle}%25)&limit=1`;
    console.log('[profile-verify] Querying:', queryUrl);
    
    const res = await fetch(queryUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    
    if (!res.ok) {
      console.log('[profile-verify] Supabase error:', res.status, res.statusText);
      return { found: false };
    }
    
    const data = await res.json();
    console.log('[profile-verify] Supabase returned:', data.length, 'records');
    
    if (data && data.length > 0) {
      const row = data[0];
      const level = (row.verification_level || 'UNVERIFIED').toUpperCase();
      console.log('[profile-verify] Found:', row.username, level);
      return {
        found: true,
        level,
        scamType: row.scam_type || 'Unknown',
        riskScore: row.risk_score || (level === 'HIGH RISK' ? 95 : level === 'LEGITIMATE' ? 5 : 50),
        notes: row.notes || '',
      };
    }
    
    return { found: false };
  } catch (error) {
    console.error('[profile-verify] Error checking known scammers:', error);
    return { found: false };
  }
}

function determineVerificationLevel(score: number, verified: boolean, accountAge?: number): string {
  if (score >= 80) return 'HIGH RISK';
  if (score >= 60) return 'Unverified';
  if (score >= 40) return 'Partially Verified';
  if (verified) return 'Verified';
  if (accountAge && accountAge > 365) return 'Legitimate';
  return 'Unverified';
}

function generateRecommendation(riskLevel: string, platform: string): string {
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  
  switch (riskLevel) {
    case 'CRITICAL':
      return `🚨 AVOID THIS ACCOUNT. High probability of scam activity detected. Do not send funds, share personal information, or click any links. Report this account to ${platformName}.`;
    case 'HIGH':
      return `⚠️ Exercise extreme caution. Multiple scam indicators detected. Verify through official channels before engaging. Never share wallet seed phrases or send funds.`;
    case 'MEDIUM':
      return `⚡ Proceed with caution. Some suspicious indicators found. Verify the account through official channels before engaging in any transactions.`;
    default:
      return `✅ No major scam indicators detected. However, always verify accounts independently before sharing sensitive information or sending funds.`;
  }
}

function formatAccountAge(days: number): string {
  if (days < 1) return 'less than 1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  const years = Math.floor(days / 365);
  return `${years}+ years`;
}

// ─── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { platform, username, verificationContext, options } = req.body as ProfileVerifyRequest;

    // Validate platform
    const SUPPORTED_PLATFORMS = ['twitter', 'telegram', 'instagram', 'discord', 'linkedin', 'facebook'];
    if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLATFORM',
          message: `Platform must be one of: ${SUPPORTED_PLATFORMS.join(', ')}`,
          supported: SUPPORTED_PLATFORMS,
        },
      });
    }

    // Validate username
    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USERNAME',
          message: 'Username is required',
        },
      });
    }

    // Clean username
    const cleanUsername = username.replace(/^@/, '').trim();

    if (cleanUsername.length < 1 || cleanUsername.length > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USERNAME',
          message: 'Username must be between 1 and 100 characters',
        },
      });
    }

    let result: ProfileVerifyResult;
    
    // Try to call local Chrome CDP scanner for Twitter
    if (platform === 'twitter') {
      const scannerResult = await callLocalScanner(platform, cleanUsername);
      
      if (scannerResult && scannerResult.success) {
        // Use real Chrome CDP scan data
        const data = scannerResult.data;
        const accountAgeDays = data.accountAgeDays || (data.account_age_years ? data.account_age_years * 365 : null);
        
        // Calculate risk from real data
        let riskScore = 2.0;
        let verificationLevel: string | undefined;
        let scamType: string | undefined;
        const redFlags: string[] = [...(data.red_flags || [])];
        
        // Add risk points for each red flag
        for (const flag of redFlags) {
          if (flag.includes('DM') || flag.includes('solicitation')) riskScore += 2.0;
          else if (flag.includes('Unrealistic') || flag.includes('1000x')) riskScore += 2.5;
          else if (flag.includes('shill') || flag.includes('promoter')) riskScore += 2.0;
          else if (flag.includes('presale')) riskScore += 2.0;
          else if (flag.includes('Telegram')) riskScore += 1.5;
          else if (flag.includes('alpha') || flag.includes('gem')) riskScore += 1.0;
          else if (flag.includes('follower ratio')) riskScore += 0.5;
          else if (flag.includes('Not verified')) riskScore += 0.3;
          else riskScore += 0.5;
        }
        
        // Check known scammers database
        const knownScammer = await checkKnownScammers(cleanUsername);
        if (knownScammer.found) {
          // Override risk score for known scammers
          if (knownScammer.level === 'HIGH RISK') {
            riskScore = Math.max(riskScore, 8.0); // At least 8/10 for known scammers
            redFlags.unshift('KNOWN SCAMMER - In database as HIGH RISK');
            verificationLevel = 'HIGH RISK';
          } else if (knownScammer.level === 'LEGITIMATE') {
            riskScore = Math.min(riskScore, 2.0); // Max 2/10 for legitimate accounts
            redFlags.unshift('Known legitimate account');
            verificationLevel = 'LEGITIMATE';
          } else if (knownScammer.level === 'PAID PROMOTER') {
            riskScore = Math.max(riskScore, 3.0);
            redFlags.unshift('Known paid promoter - verify promoted projects independently');
            verificationLevel = 'PAID PROMOTER';
          } else if (knownScammer.level === 'VERIFIED') {
            // Verified scammer in database
            riskScore = Math.max(riskScore, 9.0);
            redFlags.unshift('VERIFIED SCAMMER - Multiple victim reports');
            verificationLevel = 'VERIFIED';
          }
          
          if (knownScammer.scamType) {
            scamType = knownScammer.scamType;
          }
        }
        
        // Cap at 10
        riskScore = Math.min(riskScore, 10.0);
        
        // Convert to 0-100 scale for API
        const apiRiskScore = Math.round(riskScore * 10);
        const riskLevel = calculateRiskLevel(apiRiskScore);
        
        result = {
          success: true,
          platform,
          username: cleanUsername,
          displayName: data.display_name || data.name || cleanUsername,
          verified: data.verified || false,
          riskScore: apiRiskScore,
          riskLevel,
          verificationLevel: verificationLevel || data.verification_level || determineVerificationLevel(apiRiskScore, data.verified || false, accountAgeDays || undefined),
          scamType: scamType || data.scam_type,
          redFlags,
          evidence: data.evidence || ['Chrome CDP scan completed', 'Real profile data analyzed'],
          recommendation: generateRecommendation(riskLevel, platform),
          profileData: {
            followers: data.followers,
            following: data.following,
            posts: data.posts_count || data.posts,
            bio: data.bio,
            location: data.location,
            website: data.website,
            joinDate: data.join_date,
            accountAge: accountAgeDays ? formatAccountAge(accountAgeDays) : undefined,
            promotedTokens: data.promoted_tokens,
            recentPosts: data.recent_posts,
          },
          confidence: 'HIGH',
          scanDate: new Date().toISOString(),
          dataSource: 'chrome_cdp',
        };
        
        return res.status(200).json(result);
      }
    }
    
    // Fallback: Pattern-based detection (for non-Twitter or when local scanner unavailable)
    const scamDetection = detectScamPatterns(cleanUsername);
    
    // Calculate risk score
    let riskScore = scamDetection ? scamDetection.riskScore : 25;
    
    // Adjust for context
    const context = verificationContext || 'general';
    if (context === 'crypto' && scamDetection) {
      riskScore = Math.min(100, riskScore + 10); // Boost risk for crypto context
    }
    
    const riskLevel = calculateRiskLevel(riskScore);
    
    result = {
      success: true,
      platform,
      username: cleanUsername,
      displayName: `${cleanUsername}'s Profile`,
      verified: false,
      riskScore,
      riskLevel,
      verificationLevel: scamDetection ? 'Unverified' : 'Unknown',
      scamType: scamDetection?.type,
      redFlags: scamDetection?.flags || ['Pattern analysis only - limited data available'],
      evidence: riskScore >= 50 
        ? ['Username pattern indicates potential scam', 'Recommend manual verification', 'Use Chrome CDP scan for full analysis']
        : ['No strong scam indicators from username pattern', 'Recommend Chrome CDP scan for complete profile data'],
      recommendation: generateRecommendation(riskLevel, platform),
      profileData: undefined, // No real data in fallback mode
      confidence: riskScore >= 50 ? 'MEDIUM' : 'LOW',
      scanDate: new Date().toISOString(),
      dataSource: 'pattern_analysis',
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Profile verification error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_ERROR',
        message: 'An unexpected error occurred during verification',
      },
    });
  }
}