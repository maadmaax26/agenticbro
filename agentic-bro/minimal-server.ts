/**
 * Minimal API Server - For ngrok tunnel
 * 
 * Provides Chrome CDP profile scanning endpoint
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0-minimal',
  });
});

// API info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Agentic Bro API (Minimal)',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      'GET /health': 'Health check',
      'POST /api/v1/scan/profile': 'Scan a social media profile via Chrome CDP',
    },
  });
});

/**
 * POST /api/v1/scan/profile
 * 
 * Scan a profile using Chrome CDP
 */
app.post('/api/v1/scan/profile', async (req, res) => {
  try {
    const { platform, username, handle } = req.body;
    
    // Normalize handle
    const normalizedHandle = username || handle || '';
    
    if (!normalizedHandle) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HANDLE',
          message: 'username or handle is required',
        },
      });
    }
    
    if (platform && platform !== 'twitter') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_PLATFORM',
          message: 'Only twitter platform is supported currently',
        },
      });
    }
    
    console.log(`[Profile Scan] Scanning @${normalizedHandle}...`);
    
    // Call Chrome CDP
    const result = await scanWithChromeCDP(normalizedHandle);
    
    res.json(result);
    
  } catch (error) {
    console.error('[Profile Scan] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCAN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Scan profile using Chrome CDP
 */
async function scanWithChromeCDP(handle: string): Promise<any> {
  const CDP_URL = 'http://localhost:18800';
  
  try {
    // Get list of tabs
    const tabsResponse = await fetch(`${CDP_URL}/json/list`);
    const tabs = await tabsResponse.json();
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No Chrome tabs available');
    }
    
    // Get WebSocket URL for first tab
    const wsUrl = tabs[0].webSocketDebuggerUrl;
    
    // Navigate to profile
    const navigateUrl = `${CDP_URL}/json/navigate?tabId=${tabs[0].id}&url=https://x.com/${handle}`;
    await fetch(navigateUrl);
    
    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get page content via WebSocket
    const WebSocket = require('ws');
    const ws = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      let rootId: string | null = null;
      
      ws.on('error', (err: Error) => {
        reject(err);
      });
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'DOM.enable' }));
      });
      
      ws.on('message', (data: Buffer) => {
        const response = JSON.parse(data.toString());
        
        if (response.id === 1) {
          ws.send(JSON.stringify({ id: 2, method: 'DOM.getDocument' }));
        } else if (response.id === 2 && response.result) {
          rootId = response.result.root.nodeId;
          ws.send(JSON.stringify({ id: 3, method: 'DOM.getOuterHTML', params: { nodeId: rootId } }));
        } else if (response.id === 3 && response.result) {
          const html = response.result.outerHTML;
          ws.close();
          
          // Parse HTML for profile data
          const profile = parseProfileData(html, handle);
          resolve(profile);
        }
      });
    });
    
  } catch (error) {
    console.error('[Chrome CDP] Error:', error);
    
    // Return pattern-based fallback
    return {
      success: true,
      platform: 'twitter',
      username: handle,
      displayName: handle,
      riskScore: 25,
      riskLevel: 'LOW',
      verificationLevel: 'Unknown',
      redFlags: ['Chrome CDP unavailable - pattern analysis only'],
      evidence: ['Unable to access Chrome CDP for full scan'],
      recommendation: '⚠️ Limited scan. Chrome CDP required for full profile data.',
      confidence: 'LOW',
      scanDate: new Date().toISOString(),
      dataSource: 'pattern_analysis',
    };
  }
}

/**
 * Parse profile data from HTML
 */
