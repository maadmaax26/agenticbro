/**
 * Scam Detection Types
 * Type definitions for scam detection system
 */

import type { Page } from '@openclaw/page';

/**
 * Red flag indicator
 */
export interface RedFlag {
  type: string;
  weight: number;
  evidence: string;
}

/**
 * Pinned post/tweet
 */
export interface PinnedPost {
  id: string;
  text: string;
  url: string;
}

/**
 * Recent post/tweet
 */
export interface RecentPost {
  id: string;
  text: string;
  url: string;
}

/**
 * Scam profile data (unified for X and Telegram)
 */
export interface ScamProfileData {
  platform: 'x' | 'telegram';
  identifier: string;
  username?: string;
  displayName?: string;
  bio?: string;
  followerCount?: number;
  memberCount?: number;
  isVerified?: boolean;
  joinDate?: string;
  messageCount?: number;
  engagementRate?: number;
  location?: string;
  website?: string;
  pinnedPosts?: PinnedPost[];
  recentPosts?: RecentPost[];
  links?: string[];
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  verificationStatus: 'Unverified' | 'Partially Verified' | 'Verified' | 'Highly Verified' | 'Legitimate';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  redFlags: RedFlag[];
  summary: string;
  notes?: string;
}

/**
 * Scam scan request
 */
export interface ScamScanRequest {
  platform: 'x' | 'telegram';
  identifier: string;
  scanType?: 'quick' | 'full';
}

/**
 * Scam scan response
 */
export interface ScamScanResponse {
  status: 'success' | 'error';
  platform: 'x' | 'telegram';
  identifier: string;
  scanType: 'quick' | 'full';
  data?: ScamProfileData;
  error?: string;
  scannedAt?: string;
}