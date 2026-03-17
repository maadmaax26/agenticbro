/**
 * Value Proposition Page
 *
 * Comprehensive overview of Agentic Bro's value proposition,
 * long-term benefits, and competitive advantages
 */

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
}

interface Asset {
  name: string;
  symbol: string;
  features: string[];
}

function ValueProposition({ onBack }: { onBack: () => void }) {
  const features: FeatureCard[] = [
    {
      icon: '🤖',
      title: 'Real-Time Intelligence',
      description: 'Signals from 4 actively trading bots (Hyperliquid, Kraken, MES, Polymarket) — not backtests',
    },
    {
      icon: '📊',
      title: 'Multi-Asset Coverage',
      description: 'BTC, ETH, SOL, BNB, XRP with prices, indicators, liquidation levels, and sentiment',
    },
    {
      icon: '🔒',
      title: 'Risk Management',
      description: 'Liquidation level tracking, risk scoring, stop-loss recommendations, portfolio health',
    },
    {
      icon: '🧠',
      title: 'AI-Enhanced Insights',
      description: 'News aggregation, macro events, upcoming upgrades — updated every 15 minutes',
    },
    {
      icon: '💰',
      title: 'Cost-Effective',
      description: 'Fractional cost of Bloomberg Terminal. One-time payment, no subscription',
    },
    {
      icon: '🔥',
      title: 'Deflationary Token',
      description: 'Tokens burned on use. Supply shrinks as adoption grows = value appreciation',
    },
  ];

  const bots = [
    { name: 'Hyperliquid Scalper', platform: 'Hyperliquid Perps', strategy: 'Scalping + Swing', status: '✅ Live' },
    { name: 'Kraken Grid Trader', platform: 'Kraken Spot', strategy: 'Grid Trading', status: '✅ Live' },
    { name: 'MES Options', platform: 'Interactive Brokers', strategy: 'Vertical/Credit Spreads', status: '🔄 Dev' },
    { name: 'Polymarket Bot', platform: 'Polygon/CTF', strategy: 'Prediction Markets', status: '✅ Live' },
  ];

  const assets: Asset[] = [
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      features: ['Spot + Futures + Options', 'Liquidation: $74K↑ / $69.7K↓ / $65K↓', 'Institutional accumulation'],
    },
    {
      name: 'Ethereum',
      symbol: 'ETH',
      features: ['Spot + Futures + Options + Staking', 'Liquidation: $2.15K↑ / $2.03K↑ / $1.95K↓', 'ETHB ETF launch'],
    },
    {
      name: 'Solana',
      symbol: 'SOL',
      features: ['Spot + Perps + DeFi', 'Alpenglow upgrade (H1 2026)', 'Developers + TVL growing'],
    },
    {
      name: 'Binance Coin',
      symbol: 'BNB',
      features: ['Spot + Exchange token', 'Binance dominance', 'Regulatory uncertainty'],
    },
    {
      name: 'Ripple',
      symbol: 'XRP',
      features: ['Spot + Cross-border payments', 'ISO 20022 adoption', 'Ripple vs SEC case'],
    },
  ];

  const benefits = [
    {
      title: 'Improved Win Rate',
      description: 'Real-time signals from actively trading bots with AI-enhanced rationale',
      icon: '🎯',
    },
    {
      title: 'Reduced Drawdowns',
      description: 'Risk scoring, stop-loss recommendations, liquidation tracking',
      icon: '📉',
    },
    {
      title: 'Time Savings',
      description: 'Automate research (news + macro + events). Save 5-10 hours/week',
      icon: '⏰',
    },
    {
      title: 'Asymmetric Information',
      description: 'Access to institutional-grade data at retail prices',
      icon: '🔐',
    },
  ];

  const competitiveAdvantages = [
    { feature: 'Data Source', us: 'Live bot trading', them: 'Backtests / historical' },
    { feature: 'Update Frequency', us: '30 min (signals), 15 min (AI)', them: 'Daily / weekly' },
    { feature: 'Liquidation Levels', us: 'Real-time', them: 'None' },
    { feature: 'Asset Coverage', us: '5 assets + cross-asset', them: 'Usually 1-2 assets' },
    { feature: 'Cost', us: '<$500 one-time', them: '$500-5,000/month' },
    { feature: 'Platform', us: 'Web + API', them: 'Usually web only' },
    { feature: 'Transparency', us: 'Real PnL, real win rates', them: 'Hidden performance' },
    { feature: 'Tokenomics', us: 'Deflationary (burn on use)', them: 'Subscription (recurring)' },
  ];

  const roadmap = [
    { phase: 'Q2 2026', items: ['Daily Market Report (live)', 'API Access (Whale tier)', 'Mobile app', 'Supabase integration'] },
    { phase: 'Q3 2026', items: ['Portfolio Health Score', 'Bot Status Dashboard', 'Custom Alerts', 'Historical Performance'] },
    { phase: 'Q4 2026', items: ['Multi-Exchange Integration', 'Advanced Risk Analytics', 'Social Sentiment Index', 'Institutional Dashboard'] },
    { phase: '2027+', items: ['AI Portfolio Optimization', 'On-chain Analytics', 'Cross-chain Arbitrage', 'ML Signal Generation'] },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <header className="relative z-10 p-6 backdrop-blur-sm bg-black/20">
        <div className="container mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors mb-4"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </button>

          <div className="text-center py-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              Why Agentic Bro?
            </h1>
            <p className="text-xl text-purple-300 max-w-3xl mx-auto">
              Institutional-grade trading intelligence at retail prices — powered by 4 actively trading bots
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-6 pb-20">
        {/* Core Features */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Core Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-colors">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Active Bots */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Actively Trading Bots</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {bots.map((bot, idx) => (
              <div key={idx} className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-green-500/30">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{bot.name}</h3>
                    <p className="text-sm text-gray-400">{bot.platform}</p>
                  </div>
                  <span className="text-sm text-green-400 font-semibold">{bot.status}</span>
                </div>
                <p className="text-purple-300">{bot.strategy}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 mt-4 italic">
            Real-time signals based on actual trading performance — not backtests
          </p>
        </section>

        {/* Multi-Asset Coverage */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Multi-Asset Coverage</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {assets.map((asset, idx) => (
              <div key={idx} className="bg-black/30 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30">
                <h3 className="text-lg font-bold text-white mb-1">{asset.name}</h3>
                <p className="text-xs text-purple-300 mb-3">{asset.symbol}</p>
                <ul className="space-y-1 text-xs text-gray-300">
                  {asset.features.map((feature, fidx) => (
                    <li key={fidx} className="flex items-start gap-1">
                      <span>•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits for Traders */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Benefits for Traders</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 flex gap-4">
                <div className="text-4xl">{benefit.icon}</div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{benefit.title}</h3>
                  <p className="text-gray-300">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Competitive Advantages */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Competitive Advantages</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-black/30 backdrop-blur-sm rounded-xl">
              <thead>
                <tr className="border-b border-purple-500/30">
                  <th className="p-4 text-left text-white font-semibold">Feature</th>
                  <th className="p-4 text-left text-purple-300 font-semibold">Agentic Bro</th>
                  <th className="p-4 text-left text-gray-400 font-semibold">Traditional Services</th>
                </tr>
              </thead>
              <tbody>
                {competitiveAdvantages.map((row, idx) => (
                  <tr key={idx} className="border-b border-purple-500/20 hover:bg-purple-900/10">
                    <td className="p-4 text-white">{row.feature}</td>
                    <td className="p-4 text-purple-300 font-semibold">{row.us}</td>
                    <td className="p-4 text-gray-400">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Roadmap */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Future Roadmap</h2>
          <div className="space-y-6">
            {roadmap.map((phase, idx) => (
              <div key={idx} className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-xl font-bold text-white mb-4">{phase.phase}</h3>
                <ul className="space-y-2">
                  {phase.items.map((item, iidx) => (
                    <li key={iidx} className="flex items-center gap-3 text-gray-300">
                      <span className="text-purple-400">▹</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Token Economics */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Token Economics</h2>
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-8 border border-purple-500/30 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <div className="text-4xl mb-2">💰</div>
                <h3 className="text-lg font-bold text-white mb-1">Holder Tier</h3>
                <p className="text-3xl font-bold text-purple-300">10K AGNTCBRO</p>
                <p className="text-sm text-gray-400 mt-2">Basic signals + market analysis</p>
                <a
                  href="https://agenticbro.app/holder"
                  className="mt-4 inline-block px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Get Holder Access →
                </a>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🐋</div>
                <h3 className="text-lg font-bold text-white mb-1">Whale Tier</h3>
                <p className="text-3xl font-bold text-purple-300">100K AGNTCBRO</p>
                <p className="text-sm text-gray-400 mt-2">Full access + API + bundle pricing</p>
                <a
                  href="https://agenticbro.app/whale"
                  className="mt-4 inline-block px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Get Whale Access →
                </a>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🔥</div>
                <h3 className="text-lg font-bold text-white mb-1">Burn on Use</h3>
                <p className="text-3xl font-bold text-purple-300">Deflationary</p>
                <p className="text-sm text-gray-400 mt-2">Supply shrinks as adoption grows</p>
              </div>
            </div>
            <div className="text-center text-gray-300">
              <p className="mb-4">
                <strong className="text-white">Model:</strong> Service usage → Tokens burned → Supply decreases → Value appreciates
              </p>
              <p className="text-sm">
                Tokens are sent to dead wallet after service use. As adoption grows, supply becomes scarce — creating natural price appreciation for holders.
              </p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center py-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-purple-300 mb-8">
            Join thousands of traders using Agentic Bro for institutional-grade intelligence
          </p>
          <button
            onClick={onBack}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg font-semibold transition-colors"
          >
            Back to Dashboard
          </button>
        </section>
      </main>

      <footer className="relative z-10 text-center p-4 text-sm text-gray-500">
        <p>Built for degens, by degens • <a href="https://twitter.com/AgenticBro" className="text-purple-400 hover:text-purple-300">@AgenticBro</a></p>
      </footer>
    </div>
  );
}

export default ValueProposition;