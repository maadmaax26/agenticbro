import { useState } from 'react';
import { Zap, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

type Asset = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'XRP';
type SignalType = 'entry' | 'exit' | 'alert';

interface Signal {
  id: string;
  asset: Asset;
  type: SignalType;
  timestamp: Date;
  price: number;
  message: string;
  tokensBurned?: number;
}

export default function HolderSignalFeed() {
  const [selectedAsset, setSelectedAsset] = useState<Asset | 'all'>('all');
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<Asset | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);

  const assets: Asset[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
  const allowances = {
    BTC: { used: 2, total: 5 },
    ETH: { used: 1, total: 5 },
    SOL: { used: 0, total: 5 },
    BNB: { used: 0, total: 5 },
    XRP: { used: 0, total: 5 },
  };

  const handleRequestSignal = (asset: Asset) => {
    setPendingAsset(asset);
    setShowBurnModal(true);
  };

  const confirmBurn = () => {
    if (!pendingAsset) return;

    // Simulate burn and signal generation
    const newSignal: Signal = {
      id: Date.now().toString(),
      asset: pendingAsset,
      type: 'entry',
      timestamp: new Date(),
      price: Math.random() * 10000 + 1000,
      message: `Momentum confirmed — entering ${pendingAsset} long position`,
      tokensBurned: 10000,
    };

    setSignals([newSignal, ...signals]);
    setShowBurnModal(false);
    setPendingAsset(null);
  };

  const filteredSignals = selectedAsset === 'all'
    ? signals
    : signals.filter(s => s.asset === selectedAsset);

  return (
    <div className="space-y-6">
      {/* Asset Selection */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Trading Signals
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <AssetButton
            active={selectedAsset === 'all'}
            onClick={() => setSelectedAsset('all')}
            label="All Signals"
          />
          {assets.map(asset => (
            <AssetButton
              key={asset}
              active={selectedAsset === asset}
              onClick={() => setSelectedAsset(asset)}
              label={asset}
              allowance={allowances[asset]}
            />
          ))}
        </div>
      </div>

      {/* Signal Requests */}
      {(selectedAsset === 'all' ? assets : [selectedAsset]).map(asset => (
        <div key={asset} className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">{asset} Signals</h3>
              <p className="text-sm text-gray-400">
                {allowances[asset].total - allowances[asset].used} of {allowances[asset].total} remaining this month
              </p>
            </div>
            <button
              onClick={() => handleRequestSignal(asset)}
              disabled={allowances[asset].used >= allowances[asset].total}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {allowances[asset].used >= allowances[asset].total ? 'Limit Reached' : 'Get Signal'}
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Cost: 10,000 AGNTCBRO per signal
          </p>
        </div>
      ))}

      {/* Signal Feed */}
      {filteredSignals.length > 0 && (
        <div className="space-y-4">
          {filteredSignals.map(signal => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {/* Burn Confirmation Modal */}
      {showBurnModal && pendingAsset && (
        <BurnModal
          asset={pendingAsset}
          cost={10000}
          onConfirm={confirmBurn}
          onCancel={() => {
            setShowBurnModal(false);
            setPendingAsset(null);
          }}
        />
      )}
    </div>
  );
}

function AssetButton({ active, onClick, label, allowance }: {
  active: boolean;
  onClick: () => void;
  label: string;
  allowance?: { used: number; total: number };
}) {
  const remaining = allowance ? allowance.total - allowance.used : 0;

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
        active
          ? 'bg-purple-600 text-white'
          : 'bg-black/30 text-gray-400 hover:bg-black/50'
      }`}
    >
      {label}
      {allowance && ` (${remaining}/${allowance.total})`}
    </button>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const getIcon = () => {
    switch (signal.type) {
      case 'entry': return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'exit': return <TrendingDown className="w-5 h-5 text-red-400" />;
      case 'alert': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-purple-500/20 p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getIcon()}
          <div>
            <h4 className="font-bold text-white">{signal.asset} {signal.type.toUpperCase()}</h4>
            <p className="text-sm text-gray-400">
              {signal.timestamp.toLocaleString()}
            </p>
          </div>
        </div>
        {signal.tokensBurned && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Tokens Burned</p>
            <p className="text-sm font-semibold text-purple-300">
              {signal.tokensBurned.toLocaleString()}
            </p>
          </div>
        )}
      </div>
      <p className="text-gray-300 mb-2">{signal.message}</p>
      {signal.price && (
        <p className="text-sm text-gray-400">
          Entry Price: ${signal.price.toLocaleString()}
        </p>
      )}
    </div>
  );
}

function BurnModal({ asset, cost, onConfirm, onCancel }: {
  asset: string;
  cost: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 rounded-2xl border border-purple-500/40 p-8 max-w-md w-full">
        <h3 className="text-2xl font-bold text-white mb-4">Confirm Token Burn</h3>
        <p className="text-gray-300 mb-6">
          Requesting {asset} signal will burn <span className="text-purple-300 font-bold">{cost.toLocaleString()} AGNTCBRO</span>.
        </p>
        <div className="bg-purple-900/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">Transaction Details</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-300">Feature:</span>
            <span className="text-white font-semibold">{asset} Signal</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-300">Cost:</span>
            <span className="text-purple-300 font-semibold">{cost.toLocaleString()} AGNTCBRO</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white font-semibold hover:bg-black/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors"
          >
            Confirm Burn
          </button>
        </div>
      </div>
    </div>
  );
}