import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Fingerprint,
  Globe2,
  Mail,
  MessageSquareText,
  Network,
  PhoneCall,
  Radar,
  ShieldCheck,
  Workflow,
} from 'lucide-react'

const ATTACK_SURFACES = [
  {
    icon: MessageSquareText,
    title: 'Social media',
    description:
      'Fake profiles, impersonator accounts, fraudulent support pages, suspicious engagement, fake communities, and coordinated inauthentic behavior.',
  },
  {
    icon: PhoneCall,
    title: 'Phones and messaging',
    description:
      'Fraudulent calls, high-pressure texts, fake recruiters, romance scams, vendor payment changes, and suspicious phone-number patterns.',
  },
  {
    icon: Globe2,
    title: 'Websites and domains',
    description:
      'Phishing pages, copied storefronts, lookalike domains, spoofed landing pages, wallet-drainer sites, and suspicious DNS or certificate signals.',
  },
  {
    icon: Mail,
    title: 'Email',
    description:
      'Spoofable domains, weak SPF/DKIM/DMARC posture, fake invoices, executive impersonation, customer support fraud, and business email compromise signals.',
  },
  {
    icon: Network,
    title: 'Web3 and payments',
    description:
      'Token impersonation, wallet-drain attempts, risky contracts, suspicious wallet behavior, payment redirection, and transaction-context risk.',
  },
]

const PROBLEM_POINTS = [
  'Consumers are asked to trust profiles, phone numbers, websites, job offers, sellers, wallets, and payment requests with little context.',
  'Businesses are exposed when attackers clone their identity, spoof communications, impersonate staff, or redirect customers and vendors.',
  'Single-surface tools miss campaigns that move between social media, phone networks, domains, email, marketplaces, and blockchain rails.',
  'Platform response times can be too slow for scams that appear, convert victims, and disappear within days.',
]

const CAPABILITIES = [
  {
    icon: Fingerprint,
    title: 'Profile and identity verification',
    description:
      'Analyze public profiles, handles, engagement behavior, and scam indicators across major social platforms before a user trusts the account.',
  },
  {
    icon: PhoneCall,
    title: 'Phone, job, and vendor risk signals',
    description:
      'Check phone numbers, vendor claims, job offers, invoices, and payment redirection patterns for consumer and business fraud risk.',
  },
  {
    icon: Globe2,
    title: 'Website and domain intelligence',
    description:
      'Scan websites, lookalike domains, spoofing controls, and phishing indicators that attackers use to intercept trust and payments.',
  },
  {
    icon: ShieldCheck,
    title: 'Brand Guard monitoring',
    description:
      'Monitor for impersonator accounts, email spoofing exposure, fake storefronts, marketplace clones, suspicious domains, and vendor fraud.',
  },
  {
    icon: Network,
    title: 'Payment and Web3 protection',
    description:
      'Connect identity evidence with wallet, token, contract, transaction, and payment-context signals before users act.',
  },
  {
    icon: Workflow,
    title: 'Actionable response workflows',
    description:
      'Turn findings into alerts, evidence records, takedown drafts, trust scores, and plain-English reports for operators and customers.',
  },
]

const AUDIENCES = [
  {
    icon: CircleUserRound,
    title: 'For consumers',
    description:
      'AgenticBro helps people evaluate whether an account, phone number, website, employer, token, wallet interaction, or payment request looks trustworthy before they engage.',
    examples: ['Profile checks', 'Phone scam signals', 'Website risk', 'Employer trust', 'Wallet safety'],
  },
  {
    icon: BriefcaseBusiness,
    title: 'For businesses',
    description:
      'AgenticBro helps companies protect reputation, customers, payment flows, and partner relationships from impersonation and social engineering.',
    examples: ['Brand Guard', 'Vendor fraud review', 'Email spoofing checks', 'Domain monitoring', 'Takedown evidence'],
  },
]

const BRAND_GUARD_DETAILS = [
  'Social impersonator discovery across X, Instagram, TikTok, Facebook, Telegram, and LinkedIn',
  'Email spoofing posture checks for SPF, DKIM, and DMARC weaknesses',
  'Lookalike domain and typosquatting discovery using public certificate and DNS signals',
  'Marketplace, fake listing, support account, and vendor impersonation review',
  'Continuous monitoring schedules with alerts when new threats appear',
  'Takedown report drafts and evidence packages for platform or domain abuse reports',
]

const PRINCIPLES = [
  'Prevention before recovery',
  'Evidence over hype',
  'Trust protection for consumers and businesses',
  'Hybrid AI with human-readable outputs',
  'Fast action while scam campaigns are still live',
]