function parseProfileData(html: string, handle: string): any {
  const redFlags: string[] = [];
  let riskScore = 0;
  
  // Extract profile data using regex
  const screenNames = html.match(/"screen_name":"([^"]+)"/g)?.map(m => m.match(/"screen_name":"([^"]+)"/)?.[1]) || [];
  const descriptions = html.match(/"description":"([^"]*)"/g)?.map(m => m.match(/"description":"([^"]*)"/)?.[1]) || [];
  const followers = html.match(/"followers_count":(\d+)/)?.[1];
  const following = html.match(/"friends_count":(\d+)/)?.[1];
  const statuses = html.match(/"statuses_count":(\d+)/)?.[1];
  const created = html.match(/"created_at":"([^"]+)"/)?.[1];
  const verified = html.match(/"verified":(true|false)/)?.[1];
  
  const username = screenNames[0] || handle;
  const displayName = html.match(/"name":"([^"]+)"/)?.[1] || handle;
  const bio = descriptions[0]?.replace(/\\n/g, ' ') || '';
  
  // Check for suspended
  if (html.toLowerCase().includes('suspended')) {
    return {
      success: true,
      platform: 'twitter',
      username,
      displayName,
      status: 'SUSPENDED',
      riskScore: 100,
      riskLevel: 'CRITICAL',
      verificationLevel: 'SUSPENDED',
      redFlags: ['Account has been suspended by X'],
      evidence: ['Account suspension detected during scan'],
      recommendation: '🚨 Account suspended. Do not engage.',
      confidence: 'HIGH',
      scanDate: new Date().toISOString(),
      dataSource: 'chrome_cdp',
    };
  }
  
  // Analyze bio for red flags
  const bioLower = bio.toLowerCase();
  
  if (bioLower.includes('dm') || bioLower.includes('pm')) {
    redFlags.push('DM solicitation in bio (+15)');
    riskScore += 15;
  }
  
  if (bioLower.includes('giveaway') || bioLower.includes('free') || bioLower.includes('airdrop')) {
    redFlags.push('Giveaway/airdrop mentioned (+20)');
    riskScore += 20;
  }
  
  if (bioLower.includes('crypto') || bioLower.includes('trading') || bioLower.includes('nft')) {
    redFlags.push('Crypto/trading focus (+5)');
    riskScore += 5;
  }
  
  // Check account age
  if (created) {
    if (created.includes('2024') || created.includes('2025') || created.includes('2026')) {
      redFlags.push('New account (< 2 years) (+15)');
      riskScore += 15;
    }
  }
  
  // Calculate final risk score
  const finalScore = Math.min(riskScore / 90 * 10, 10);
  let riskLevel = 'LOW';
  if (finalScore >= 3 && finalScore < 5) riskLevel = 'MEDIUM';
  else if (finalScore >= 5 && finalScore < 7) riskLevel = 'HIGH';
  else if (finalScore >= 7) riskLevel = 'CRITICAL';
  
  return {
    success: true,
    platform: 'twitter',
    username,
    displayName,
    bio: bio.substring(0, 300),
    followers: followers ? parseInt(followers) : null,
    following: following ? parseInt(following) : null,
    tweets: statuses ? parseInt(statuses) : null,
    accountCreated: created || null,
    verified: verified === 'true',
    riskScore: Math.round(finalScore * 10) / 10,
    riskLevel,
    verificationLevel: finalScore < 3 ? 'LOW_RISK' : finalScore < 5 ? 'MEDIUM_RISK' : finalScore < 7 ? 'HIGH_RISK' : 'CRITICAL',
    redFlags,
    evidence: redFlags.length === 0 ? ['No major red flags detected'] : redFlags,
    recommendation: finalScore < 3 
      ? '✅ No major scam indicators detected.' 
      : finalScore < 5 
        ? '⚠️ Some red flags detected. Proceed with caution.' 
        : '🚨 Multiple red flags detected. High risk account.',
    confidence: 'HIGH',
    scanDate: new Date().toISOString(),
    dataSource: 'chrome_cdp',
  };
}

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║                                            ║');
  console.log('║   🛡️  Agentic Bro API (Minimal)           ║');
  console.log('║                                            ║');
  console.log('║   Port: ' + PORT + '                              ║');
  console.log('║   Chrome CDP: localhost:18800               ║');
  console.log('║                                            ║');
  console.log('║   Endpoints:                               ║');
  console.log('║   • GET  /health                           ║');
  console.log('║   • POST /api/v1/scan/profile              ║');
  console.log('║                                            ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});