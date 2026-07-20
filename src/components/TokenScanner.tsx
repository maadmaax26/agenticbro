import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCredits } from '../lib/payments';
import { useAuth } from '../lib/AuthContext';

interface TokenScannerProps {
  onLoginRequired?: () => void;
}

interface TokenScanSummary {
  totalAnalyzed?: number;
  suspicious?: number;
  exactSymbolFakes?: number;
  highRisk?: number;
  mediumRisk?: number;
  lowRisk?: number;
}

interface TokenScanResult {
  success: boolean;
  legitimateToken?: {
    symbol?: string;
    name?: string;
    address?: string;
    price?: string;
    liquidity?: number;
    volume?: number;
    url?: string;
  };
  summary?: TokenScanSummary;
  alert?: string;
  error?: string;
  scanDate?: string;
}

export default function TokenScanner({ onLoginRequired }: TokenScannerProps) {
  const { publicKey } = useWallet();
  const { isAuthenticated, email, walletAddress: authWalletAddress } = useAuth();
  const [contractAddress, setContractAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<TokenScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveWalletAddress = publicKey?.toString() || authWalletAddress || null;
  const { credits, freeScansRemaining, hasScans, useCredit: consumeCredit } = useCredits(null, email || null, effectiveWalletAddress);

  const handleScan = async () => {
    if (!contractAddress.trim()) {
      setError('Please enter a contract address');
      return;
    }
    if (!hasScans && !isAuthenticated && !publicKey) {
      onLoginRequired?.();
      return;
    }
    if (!hasScans) {
      setError('No scans remaining. Purchase credits to continue scanning.');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    const creditResult = await consumeCredit();
    if (!creditResult.success) {
      setError('Failed to use scan credit. Please try again.');
      setScanning(false);
      return;
    }

    try {
      const response = await fetch('/api/token-impersonation-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: contractAddress.trim() }),
      });
      const data = await response.json() as TokenScanResult;
      if (!response.ok || !data.success) throw new Error(data.error || 'Token scan failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-cyan-500/20">
      <h3 className="text-xl font-bold text-cyan-400 mb-4">Token Scanner</h3>
      <div className="space-y-4">
        <input
          type="text"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          placeholder="Enter token contract address"
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
        />
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold"
        >
          {scanning ? 'Scanning...' : 'Scan Token'}
        </button>
        <div className="text-sm text-gray-400">
          Credits: {credits} | Free scans: {freeScansRemaining}
        </div>
        {error && <div className="p-3 rounded-lg bg-red-900/40 text-red-200">{error}</div>}
        {result && (
          <div className="p-4 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 space-y-2">
            <div className="font-semibold">{result.legitimateToken?.symbol || 'Token'} {result.legitimateToken?.name ? `- ${result.legitimateToken.name}` : ''}</div>
            <div>Suspicious candidates: {result.summary?.suspicious ?? 0}</div>
            <div>Total analyzed: {result.summary?.totalAnalyzed ?? 0}</div>
            {result.alert && <div className="text-sm text-gray-300">{result.alert}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
