/**
 * Value Proposition Page -- Why Agentic Bro
 * Focused on the hybrid AI trust ecosystem
 */

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  name: string;
}

function ValueProposition({ onBack }: { onBack: () => void }) {

  const coreStrengths: FeatureCard[] = [
    {
      name: 'profile-verifier',
      icon: '🔍',
      title: 'Profile Verifier Scanner',
      description: 'Instantly verify any social media profile across 6 platforms. Scan X (Twitter), Telegram, Discord, Instagram, TikTok, and YouTube accounts for bot activity, fake followers, and scam signals. First 5 scans free, then $1/scan.',
    },
    {
      name: 'token-impersonation',
      icon: '🪙',
      title: 'Token Impersonation Scanner',
      description: 'Protect yourself from fake tokens impersonating legitimate projects. Enter any contract address and identify copycat tokens, honeypots, and contract risk before you transact.',
    },
    {
      name: 'scam-detection',
      icon: '🛡',
      title: 'Trust Detection System',
      description: 'Deep-dive AI investigation into Telegram channels, X accounts, token projects, websites, and wallet behavior. Exposes coordinated risk before users or brands are harmed.',
    },
    {
      name: 'priority-scan',
      icon: '⚡',
      title: 'Priority Scan',
      description: 'Scan any wallet, Telegram channel, token address, social profile, phone number, or website for hidden risk signals and low-trust actors.',
    },
    {
      name: 'wallet-forensics',
      icon: '📊',
      title: 'Wallet Intelligence',
      description: 'Trace wallet activity, detect bot-like patterns, identify coordinated flows, and map fund movement across Web3 ecosystems with precision.',
    },
    {
      name: 'victim-reports',
      icon: '📋',
      title: 'Scammer Database',
      description: 'Community-powered database of known scammers, rug-pull deployers, and fake signal providers -- cross-referenced against every scan you run.',
    },
  ];

  const howItWorks = [
    { step: '01', title: 'Choose a Trust Surface', description: 'Start with a wallet, token, profile, website, phone number, domain, Telegram channel, or brand.' },
    { step: '02', title: 'Submit the Target', description: 'AgenticBro queues the scan and routes it to the right local or cloud AI workflow.' },
    { step: '03', title: 'AI Runs the Investigation', description: 'AgenticBro cross-references on-chain data, social signals, website intelligence, phone data, and the scammer database.' },
    { step: '04', title: 'Act with Evidence', description: 'Get a clear trust score, red flags, and a recommendation so you can transact, hire, promote, or report with better information.' },
  ];

  const stats = [
    { value: '6', label: 'Platforms Supported' },
    { value: '5,000+', label: 'Known Scammers in Database' },
    { value: '< 30s', label: 'Average Scan Time' },
    { value: '5 Free', label: 'Scans for Every User' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl" />

      <header className="relative z-10 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors mb-6 group">
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Back to Dashboard
          </button>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2 text-sm text-red-400 font-medium mb-4">
              🛡 Hybrid AI Trust Ecosystem
            </div>
            <h1 className="text-5xl font-black text-white mb-4">Why AgenticBro?</h1>
            <p className="text-xl text-purple-300 max-w-3xl mx-auto">
              Web3 trust now spans wallets, tokens, identities, websites, domains, phone numbers, and brand impersonation.
              AgenticBro turns those fragmented signals into AI-powered trust intelligence.
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-6 pb-20">

        <section className="mb-16 mt-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-5 text-center">
                <div className="text-3xl font-black text-purple-400 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">Core Strengths</h2>
          <p className="text-gray-400 text-center mb-10">Everything AgenticBro does is built around one mission: helping people verify trust before risk spreads</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreStrengths.map((feature, index) => (
              <div key={index} className="bg-gray-900/60 border border-gray-700/40 rounded-2xl p-6 hover:border-purple-500/40 transition-all group">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <div className="bg-gradient-to-br from-red-950/40 to-gray-900/60 border border-red-500/20 rounded-3xl p-10">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1 text-sm text-red-400 mb-4">
                  🚨 Featured Tool
                </div>
                <h2 className="text-4xl font-black text-white mb-4">Trust Detection System</h2>
                <p className="text-gray-300 text-lg mb-6">
                  Before you transact with a new project, follow a signal channel, hire a Web3 employer, or trust a brand,
                  run an AgenticBro investigation. Our AI cross-references wallet forensics, abuse patterns, social media
                  behaviour, and our growing scammer database to give you a complete risk picture.
                </p>
                <ul className="space-y-3">
                  {['Telegram and X channel credibility scoring', 'Token contract risk analysis (honeypots, mint authority, bundled buys)', 'Wallet forensics -- who is really behind the project?', 'Victim report cross-referencing', 'Clear verdict: Verified / Caution / High Risk / Known Threat'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-300">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">✔</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gray-900/80 border border-red-500/20 rounded-2xl p-6">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">🛡</div>
                  <div className="text-xl font-bold text-white">Investigation Report</div>
                  <div className="text-sm text-gray-500">Sample output</div>
                </div>
                <div className="space-y-3 text-sm">
                  {[{ label: 'Trust Score', value: '12 / 100', color: 'text-red-400' }, { label: 'Risk Level', value: 'CRITICAL', color: 'text-red-500 font-bold' }, { label: 'Confirmed Abuse', value: '3 reports', color: 'text-red-400' }, { label: 'Wallet Age', value: '6 days', color: 'text-yellow-400' }, { label: 'DB Match', value: 'Known threat', color: 'text-red-400' }, { label: 'Verdict', value: '🚫 DO NOT TRUST', color: 'text-red-500 font-bold' }].map((row, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-800/50 pb-2">
                      <span className="text-gray-500">{row.label}</span>
                      <span className={row.color}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <div className="bg-gradient-to-br from-purple-950/40 to-gray-900/60 border border-purple-500/20 rounded-3xl p-10">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="order-2 md:order-1 bg-gray-900/80 border border-purple-500/20 rounded-2xl p-6">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">🔍</div>
                  <div className="text-xl font-bold text-white">Priority Scan</div>
                  <div className="text-sm text-gray-500">Scan modes available</div>
                </div>
                <div className="space-y-3">
                  {[{ mode: '💰 Wallet Scan', desc: 'Full activity history, risk flags, insider patterns' }, { mode: '📡 Channel Scan', desc: 'Win rate, rug rate, signal quality for any Telegram group' }, { mode: '💸 Token Scan', desc: 'Contract audit, liquidity analysis, deployer history' }].map((item, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-xl p-4">
                      <div className="font-semibold text-purple-300 mb-1">{item.mode}</div>
                      <div className="text-sm text-gray-400">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-3 py-1 text-sm text-purple-400 mb-4">
                  ⚡ Featured Tool
                </div>
                <h2 className="text-4xl font-black text-white mb-4">Priority Scan</h2>
                <p className="text-gray-300 text-lg mb-6">
                  Not all intelligence tools are equal. Priority Scan goes beyond surface-level data to give you
                  actionable intelligence on any wallet, channel, token, social profile, phone number, or website --
                  so you can make trust decisions with full situational awareness.
                </p>
                <ul className="space-y-3">
                  {['Identify channels by historical outcomes, not hype', 'Detect suspicious wallet and transaction patterns', 'Spot bot activity and coordinated manipulation', 'Get risk-adjusted recommendations based on real data', 'Holder Tier: 100 scans/month across trust surfaces', 'Whale Tier: Unlimited scans'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-300">
                      <span className="text-purple-400 mt-0.5 flex-shrink-0">✔</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <div className="bg-gradient-to-br from-cyan-950/40 to-gray-900/60 border border-cyan-500/20 rounded-3xl p-10">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-1 text-sm text-cyan-400 mb-4">
                  🔍 Featured Tool
                </div>
                <h2 className="text-4xl font-black text-white mb-4">Profile Verifier Scanner</h2>
                <p className="text-gray-300 text-lg mb-6">
                  Instantly verify any social media profile for authenticity. Our AI-powered scanner checks for 
                  bot activity, fake followers, engagement patterns, and scam signals across 6 major platforms.
                </p>
                <ul className="space-y-3">
                  {[
                    'X (Twitter) — follower quality, bot detection, engagement rate',
                    'Telegram — channel credibility, member quality, scam history',
                    'Discord — server activity, role distribution, warning signs',
                    'Instagram — follower authenticity, engagement quality',
                    'TikTok — view-to-like ratio, comment quality analysis',
                    'YouTube — subscriber legitimacy, view quality metrics',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-300">
                      <span className="text-cyan-400 mt-0.5 flex-shrink-0">✔</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center gap-4">
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-4 py-2">
                    <span className="text-cyan-400 font-bold">5 Free Scans</span>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-2">
                    <span className="text-purple-400 font-bold">$1/scan after</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/80 border border-cyan-500/20 rounded-2xl p-6">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">🔍</div>
                  <div className="text-xl font-bold text-white">Profile Scan Result</div>
                  <div className="text-sm text-gray-500">Sample output</div>
                </div>
                <div className="space-y-3 text-sm">
                  {[{ label: 'Platform', value: 'X (Twitter)', color: 'text-cyan-400' }, { label: 'Username', value: '@elonmusk', color: 'text-white font-mono' }, { label: 'Trust Score', value: '98 / 100', color: 'text-green-400 font-bold' }, { label: 'Risk Level', value: 'LOW', color: 'text-green-500 font-bold' }, { label: 'Bot Score', value: '2%', color: 'text-green-400' }, { label: 'Verdict', value: '✅ LEGITIMATE', color: 'text-green-500 font-bold' }].map((row, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-800/50 pb-2">
                      <span className="text-gray-500">{row.label}</span>
                      <span className={row.color}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">How It Works</h2>
          <p className="text-gray-400 text-center mb-10">From target submission to trust-ready intelligence in under a minute</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step, index) => (
              <div key={index} className="relative bg-gray-900/60 border border-gray-700/40 rounded-2xl p-6 hover:border-purple-500/40 transition-all">
                <div className="text-5xl font-black text-purple-500/20 mb-3">{step.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 text-gray-600 text-xl">→</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">Competitive Advantages</h2>
          <p className="text-gray-400 text-center mb-10">Why AgenticBro stands apart in a crowded trust and security market</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ icon: '🤖', title: 'AI-Native Investigation', desc: 'Unlike static blacklists, AgenticBro uses live AI analysis that adapts to new scam and impersonation patterns as they emerge.' }, { icon: '⛓', title: 'On-Chain and Off-Chain Evidence', desc: 'Verdicts combine wallet history, transaction flows, contract signals, social context, domains, websites, and phone intelligence.' }, { icon: '🤝', title: 'Community-Powered Intelligence', desc: 'The risk database grows with every report and scan. The more the ecosystem uses AgenticBro, the more useful the intelligence layer becomes.' }].map((item, i) => (
              <div key={i} className="bg-gray-900/60 border border-gray-700/40 rounded-2xl p-6 text-center hover:border-purple-500/40 transition-all">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center">
          <div className="bg-gradient-to-br from-purple-900/30 to-gray-900/60 border border-purple-500/20 rounded-3xl p-12">
            <div className="text-5xl mb-4">🛡</div>
            <h2 className="text-4xl font-bold text-white mb-4">Verify trust before you act.</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Every scan you skip is a signal you did not check. AgenticBro gives you your first scans free so you can
              protect wallets, users, and brands with better evidence.
            </p>
            <button onClick={onBack} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-10 rounded-xl text-lg transition-all transform hover:scale-105">
              Run Your First Scan →
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}

export default ValueProposition;
