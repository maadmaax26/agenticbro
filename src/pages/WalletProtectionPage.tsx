/**
 * WalletProtectionPage.tsx — Full Protection Dashboard
 * 
 * Main page for wallet protection features.
 * Combines simulator, approvals, history, and quick check.
 */

import { useState } from 'react';
import {
  Shield,
  History,
  CheckCircle,
  Zap,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { WalletSimulator } from '../components/wallet-simulator';
import { ApprovalManager, QuickCheck } from '../components/WalletProtector';
import type { TransactionRecord } from '../lib/wallet-proxy/useWalletSimulator';
import { ContactUs } from '../components/ContactUs';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'simulator' | 'approvals' | 'history' | 'quick-check';

interface WalletProtectionPageProps {
  onBack?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function WalletProtectionPage({ onBack }: WalletProtectionPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('simulator');
  const [transactionHistory] = useState<TransactionRecord[]>([]);

  // ── Tab Configuration ────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'simulator', label: 'Simulator', icon: Shield },
    { id: 'quick-check', label: 'Quick Check', icon: Zap },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle },
    { id: 'history', label: 'History', icon: History },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      {/* ── Header ───────────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors md:hidden"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <Shield className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-xl font-bold text-white">Wallet Protection</h1>
                <p className="text-sm text-gray-400">Analyze transactions before signing</p>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Tabs ─────────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-white/10 bg-black/20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <WalletSimulator />
          </div>
        )}

        {activeTab === 'quick-check' && (
          <div className="max-w-2xl mx-auto">
            <QuickCheck />
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="max-w-4xl mx-auto">
            <ApprovalManager />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <div className="p-6 rounded-lg bg-black/40 border border-white/5">
              <h3 className="text-lg font-semibold text-white mb-4">Transaction History</h3>
              {transactionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No transactions analyzed yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Use the simulator or quick check to analyze transactions
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactionHistory.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 rounded bg-black/30 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white">{record.url}</div>
                        <div className="text-sm text-gray-400">
                          {new Date(record.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          record.decision === 'approved'
                            ? 'bg-green-900/30 text-green-400'
                            : record.decision === 'rejected'
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}
                      >
                        {record.decision}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            🔐 Agentic Bro Wallet Guard — Scan first, trust later
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Educational purposes only. Not financial advice. Always DYOR.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            <ContactUs />
          </p>
        </div>
      </footer>
    </div>
  );
}

export default WalletProtectionPage;