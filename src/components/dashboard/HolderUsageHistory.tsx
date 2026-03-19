import { History, Flame } from 'lucide-react';

interface UsageRecord {
  id: string;
  feature: string;
  timestamp: Date;
  tokensBurned: number;
}

export default function HolderUsageHistory() {
  // Mock data
  const usageHistory: UsageRecord[] = [
    {
      id: '1',
      feature: 'BTC Signal',
      timestamp: new Date(2026, 2, 19, 14, 30),
      tokensBurned: 10000,
    },
    {
      id: '2',
      feature: 'ETH Signal',
      timestamp: new Date(2026, 2, 19, 13, 45),
      tokensBurned: 10000,
    },
    {
      id: '3',
      feature: 'AI Insight',
      timestamp: new Date(2026, 2, 19, 12, 20),
      tokensBurned: 20000,
    },
    {
      id: '4',
      feature: 'Market Analysis',
      timestamp: new Date(2026, 2, 18, 16, 50),
      tokensBurned: 10000,
    },
    {
      id: '5',
      feature: 'Market Analysis',
      timestamp: new Date(2026, 2, 18, 14, 10),
      tokensBurned: 10000,
    },
  ];

  const totalBurned = usageHistory.reduce((sum, record) => sum + record.tokensBurned, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5" />
          Usage Summary
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-purple-900/30 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Total Tokens Burned</p>
            <p className="text-2xl font-bold text-purple-300">
              {totalBurned.toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-900/30 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Total Features Used</p>
            <p className="text-2xl font-bold text-purple-300">
              {usageHistory.length}
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Usage History
        </h2>
        <div className="space-y-3">
          {usageHistory.map(record => (
            <UsageRecordCard key={record.id} record={record} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageRecordCard({ record }: { record: UsageRecord }) {
  return (
    <div className="bg-black/30 rounded-xl border border-purple-500/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-white">{record.feature}</h4>
        <div className="text-right">
          <p className="text-sm text-gray-400">
            {record.timestamp.toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <p className="text-sm text-purple-300 font-semibold">
          {record.tokensBurned.toLocaleString()} AGNTCBRO
        </p>
      </div>
    </div>
  );
}