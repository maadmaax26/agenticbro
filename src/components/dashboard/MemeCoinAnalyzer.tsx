import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Zap, Filter, RefreshCw } from 'lucide-react';

interface MemeCoin {
  ticker: string;
  edge: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  mentions: number;
  engagement: number;
  sentiment_trend: 'improving' | 'degrading' | 'stable';
  risk: 'HIGH_RISK' | 'MODERATE_RISK' | 'LOW_RISK';
  red_flags: string[];
  is_new: boolean;
  market_cap: string;
  volume: string;
  age: string;
  holders: number;
  contract?: string;
}

interface MemeCoinsResponse {
  coins: MemeCoin[];
  summary: {
    totalCoins: number;
    filteredCount: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    newCoins: number;
    avgEdgeScore: number;
    generatedAt: string;
  };
  mock: boolean;
  ts: number;
}

export default function MemeCoinAnalyzer() {
  const [filterMode, setFilterMode] = useState<'all' | 'high' | 'medium' | 'low' | 'new'>('all');
  const [sortBy, setSortBy] = useState<'edge' | 'mentions' | 'engagement'>('edge');
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<MemeCoinsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch meme coins from API
  const fetchMemeCoins = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/telegram/meme-coins?filter=${filterMode}&sortBy=${sortBy}`);
      if (!response.ok) {
        throw new Error('Failed to fetch meme coins');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch meme coins:', err);
      setError('Failed to load meme coin data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load data on mount and when filter/sort changes
  useEffect(() => {
    fetchMemeCoins();
  }, [filterMode, sortBy]);

  const handleRefresh = async () => {
    await fetchMemeCoins();
  };

  // Use data from API or empty array
  const coins = data?.coins || [];
  const summary = data?.summary;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH_RISK': return 'text-red-400';
      case 'MODERATE_RISK': return 'text-yellow-400';
      case 'LOW_RISK': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getSentimentIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'degrading': return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'stable': return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-3xl">🎰</span>
              Meme Coin Analyzer
            </h2>
            <p className="text-gray-400">
              AI-powered analysis of emerging meme coin opportunities — ranked by edge score
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/20">
            <p className="text-xs text-gray-400 mb-1">Total Coins</p>
            <p className="text-2xl font-bold text-purple-300">{summary?.totalCoins ?? 0}</p>
          </div>
          <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/20">
            <p className="text-xs text-gray-400 mb-1">High Confidence</p>
            <p className="text-2xl font-bold text-green-300">{summary?.highConfidence ?? 0}</p>
          </div>
          <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-500/20">
            <p className="text-xs text-gray-400 mb-1">Medium Confidence</p>
            <p className="text-2xl font-bold text-yellow-300">{summary?.mediumConfidence ?? 0}</p>
          </div>
          <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/20">
            <p className="text-xs text-gray-400 mb-1">High Risk</p>
            <p className="text-2xl font-bold text-red-300">{coins.filter(c => c.risk === 'HIGH_RISK').length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterButton
            active={filterMode === 'all'}
            onClick={() => setFilterMode('all')}
            icon={<Filter />}
            label="All"
          />
          <FilterButton
            active={filterMode === 'high'}
            onClick={() => setFilterMode('high')}
            icon={<CheckCircle />}
            label="High Edge"
            color="green"
          />
          <FilterButton
            active={filterMode === 'medium'}
            onClick={() => setFilterMode('medium')}
            icon={<Clock />}
            label="Medium Edge"
            color="yellow"
          />
          <FilterButton
            active={filterMode === 'low'}
            onClick={() => setFilterMode('low')}
            icon={<AlertTriangle />}
            label="Low Edge"
            color="red"
          />
          <FilterButton
            active={filterMode === 'new'}
            onClick={() => setFilterMode('new')}
            icon={<Zap />}
            label="⚡ New"
            color="purple"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-purple-900/20 border border-purple-500/30 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            <option value="edge">Edge Score</option>
            <option value="mentions">Mentions</option>
            <option value="engagement">Engagement</option>
          </select>
        </div>
      </div>

      {/* Coin List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-8 text-center">
            <div className="text-gray-400">Loading meme coin data...</div>
          </div>
        ) : error ? (
          <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </p>
          </div>
        ) : coins.length === 0 ? (
          <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-8 text-center">
            <p className="text-gray-400">No meme coins match the current filter.</p>
          </div>
        ) : (
          coins.map((coin) => (
          <div
            key={coin.ticker}
            className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 overflow-hidden"
          >
            {/* Coin Header */}
            <div
              className="p-5 cursor-pointer hover:bg-purple-900/10 transition-colors"
              onClick={() => setExpandedCoin(expandedCoin === coin.ticker ? null : coin.ticker)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl font-bold text-white">
                    {coin.ticker.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold text-white">{coin.ticker}</span>
                      {coin.is_new && (
                        <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/50 text-purple-300 text-xs font-bold rounded-full">
                          ⚡ NEW
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span>Edge: <span className="font-bold text-purple-300">{coin.edge.toFixed(2)}</span></span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold border" style={getConfidenceStyle(coin.confidence)}>
                        {coin.confidence}
                      </span>
                      <span className={`flex items-center gap-1 ${getRiskColor(coin.risk)}`}>
                        {getSentimentIcon(coin.sentiment_trend)}
                        {coin.sentiment_trend}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-1">
                    Mentions: <span className="font-bold text-white">{coin.mentions}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Eng: <span className="font-bold text-white">{coin.engagement.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedCoin === coin.ticker && (
              <div className="border-t border-purple-500/20 p-5 bg-purple-900/10">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Market Data</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-black/30 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Market Cap</p>
                          <p className="font-bold text-white">{coin.market_cap}</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Volume</p>
                          <p className="font-bold text-white">{coin.volume}</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Age</p>
                          <p className="font-bold text-white">{coin.age}</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Holders</p>
                          <p className="font-bold text-white">{coin.holders}</p>
                        </div>
                      </div>
                    </div>

                    {coin.contract && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Contract Address</p>
                        <div className="bg-black/30 rounded-lg p-3">
                          <p className="font-mono text-xs text-purple-300 break-all">{coin.contract}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Risk Assessment</p>
                      <div className="bg-black/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Risk Level</span>
                          <span className={`font-bold ${getRiskColor(coin.risk)}`}>
                            {coin.risk.replace('_', ' ')}
                          </span>
                        </div>
                        {coin.red_flags.length > 0 ? (
                          <div className="space-y-1">
                            {coin.red_flags.map((flag, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                <span className="text-red-300">{flag}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-green-300">
                            <CheckCircle className="w-4 h-4" />
                            <span>No red flags detected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-2">Recommendation</p>
                      <div className={`rounded-lg p-4 ${coin.edge >= 0.70 ? 'bg-green-900/20 border border-green-500/30' : coin.edge >= 0.50 ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                        {coin.edge >= 0.70 && (
                          <div className="text-sm">
                            <p className="font-bold text-green-300 mb-1">✅ Strong Buy Signal</p>
                            <p className="text-gray-400">High edge score with improving sentiment. Consider entry.</p>
                          </div>
                        )}
                        {coin.edge >= 0.50 && coin.edge < 0.70 && (
                          <div className="text-sm">
                            <p className="font-bold text-yellow-300 mb-1">⚠️ Moderate Signal</p>
                            <p className="text-gray-400">Decent edge but has some red flags. Proceed with caution.</p>
                          </div>
                        )}
                        {coin.edge < 0.50 && (
                          <div className="text-sm">
                            <p className="font-bold text-red-300 mb-1">❌ Low Signal</p>
                            <p className="text-gray-400">Low edge with multiple red flags. Skip this play.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )))}
      </div>

      {/* Disclaimer */}
      <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4">
        <p className="text-sm text-gray-400 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong className="text-red-400">Warning:</strong> Meme coin trading is extremely high risk. 90%+ fail within 90 days. Never invest more than you can afford to lose. Always do your own research (DYOR) and verify contract addresses on-chain.
          </span>
        </p>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  icon,
  label,
  color
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color?: string;
}) {
  const colorStyles = color === 'green' ? 'bg-green-500/20 border-green-500 text-green-300' :
                     color === 'yellow' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300' :
                     color === 'red' ? 'bg-red-500/20 border-red-500 text-red-300' :
                     color === 'purple' ? 'bg-purple-500/20 border-purple-500 text-purple-300' :
                     'bg-gray-500/20 border-gray-500 text-gray-300';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
        active ? colorStyles : 'bg-black/30 text-gray-400 hover:bg-black/50 border-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function getConfidenceStyle(confidence: string) {
  switch (confidence) {
    case 'HIGH':
      return { background: 'rgba(34, 197, 94, 0.2)', borderColor: 'rgba(34, 197, 94, 0.6)', color: '#4ade80' };
    case 'MEDIUM':
      return { background: 'rgba(234, 179, 8, 0.2)', borderColor: 'rgba(234, 179, 8, 0.6)', color: '#facc15' };
    case 'LOW':
      return { background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.6)', color: '#f87171' };
    default:
      return { background: 'rgba(107, 114, 128, 0.2)', borderColor: 'rgba(107, 114, 128, 0.6)', color: '#9ca3af' };
  }
}