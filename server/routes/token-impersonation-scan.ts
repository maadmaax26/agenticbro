/**
 * Token Impersonation Scanner API
 *
 * Routes:
 *   POST /api/token-impersonation-scan → Scan for tokens impersonating a legitimate token
 *
 * Data Sources:
 *   - Token Impersonation Scanner (Python script)
 *   - DexScreener API (via Python script)
 *
 * Usage:
 *   POST /api/token-impersonation-scan
 *   Body: { contractAddress: string }
 */

import express, { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const router = express.Router();

// ─── ES Module __dirname workaround ─────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TokenImpersonationRequest {
  contractAddress: string;
}

interface ImpersonatorToken {
  symbol: string;
  name: string;
  address: string;
  price: string;
  liquidity: number;
  volume: number;
  chain: string;
  dex: string;
  url: string;
  risk_score: number;
  risk_factors: string[];
}

interface ScanResults {
  exact_symbol_fakes: ImpersonatorToken[];
  high_risk: ImpersonatorToken[];
  medium_risk: ImpersonatorToken[];
  low_risk: ImpersonatorToken[];
  unrelated: ImpersonatorToken[];
}

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  price: string;
  volume: number;
  liquidity: number;
  chain: string;
  dex: string;
  url: string;
  pairAddress: string;
  websites: { url: string; label: string }[];
  socials: { type: string; url: string }[];
}

interface TokenImpersonationResult {
  success: boolean;
  legitimateToken: TokenInfo;
  impersonators: ScanResults;
  summary: {
    totalAnalyzed: number;
    exactSymbolFakes: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    unrelated: number;
    suspicious: number;
  };
  alert: string;
  scanDate: string;
  error?: string;
}

// ─── Scanner Script Path ───────────────────────────────────────────────────────

const SCANNER_SCRIPT = path.join(__dirname, '../../scripts/token_impersonation_scanner.py');

// ─── Helper Functions ─────────────────────────────────────────────────────────────

function generateAlert(legitimateToken: TokenInfo, impersonators: ScanResults): string {
  const totalSuspicious = impersonators.high_risk.length + impersonators.medium_risk.length + impersonators.low_risk.length;
  const totalAnalyzed = Object.values(impersonators).reduce((sum, arr) => sum + arr.length, 0) + 1;

  let alert = `🚨 ${legitimateToken.symbol.toUpperCase()} SCAM ALERT 🚨\n\n`;
  alert += `Just completed full scan of ${totalAnalyzed} tokens - here's what I found:\n\n`;
  alert += `✅ LEGITIMATE ${legitimateToken.symbol.toUpperCase()}: Verified Safe\n`;
  alert += `Contract: ${legitimateToken.address}\n`;
  alert += `Price: $${legitimateToken.price} | Volume: $${legitimateToken.volume.toLocaleString()} | `;
  alert += `Site: ${legitimateToken.websites[0]?.url || 'N/A'}\n\n`;
  alert += `⚠️ ${totalSuspicious} SUSPICIOUS TOKENS IDENTIFIED\n\n`;

  if (impersonators.high_risk.length > 0) {
    alert += `🚨 HIGH RISK - AVOID:\n`;
    impersonators.high_risk.slice(0, 5).forEach((imp, i) => {
      const factors = imp.risk_factors.slice(0, 2).join(' | ');
      alert += `• ${imp.symbol} (${imp.name}) - ${factors}\n`;
      alert += `  Contract: ${imp.address}\n`;
      if (i < Math.min(impersonators.high_risk.length - 1, 4)) alert += '\n';
    });
  }

  if (impersonators.medium_risk.length > 0 && impersonators.high_risk.length < 5) {
    alert += `\n⚠️ MEDIUM RISK:\n`;
    impersonators.medium_risk.slice(0, 3).forEach(imp => {
      alert += `• ${imp.symbol} (${imp.name}) - ${imp.risk_factors[0] || 'Suspicious activity'}\n`;
    });
  }

  alert += `\n🛡️ PROTECT YOURSELF:\n`;
  alert += `✅ ALWAYS verify contract address\n`;
  alert += `✅ ONLY trust legitimate project links\n`;
  alert += `✅ NEVER buy tokens with $0 liquidity\n`;
  alert += `✅ AVOID similar-but-not-identical names\n\n`;

  alert += `📊 SCAN RESULTS:\n`;
  alert += `• Tokens analyzed: ${totalAnalyzed}\n`;
  alert += `• Legitimate: 1 (${legitimateToken.symbol.toUpperCase()})\n`;
  alert += `• Suspicious: ${totalSuspicious}\n`;
  alert += `• Direct copies: ${impersonators.high_risk.filter(i => i.risk_factors.some(f => f.includes('exact symbol match'))).length}\n\n`;

  alert += `⚠️ CRITICAL:\n`;
  alert += `✅ ONLY TRUST: ${legitimateToken.address}\n`;
  alert += `🚫 Any other contract is NOT ${legitimateToken.symbol.toUpperCase()}\n\n`;
  alert += `🔐 Scan first, ape later!\n\n`;
  alert += `${legitimateToken.symbol} #ScamDetection #${legitimateToken.chain} #CryptoSafety`;

  return alert;
}

