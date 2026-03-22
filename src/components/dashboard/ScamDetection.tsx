/**
 * Scam Detection Dashboard Component
 * Dedicated scam detection section for X/Twitter profiles and Telegram channels
 * Integrates with browser-based X scraper and Telegram channel web fetcher
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardActions } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, AlertOctagon, Shield, Search, Send } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';

// API types
interface ScamScanRequest {
  platform: 'x' | 'telegram';
  identifier: string; // X username (@username) or Telegram channel (t.me/channel)
  scanType: 'quick' | 'full';
}

interface ScamScanResult {
  platform: 'x' | 'telegram';
  identifier: string;
  scanType: 'quick' | 'full';
  status: 'success' | 'error';
  data?: ScamProfileData;
  error?: string;
  scannedAt?: string;
}

interface ScamProfileData {
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

interface RedFlag {
  type: string;
  weight: number;
  evidence: string;
}

interface PinnedPost {
  id: string;
  text: string;
  url: string;
}

interface RecentPost {
  id: string;
  text: string;
  url: string;
}

export default function ScamDetectionDashboard() {
  const [xUsername, setXUsername] = useState('');
  const [telegramChannel, setTelegramChannel] = useState('');
  const [scanType, setScanType] = useState<'quick' | 'full'>('quick');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScamScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'x' | 'telegram'>('x');
  const [recentScans, setRecentScans] = useState<ScamProfileData[]>([]);

  // Load recent scans on component mount
  useEffect(() => {
    loadRecentScans();
  }, []);

  const loadRecentScans = async () => {
    try {
      const response = await fetch('/api/scam-detection/history');
      const data = await response.json();
      if (data.history) {
        setRecentScans(data.history.slice(0, 10)); // Show last 10 scans
      }
    } catch (error) {
      console.error('Failed to load recent scans:', error);
    }
  };

  const handleScan = async (platform: 'x' | 'telegram') => {
    const identifier = platform === 'x' ? xUsername : telegramChannel;

    if (!identifier) {
      setError(`Please enter a ${platform === 'x' ? 'X username (e.g., @username)' : 'Telegram channel (e.g., t.me/channel)'}`);
      return;
    }

    if (isScanning) return;

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('/api/scam-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform,
          identifier,
          scanType
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        setScanResult(result);
        setError(null);
        // Refresh recent scans
        loadRecentScans();
      } else {
        setError(result.error || 'Scan failed');
      }
    } catch (error) {
      console.error('Scan error:', error);
      setError(`Scan failed: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  const getStatusIcon = (level: string) => {
    switch (level) {
      case 'LOW':
        return <CheckCircle2 className="text-green-500" />;
      case 'MEDIUM':
        return <AlertTriangle className="text-yellow-500" />;
      case 'HIGH':
        return <XCircle className="text-red-500" />;
      case 'CRITICAL':
        return <AlertOctagon className="text-red-600" />;
      default:
        return null;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'text-green-500';
      case 'MEDIUM':
        return 'text-yellow-500';
      case 'HIGH':
        return 'text-red-500';
      case 'CRITICAL':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'Verified':
      case 'Highly Verified':
        return 'bg-green-500 text-white';
      case 'Partially Verified':
        return 'bg-yellow-500 text-black';
      case 'Legitimate':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="text-red-500" />
            Scam Detection Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Scan X/Twitter profiles and Telegram channels for scam detection. Real-time risk scoring (1-10), red flag detection, victim report search, and evidence collection.
            Uses browser automation for X profiles and web fetch for Telegram channels.
          </p>
        </CardContent>
      </Card>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Scan Profile or Channel</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Platform Tabs */}
          <div className="flex gap-4 mb-4">
            <Button
              variant={selectedPlatform === 'x' ? 'default' : 'outline'}
              onClick={() => setSelectedPlatform('x')}
            >
              <Search className="w-4 h-4 mr-2" />
              X/Twitter Profile
            </Button>
            <Button
              variant={selectedPlatform === 'telegram' ? 'default' : 'outline'}
              onClick={() => setSelectedPlatform('telegram')}
            >
              <Send className="w-4 h-4 mr-2" />
              Telegram Channel
            </Button>
          </div>

          {/* X Account Input */}
          {selectedPlatform === 'x' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">X Username</label>
                <Input
                  id="x-username-input"
                  type="text"
                  placeholder="@username"
                  value={xUsername}
                  onChange={(e) => setXUsername(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleScan('x');
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">Enter X username (e.g., @CryptoGenius09)</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value as 'quick' | 'full')}
                  className="flex-1"
                >
                  <option value="quick">Quick Scan (5 min)</option>
                  <option value="full">Full Scan (10 min)</option>
                </select>
                <Button
                  onClick={() => handleScan('x')}
                  disabled={isScanning || !xUsername}
                >
                  {isScanning ? 'Scanning...' : 'Scan X Profile'}
                </Button>
              </div>
            </div>
          )}

          {/* Telegram Channel Input */}
          {selectedPlatform === 'telegram' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Telegram Channel</label>
                <Input
                  id="telegram-channel-input"
                  type="text"
                  placeholder="t.me/channel"
                  value={telegramChannel}
                  onChange={(e) => setTelegramChannel(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleScan('telegram');
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">Enter Telegram channel (e.g., t.me/channel or @channel)</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value as 'quick' | 'full')}
                  className="flex-1"
                >
                  <option value="quick">Quick Scan (5 min)</option>
                  <option value="full">Full Scan (10 min)</option>
                </select>
                <Button
                  onClick={() => handleScan('telegram')}
                  disabled={isScanning || !telegramChannel}
                >
                  {isScanning ? 'Scanning...' : 'Scan Telegram Channel'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isScanning && (
        <Card>
          <CardContent className="flex justify-center items-center py-10">
            <div className="text-center">
              <Loader2 />
              <p className="text-sm text-gray-500 mt-2">
                Scanning {selectedPlatform === 'x' ? 'X profile' : 'Telegram channel'}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {scanResult && scanResult.status === 'success' && scanResult.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Scan Results — {scanResult.data.platform === 'x' ? 'X Profile' : 'Telegram Channel'}: {scanResult.data.identifier}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Scan Type:</span>
                <span className="text-sm font-medium">{scanResult.data.scanType}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Risk Level Badge */}
            <div className="flex items-center gap-2 mb-4">
              <div>
                <span className="text-sm text-gray-500">Risk Level:</span>
                <span className={`ml-2 font-bold text-lg ${getRiskColor(scanResult.data.riskLevel)}`}>
                  {scanResult.data.riskLevel}
                </span>
              </div>
              <span className={`ml-2 text-sm ${getRiskColor(scanResult.data.riskLevel)}`}>
                ({scanResult.data.riskScore.toFixed(1)}/10)
              </span>
              {getStatusIcon(scanResult.data.riskLevel)}
            </div>

            {/* Verification Status Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Verification Status:</span>
              <span className={`ml-2 text-xs px-2 py-1 rounded ${getVerificationBadge(scanResult.data.verificationStatus)}`}>
                {scanResult.data.verificationStatus}
              </span>
              <span className="ml-2 text-sm text-gray-500">
                ({scanResult.data.confidence} confidence)
              </span>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
              <div className="border rounded p-3">
                <span className="text-gray-500 block text-xs mb-1">
                  {scanResult.data.platform === 'x' ? 'Followers' : 'Members'}
                </span>
                <span className="font-bold text-lg">
                  {scanResult.data.platform === 'x'
                    ? (scanResult.data.followerCount?.toLocaleString() || '0')
                    : (scanResult.data.memberCount?.toLocaleString() || '0')
                  }
                </span>
              </div>
              <div className="border rounded p-3">
                <span className="text-gray-500 block text-xs mb-1">
                  {scanResult.data.platform === 'x' ? 'Posts' : 'Messages'}
                </span>
                <span className="font-bold text-lg">
                  {scanResult.data.platform === 'x'
                    ? (scanResult.data.messageCount?.toLocaleString() || '0')
                    : (scanResult.data.messageCount?.toLocaleString() || '0')
                  }
                </span>
              </div>
              <div className="border rounded p-3">
                <span className="text-gray-500 block text-xs mb-1">Engagement</span>
                <span className="font-bold text-lg">
                  {scanResult.data.engagementRate?.toFixed(2) || '0'}%
                </span>
              </div>
              <div className="border rounded p-3">
                <span className="text-gray-500 block text-xs mb-1">Joined</span>
                <span className="font-bold text-lg">
                  {scanResult.data.joinDate || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Profile Details */}
            {(scanResult.data.displayName || scanResult.data.bio) && (
              <div className="border rounded p-4 mb-6">
                <h4 className="font-semibold mb-3">Profile Details</h4>
                {scanResult.data.displayName && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-500">Display Name:</span>
                    <span className="ml-2 font-medium">{scanResult.data.displayName}</span>
                  </div>
                )}
                {scanResult.data.bio && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-500">Bio:</span>
                    <p className="ml-2 text-sm">{scanResult.data.bio}</p>
                  </div>
                )}
                {scanResult.data.website && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-500">Website:</span>
                    <a
                      href={scanResult.data.website}
                      target="_blank"
                      className="ml-2 text-blue-500 hover:underline"
                    >
                      {scanResult.data.website}
                    </a>
                  </div>
                )}
                {scanResult.data.location && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-500">Location:</span>
                    <span className="ml-2">{scanResult.data.location}</span>
                  </div>
                )}
              </div>
            )}

            {/* Red Flags */}
            {scanResult.data.redFlags && scanResult.data.redFlags.length > 0 && (
              <div className="mb-6">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <AlertTitle>Red Flags Detected ({scanResult.data.redFlags.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-2">
                      {scanResult.data.redFlags.map((flag, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="font-medium mr-2">• {flag.type}</span>
                          <span className="text-sm">{flag.evidence}</span>
                          <span className="ml-auto text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            Weight: {flag.weight}/10
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Summary */}
            <div className="mb-6">
              <Alert variant={scanResult.data.riskScore >= 7 ? 'destructive' : 'default'}>
                <AlertDescription className="text-gray-700">
                  {scanResult.data.summary}
                </AlertDescription>
              </Alert>
            </div>

            {/* Recent Posts */}
            {scanResult.data.recentPosts && scanResult.data.recentPosts.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Recent Posts (Sample - Last 10)</h4>
                <div className="space-y-2">
                  {scanResult.data.recentPosts.map((post, i) => (
                    <div key={i} className="border-b border-gray-200 p-3 rounded">
                      <p className="text-sm text-gray-700 mb-2">{post.text}</p>
                      <a
                        href={post.url}
                        target="_blank"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        {post.url.length > 50 ? post.url.substring(0, 50) + '...' : post.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pinned Posts */}
            {scanResult.data.pinnedPosts && scanResult.data.pinnedPosts.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Pinned Posts (Sample - Last 5)</h4>
                <div className="space-y-2">
                  {scanResult.data.pinnedPosts.map((post, i) => (
                    <div key={i} className="border-b border-gray-200 p-3 rounded bg-gray-50">
                      <p className="text-sm text-gray-700 mb-2">{post.text}</p>
                      <a
                        href={post.url}
                        target="_blank"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        {post.url.length > 50 ? post.url.substring(0, 50) + '...' : post.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {scanResult.data.links && scanResult.data.links.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">External Links Found</h4>
                <div className="space-y-2">
                  {scanResult.data.links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      className="block text-sm text-blue-500 hover:underline"
                    >
                      {link.length > 60 ? link.substring(0, 60) + '...' : link}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {scanResult.data.notes && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Additional Notes</h4>
                <p className="text-sm text-gray-600">{scanResult.data.notes}</p>
              </div>
            )}

            {/* Scan Metadata */}
            <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
              <p>Scanned: {scanResult.scannedAt ? new Date(scanResult.scannedAt).toLocaleString() : 'Unknown'}</p>
              <p>Scan Type: {scanResult.data.scanType}</p>
              <p>Platform: {scanResult.data.platform === 'x' ? 'X/Twitter' : 'Telegram'}</p>
            </div>
          </CardContent>
          <CardActions>
            <Button
              variant="outline"
              onClick={() => {
                setScanResult(null);
                setError(null);
              }}
            >
              Scan Another Profile
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                // Save scan to database
                try {
                  await fetch('/api/scam-detection/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(scanResult.data)
                  });
                  alert('Scan saved to database!');
                } catch (error) {
                  alert('Failed to save scan');
                }
              }}
            >
              Save to Database
            </Button>
          </CardActions>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Recent Scans History */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentScans.map((scan, i) => (
                <div
                  key={i}
                  className="border-b border-gray-200 p-3 rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => setScanResult({
                    platform: scan.platform,
                    identifier: scan.identifier,
                    scanType: 'quick',
                    status: 'success',
                    data: scan,
                    scannedAt: new Date().toISOString()
                  })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{scan.platform === 'x' ? 'X' : 'Telegram'}</span>
                      <span className="ml-2">{scan.identifier}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${getVerificationBadge(scan.verificationStatus)}`}>
                        {scan.verificationStatus}
                      </span>
                      <span className={`font-bold ${getRiskColor(scan.riskLevel)}`}>
                        {scan.riskScore.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}