/**
 * Wallet Protection Client
 * 
 * Client-side helper functions for interacting with wallet protection APIs.
 */

// API endpoints
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Types
export interface TransactionAnalysisResult {
  success: boolean;
  transactionId?: string;
  fee: number;
  instructions: AnalyzedInstruction[];
  overallRisk: {
    score: number;
    level: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: string[];
    recommendation: 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK';
    explanation: string;
  };
  error?: string;
}

export interface AnalyzedInstruction {
  programId: string;
  programName: string;
  instructionType: string;
  instructionLabel: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  details: {
    source?: string;
    destination?: string;
    amount?: number;
    token?: string;
    authority?: string;
  };
  flags: string[];
}

export interface Token2022CheckResult {
  success: boolean;
  mint?: string;
  extensions?: TokenExtension[];
  overallRisk?: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags?: string[];
  error?: string;
}

export interface TokenExtension {
  type: string;
  value: unknown;
  risk: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface DrainerCheckResult {
  success: boolean;
  address?: string;
  isKnownDrainer?: boolean;
  drainerInfo?: {
    name: string;
    type: string;
    riskLevel: string;
    totalStolenUsd?: number;
    victimCount?: number;
    firstSeen?: string;
    referenceUrl?: string;
  };
  riskAssessment?: {
    score: number;
    level: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendation: 'APPROVE' | 'CAUTION' | 'REJECT' | 'BLOCK';
    explanation: string;
  };
  error?: string;
}

/**
 * Analyze a transaction for risks
 */
export async function analyzeTransaction(
  transaction: string | Buffer,
  format: 'base58' | 'base64' = 'base58'
): Promise<TransactionAnalysisResult> {
  try {
    const payload = typeof transaction === 'string'
      ? (format === 'base58' ? { transaction } : { base64: transaction })
      : { base64: Buffer.from(transaction).toString('base64') };

    const response = await fetch(`${API_BASE}/api/transaction-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.json();
  } catch (error) {
    return {
      success: false,
      fee: 0,
      instructions: [],
      overallRisk: {
        score: 0,
        level: 'SAFE',
        flags: [],
        recommendation: 'REJECT',
        explanation: 'Failed to analyze transaction',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check a Token-2022 mint for dangerous extensions
 */
export async function checkToken2022(mint: string): Promise<Token2022CheckResult> {
  try {
    const response = await fetch(`${API_BASE}/api/token-2022-check?mint=${encodeURIComponent(mint)}`);
    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if an address is a known drainer
 */
export async function checkDrainer(address: string): Promise<DrainerCheckResult> {
  try {
    const response = await fetch(`${API_BASE}/api/drainer-check?address=${encodeURIComponent(address)}`);
    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check multiple addresses for known drainers
 */
export async function checkDrainers(addresses: string[]): Promise<DrainerCheckResult[]> {
  try {
    const response = await fetch(`${API_BASE}/api/drainer-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses }),
    });
    
    const result = await response.json();
    
    // API returns single result for bulk, wrap in array
    if (result.success && result.addresses) {
      return result.results;
    }
    
    return [result];
  } catch (error) {
    return addresses.map(() => ({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

/**
 * Get proxied dApp URL
 */
export function getProxiedUrl(url: string): string {
  return `${API_BASE}/api/wallet-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Log a wallet protection event
 */
export async function logWalletEvent(event: {
  sessionId: string;
  dappUrl: string;
  riskScore: number;
  riskLevel: string;
  recommendation: string;
  userDecision: string;
  instructions: AnalyzedInstruction[];
  flags: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/wallet-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Combined risk assessment for a transaction
 */
export async function fullRiskAssessment(
  transaction: string | Buffer,
  format: 'base58' | 'base64' = 'base58'
): Promise<{
  transaction: TransactionAnalysisResult;
  tokenExtensions: Token2022CheckResult[];
  drainerChecks: DrainerCheckResult[];
}> {
  // Analyze transaction
  const txResult = await analyzeTransaction(transaction, format);

  // Extract all addresses from instructions
  const addresses = txResult.instructions
    .flatMap(i => [i.details.source, i.details.destination, i.details.authority])
    .filter((a): a is string => !!a);

  // Check for Token-2022 extensions on token addresses
  const tokenAddresses = txResult.instructions
    .filter(i => i.programName === 'SPL Token' || i.programName === 'Token-2022')
    .map(i => i.details.token)
    .filter((a): a is string => !!a);

  // Run all checks in parallel
  const [tokenExtensions, drainerChecks] = await Promise.all([
    Promise.all(tokenAddresses.map(addr => checkToken2022(addr))),
    checkDrainers(addresses),
  ]);

  return {
    transaction: txResult,
    tokenExtensions,
    drainerChecks,
  };
}
