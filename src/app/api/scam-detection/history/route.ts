/**
 * Scam Detection History API Route
 * GET endpoint for retrieving recent scam scans
 */

import { NextRequest, NextResponse } from 'next/server';
import { ScamProfileData } from '@/types/scam-detection';

/**
 * GET /api/scam-detection/history
 * Get recent scam scan history
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const platform = searchParams.get('platform'); // 'x' or 'telegram'

  try {
    // Read scammer database CSV file
    const csvPath = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
    const fs = require('fs').promises;
    const csv = require('csv-parse');

    // Read CSV file
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const records = csv.parse(csvContent, { columns: true });

    // Convert to scan result format
    const history: ScamProfileData[] = records.map((record: any) => {
      const platform = (record['Platform'] || '').toLowerCase().includes('telegram') ? 'telegram' : 'x';
      const identifier = record['X Handle'] || record['Telegram Channel'] || record['Scammer Name'] || '';

      // Extract risk score from Total Lost USD (if present) or calculate from Verification Level
      let riskScore = 0;
      if (record['Total Lost USD'] && record['Total Lost USD'] !== '0') {
        const loss = parseFloat(record['Total Lost USD']);
        riskScore = loss > 0 ? Math.min(loss / 100, 10) : 0;
      }

      // Map verification level
      const verificationLevel = record['Verification Level'] || 'Unverified';

      // Determine risk level
      let riskLevel = 'LOW';
      if (riskScore >= 7) {
        riskLevel = 'HIGH';
      } else if (riskScore >= 5) {
        riskLevel = 'MEDIUM';
      }

      return {
        platform,
        identifier,
        username: identifier.startsWith('@') ? identifier : undefined,
        displayName: record['Scammer Name'] || '',
        bio: record['Notes'] || '',
        followerCount: parseInt(record['Victims Count'] || '0'),
        memberCount: parseInt(record['Victims Count'] || '0'),
        messageCount: 0,
        engagementRate: 0,
        isVerified: verificationLevel === 'Verified' || verificationLevel === 'Highly Verified',
        joinDate: record['Last Updated'] || '',
        website: record['Evidence Links'] || '',
        pinnedPosts: [],
        recentPosts: [],
        links: record['Evidence Links'] ? [record['Evidence Links']] : [],
        riskScore,
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
        verificationStatus: verificationLevel as ScamProfileData['verificationStatus'],
        confidence: record['Victims Count'] && parseInt(record['Victims Count']) > 0 ? 'HIGH' : 'LOW',
        redFlags: [],
        summary: generateSummary(record),
        notes: record['Notes'] || ''
      };
    });

    // Filter by platform if specified
    const filteredHistory = platform
      ? history.filter(h => h.platform === platform)
      : history;

    // Sort by Last Updated (descending)
    const sortedHistory = filteredHistory
      .filter(h => h.joinDate) // Only include items with join date
      .sort((a, b) => {
        const dateA = new Date(a.joinDate);
        const dateB = new Date(b.joinDate);
        return dateB.getTime() - dateA.getTime();
      });

    // Limit results
    const limitedHistory = sortedHistory.slice(0, limit);

    return NextResponse.json({
      history: limitedHistory,
      count: limitedHistory.length,
      total: sortedHistory.length,
      limit,
      platform
    });

  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve scam scan history' },
      { status: 500 }
    );
  }
}

/**
 * Generate summary for history item
 */
function generateSummary(record: any): string {
  const name = record['Scammer Name'] || '';
  const platform = record['Platform'] || '';
  const verification = record['Verification Level'] || 'Unverified';
  const victims = record['Victims Count'] || '0';
  const lost = record['Total Lost USD'] || '0';

  if (verification === 'Legitimate' || verification === 'Verified') {
    return `${name} (${platform}) — Legitimate. Verified track record. Safe for engagement.`;
  } else if (parseInt(lost) > 0) {
    return `${name} (${platform}) — HIGH RISK. ${victims} reported victims, $${lost} lost. Caution advised.`;
  } else {
    return `${name} (${platform}) — ${verification} status. Proceed with caution.`;
  }
}