export function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#080b10] text-white overflow-x-hidden">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#080b10]/85 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 text-left"
            type="button"
          >
            <img src="/icon.png" alt="Agentic Bro" className="h-10 w-10 rounded-lg ring-1 ring-cyan-400/40" />
            <div>
              <div className="font-bold text-lg leading-tight">AgenticBro</div>
              <div className="text-xs text-cyan-200/70">AI trust ecosystem for consumers and businesses</div>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/brand-guard')}
              className="hidden sm:inline-flex px-4 py-2 rounded-lg border border-cyan-400/25 text-cyan-100 hover:bg-cyan-500/10 text-sm font-semibold transition-colors"
              type="button"
            >
              Brand Guard
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#071013] text-sm font-bold transition-colors"
              type="button"
            >
              Start Scanning
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-white/10">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 text-cyan-200 text-sm font-semibold mb-6">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Agentic Insights LLC | Established April 2026
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
                AI trust intelligence for consumers and businesses.
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-3xl">
                Agentic Insights LLC designs, develops, deploys, and commercializes AgenticBro,
                an artificial intelligence-powered trust ecosystem for scam detection, consumer protection,
                business identity protection, and digital risk intelligence. The platform operates at the
                intersection of cybersecurity, behavioral AI, decentralized infrastructure, and real-world fraud prevention.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/brand-guard')}
                  className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#071013] font-black transition-colors"
                  type="button"
                >
                  Explore Brand Guard
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 rounded-xl border border-white/15 text-white hover:bg-white/10 font-bold transition-colors"
                  type="button"
                >
                  Run a Trust Scan
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <Radar className="h-7 w-7 text-cyan-300" aria-hidden="true" />
                <h2 className="text-2xl font-bold">What we protect against</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Social media impersonation',
                  'Fraudulent calls and texts',
                  'Fake jobs, invoices, and vendor fraud',
                  'Coordinated fake behavior',
                  'Email spoofing and BEC signals',
                  'Phishing sites, spoofed domains, and wallet drains',
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.06] px-4 py-3 text-sm font-semibold text-cyan-50">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16 bg-white/[0.02] border-b border-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-3xl mb-10">
              <div className="flex items-center gap-2 text-amber-200 font-semibold mb-3">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                <span>The core problem</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Modern fraud is a trust problem.</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Scammers win trust before money moves. They build fake identities, clone business surfaces,
                spoof communications, and pressure victims across social, phone, web, marketplace, and payment channels
                where delayed enforcement and single-purpose security tools cannot provide full protection.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
              {PROBLEM_POINTS.map((point) => (
                <div key={point} className="bg-[#0b1016] p-6">
                  <CheckCircle2 className="h-5 w-5 text-cyan-300 mb-4" aria-hidden="true" />
                  <p className="text-gray-300 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {[
                ['$12.5B', 'reported U.S. consumer fraud losses in 2024'],
                ['$1.9B', 'reported social media-originated scam losses in 2024'],
                ['$17B', 'estimated global crypto scam and fraud losses in 2025'],
              ].map(([value, label]) => (
                <div key={value} className="rounded-xl border border-white/10 bg-black/35 p-5">
                  <div className="text-3xl font-black text-white mb-1">{value}</div>
                  <div className="text-sm text-gray-400 leading-relaxed">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-6xl mx-auto mb-16">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Supported attack surfaces</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                AgenticBro is built for the channels where trust is created, abused, and converted into losses.
                Web3 is one surface. The broader ecosystem covers social media, phones, websites, domains, email,
                marketplaces, business workflows, and payment paths.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {ATTACK_SURFACES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
                  <Icon className="h-7 w-7 text-cyan-300 mb-4" aria-hidden="true" />
                  <h3 className="font-bold text-white mb-2">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="max-w-6xl mx-auto mb-16">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">One trust layer for two audiences</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                AgenticBro is designed to serve people making everyday trust decisions and businesses defending the
                public surfaces customers rely on.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {AUDIENCES.map(({ icon: Icon, title, description, examples }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
                  <Icon className="h-8 w-8 text-cyan-300 mb-5" aria-hidden="true" />
                  <h3 className="text-2xl font-bold mb-3">{title}</h3>
                  <p className="text-gray-400 leading-relaxed mb-5">{description}</p>
                  <div className="flex flex-wrap gap-2">
                    {examples.map((example) => (
                      <span key={example} className="px-3 py-1 rounded-full border border-cyan-400/15 bg-cyan-500/[0.06] text-xs font-semibold text-cyan-100">
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">A hybrid trust intelligence platform</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                AgenticBro combines scan tools, local AI workers, cloud reasoning, durable queues, and external
                threat intelligence to create practical trust signals for consumers, businesses, brands, and organizations.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CAPABILITIES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.035] p-6">
                  <Icon className="h-7 w-7 text-cyan-300 mb-5" aria-hidden="true" />
                  <h3 className="text-lg font-bold mb-2">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16 bg-white/[0.02] border-y border-white/10">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-400/25 bg-purple-500/10 text-purple-200 text-sm font-semibold mb-5">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Brand Guard
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Business trust protection built into the ecosystem.</h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                Brand Guard is the business protection layer inside AgenticBro. It helps companies detect fake accounts,
                spoofable email configurations, cloned domains, fraudulent listings, and vendor impersonation before
                customers, employees, or partners are redirected into a scam.
              </p>
              <button
                onClick={() => navigate('/brand-guard')}
                className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors"
                type="button"
              >
                Open Brand Guard
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {BRAND_GUARD_DETAILS.map((detail) => (
                <div key={detail} className="flex gap-3 rounded-xl border border-purple-400/15 bg-purple-500/[0.06] p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400 mt-0.5" aria-hidden="true" />
                  <span className="text-sm text-gray-200 leading-relaxed">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Company purpose</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Agentic Insights LLC exists to reduce the gap between when a scam appears and when people can recognize it.
                The company focuses on AI-assisted intelligence, practical risk scoring, and response workflows that make
                trust decisions faster, clearer, and more accessible for both consumers and businesses across digital channels.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-6 sm:p-8">
              <h3 className="text-xl font-bold mb-5">Operating principles</h3>
              <div className="space-y-4">
                {PRINCIPLES.map((principle) => (
                  <div key={principle} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    <span className="text-gray-200 font-semibold">{principle}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
