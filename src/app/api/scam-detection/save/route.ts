/**
 * Scam Detection Save API Route
 * POST endpoint for saving scam scans to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { ScamProfileData } from '@/types/scam-detection';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/scam-detection/save
 * Save scan result to scammer database CSV file
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const scanData = await req.json();

    // Validate scan data
    if (!scanData.platform || !scanData.identifier) {
      return NextResponse.json(
        { error: 'Invalid scan data. Platform and identifier required.' },
        { status: 400 }
      );
    }

    // Read existing CSV file
    const csvPath = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
    const fs = require('fs').promises;
    const csv = require('csv-parse');
    const csvStringify = require('csv-stringify');

    // Read CSV file
    let csvContent = '';
    try {
      csvContent = await fs.readFile(csvPath, 'utf-8');
    } catch (error) {
      // File doesn't exist yet, create with headers
      const headers = [
        'Scammer Name',
        'Platform',
        'X Handle',
        'Telegram Channel',
        'Victims Count',
        'Total Lost USD',
        'Verification Level',
        'Scam Type',
        'Last Updated',
        'Notes',
        'Wallet Address',
        'Evidence Links'
      ];
      csvContent = headers.join(',') + '\n';
    }

    // Parse existing records
    const records = csv.parse(csvContent, { columns: true });

    // Check if entry already exists
    const existingIndex = records.findIndex((record: any) => {
      const existingIdentifier = record['X Handle'] || record['Telegram Channel'];
      return existingIdentifier === scanData.identifier;
    });

    // Create new record
    const newRecord = {
      'Scammer Name': scanData.displayName || scanData.identifier,
      'Platform': scanData.platform === 'x' ? 'X' : 'Telegram',
      'X Handle': scanData.platform === 'x' ? scanData.identifier : '',
      'Telegram Channel': scanData.platform === 'telegram' ? scanData.identifier : '',
      'Victims Count': '0',
      'Total Lost USD': '0',
      'Verification Level': scanData.verificationStatus,
      'Scam Type': 'Unknown',
      'Last Updated': new Date().toISOString(),
      'Notes': scanData.notes || scanData.summary,
      'Wallet Address': '-',
      'Evidence Links': scanData.links && scanData.links.length > 0 ? scanData.links.join(', ') : '-'
    };

    // Update existing record or append new one
    if (existingIndex !== -1) {
      records[existingIndex] = {
        ...records[existingIndex],
        ...newRecord,
        'Last Updated': new Date().toISOString() // Always update timestamp
      };
    } else {
      records.push(newRecord);
    }

    // Convert back to CSV
    csvStringify(records, { header: true }, (err, output) => {
      if (err) {
        console.error('Error converting to CSV:', err);
        throw err;
      }
      fs.writeFile(csvPath, output, 'utf-8');
    });

    // Add to memory
    await addToMemory(scanData);

    return NextResponse.json({
      status: 'success',
      message: 'Scan saved to database',
      data: scanData
    });

  } catch (error) {
    console.error('Save API error:', error);
    return NextResponse.json(
      { error: 'Failed to save scan to database' },
      { status: 500 }
    );
  }
}

/**
 * Add scan to memory for long-term storage
 */
async function addToMemory(scanData: ScamProfileData): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const memoryPath = `/Users/efinney/.openclaw/workspace/memory/${today}.md`;
    const fs = require('fs').promises;

    // Read existing memory file
    let memoryContent = '';
    try {
      memoryContent = await fs.readFile(memoryPath, 'utf-8');
    } catch (error) {
      // File doesn't exist yet
      memoryContent = `# ${today} - Daily Memory\n\n`;
    }

    // Add scan to memory
    const timestamp = new Date().toISOString();
    const scanSummary = `
## Scam Detection Scan - ${timestamp}

**Platform:** ${scanData.platform === 'x' ? 'X' : 'Telegram'}
**Identifier:** ${scanData.identifier}
**Risk Score:** ${scanData.riskScore.toFixed(1)}/10
**Risk Level:** ${scanData.riskLevel}
**Verification Status:** ${scanData.verificationStatus}
**Confidence:** ${scanData.confidence}

**Summary:** ${scanData.summary}

**Red Flags:** ${scanData.redFlags.length > 0 ? scanData.redFlags.map(f => f.type).join(', ') : 'None'}

**Notes:** ${scanData.notes || 'None'}

---

`;

    // Append to memory file
    await fs.appendFile(memoryPath, scanSummary, 'utf-8');

  } catch (error) {
    console.error('Error adding scan to memory:', error);
    // Don't throw error here, just log it
  }
}

/**
 * GET /api/scam-detection/save
 * Documentation endpoint
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Scam Detection Save API',
    version: '1.0.0',
    endpoint: '/api/scam-detection/save',
    method: 'POST',
    description: 'Save scam scan results to database and memory',
    parameters: {
      platform: {
        type: 'string',
        required: true,
        enum: ['x', 'telegram']
      },
      identifier: {
        type: 'string',
        required: true
      },
      riskScore: {
        type: 'number',
        required: true
      },
      riskLevel: {
        type: 'string',
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
      },
      verificationStatus: {
        type: 'string',
        required: true
      },
      confidence: {
        type: 'string',
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH']
      },
      summary: {
        type: 'string',
        required: true
      },
      redFlags: {
        type: 'array',
        required: false,
        items: {
          type: 'object',
          properties: {
            type: 'string',
            weight: 'number',
            evidence: 'string'
          }
        }
      }
    }
  });
}