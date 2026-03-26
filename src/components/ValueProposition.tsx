/**
 * Value Proposition Page -- Why Agentic Bro
 * Focused on Scam Detection and Priority Scan
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
      name: 'scam-detection',
      icon: '🛡',
      title: 'Scam Detection System',
      description: 'Deep-dive AI investigation into Telegram channels, X accounts, and token projects. Instantly exposes rug pulls, fake influencers, and honeypots before you lose a single dollar.',
    },
    {
      name: 'priority-scan',
      icon: '🔍',
      title: 'Priority Scan',
      description: 'Scan any wallet, Telegram channel, or token address for hidden risk signals. Uncover insider patterns, suspicious flows, and low-trust actors -- all in seconds.',
    },
    {
      name: 'wallet-forensics',
      icon: '📊',
      title: 'On-Chain Wallet Analysis',
      description: 'Trace wallet activity, detect bot wallets, identify coordinated pump groups, and map fund flows across the Solana ecosystem with precision.',
    },
    {
      name: 'victim-reports',
      icon: '📋',
      title: 'Scammer Database',
      description: 'Community-powered database of known scammers, rug-pull deployers, and fake signal providers -- cross-referenced against every scan you run.',
    },
    {
      name: 'informed-decisions',
      icon: '🧠',
      title: 'Informed Trading Intelligence',
      description: 'Every scan produces a trust score, risk tier, and actionable recommendation -- so you know exactly whether to buy, avoid, or investigate further.',
    },
    {
      name: 'token-burn',
      icon: '🔥',
      title: 'Deflationary Token Model',
      description: 'Every scan burns $AGNTCBRO tokens. The more Agentic Bro protects users, the scarcer the supply -- value appreciation built into every investigation.',
    },
  ];

  const howItWorks = [
    { step: '01', title: 'Connect Your Wallet', description: 'Link your Solana wallet to unlock full access to Scam Detection and Priority Scan features.' },
    { step: '02', title: 'Enter Any Target', description: 'Paste a Telegram channel, X username, wallet address, or token contract you want investigated.' },
    { step: '03', title: 'AI Runs the Investigation', description: 'Agentic Bro cross-references on-chain data, social signals, and the scammer database to generate a full risk report.' },
    { step: '04', title: 'Trade with Confidence', description: 'Get a clear trust score, red flags, and a recommendation -- so you can act decisively with full information.' },
  ];

  const stats = [
    { value: '5,000+', label: 'Known Scammers in Database' },
    { value: '< 30s', label: 'Average Scan Time' },
    { value: '3 Free', label: 'Scans for Every User' },
    { value: '100%', label: 'On-Chain Verified Results' },
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
              🛡 Protecting Degens Since Day One
            </div>
            <h1 className="text-5xl font-black text-white mb-4">Why Agentic Bro?</h1>
            <p className="text-xl text-purple-300 max-w-3xl mx-auto">
              The crypto space is full of scammers, rug pulls, and fake alpha. Agentic Bro arms you with
              AI-powered investigation tools to protect your capital and make every trade count.
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
          <p className="text-gray-400 text-center mb-10">Everything Agentic Bro does is built around one mission: keeping your money safe</p>
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
                <h2 className="text-4xl font-black text-white mb-4">Scam Detection System</h2>
                <p className="text-gray-300 text-lg mb-6">
                  Before you ape into a new project or follow a signal channel, run an Agentic Bro investigation.
                  Our AI cross-references on-chain wallet forensics, historical rug-pull patterns, social media
                  behaviour, and our growing scammer database to give you a complete risk picture.
                </p>
                <ul className="space-y-3">
                  {['Telegram and X channel credibility scoring', 'Token contract risk analysis (honeypots, mint authority, bundled buys)', 'Wallet forensics -- who is really behind the project?', 'Victim report cross-referencing', 'Clear verdict: Safe / Caution / High Risk / Known Scam'].map((item, i) => (
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
                  {[{ label: 'Trust Score', value: '12 / 100', color: 'text-red-400' }, { label: 'Risk Level', value: 'CRITICAL', color: 'text-red-500 font-bold' }, { label: 'Rug Pulls', value: '3 confirmed', color: 'text-red-400' }, { label: 'Wallet Age', value: '6 days', color: 'text-yellow-400' }, { label: 'DB Match', value: 'Known scammer', color: 'text-red-400' }, { label: 'Verdict', value: '🚫 DO NOT INVEST', color: 'text-red-500 font-bold' }].map((row, i) => (
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
                  deep, actionable intelligence on any wallet, channel, or token -- so you can enter positions
                  with full situational awareness.
                </p>
                <ul className="space-y-3">
                  {['Identify signal channels by actual win/loss record, not hype', 'Detect early whale accumulation before price moves', 'Spot bot activity and coordinated pump-and-dump setups', 'Get risk-adjusted trade recommendations based on real data', 'Prioritise your scans -- Whale Tier users get unlimited access'].map((item, i) => (
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
          <h2 className="text-3xl font-bold text-white mb-2 text-center">How It Works</h2>
          <p className="text-gray-400 text-center mb-10">From wallet connect to trade-ready intelligence in under a minute</p>
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
          <p className="text-gray-400 text-center mb-10">Why Agentic Bro stands apart in a crowded space</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ icon: '🤖', title: 'AI-Native Investigation', desc: 'Unlike static blacklists, Agentic Bro uses live AI analysis that adapts to new scam patterns as they emerge -- not 3 months later.' }, { icon: '⛓', title: 'On-Chain Truth', desc: 'Every verdict is backed by verifiable on-chain data -- wallet history, transaction flows, contract code. No guesswork, no opinions.' }, { icon: '🤝', title: 'Community-Powered Database', desc: 'The scammer database grows with every user report. The more the community uses Agentic Bro, the smarter and safer it gets for everyone.' }].map((item, i) => (
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
            <h2 className="text-4xl font-bold text-white mb-4">Stop Gambling. Start Investigating.</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Every scan you skip is a risk you could have avoided. Agentic Bro gives you 3 free scans --
              start protecting your portfolio today.
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
