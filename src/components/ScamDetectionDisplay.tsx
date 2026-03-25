// ============================================
// Agentic Bro - Scam Detection Display Component
// ============================================
// Purpose: Display scammer database and scan results on website
// Display: Public-facing component for agenticbro.io
// Created: March 25, 2026
// ============================================

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

// ============================================
// Supabase Client
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    <span className={`${colors[level as keyof typeof colors]} text-white px-3 py-1 rounded-full text-sm font-semibold`}>
      {level} ({score.toFixed(2)}/10)
    </span>
  );
}

// ============================================
// Scammer Card Component
// ============================================

function ScammerCard({ scammer }: { scammer: Scammer }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{scammer.scammer_name}</h3>
          <p className="text-gray-600 text-sm">{scammer.platform}</p>
        </div>
        <RiskLevelBadge level={scammer.risk_level} score={scammer.risk_score} />
      </div>
      
      <div className="space-y-2 text-sm">
        {scammer.x_handle && (
          <div className="flex items-center text-gray-700">
            <span className="font-semibold mr-2">X Handle:</span>
            <span className="text-blue-600">{scammer.x_handle}</span>
          </div>
        )}
        {scammer.telegram_channel && (
          <div className="flex items-center text-gray-700">
            <span className="font-semibold mr-2">Telegram:</span>
            <span className="text-blue-600">{scammer.telegram_channel}</span>
          </div>
        )}
        <div className="flex items-center text-gray-700">
          <span className="font-semibold mr-2">Scam Type:</span>
          <span className="text-red-600">{scammer.scam_type}</span>
        </div>
        <div className="flex items-center text-gray-700">
          <span className="font-semibold mr-2">Victims:</span>
          <span className="text-red-600">{scammer.victims_count}</span>
          <span className="mx-2">•</span>
          <span className="font-semibold mr-2">Total Lost:</span>
          <span className="text-red-600">${scammer.total_lost_usd.toLocaleString()}</span>
        </div>
        <div className="flex items-center text-gray-700">
          <span className="font-semibold mr-2">Status:</span>
          <span className="text-red-600 font-semibold">{scammer.verification_level}</span>
        </div>
        <div className="text-gray-500 text-xs mt-2">
          Last updated: {new Date(scammer.last_updated).toLocaleDateString()}
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
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{account.account_name}</h3>
          <p className="text-gray-600 text-sm">{account.platform}</p>
        </div>
        <RiskLevelBadge level={account.risk_level} score={account.risk_score} />
      </div>
      
      <div className="space-y-2 text-sm">
        {account.x_handle && (
          <div className="flex items-center text-gray-700">
            <span className="font-semibold mr-2">X Handle:</span>
            <span className="text-blue-600">{account.x_handle}</span>
          </div>
        )}
        {account.verification_badge && (
          <div className="flex items-center text-gray-700">
            <span className="font-semibold mr-2">Verified:</span>
            <span className="text-blue-600">✅ Blue Checkmark</span>
          </div>
        )}
        <div className="flex items-center text-gray-700">
          <span className="font-semibold mr-2">Followers:</span>
          <span className="text-green-600">{account.followers?.toLocaleString()}</span>
        </div>
        <div className="flex items-center text-gray-700">
          <span className="font-semibold mr-2">Status:</span>
          <span className="text-green-600 font-semibold">LEGITIMATE</span>
        </div>
        <div className="text-gray-500 text-xs mt-2">
          Scanned: {new Date(account.scan_date).toLocaleDateString()}
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="text-3xl font-bold mb-2">{stats.total_scans.toLocaleString()}</div>
        <div className="text-blue-100">Total Scans</div>
      </div>
      
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white">
        <div className="text-3xl font-bold mb-2">{stats.total_scammers_detected.toLocaleString()}</div>
        <div className="text-red-100">Scammers Detected</div>
      </div>
      
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
        <div className="text-3xl font-bold mb-2">{stats.total_legitimate_accounts.toLocaleString()}</div>
        <div className="text-green-100">Legitimate Accounts</div>
      </div>
      
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="text-3xl font-bold mb-2">${stats.total_lost_tracked_usd.toLocaleString()}</div>
        <div className="text-purple-100">Loss Tracked</div>
      </div>
      
      {/* Risk Level Breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="font-bold text-gray-900 mb-4">Risk Level Breakdown</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-green-600">Low Risk</span>
            <span className="font-semibold">{stats.low_risk_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-600">Medium Risk</span>
            <span className="font-semibold">{stats.medium_risk_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-600">High Risk</span>
            <span className="font-semibold">{stats.high_risk_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-600">Critical Risk</span>
            <span className="font-semibold">{stats.critical_risk_count}</span>
          </div>
        </div>
      </div>
      
      {/* Scam Types Breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="font-bold text-gray-900 mb-4">Scam Types</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-700">AMA/Giveaway Fraud</span>
            <span className="font-semibold">{stats.ama_giveaway_fraud}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Rug Pull</span>
            <span className="font-semibold">{stats.rug_pull}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Phishing</span>
            <span className="font-semibold">{stats.phishing}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Wallet Drainer</span>
            <span className="font-semibold">{stats.wallet_drainer}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Other</span>
            <span className="font-semibold">{stats.other_scam_types}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function ScamDetectionDisplay() {
  const [scammers, setScammers] = useState<Scammer[]>([]);
  const [legitimate, setLegitimate] = useState<LegitimateAccount[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scammers' | 'legitimate' | 'scans'>('scammers');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [scammersRes, legitimateRes, scanResultsRes, statsRes] = await Promise.all([
        supabase.from('scammers').select('*').order('created_at', { ascending: false }),
        supabase.from('legitimate_accounts').select('*').order('followers', { ascending: false }).limit(10),
        supabase.from('scan_results').select('*').order('scan_date', { ascending: false }).limit(20),
        supabase.from('stats').select('*').single()
      ]);
      
      if (scammersRes.data) setScammers(scammersRes.data);
      if (legitimateRes.data) setLegitimate(legitimateRes.data);
      if (scanResultsRes.data) setScanResults(scanResultsRes.data);
      if (statsRes.data) setStats(statsRes.data);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scam detection data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">🔍 Scam Detection Database</h1>
          <p className="text-xl text-blue-100">
            Protecting the $SOL community from scammers since 2026
          </p>
          <p className="text-sm text-blue-200 mt-2">
            Last updated: {stats ? new Date(stats.last_updated).toLocaleString() : 'Unknown'}
          </p>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {/* Stats Dashboard */}
        {stats && <StatsDashboard stats={stats} />}
        
        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('scammers')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'scammers'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🚨 Scammers ({scammers.length})
          </button>
          <button
            onClick={() => setActiveTab('legitimate')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'legitimate'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            ✅ Legitimate ({legitimate.length})
          </button>
          <button
            onClick={() => setActiveTab('scans')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'scans'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📊 Recent Scans ({scanResults.length})
          </button>
        </div>
        
        {/* Content */}
        {activeTab === 'scammers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scammers.length > 0 ? (
              scammers.map((scammer) => (
                <ScammerCard key={scammer.id} scammer={scammer} />
              ))
            ) : (
              <div className="col-span-3 text-center py-12">
                <p className="text-gray-500 text-lg">No scammers detected yet. 🎉</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'legitimate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {legitimate.length > 0 ? (
              legitimate.map((account) => (
                <LegitimateCard key={account.id} account={account} />
              ))
            ) : (
              <div className="col-span-3 text-center py-12">
                <p className="text-gray-500 text-lg">No legitimate accounts verified yet.</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'scans' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {scanResults.length > 0 ? (
                  scanResults.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {scan.target_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.platform}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <RiskLevelBadge level={scan.risk_level} score={scan.risk_score} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.verification_level}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(scan.scan_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-lg">
                      No scan results yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>🔐 Scan first, ape later! | $AGNTCBRO</p>
          <p className="mt-2">
            Data sourced from Agentic Bro scam detection system • Updated automatically
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// End of Component
// ============================================