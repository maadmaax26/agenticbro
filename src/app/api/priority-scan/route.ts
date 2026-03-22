/**
 * Priority Scan API Route
 * API endpoint for X profile scanning via browser automation
 * Provides real-time scam detection for Agentic Bro users
 */

import { NextRequest, NextResponse } from 'next/server';
import { Browser } from '@openclaw/browser';
import { XProfileScraper, XProfileData } from '../../services/XProfileScraper';
import { PriorityScanService, PriorityScanRequest, PriorityScanResponse, PriorityScanData } from '../../services/priority-scan';
import { Browser as BrowserType } from 'openclaw/browser';

// Initialize browser singleton
let browser: Browser | null = null;

/**
 * Initialize browser (lazy initialization)
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = new Browser();
  }
  return browser;
}

/**
 * GET /api/priority-scan
 * Documentation endpoint
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Priority Scan API',
    version: '1.0.0',
    endpoint: '/api/priority-scan',
    method: 'POST',
    authentication: 'token-gated (Holder/Whale tiers)',
    description: 'Scan X/Twitter profiles for scam detection',
    parameters: {
      username: {
        type: 'string',
        required: true,
        pattern: '^@[a-zA-Z0-9_]{1,15}$'
      },
      scanType: {
        type: 'string',
        required: false,
        enum: ['quick', 'full'],
        default: 'quick'
      }
    },
    examples: [
      {
        username: '@crypto_genius09',
        scanType: 'full'
      }
    ]
  });
}

/**
 * POST /api/priority-scan
 * Trigger a scan on an X profile
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { username, scanType = 'quick' } = await req.json();

  // Validate username
  const usernamePattern = /^@[a-zA-Z0-9_]{1,15}$/;
  if (!usernamePattern.test(username)) {
    return NextResponse.json(
      { error: 'Invalid username format. Must be like @username' },
      { status: 400 }
    );
  }

  try {
    // Initialize browser
    const browser = await getBrowser();

    // Create scan service
    const scanService = new PriorityScanService();

    // Perform scan
    const result = await scanService.scan({ username, scanType });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Priority scan API error:', error);
    return NextResponse.json(
      { error: 'Failed to perform priority scan' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/priority-scan/history
 * Get recent priority scans
 */
export async function GET_HISTORY(req: {
  const { username } = req.query;
  const limit = parseInt(req.query.limit?.toString() || '10');

  // Get database file
  const csvPath = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
  const fs = require('fs').promises;
  const csv = require('csv-parse');

  try {
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const records = csv.parse(csvContent);

    // Filter by username if provided
    let filteredRecords = records.filter((record: any) => {
      // Find the username field (could be "X Handle" or "Scammer Name")
      return Object.entries(record).some(([key, value]) => {
        const valueStr = String(value);
        return valueStr.toLowerCase() === username.toLowerCase();
      });
    });

    // Sort by Last Updated (descending)
    filteredRecords.sort((a, b) => {
      const dateA = new Date(a['Last Updated']);
      const dateB = new Date(b['Last Updated']);
      return dateB.getTime() - dateA.getTime();
    });

    // Limit results
    const limitedRecords = filteredRecords.slice(0, limit);

    return NextResponse.json({
      username,
      history: limitedRecords.map((record: any) => {
        const record = record as any;
        return {
          id: record['Scammer Name'],
          platform: record['Platform'],
          xHandle: record['X Handle'] || '',
          telegramChannel: record['Telegram Channel'] || '',
          riskScore: record['Total Lost USD'] ? parseFloat(record['Total Lost USD']) || null : null,
          verification: record['Verification Level'] || 'Unknown',
          victims: parseInt(record['Victims Count']) || 0,
          lastUpdated: record['Last Updated'] || '',
          notes: record['Notes'] || ''
        };
      }),
      count: limitedRecords.length,
      total: filteredRecords.length,
      limit,
      scanHistoryUrl: `/Users/efinney/.openclaw/workspace/scammer-database.csv`
    });

  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve history' }, { status: 500 });
  }
}

/**
 * GET /api/priority-scan/database
 * Get full scammer database
 */
export async function GET_DATABASE(req) {
  try {
    const csvPath = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
    const fs = require('fs').promises;
    const csv = require('csv-parse');

    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const records = csv.parse(csvContent);

    // Group by verification level
    const database = {
      unverified: records.filter(r => r['Verification Level'] === 'Unverified'),
      partiallyVerified: records.filter(r => r['Verification Level'] === 'Partially Verified'),
      verified: records.filter(r => r['Verification Level'] === 'Verified' || r['Verification Level'] === 'Highly Verified'),
      legitimate: records.filter(r => r['Verification Level'] === 'Legitimate')
    };

    const summary = {
      total: records.length,
      unverified: database.unverified.length,
      partiallyVerified: database.partiallyVerified.length,
      verified: database.verified.length,
      legitimate: database.legitimate.length,
      highRisk: records.filter(r =>
        ['Verified', 'High Risk', 'Partially Verified'].includes(r['Verification Level'])
      ).length,
      recentlyUpdated: records.filter(r => r['Last Updated']).slice(0, 5)
    };

    return NextResponse.json({
      database,
      summary,
      databaseUrl: '/Users/efinney/.openclaw/workspace/scammer-database.csv'
    });

  } catch (error) {
    console.error('Database API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve database' }, { status: 500 });
  }
}

/**
 * GET /api/priority-scan/stats
 * Get statistics on priority scans
 */
export async function GET_STATS(req) {
  try {
    const csvPath = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
    const fs = require('fs').promises;
    const csv = require('csv-parse');

    const csvContent = await fs.readFile(csvPath, 'csvPath', 'utf-8');
    const records = csv.parse(csvContent);

    const stats = {
      totalScans: records.length,
      unverified: 0,
      partiallyVerified: 0,
      verified: 0,
      legitimate: 0,
      highRisk: 0,
      recentlyUpdated: 0,
      victimsTotal: 0
    };

    // Calculate stats
    for (const record of records) {
      const verification = record['Verification Level'] || 'Unknown';

      switch (verification) {
        case 'Unverified':
          stats.unverified++;
          break;
        case 'Partially Verified':
          stats.partiallyVerified++;
          break;
        case 'Verified':
        case 'Highly Verified':
        case 'Verified':
          stats.verified++;
          const victims = parseInt(record['Victims Count'] || '0');
          stats.victimsTotal += victims;
          break;
        case 'Legitimate':
          stats.legitimate++;
          break;
        case 'High Risk':
          stats.highRisk++;
          break;
      }

      const lastUpdated = record['Last Updated'];
      if (lastUpdated) {
        const date = new Date(lastUpdated);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        if (diffHours < 168) { // 7 days
          stats.recentlyUpdated++;
        }
      }
    }

    return NextResponse.json({
      stats,
      databaseUrl: '/Users/efinney/.openclaw/workspace/scammer-database.csv'
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Failed to retrieve stats' }, { status: 500 });
  }
}

// Type aliases
type PriorityScanData = PriorityScanData;
type PriorityScanResponse = PriorityScanResponse;