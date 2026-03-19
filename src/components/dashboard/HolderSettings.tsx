import { Bell, ExternalLink, RefreshCw } from 'lucide-react';

export default function HolderSettings() {
  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </h2>
        <div className="space-y-4">
          <SettingToggle
            label="Signal Alerts"
            description="Receive notifications when new signals are available"
            enabled={true}
          />
          <SettingToggle
            label="AI Insights"
            description="Get notified when AI insights are generated"
            enabled={true}
          />
          <SettingToggle
            label="Market Analysis"
            description="Daily market analysis notifications"
            enabled={false}
          />
          <SettingToggle
            label="Usage Alerts"
            description="Alert when approaching monthly limits"
            enabled={true}
          />
        </div>
      </div>

      {/* Top-Up Links */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Top-Up AGNTCBRO
        </h2>
        <div className="space-y-3">
          <TopUpLink
            label="Buy on Pump.fun"
            url="https://pump.fun/coin/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
            description="Purchase additional AGNTCBRO tokens"
          />
          <TopUpLink
            label="Buy on Raydium"
            url="https://raydium.io"
            description="Trade on Solana DEX"
          />
          <TopUpLink
            label="Check Balance"
            url="#"
            description="View your current token holdings"
          />
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Account Actions
        </h2>
        <div className="space-y-3">
          <ActionButton
            label="Refresh Token Balance"
            description="Sync your wallet balance from blockchain"
          />
          <ActionButton
            label="Re-verify Holder Tier"
            description="Re-check your tier eligibility"
          />
          <ActionButton
            label="Export Usage History"
            description="Download CSV of all usage records"
          />
        </div>
      </div>
    </div>
  );
}

function SettingToggle({ label, description, enabled }: {
  label: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-purple-500/10">
      <div>
        <h4 className="font-semibold text-white">{label}</h4>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      <button
        className={`w-12 h-6 rounded-full transition-colors ${
          enabled ? 'bg-purple-600' : 'bg-gray-700'
        }`}
        onClick={() => {/* Toggle would update state */}}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function TopUpLink({ label, url, description }: {
  label: string;
  url: string;
  description: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-purple-900/30 rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
    >
      <h4 className="font-semibold text-white mb-1">{label}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </a>
  );
}

function ActionButton({ label, description }: {
  label: string;
  description: string;
}) {
  return (
    <button className="w-full text-left bg-purple-900/30 rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-900/40 transition-all">
      <h4 className="font-semibold text-white mb-1">{label}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </button>
  );
}