// ─── API Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/token-impersonation-scan
 *
 * Scan for tokens impersonating a legitimate token by contract address
 *
 * Request Body:
 * {
 *   "contractAddress": "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "legitimateToken": { ... },
 *   "impersonators": { ... },
 *   "summary": { ... },
 *   "alert": "...",
 *   "scanDate": "2026-03-26T10:00:00.000Z"
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { contractAddress } = req.body as TokenImpersonationRequest;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Contract address is required'
      });
    }

    // Validate contract address format (basic validation)
    if (contractAddress.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract address format'
      });
    }

    // Check if scanner script exists
    if (!fs.existsSync(SCANNER_SCRIPT)) {
      return res.status(500).json({
        success: false,
        error: 'Token impersonation scanner not found'
      });
    }

    // Run the Python scanner
    console.log(`🔍 Starting token impersonation scan for: ${contractAddress}`);
    const { stdout, stderr } = await execAsync(`python3 "${SCANNER_SCRIPT}" "${contractAddress}"`);

    if (stderr && stderr.includes('ERROR')) {
      console.error('Scanner error:', stderr);
      return res.status(500).json({
        success: false,
        error: 'Scanner execution failed',
        details: stderr
      });
    }

    // Parse scanner output
    // The scanner outputs JSON at the end with "Detailed report saved to:" message
    const jsonMatch = stdout.match(/impersonation_scan_[^_]+_\d+_\d+\.json/);
    if (!jsonMatch) {
      return res.status(500).json({
        success: false,
        error: 'Scanner output format invalid',
        details: 'Could not find JSON report file'
      });
    }

    const reportPath = path.join(__dirname, '../..', jsonMatch[0]);

    if (!fs.existsSync(reportPath)) {
      return res.status(500).json({
        success: false,
        error: 'Scanner report file not found',
        details: reportPath
      });
    }

    // Read the JSON report
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const reportData = JSON.parse(reportContent);

    // Generate alert
    const alert = generateAlert(reportData.legitimate_token, reportData.impersonators);

    // Format response
    const result: TokenImpersonationResult = {
      success: true,
      legitimateToken: reportData.legitimate_token,
      impersonators: reportData.impersonators,
      summary: {
        totalAnalyzed: reportData.summary.total_analyzed,
        exactSymbolFakes: reportData.summary.exact_symbol_fakes || 0,
        highRisk: reportData.summary.high_risk,
        mediumRisk: reportData.summary.medium_risk,
        lowRisk: reportData.summary.low_risk,
        unrelated: reportData.summary.unrelated,
        suspicious: (reportData.summary.exact_symbol_fakes || 0) + reportData.summary.high_risk + reportData.summary.medium_risk + reportData.summary.low_risk
      },
      alert,
      scanDate: reportData.scan_date
    };

    const exactFakeCount = result.summary.exactSymbolFakes;
    console.log(`✅ Scan complete: ${result.summary.suspicious} suspicious tokens found, ${exactFakeCount} exact symbol fakes`);
    res.json(result);

  } catch (error) {
    console.error('Token impersonation scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform token impersonation scan',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/token-impersonation-scan/reports
 *
 * List recent scan reports
 */
router.get('/reports', (req: Request, res: Response) => {
  try {
    const reportsDir = path.join(__dirname, '../..');
    const files = fs.readdirSync(reportsDir)
      .filter(file => file.startsWith('impersonation_scan_') && file.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 10);

    const reports = files.map(file => {
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);
      const contract = file.match(/impersonation_scan_([^_]+)/)?.[1] || 'unknown';
      const date = file.match(/(\d{8}_\d{6})/)?.[1] || 'unknown';

      return {
        filename: file,
        contractAddress: contract,
        date: date,
        createdAt: stats.birthtime,
        size: stats.size
      };
    });

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Error listing scan reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list scan reports'
    });
  }
});

/**
 * GET /api/token-impersonation-scan/report/:filename
 *
 * Get a specific scan report
 */
router.get('/report/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const reportPath = path.join(__dirname, '../..', filename);

    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    if (!filename.startsWith('impersonation_scan_') || !filename.endsWith('.json')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report filename'
      });
    }

    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const reportData = JSON.parse(reportContent);

    res.json({ success: true, report: reportData });
  } catch (error) {
    console.error('Error reading scan report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read scan report'
    });
  }
});

export default router;