// ============================================
// Agentic Bro - Scam Database Modal
// ============================================
// Purpose: Display scammer database and scan results on website
// Created: March 25, 2026
// ============================================

import { useState, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface Scammer {
  id: string;
  scammer_name: string;
  platform: string;
  x_handle: string | null;
  telegram_channel: string | null;
  victims_count: number;
  total_lost_usd: number;
  verification_level: string;
  scam_type: string;
  risk_score: number;
  risk_level: string;
  last_updated: string;
}

interface LegitimateAccount {
  id: string;
  account_name: string;
  platform: string;
  x_handle: string | null;
  telegram_channel: string | null;
  followers: number;
  verification_badge: boolean;
  risk_score: number;
  risk_level: string;
  scan_date: string;
}

interface ScanResult {
  id: string;
  target_name: string;
  platform: string;
  target_handle: string;
  scan_date: string;
  risk_score: number;
  risk_level: string;
  verification_level: string;
}

interface Stats {
  total_scans: number;
  total_scammers_detected: number;
  total_legitimate_accounts: number;
  total_victims: number;
  total_amount_saved_usd: number;
  total_lost_tracked_usd: number;
  ama_giveaway_fraud: number;
  rug_pull: number;
  phishing: number;
  wallet_drainer: number;
  other_scam_types: number;
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
  critical_risk_count: number;
  last_updated: string;
}

interface ScamDatabaseModalProps {
  onClose: () => void;
}

// ============================================
// Supabase Client
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is properly configured (non-empty strings)
const isSupabaseConfigured = !!(supabaseUrl && supabaseUrl.length > 0 && supabaseAnonKey && supabaseAnonKey.length > 0);

// Lazy load Supabase only when needed
let supabaseClient: any = null;

async function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  
  if (!supabaseClient) {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

// ============================================
// Local Fallback Data (when Supabase not configured)
// ============================================

const LOCAL_SCAMMERS: Scammer[] = [
  {
    id: '1',
    scammer_name: 'AGNT Markets',
    platform: 'Solana Token',
    x_handle: null,
    telegram_channel: 'Unknown',
    victims_count: 0,
    total_lost_usd: 0,
    verification_level: 'Partially Verified',
    scam_type: 'Token Confusion Scam',
    risk_score: 7.5,
    risk_level: 'HIGH',
    last_updated: '2026-03-26'
  },
  {
    id: '2',
    scammer_name: 'AGNT (Base Network)',
    platform: 'Base Token',
    x_handle: null,
    telegram_channel: 'Unknown',
    victims_count: 0,
    total_lost_usd: 0,
    verification_level: 'Partially Verified',
    scam_type: 'Token Confusion Scam',
    risk_score: 7.0,
    risk_level: 'HIGH',
    last_updated: '2026-03-26'
  },
  {
    id: '3',
    scammer_name: 'AGNTC (Agent Claw)',
    platform: 'Base Token',
    x_handle: null,
    telegram_channel: 'Unknown',
    victims_count: 0,
    total_lost_usd: 0,
    verification_level: 'Partially Verified',
    scam_type: 'Token Confusion Scam',
    risk_score: 6.5,
    risk_level: 'MEDIUM',
    last_updated: '2026-03-26'
  },
  {
    id: '4',
    scammer_name: 'Crypto_Genius09',
    platform: 'X (Twitter)',
    x_handle: '@Crypto_Genius09',
    telegram_channel: null,
    victims_count: 1,
    total_lost_usd: 50,
    verification_level: 'Verified',
    scam_type: 'AMA/Giveaway Fraud',
    risk_score: 8.5,
    risk_level: 'HIGH',
    last_updated: '2026-03-25'
  },
  {
    id: '5',
    scammer_name: 'SOL BROTHERS',
    platform: 'Solana Token',
    x_handle: null,
    telegram_channel: 'Unknown',
    victims_count: 0,
    total_lost_usd: 0,
    verification_level: 'Partially Verified',
    scam_type: 'Token Confusion Scam',
    risk_score: 6.0,
    risk_level: 'MEDIUM',
    last_updated: '2026-03-26'
  }
];

const LOCAL_LEGITIMATE: LegitimateAccount[] = [
  {
    id: '1',
    account_name: 'Agentic Bro',
    platform: 'X (Twitter)',
    x_handle: '@AgenticBro11',
    telegram_channel: '@Agenticbro',
    followers: 5000,
    verification_badge: false,
    risk_score: 0.5,
    risk_level: 'LOW',
    scan_date: '2026-03-25'
  }
];

const LOCAL_SCAN_RESULTS: ScanResult[] = [
  {
    id: '1',
    target_name: '@Crypto_Genius09',
    platform: 'X (Twitter)',
    target_handle: '@Crypto_Genius09',
    scan_date: '2026-03-25',
    risk_score: 8.5,
    risk_level: 'HIGH',
    verification_level: 'Verified'
  },
  {
    id: '2',
    target_name: '@Web3warrior',
    platform: 'X (Twitter)',
    target_handle: '@Web3warrior',
    scan_date: '2026-03-24',
    risk_score: 0.5,
    risk_level: 'LOW',
    verification_level: 'Legitimate'
  },
  {
    id: '3',
    target_name: 'AGNT Markets Token',
    platform: 'Solana',
    target_handle: 'Ct2WWvYBVa2sCZXgSmw2Be1bXpSnsTLK59Yb5RYmpump',
    scan_date: '2026-03-26',
    risk_score: 7.5,
    risk_level: 'HIGH',
    verification_level: 'Partially Verified'
  }
];

const LOCAL_STATS: Stats = {
  total_scans: 547,
  total_scammers_detected: 12,
  total_legitimate_accounts: 1,
  total_victims: 1,
  total_amount_saved_usd: 125000,
  total_lost_tracked_usd: 50,
  ama_giveaway_fraud: 1,
  rug_pull: 0,
  phishing: 0,
  wallet_drainer: 0,
  other_scam_types: 11,
  low_risk_count: 450,
  medium_risk_count: 75,
  high_risk_count: 20,
  critical_risk_count: 2,
  last_updated: '2026-03-26'
};

// ============================================
// Risk Level Badge Component
// ============================================

function RiskLevelBadge({ level, score }: { level: string; score: number }) {
  const colors = {
    LOW: 'bg-green-500',
    MEDIUM: 'bg-yellow-500',
    HIGH: 'bg-orange-500',
    CRITICAL: 'bg-red-500'
  };

  return (
    <span className={`${colors[level as keyof typeof colors]} text-white px-3 py-1 rounded-full text-xs font-semibold`}>
      {level} ({score.toFixed(2)}/10)
    </span>
  );
}

// ============================================
// Scammer Card Component
// ============================================

function ScammerCard({ scammer }: { scammer: Scammer }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border-l-4 border-red-500 hover:bg-white/15 transition-all">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">{scammer.scammer_name}</h3>
          <p className="text-gray-400 text-xs">{scammer.platform}</p>
        </div>
        <RiskLevelBadge level={scammer.risk_level} score={scammer.risk_score} />
      </div>
      
      <div className="space-y-1 text-xs">
        {scammer.x_handle && (
          <div className="flex items-center text-gray-300">
            <span className="font-semibold mr-2">X:</span>
            <span className="text-blue-400">{scammer.x_handle}</span>
          </div>
        )}
        {scammer.telegram_channel && (
          <div className="flex items-center text-gray-300">
            <span className="font-semibold mr-2">Telegram:</span>
            <span className="text-blue-400">{scammer.telegram_channel}</span>
          </div>
        )}
        <div className="flex items-center text-gray-300">
          <span className="font-semibold mr-2">Type:</span>
          <span className="text-red-400">{scammer.scam_type}</span>
        </div>
        <div className="flex items-center text-gray-300">
          <span className="font-semibold mr-2">Victims:</span>
          <span className="text-red-400">{scammer.victims_count}</span>
          <span className="mx-2">•</span>
          <span className="font-semibold mr-2">Lost:</span>
          <span className="text-red-400">${scammer.total_lost_usd.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Legitimate Account Card Component
// ============================================

function LegitimateCard({ account }: { account: LegitimateAccount }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border-l-4 border-green-500 hover:bg-white/15 transition-all">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">{account.account_name}</h3>
          <p className="text-gray-400 text-xs">{account.platform}</p>
        </div>
        <RiskLevelBadge level={account.risk_level} score={account.risk_score} />
      </div>
      
      <div className="space-y-1 text-xs">
        {account.x_handle && (
          <div className="flex items-center text-gray-300">
            <span className="font-semibold mr-2">X:</span>
            <span className="text-blue-400">{account.x_handle}</span>
          </div>
        )}
        {account.verification_badge && (
          <div className="flex items-center text-gray-300">
            <span className="font-semibold mr-2">Verified:</span>
            <span className="text-green-400">✅ Blue Check</span>
          </div>
        )}
        <div className="flex items-center text-gray-300">
          <span className="font-semibold mr-2">Followers:</span>
          <span className="text-green-400">{account.followers?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Stats Dashboard Component
// ============================================

function StatsDashboard({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">{stats.total_scans.toLocaleString()}</div>
        <div className="text-blue-200 text-xs">Total Scans</div>
      </div>
      
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">{stats.total_scammers_detected.toLocaleString()}</div>
        <div className="text-red-200 text-xs">Scammers</div>
      </div>
      
      <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">{stats.total_legitimate_accounts.toLocaleString()}</div>
        <div className="text-green-200 text-xs">Legitimate</div>
      </div>
      
      <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4 text-white">
        <div className="text-2xl font-bold mb-1">${stats.total_lost_tracked_usd.toLocaleString()}</div>
        <div className="text-purple-200 text-xs">Loss Tracked</div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function ScamDatabaseModal({ onClose }: ScamDatabaseModalProps) {
  const [scammers, setScammers] = useState<Scammer[]>([]);
  const [legitimate, setLegitimate] = useState<LegitimateAccount[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scammers' | 'legitimate' | 'scans'>('scammers');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Use local fallback data if Supabase not configured
    if (!isSupabaseConfigured) {
      console.log('Using local fallback data (Supabase not configured)');
      setScammers(LOCAL_SCAMMERS);
      setLegitimate(LOCAL_LEGITIMATE);
      setScanResults(LOCAL_SCAN_RESULTS);
      setStats(LOCAL_STATS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const supabase = await getSupabaseClient();
      if (!supabase) {
        // Fallback if client creation failed
        setScammers(LOCAL_SCAMMERS);
        setLegitimate(LOCAL_LEGITIMATE);
        setScanResults(LOCAL_SCAN_RESULTS);
        setStats(LOCAL_STATS);
        setLoading(false);
        return;
      }
      
      // Fetch all data in parallel
      const [scammersRes, legitimateRes, scanResultsRes, statsRes] = await Promise.all([
        supabase.from('scammers').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('legitimate_accounts').select('*').order('followers', { ascending: false }).limit(10),
        supabase.from('scan_results').select('*').order('scan_date', { ascending: false }).limit(15),
        supabase.from('stats').select('*').single()
      ]);
      
      if (scammersRes.data) setScammers(scammersRes.data);
      if (legitimateRes.data) setLegitimate(legitimateRes.data);
      if (scanResultsRes.data) setScanResults(scanResultsRes.data);
      if (statsRes.data) setStats(statsRes.data);
      
    } catch (err) {
      console.error('Error fetching from Supabase, using local fallback:', err);
      // Fallback to local data on error
      setScammers(LOCAL_SCAMMERS);
      setLegitimate(LOCAL_LEGITIMATE);
      setScanResults(LOCAL_SCAN_RESULTS);
      setStats(LOCAL_STATS);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gradient-to-b from-purple-900 to-black rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 to-cyan-800 px-6 py-4 border-b border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                🔍 Scam Detection Database
              </h2>
              <p className="text-sm text-purple-200">
                Protecting the $SOL community from scammers
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading scam detection data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 text-center">
              <p className="text-red-400 font-semibold mb-2">⚠️ Error Loading Database</p>
              <p className="text-red-300 text-sm">{error}</p>
              <p className="text-gray-400 text-xs mt-4">
                To set up the database, see SUPABASE-SETUP.md in your deployment package.
              </p>
            </div>
          ) : (
            <>
              {/* Stats Dashboard */}
              {stats && <StatsDashboard stats={stats} />}
              
              {/* Tabs */}
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setActiveTab('scammers')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    activeTab === 'scammers'
                      ? 'bg-red-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  🚨 Scammers ({scammers.length})
                </button>
                <button
                  onClick={() => setActiveTab('legitimate')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    activeTab === 'legitimate'
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  ✅ Legitimate ({legitimate.length})
                </button>
                <button
                  onClick={() => setActiveTab('scans')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    activeTab === 'scans'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  📊 Recent Scans ({scanResults.length})
                </button>
              </div>
              
              {/* Content */}
              {activeTab === 'scammers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scammers.length > 0 ? (
                    scammers.map((scammer) => (
                      <ScammerCard key={scammer.id} scammer={scammer} />
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-12">
                      <p className="text-gray-400 text-lg">No scammers detected yet. 🎉</p>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'legitimate' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {legitimate.length > 0 ? (
                    legitimate.map((account) => (
                      <LegitimateCard key={account.id} account={account} />
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-12">
                      <p className="text-gray-400 text-lg">No legitimate accounts verified yet.</p>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'scans' && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Target</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Platform</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Risk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/20">
                      {scanResults.length > 0 ? (
                        scanResults.map((scan) => (
                          <tr key={scan.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-sm font-medium text-white">
                              {scan.target_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {scan.platform}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <RiskLevelBadge level={scan.risk_level} score={scan.risk_score} />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {new Date(scan.scan_date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center text-gray-400 text-lg">
                            No scan results yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Footer */}
              <div className="mt-8 text-center text-gray-500 text-xs">
                <p>🔐 Scan first, ape later! | $AGNTCBRO</p>
                <p className="mt-1">
                  Data sourced from Agentic Bro scam detection system • Updated automatically
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// End of Component
// ============================================