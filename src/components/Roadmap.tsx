/**
 * Roadmap Page
 *
 * Product Roadmap 2026–2027 based on v1.0 roadmap document
 */

function Roadmap({ onBack }: { onBack: () => void }) {
  const phases = [
    {
      number: '1',
      title: 'Foundation',
      period: 'Q2 2026',
      color: 'green',
      metrics: [
        { value: '500', label: 'Active Users' },
        { value: '50+', label: 'Daily Signals' },
        { value: '60%+', label: 'Bot Accuracy' },
        { value: '100', label: 'Token Holders' },
      ],
      sections: [
        {
          title: 'Core Platform',
          items: [
            { done: true, text: 'Website Launch: agenticbro.app' },
            { done: true, text: 'Dashboard: Signal feed, trade analysis, alert feed' },
            { done: true, text: 'Daily Market Report: Prices, liquidation levels, AI insights' },
            { done: true, text: 'Value Proposition Page: Full feature breakdown' },
            { done: false, text: 'Wallet Integration: Solana wallet (Phantom, Solflare)' },
            { done: false, text: 'Token Gating: Holder / Whale tier validation' },
          ],
        },
        {
          title: 'Trading Services',
          items: [
            { done: false, text: 'Market Analysis: 30-min updates, 5 assets' },
            { done: true, text: 'BTC Signals: Real-time signals + AI insights' },
            { done: true, text: 'ETH Signals: Including ETHB ETF context' },
            { done: true, text: 'SOL Signals: Alpenglow upgrade tracking' },
            { done: true, text: 'BNB Signals: Exchange token focus' },
            { done: true, text: 'XRP Signals: Regulatory case tracking' },
            { done: false, text: 'AI Insights: News + macro + events, 15-min updates' },
            { done: false, text: 'Market Impact: Correlation analysis' },
          ],
        },
      ],
    },
    {
      number: '2',
      title: 'Growth',
      period: 'Q3 2026',
      color: 'blue',
      metrics: [
        { value: '1K–5K', label: 'Active Users' },
        { value: '500+', label: 'Daily Signals' },
        { value: '65%+', label: 'Bot Accuracy' },
        { value: '2', label: 'Wallet Integrations' },
      ],
      sections: [
        {
          title: 'Platform Features',
          items: [
            { done: false, text: 'Portfolio Health Score (30-point scoring system)' },
            { done: false, text: 'Bot Status Dashboard' },
            { done: false, text: 'Custom Alert Configuration' },
            { done: false, text: 'Historical Signal Performance' },
            { done: false, text: 'Mobile App (iOS / Android)' },
          ],
        },
        {
          title: 'Trading Services Enhancement',
          items: [
            { done: false, text: 'Market Analysis: Volatility metrics + regime detection' },
            { done: false, text: 'Asset Signals: Expand to MATIC, AVAX, DOT, ATOM' },
            { done: false, text: 'AI Insights: User preference filtering' },
            { done: false, text: 'Market Impact: Include L2s and DeFi protocols' },
          ],
        },
      ],
    },
    {
      number: '3',
      title: 'Expansion',
      period: 'Q4 2026',
      color: 'purple',
      metrics: [
        { value: '10K–50K', label: 'Active Users' },
        { value: '5,000+', label: 'Daily Signals' },
        { value: '70%+', label: 'Bot Accuracy' },
        { value: '3', label: 'Exchanges' },
      ],
      sections: [
        {
          title: 'Advanced Features',
          items: [
            { done: false, text: 'Multi-Exchange Integration (Binance, Coinbase, Bybit)' },
            { done: false, text: 'Advanced Risk Analytics: VaR, stress testing, Monte Carlo' },
            { done: false, text: 'Social Sentiment Index: Twitter/X, Reddit, Telegram' },
            { done: false, text: 'On-Chain Analytics: DEX flows + whale tracking' },
            { done: false, text: 'Cross-Chain Arbitrage Detection' },
          ],
        },
      ],
    },
    {
      number: '4',
      title: 'Ecosystem',
      period: '2027+',
      color: 'yellow',
      metrics: [
        { value: '100K+', label: 'Active Users' },
        { value: '50K+', label: 'Daily Signals' },
        { value: '75%+', label: 'Bot Accuracy' },
        { value: '10+', label: 'Chains' },
      ],
      sections: [
        {
          title: 'AI & Machine Learning',
          items: [
            { done: false, text: 'ML Signal Generation: Pattern recognition across historical data' },
            { done: false, text: 'Natural Language Processing: News + social sentiment parsing' },
            { done: false, text: 'Time Series Forecasting: Multi-horizon price prediction' },
            { done: false, text: 'Anomaly Detection: Real-time outlier flagging' },
            { done: false, text: 'Automated Trading: Closed-loop execution with risk controls' },
          ],
        },
      ],
    },
  ];

  const tokenParams = [
    { param: 'Token Symbol', value: 'AGNTCBRO' },
    { param: 'Total Supply', value: '1,000,000,000' },
    { param: 'Burn Model', value: 'Burn-on-use' },
    { param: 'Free Tier', value: '0 tokens required' },
    { param: 'Holder Tier', value: '10,000 AGNTCBRO' },
    { param: 'Whale Tier', value: '100,000 AGNTCBRO' },
  ];

  const tokenUtility = [
    { utility: 'Staking Rewards', description: 'Earn yield by locking AGNTCBRO' },
    { utility: 'Governance', description: 'Vote on feature prioritization and upgrades' },
    { utility: 'Fee Discounts', description: 'Reduced fees for high-volume signal consumers' },
    { utility: 'Early Access', description: 'Priority access to beta features and new signal types' },
    { utility: 'Airdrop Eligibility', description: 'Holders qualify for partner protocol airdrops' },
  ];

  const milestones = {
    nearTerm: [
      { milestone: 'Complete token gating implementation', target: 'Q2 2026' },
      { milestone: 'Launch API access for Whale tier', target: 'Q2 2026' },
      { milestone: 'Deploy mobile app (iOS / Android)', target: 'Q3 2026' },
      { milestone: 'Integrate with 2 major wallets', target: 'Q3 2026' },
      { milestone: 'Reach 1,000 active users', target: 'Q3 2026' },
    ],
    midTerm: [
      'Multi-exchange integration',
      'Advanced risk analytics',
      'On-chain analytics',
      'Institutional dashboard beta',
      'Reach 10,000 active users',
    ],
    longTerm: [
      'ML-powered signal generation',
      'Cross-chain support (10+ chains)',
      'DeFi protocol integration (5+ protocols)',
      'DAO governance launch',
      'Reach 100,000 active users',
    ],
  };

  const colorMap: Record<string, string> = {
    green: 'border-green-500/40 bg-green-900/10',
    blue: 'border-blue-500/40 bg-blue-900/10',
    purple: 'border-purple-500/40 bg-purple-900/10',
    yellow: 'border-yellow-500/40 bg-yellow-900/10',
  };

  const badgeMap: Record<string, string> = {
    green: 'bg-green-500/20 text-green-300',
    blue: 'bg-blue-500/20 text-blue-300',
    purple: 'bg-purple-500/20 text-purple-300',
    yellow: 'bg-yellow-500/20 text-yellow-300',
  };

  return (
    <div className="min-h-screen">
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
            <div className="text-sm font-mono text-purple-400 mb-2 tracking-widest uppercase">
              Version 1.0 · March 14, 2026 · Active Development
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Product Roadmap</h1>
            <p className="text-xl text-purple-300 max-w-3xl mx-auto mb-8">
              2026 – 2027 · Four strategic phases targeting 100,000+ active users, 50,000+ daily signals, and 75%+ bot accuracy
            </p>
            <p className="text-lg text-gray-300 italic max-w-2xl mx-auto">
              "Agentic Bro tells you where your trading sucks — and how to fix it."
            </p>
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-4 mt-10 max-w-2xl mx-auto">
              {[
                { value: '4', label: 'Dev Phases' },
                { value: '1B', label: 'AGNTCBRO Supply' },
                { value: '3', label: 'Token Tiers' },
                { value: '75%+', label: 'Target Accuracy' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-black/30 rounded-xl p-4 border border-purple-500/30">
                  <div className="text-2xl font-bold text-purple-300">{stat.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-6 pb-20">

        {/* Phases */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Development Phases</h2>
          <div className="space-y-8">
            {phases.map((phase) => (
              <div key={phase.number} className={`rounded-2xl border p-8 ${colorMap[phase.color]}`}>
                {/* Phase header */}
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className={`text-xs font-bold px-3 py-1 rounded-full ${badgeMap[phase.color]}`}>
                    Phase {phase.number}
                  </div>
                  <h3 className="text-2xl font-bold text-white">{phase.title}</h3>
                  <span className="text-gray-400 font-mono text-sm">{phase.period}</span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {phase.metrics.map((m, idx) => (
                    <div key={idx} className="bg-black/30 rounded-xl p-4 text-center">
                      <div className="text-xl font-bold text-white">{m.value}</div>
                      <div className="text-xs text-gray-400 mt-1">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Sections */}
                <div className="grid md:grid-cols-2 gap-6">
                  {phase.sections.map((section, sidx) => (
                    <div key={sidx}>
                      <h4 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-3">
                        {section.title}
                      </h4>
                      <ul className="space-y-2">
                        {section.items.map((item, iidx) => (
                          <li key={iidx} className="flex items-start gap-2 text-sm">
                            <span className={item.done ? 'text-green-400 mt-0.5' : 'text-gray-500 mt-0.5'}>
                              {item.done ? '✓' : '○'}
                            </span>
                            <span className={item.done ? 'text-gray-200' : 'text-gray-400'}>
                              {item.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Token Economics */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Token Economics</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Parameters */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-purple-500/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-purple-500/20">
                <h3 className="text-lg font-bold text-white">Parameters</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {tokenParams.map((row, idx) => (
                    <tr key={idx} className="border-b border-purple-500/10">
                      <td className="px-6 py-3 text-sm text-gray-400">{row.param}</td>
                      <td className="px-6 py-3 text-sm text-white font-semibold">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Utility */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-purple-500/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-purple-500/20">
                <h3 className="text-lg font-bold text-white">Phase 2 Token Utility</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {tokenUtility.map((row, idx) => (
                    <tr key={idx} className="border-b border-purple-500/10">
                      <td className="px-6 py-3 text-sm text-purple-300 font-semibold whitespace-nowrap">{row.utility}</td>
                      <td className="px-6 py-3 text-sm text-gray-300">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Milestones */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Key Milestones</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Near-term */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-green-500/30 p-6">
              <h3 className="text-lg font-bold text-green-300 mb-4">Near-Term · 3–6 Months</h3>
              <div className="space-y-3">
                {milestones.nearTerm.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5 text-xs">▹</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-200">{m.milestone}</p>
                      <p className="text-xs text-green-400 font-mono mt-0.5">{m.target}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Mid-term */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
              <h3 className="text-lg font-bold text-blue-300 mb-4">Mid-Term · 6–12 Months</h3>
              <ul className="space-y-3">
                {milestones.midTerm.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="text-blue-400 mt-0.5 text-xs">▹</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
            {/* Long-term */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-yellow-500/30 p-6">
              <h3 className="text-lg font-bold text-yellow-300 mb-4">Long-Term · 12–24 Months</h3>
              <ul className="space-y-3">
                {milestones.longTerm.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="text-yellow-400 mt-0.5 text-xs">▹</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-12">
          <p className="text-sm text-gray-500 mb-6 font-mono">
            Built for degens, by degens · agenticbro.app · @AgenticBro11 · t.me/Agenticbro1
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
        <p>Built for degens, by degens · <a href="https://twitter.com/AgenticBro" className="text-purple-400 hover:text-purple-300">@AgenticBro</a></p>
      </footer>
    </div>
  );
}

export default Roadmap;
