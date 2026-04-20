/**
 * Roadmap Page - Scam Detection Focus
 *
 * Product Roadmap 2026–2027
 * Focus: AI-Powered Scam Detection for Crypto Users
 */

function Roadmap({ onBack }: { onBack: () => void }) {
  const phases = [
    {
      number: '1',
      title: 'Scam Detection Foundation',
      period: 'Q2 2026',
      color: 'green',
      metrics: [
        { value: '547+', label: 'Scans Completed' },
        { value: '5,000+', label: 'Users Protected' },
        { value: '$125K+', label: '$SOL Protected' },
        { value: '500+', label: 'Known Scammers' },
        { value: '12+', label: 'Scammers Detected' },
        { value: '10', label: 'Red Flag Types' },
      ],
      sections: [
        {
          title: 'Core Scam Detection',
          items: [
            { done: true, text: 'Website Launch: agenticbro.app' },
            { done: true, text: 'Dashboard: Signal feed, trade analysis, alert feed' },
            { done: true, text: 'Daily Market Report: Prices, liquidation levels, AI insights' },
            { done: true, text: 'Value Proposition Page: Full feature breakdown' },
            { done: true, text: 'Scam Detection System: AI-powered risk assessment for X/Telegram' },
            { done: true, text: 'Gem Advisor Framework: Quality-gated alpha channel analysis' },
            { done: true, text: 'Enhanced Priority Scan: 4 modes (Wallet, Channel, Token, Scam)' },
            { done: true, text: 'Free Scan Limit: Free tier: 5 scans per user' },
            { done: false, text: 'Wallet Integration: Solana wallet (Phantom, Solflare)' },
            { done: false, text: 'Token Gating: Holder / Whale tier validation' },
          ],
        },
        {
          title: 'Detection Capabilities',
          items: [
            { done: true, text: 'Guaranteed Returns Detection: +15 pts weight' },
            { done: true, text: 'Private Alpha Scams: +15 pts weight' },
            { done: true, text: 'Unrealistic Claims Detection: +15 pts weight' },
            { done: true, text: 'Urgency Tactics Detection: +10 pts weight' },
            { done: true, text: 'No Track Record Detection: +10 pts weight' },
            { done: true, text: 'Crypto Request Scams: +10 pts weight' },
            { done: true, text: 'Paid Promoter Detection: +15 pts weight' },
            { done: false, text: 'Deepfake Detection: AI-generated profile images' },
            { done: false, text: 'Multi-Language Analysis: Non-English scam patterns' },
          ],
        },
        {
          title: 'Platform Infrastructure',
          items: [
            { done: true, text: 'Website: agenticbro.app live' },
            { done: true, text: 'Payment System: Stripe + USDC + AGNTCBRO' },
            { done: true, text: 'Credit System: 3 free scans per user' },
            { done: true, text: 'Tier System: Holder (10K) and Whale (100K) tiers' },
            { done: true, text: 'DePIN Infrastructure: Mac Studio nodes for local inference' },
            { done: false, text: 'Browser Extension: Chrome/Firefox scam warnings' },
            { done: false, text: 'Mobile App: iOS/Android on-device scanning' },
          ],
        },
      ],
    },
    {
      number: '2',
      title: 'Advanced Detection & Alerts',
      period: 'Q3 2026',
      color: 'blue',
      metrics: [
        { value: '10K+', label: 'Active Users' },
        { value: '50+', label: 'Daily Scans' },
        { value: '$1M+', label: '$SOL Protected' },
        { value: '1000+', label: 'Known Scammers' },
      ],
      sections: [
        {
          title: 'Real-Time Protection',
          items: [
            { done: false, text: 'Browser Extension: Real-time X/Twitter warnings' },
            { done: false, text: 'Telegram Bot: In-channel scam detection' },
            { done: false, text: 'Wallet Integration: Phantom/Solflare alerts' },
            { done: false, text: 'Push Notifications: New scam alerts' },
            { done: false, text: 'Email Digest: Weekly scam report' },
          ],
        },
        {
          title: 'Advanced Analytics',
          items: [
            { done: false, text: 'Wallet Forensics: Transaction pattern analysis' },
            { done: false, text: 'Deepfake Detection: AI-generated content flags' },
            { done: false, text: 'Multi-Chain Support: Ethereum, BSC, Base' },
            { done: false, text: 'Historical Scam Data: Trend analysis' },
            { done: false, text: 'Risk Heat Maps: Visual threat intelligence' },
          ],
        },
        {
          title: 'Community Protection',
          items: [
            { done: false, text: 'Community Warnings: Telegram group alerts' },
            { done: false, text: 'Scam Reporter: User submission system' },
            { done: false, text: 'Reputation System: Trusted reporter badges' },
            { done: false, text: 'Victim Support: Recovery guidance resources' },
          ],
        },
      ],
    },
    {
      number: '3',
      title: 'AI & Machine Learning',
      period: 'Q4 2026',
      color: 'purple',
      metrics: [
        { value: '50K+', label: 'Active Users' },
        { value: '500+', label: 'Daily Scans' },
        { value: '$10M+', label: '$SOL Protected' },
        { value: '5000+', label: 'Known Scammers' },
      ],
      sections: [
        {
          title: 'AI Enhancement',
          items: [
            { done: false, text: 'ML Risk Model: Pattern recognition across scams' },
            { done: false, text: 'NLP Analysis: Bio/tweet sentiment scoring' },
            { done: false, text: 'Image Analysis: Fake profile picture detection' },
            { done: false, text: 'Behavioral Analysis: Account age + activity patterns' },
            { done: false, text: 'Cross-Platform Correlation: X + Telegram + Discord' },
          ],
        },
        {
          title: 'Enterprise Features',
          items: [
            { done: false, text: 'API Access: Enterprise scan quotas' },
            { done: false, text: 'Custom Rules: Organization-specific detection' },
            { done: false, text: 'White-Label: Branded scam detection' },
            { done: false, text: 'Audit Reports: Compliance documentation' },
          ],
        },
      ],
    },
    {
      number: '4',
      title: 'Ecosystem Expansion',
      period: '2027+',
      color: 'yellow',
      metrics: [
        { value: '100K+', label: 'Active Users' },
        { value: '5K+', label: 'Daily Scans' },
        { value: '$50M+', label: '$SOL Protected' },
        { value: '50K+', label: 'Known Scammers' },
      ],
      sections: [
        {
          title: 'Cross-Chain & Platform',
          items: [
            { done: false, text: 'Multi-Chain: 10+ blockchain support' },
            { done: false, text: 'NFT Scam Detection: Fake collection warnings' },
            { done: false, text: 'DeFi Protection: Rug pull detection' },
            { done: false, text: 'Social Media: Instagram/TikTok scams' },
            { done: false, text: 'Job Scams: Employment fraud detection' },
          ],
        },
        {
          title: 'AI Safety Layer',
          items: [
            { done: false, text: 'Romance Scam Detection: Relationship fraud' },
            { done: false, text: 'Deepfake Detection: AI video/image verification' },
            { done: false, text: 'Phishing Protection: Website risk scoring' },
            { done: false, text: 'AI Agent Safety: Protection from malicious agents' },
          ],
        },
      ],
    },
  ];

  const tokenParams = [
    { param: 'Token Symbol', value: 'JEEEVS' },
    { param: 'Total Supply', value: '1,000,000,000' },
    { param: 'Standard', value: 'Token-2022' },
    { param: 'Free Tier', value: '3 scans (no token required)' },
    { param: 'Holder Tier', value: '20 free scans/month' },
    { param: 'Whale Tier', value: 'Unlimited scans + API access' },
  ];

  const tokenUtility = [
    { utility: 'Scam Protection', description: 'Token-gated access to premium features' },
    { utility: 'Staking Rewards', description: 'Earn yield by locking JEEEVS' },
    { utility: 'Governance', description: 'Vote on detection rules and priorities' },
    { utility: 'Fee Discounts', description: 'Reduced scan costs for holders' },
    { utility: 'Early Access', description: 'Priority access to new detection features' },
    { utility: 'API Access', description: 'Enterprise integration for Whale tier' },
  ];

  const milestones = {
    nearTerm: [
      { milestone: 'Browser extension beta launch', target: 'Q2 2026' },
      { milestone: 'Wallet forensics integration', target: 'Q2 2026' },
      { milestone: 'Telegram bot scam detection', target: 'Q3 2026' },
      { milestone: 'Mobile app iOS beta', target: 'Q3 2026' },
      { milestone: 'Deepfake detection v1', target: 'Q3 2026' },
      { milestone: 'Multi-chain support (ETH, BSC)', target: 'Q4 2026' },
      { milestone: 'Enterprise API launch', target: 'Q4 2026' },
      { milestone: 'ML risk model training', target: 'Q4 2026' },
    ],
    midTerm: [
      'Browser extension full release',
      'Mobile app Android launch',
      'NFT scam detection',
      'DeFi rug pull detection',
      'Cross-platform correlation engine',
      'Community reputation system',
      'Victim recovery resources',
      'White-label enterprise offering',
    ],
    longTerm: [
      '10+ blockchain support',
      'AI safety layer for internet',
      'Romance scam detection',
      'Job scam detection',
      'Social media protection (Instagram, TikTok)',
      '100K+ active users',
    ],
  };

  const detectionStats = [
    { value: '10', label: 'Red Flag Types' },
    { value: '90', label: 'Max Points' },
    { value: '6', label: 'Verification Levels' },
    { value: '98%', label: 'Gross Margin' },
  ];

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
              AI-Powered Scam Detection · April 2026 · Active Development
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Scam Detection Roadmap</h1>
            <p className="text-xl text-purple-300 max-w-3xl mx-auto mb-8">
              Protecting crypto users from scams with AI-powered risk analysis. 10-point red flag system, real-time Chrome CDP scanning, and a growing database of known scammers.
            </p>
            <p className="text-lg text-gray-300 italic max-w-2xl mx-auto">
              "Scan first. Ape later." 🔐
            </p>
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-4 mt-10 max-w-4xl mx-auto">
              {detectionStats.map((stat, idx) => (
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

        {/* Red Flag System */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">10-Point Red Flag System</h2>
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8">
            <p className="text-gray-300 mb-6 text-center">
              Our weighted scoring system detects scams with 90 total possible points. Risk levels: LOW (0-3), MEDIUM (3-5), HIGH (5-7), CRITICAL (7-10).
            </p>
            <div className="grid md:grid-cols-5 gap-4">
              {[
                { flag: 'Guaranteed Returns', weight: '+15 pts', severity: 'HIGH' },
                { flag: 'Private Alpha/Giveaway', weight: '+15 pts', severity: 'HIGH' },
                { flag: 'Unrealistic Claims', weight: '+15 pts', severity: 'HIGH' },
                { flag: 'Urgency Tactics', weight: '+10 pts', severity: 'MEDIUM' },
                { flag: 'No Track Record', weight: '+10 pts', severity: 'MEDIUM' },
                { flag: 'Requests Crypto', weight: '+10 pts', severity: 'MEDIUM' },
                { flag: 'No Verification', weight: '+5 pts', severity: 'LOW' },
                { flag: 'Fake Followers', weight: '+5 pts', severity: 'LOW' },
                { flag: 'New Account', weight: '+3 pts', severity: 'LOW' },
                { flag: 'VIP Upsell', weight: '+2 pts', severity: 'LOW' },
              ].map((item, idx) => (
                <div key={idx} className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-sm text-white font-semibold">{item.flag}</div>
                  <div className="text-lg font-bold text-red-400 mt-1">{item.weight}</div>
                  <div className={`text-xs mt-1 ${item.severity === 'HIGH' ? 'text-red-400' : item.severity === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'}`}>
                    {item.severity}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                <span className="text-purple-300 font-semibold">Verification Levels:</span>{' '}
                UNVERIFIED → PARTIALLY VERIFIED → VERIFIED → LEGITIMATE → PAID PROMOTER → HIGH RISK
              </p>
            </div>
          </div>
        </section>

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
                <div className="grid md:grid-cols-3 gap-6">
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
          <h2 className="text-3xl font-bold text-white mb-10 text-center">$JEEEVS Token Economics</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Parameters */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-purple-500/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-purple-500/20">
                <h3 className="text-lg font-bold text-white">Token Parameters</h3>
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
                <h3 className="text-lg font-bold text-white">Token Utility</h3>
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
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              <span className="text-green-400 font-semibold">30% Burn:</span> 30% of JEEEVS payments are burned, creating deflationary pressure.
            </p>
          </div>
        </section>

        {/* DePIN Infrastructure */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">DePIN Infrastructure</h2>
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-purple-300 mb-4">Why DePIN?</h3>
                <ul className="space-y-3">
                  {[
                    { title: 'Sovereign Inference', desc: 'Mac Studio nodes run local AI models' },
                    { title: 'Zero Marginal Cost', desc: 'Electricity-only cost after hardware' },
                    { title: 'No Rate Limits', desc: 'Own the hardware, own the limits' },
                    { title: 'Data Privacy', desc: 'Scans never leave your node' },
                    { title: '98% Gross Margin', desc: 'Fixed hardware, near-zero marginal cost' },
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <div>
                        <div className="text-white font-semibold">{item.title}</div>
                        <div className="text-sm text-gray-400">{item.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold text-purple-300 mb-4">Competitive Advantage</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-purple-500/30">
                      <th className="text-left py-2 text-gray-400">Layer</th>
                      <th className="text-left py-2 text-gray-400">Traditional AI-Crypto</th>
                      <th className="text-left py-2 text-purple-300">Jeeevs</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-purple-500/10">
                      <td className="py-2">Inference</td>
                      <td className="py-2">Cloud API</td>
                      <td className="py-2 text-green-400">Mac Studio local</td>
                    </tr>
                    <tr className="border-b border-purple-500/10">
                      <td className="py-2">Cost</td>
                      <td className="py-2">$0.02/query</td>
                      <td className="py-2 text-green-400">$0.001/query</td>
                    </tr>
                    <tr className="border-b border-purple-500/10">
                      <td className="py-2">Rate Limits</td>
                      <td className="py-2">Yes (tiered)</td>
                      <td className="py-2 text-green-400">No (own hardware)</td>
                    </tr>
                    <tr className="border-b border-purple-500/10">
                      <td className="py-2">Data Privacy</td>
                      <td className="py-2">Third-party</td>
                      <td className="py-2 text-green-400">Sovereign (local)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
            Protecting crypto users since 2026 · agenticbro.app · @AgenticBro1 · t.me/Agenticbro1
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
        <p>Scam Detection Platform · April 2026 · Built for crypto users, by crypto users · <a href="https://twitter.com/AgenticBro" className="text-purple-400 hover:text-purple-300">@AgenticBro</a></p>
      </footer>
    </div>
  );
}

export default Roadmap;