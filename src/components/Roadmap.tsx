/**
 * Roadmap Page - Hybrid AI Trust Ecosystem
 *
 * Product Roadmap 2026-2027
 * Focus: hybrid local/cloud AI trust infrastructure for Web3, brands, identity, and fraud prevention.
 */

function Roadmap({ onBack }: { onBack: () => void }) {
  const phases = [
    {
      number: '1',
      title: 'Production Trust Intelligence Foundation',
      period: 'Completed / Current',
      color: 'green',
      metrics: [
        { value: 'Live', label: 'agenticbro.app' },
        { value: '10', label: 'Free Daily Scans' },
        { value: '7+', label: 'Trust Surfaces' },
        { value: 'Hybrid', label: 'Local + Cloud AI' },
      ],
      sections: [
        {
          title: 'User-Facing Trust Tools',
          items: [
            { done: true, text: 'Profile Verifier for social identity risk checks' },
            { done: true, text: 'Priority Scan for wallets, channels, tokens, phones, websites, and profiles' },
            { done: true, text: 'Website and phishing analysis for suspicious domains' },
            { done: true, text: 'Phone scam and credibility checks' },
            { done: true, text: 'Token impersonation and contract risk scanning' },
            { done: true, text: 'Credibility History Analyzer for promotion and claim history' },
          ],
        },
        {
          title: 'Brand Protection',
          items: [
            { done: true, text: 'Brand Guard dashboard for impersonation monitoring' },
            { done: true, text: 'Lookalike domain and email spoofing workflows' },
            { done: true, text: 'Evidence collection for takedown workflows' },
            { done: true, text: 'Stripe-based Brand Guard onboarding and credits' },
            { done: false, text: 'Expanded automated brand monitoring bundles' },
          ],
        },
        {
          title: 'Hybrid AI Infrastructure',
          items: [
            { done: true, text: 'Queue-based scan dispatch from agenticbro.app' },
            { done: true, text: 'OpenClaw local agent execution for scheduled work' },
            { done: true, text: 'Mac Studio local AI path for owned inference capacity' },
            { done: true, text: 'Cloud AI reasoning path for deeper investigations' },
            { done: false, text: 'More resilient worker monitoring, retries, and queue observability' },
          ],
        },
      ],
    },
    {
      number: '2',
      title: 'Scale Scanning Capacity and Reliability',
      period: 'Next 3-6 Months',
      color: 'blue',
      metrics: [
        { value: '20x', label: 'Target Throughput' },
        { value: '<30s', label: 'Target Common Scan' },
        { value: '24/7', label: 'Monitoring Goal' },
        { value: 'Multi-API', label: 'Provider Resilience' },
      ],
      sections: [
        {
          title: 'Capacity Expansion',
          items: [
            { done: false, text: 'Increase AI API tiers to reduce rate-limit bottlenecks' },
            { done: false, text: 'Add higher-capacity cloud reasoning for complex investigations' },
            { done: false, text: 'Expand local model routing for routine and scheduled scans' },
            { done: false, text: 'Introduce cost-aware routing between local and cloud models' },
            { done: false, text: 'Track scan cost, latency, queue age, and throughput metrics' },
          ],
        },
        {
          title: 'Data and Signal Coverage',
          items: [
            { done: false, text: 'Add stronger domain, WHOIS, DNS, and certificate intelligence' },
            { done: false, text: 'Expand wallet intelligence with richer blockchain provider coverage' },
            { done: false, text: 'Improve phone, social, and website correlation signals' },
            { done: false, text: 'Build reusable trust evidence records for repeat scans' },
          ],
        },
        {
          title: 'Operational Reliability',
          items: [
            { done: false, text: 'Queue health dashboard for pending, failed, and retried jobs' },
            { done: false, text: 'Automated fallback when a model or data provider is rate-limited' },
            { done: false, text: 'Scheduled monitoring for brands, domains, wallets, and websites' },
            { done: false, text: 'Better alert delivery and weekly trust briefings' },
          ],
        },
      ],
    },
    {
      number: '3',
      title: 'Trust Intelligence Engine',
      period: '6-12 Months',
      color: 'purple',
      metrics: [
        { value: 'Graph', label: 'Trust Memory' },
        { value: 'Explainable', label: 'Risk Scoring' },
        { value: 'Cross-Surface', label: 'Correlation' },
        { value: 'API', label: 'Partner Access' },
      ],
      sections: [
        {
          title: 'Model and Scoring R&D',
          items: [
            { done: false, text: 'Explainable trust scoring across on-chain and off-chain signals' },
            { done: false, text: 'Fine-tuned fraud classifiers for repeated scam patterns' },
            { done: false, text: 'Evaluation datasets for phishing, impersonation, and wallet risk' },
            { done: false, text: 'Confidence scoring that separates evidence from speculation' },
          ],
        },
        {
          title: 'Knowledge Graph',
          items: [
            { done: false, text: 'Entity graph linking wallets, domains, profiles, phone numbers, and brands' },
            { done: false, text: 'Historical memory for repeated actors and evolving campaigns' },
            { done: false, text: 'Cross-channel campaign detection for coordinated impersonation' },
            { done: false, text: 'Reusable evidence packages for alerts, reports, and takedowns' },
          ],
        },
        {
          title: 'Commercial Readiness',
          items: [
            { done: false, text: 'Enterprise API for brand, wallet, and website trust checks' },
            { done: false, text: 'Team dashboards for businesses, communities, and agencies' },
            { done: false, text: 'Audit-ready reports for brand protection and fraud prevention' },
            { done: false, text: 'Partner pilots with Web3, fintech, and online-safety organizations' },
          ],
        },
      ],
    },
    {
      number: '4',
      title: 'Hybrid AI Trust Ecosystem',
      period: '2027+',
      color: 'yellow',
      metrics: [
        { value: 'Multi-Chain', label: 'Wallet Coverage' },
        { value: 'Always-On', label: 'Monitoring' },
        { value: 'Enterprise', label: 'Trust APIs' },
        { value: 'Public Benefit', label: 'Fraud Prevention' },
      ],
      sections: [
        {
          title: 'Ecosystem Expansion',
          items: [
            { done: false, text: 'Broader multichain coverage beyond Solana' },
            { done: false, text: 'Browser extension and mobile trust warnings' },
            { done: false, text: 'DeFi, NFT, creator, employer, and marketplace trust workflows' },
            { done: false, text: 'Public scam intelligence feeds and community reporting loops' },
          ],
        },
        {
          title: 'Autonomous Investigations',
          items: [
            { done: false, text: 'Multi-agent investigations that gather evidence across sources' },
            { done: false, text: 'Autonomous monitoring of brands, domains, wallets, and communities' },
            { done: false, text: 'AI-generated incident summaries with human review paths' },
            { done: false, text: 'Predictive detection of suspicious infrastructure before broad abuse' },
          ],
        },
        {
          title: 'Grant and Research Alignment',
          items: [
            { done: false, text: 'NSF SBIR project pitch around hybrid AI trust infrastructure' },
            { done: false, text: 'Benchmarks for cost-aware local/cloud AI orchestration' },
            { done: false, text: 'Research on explainable multi-source fraud risk scoring' },
            { done: false, text: 'Commercial pilots that prove measurable fraud reduction' },
          ],
        },
      ],
    },
  ];

  const infrastructureLayers = [
    { layer: 'Public App', current: 'agenticbro.app scans and Brand Guard', next: 'Role-based dashboards and partner APIs' },
    { layer: 'Queue', current: 'Supabase-backed scan dispatch and status', next: 'Priority routing, retries, observability, and worker health' },
    { layer: 'Local AI', current: 'Mac Studio and OpenClaw agent execution', next: 'More local workers, embeddings, classifiers, and scheduled monitors' },
    { layer: 'Cloud AI', current: 'Cloud reasoning for advanced reports', next: 'Provider redundancy, long-context investigations, and consensus checks' },
    { layer: 'Trust Engine', current: 'Risk scores and scan reports', next: 'Knowledge graph, explainability, and reusable evidence records' },
  ];

  const milestones = {
    nearTerm: [
      { milestone: 'Remove remaining rate-limit bottlenecks from core scan paths', target: 'Q3 2026' },
      { milestone: 'Expand queue observability for local OpenClaw jobs', target: 'Q3 2026' },
      { milestone: 'Increase Brand Guard recurring monitoring capacity', target: 'Q3 2026' },
      { milestone: 'Prepare NSF SBIR Project Pitch narrative and technical roadmap', target: 'Q3 2026' },
      { milestone: 'Add stronger domain and website intelligence providers', target: 'Q4 2026' },
      { milestone: 'Ship enterprise-ready trust report exports', target: 'Q4 2026' },
    ],
    midTerm: [
      'Hybrid local/cloud model routing dashboard',
      'Trust knowledge graph for wallets, domains, profiles, and brands',
      'Fine-tuned fraud classifier evaluation set',
      'Cross-surface alert correlation for Brand Guard',
      'Browser extension beta for trust warnings',
      'Enterprise API pilot for brand and wallet trust checks',
    ],
    longTerm: [
      'Always-on digital trust monitoring',
      'Multichain wallet and token risk coverage',
      'Autonomous evidence-gathering investigation agents',
      'Public benefit fraud-prevention partnerships',
      'Measurable loss-prevention and safety-impact reporting',
      'Hybrid AI trust infrastructure as a commercial platform',
    ],
  };

  const summaryStats = [
    { value: '7+', label: 'Trust Surfaces' },
    { value: '10', label: 'Free Daily Scans' },
    { value: 'Hybrid', label: 'Local + Cloud AI' },
    { value: 'Queue', label: 'Agent Orchestration' },
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
            <div className="text-sm font-mono text-cyan-300 mb-2 tracking-widest uppercase">
              Hybrid AI Trust Ecosystem · 2026-2027 · Active Development
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">AgenticBro Roadmap</h1>
            <p className="text-xl text-cyan-100 max-w-3xl mx-auto mb-8">
              Scaling AgenticBro from a production scan platform into hybrid AI trust infrastructure for Web3 users,
              brands, wallets, identities, domains, websites, and fraud prevention workflows.
            </p>
            <p className="text-lg text-gray-300 italic max-w-2xl mx-auto">
              Verify trust before users, wallets, or brands are exposed.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-4xl mx-auto">
              {summaryStats.map((stat, idx) => (
                <div key={idx} className="bg-black/30 rounded-xl p-4 border border-cyan-500/30">
                  <div className="text-2xl font-bold text-cyan-200">{stat.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-6 pb-20">
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Hybrid AI Infrastructure Layers</h2>
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl border border-cyan-500/30 p-8">
            <p className="text-gray-300 mb-6 text-center max-w-3xl mx-auto">
              AgenticBro is built around orchestration: public scan requests move through a durable queue,
              local OpenClaw agents, local AI workers, cloud reasoning models, and external intelligence APIs.
            </p>
            <div className="grid md:grid-cols-5 gap-4">
              {infrastructureLayers.map((item, idx) => (
                <div key={idx} className="bg-black/40 rounded-xl p-4 border border-cyan-500/20">
                  <div className="text-sm text-white font-bold mb-2">{item.layer}</div>
                  <div className="text-xs text-gray-400 mb-3">{item.current}</div>
                  <div className="text-xs text-cyan-200">{item.next}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Development Phases</h2>
          <div className="space-y-8">
            {phases.map((phase) => (
              <div key={phase.number} className={`rounded-2xl border p-8 ${colorMap[phase.color]}`}>
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className={`text-xs font-bold px-3 py-1 rounded-full ${badgeMap[phase.color]}`}>
                    Phase {phase.number}
                  </div>
                  <h3 className="text-2xl font-bold text-white">{phase.title}</h3>
                  <span className="text-gray-400 font-mono text-sm">{phase.period}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {phase.metrics.map((m, idx) => (
                    <div key={idx} className="bg-black/30 rounded-xl p-4 text-center">
                      <div className="text-xl font-bold text-white">{m.value}</div>
                      <div className="text-xs text-gray-400 mt-1">{m.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {phase.sections.map((section, sidx) => (
                    <div key={sidx}>
                      <h4 className="text-sm font-semibold text-cyan-200 uppercase tracking-wider mb-3">
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

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Key Milestones</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-green-500/30 p-6">
              <h3 className="text-lg font-bold text-green-300 mb-4">Near-Term · 3-6 Months</h3>
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

            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
              <h3 className="text-lg font-bold text-blue-300 mb-4">Mid-Term · 6-12 Months</h3>
              <ul className="space-y-3">
                {milestones.midTerm.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="text-blue-400 mt-0.5 text-xs">▹</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-yellow-500/30 p-6">
              <h3 className="text-lg font-bold text-yellow-300 mb-4">Long-Term · 12-24 Months</h3>
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

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Funding Priorities</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-cyan-500/30 p-6">
              <h3 className="text-lg font-bold text-white mb-4">What Capital Unlocks</h3>
              <ul className="space-y-3">
                {[
                  'Higher API tiers for AI, threat intelligence, blockchain, phone, domain, and website data',
                  'More local inference capacity for scheduled scans and routine analysis',
                  'Cloud AI capacity for advanced reasoning and long-context investigations',
                  'Queue reliability, monitoring, retry logic, and operational dashboards',
                  'Research datasets, model evaluation, and explainable trust scoring',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="text-cyan-300 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Grant-Ready Technical Themes</h3>
              <ul className="space-y-3">
                {[
                  'Hybrid local/cloud AI orchestration for cost-aware fraud analysis',
                  'Multi-source trust fusion across identity, wallet, web, phone, and brand signals',
                  'Explainable AI risk scoring for online financial fraud prevention',
                  'Autonomous evidence gathering for phishing and impersonation campaigns',
                  'Commercial trust APIs for consumers, businesses, and ecosystem partners',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="text-purple-300 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="text-center py-12">
          <p className="text-sm text-gray-500 mb-6 font-mono">
            Hybrid AI trust intelligence · agenticbro.app · @AgenticBro11 · t.me/Agenticbro1
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
        <p>Hybrid AI Trust Ecosystem · Built for Web3 users, brands, and online safety workflows</p>
      </footer>
    </div>
  );
}

export default Roadmap;
