import { useNavigate } from 'react-router-dom'
import {
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleUserRound,
  DatabaseZap,
  ExternalLink,
  FileText,
  Globe2,
  Landmark,
  Linkedin,
  MailCheck,
  Network,
  Radar,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'

const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/earl-finney-60259a4'
const LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/agentic-insights-llc/'

const AGENTICBRO_CAPABILITIES = [
  'Website risk analysis',
  'Brand reputation analysis',
  'Wallet protection',
  'Token verification',
  'Phone fraud detection',
  'Social identity analysis',
  'Employer trust analysis',
  'Continuous monitoring',
]

const BRAND_GUARD_CAPABILITIES = [
  'Brand impersonation',
  'Lookalike domains',
  'Certificate Transparency discoveries',
  'Email authentication weaknesses (SPF, DKIM, DMARC)',
  'Marketplace abuse',
  'Social impersonation',
  'Vendor fraud',
  'Reputation threats',
]

const TECHNOLOGY_POINTS = [
  {
    icon: BrainCircuit,
    title: 'Autonomous AI agents',
    description:
      'OpenClaw agents coordinate investigations, evidence review, and response workflows across monitored trust surfaces.',
  },
  {
    icon: Network,
    title: 'Hybrid AI reasoning',
    description:
      'Locally hosted large language models are combined with cloud AI reasoning to balance performance, privacy, and operating cost.',
  },
  {
    icon: Workflow,
    title: 'Queue-based orchestration',
    description:
      'Durable queues and workers support continuous monitoring, scheduled scans, and repeatable investigation pipelines.',
  },
  {
    icon: DatabaseZap,
    title: 'Multi-source intelligence',
    description:
      'Signals from intelligence providers, behavioral models, infrastructure data, and community reports are correlated into explainable risk scores.',
  },
]

const FUTURE_AREAS = [
  'Advisors',
  'Research partnerships',
  'Awards and grants',
  'Publications',
  'AI architecture overview',
  'Enterprise customers',
  'Press mentions',
  'Security and privacy commitments',
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
            <img src="/icon.png" alt="AgenticBro" className="h-10 w-10 rounded-lg ring-1 ring-cyan-400/40" />
            <div>
              <div className="font-bold text-lg leading-tight">AgenticBro</div>
              <div className="text-xs text-cyan-200/70">A product of Agentic Insights LLC</div>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <a
              href="/brand-guard"
              className="hidden sm:inline-flex px-4 py-2 rounded-lg border border-cyan-400/25 text-cyan-100 hover:bg-cyan-500/10 text-sm font-semibold transition-colors"
            >
              Brand Guard
            </a>
            <a
              href="/"
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#071013] text-sm font-bold transition-colors"
            >
              AgenticBro
            </a>
          </div>
        </div>
      </nav>

      <main>
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-white/10">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
            <div>
              <a
                href={LINKEDIN_COMPANY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 text-cyan-200 hover:text-white hover:bg-cyan-500/15 text-sm font-semibold mb-6 transition-colors"
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Agentic Insights LLC
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
                Building the future of digital trust.
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-3xl">
                Agentic Insights LLC develops AI-powered trust intelligence platforms that help consumers,
                businesses, and enterprises make safer digital decisions before trust is established.
              </p>
              <p className="mt-5 text-base sm:text-lg text-gray-400 leading-relaxed max-w-3xl">
                Our mission is to combine autonomous AI agents, hybrid AI infrastructure, and multi-source
                threat intelligence into practical solutions that detect fraud, assess digital risk, and automate
                investigations across websites, brands, phone numbers, social identities, domains, wallets, and
                online communications.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href="/"
                  className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#071013] font-black transition-colors text-center"
                >
                  Explore AgenticBro
                </a>
                <a
                  href="/brand-guard"
                  className="px-6 py-3 rounded-xl border border-white/15 text-white hover:bg-white/10 font-bold transition-colors text-center"
                >
                  Explore Brand Guard
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <Radar className="h-7 w-7 text-cyan-300" aria-hidden="true" />
                <h2 className="text-2xl font-bold">Trust intelligence model</h2>
              </div>
              <p className="text-gray-300 leading-relaxed mb-5">
                Rather than relying on a single data source, our platforms correlate evidence from multiple
                intelligence providers, behavioral AI models, and community signals to generate explainable trust
                scores and actionable recommendations.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Autonomous investigation',
                  'Behavioral AI models',
                  'Threat intelligence',
                  'Community signals',
                  'Explainable scoring',
                  'Actionable response',
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
            <div className="text-center max-w-3xl mx-auto mb-10">
              <div className="flex items-center justify-center gap-2 text-cyan-200 font-semibold mb-3">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <span>Our platforms</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Products of Agentic Insights LLC</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                AgenticBro and Brand Guard share the same hybrid AI trust infrastructure, with product experiences
                tailored to consumer protection and business risk operations.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <article className="rounded-2xl border border-white/10 bg-[#0b1016] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <CircleUserRound className="h-8 w-8 text-cyan-300" aria-hidden="true" />
                  <h3 className="text-2xl font-bold">
                    <a href="/" className="hover:text-cyan-200 transition-colors">
                      AgenticBro
                    </a>
                  </h3>
                </div>
                <p className="text-gray-400 leading-relaxed mb-6">
                  AgenticBro is our AI-powered Trust Intelligence platform designed to help consumers identify
                  scams and reduce financial loss before interacting with unknown websites, investments, wallets,
                  phone numbers, social profiles, or online businesses.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {AGENTICBRO_CAPABILITIES.map((capability) => (
                    <div key={capability} className="flex gap-3 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.06] p-4">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-gray-200 leading-relaxed">{capability}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-[#0b1016] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <ShieldCheck className="h-8 w-8 text-purple-300" aria-hidden="true" />
                  <h3 className="text-2xl font-bold">
                    <a href="/brand-guard" className="hover:text-purple-200 transition-colors">
                      Brand Guard
                    </a>
                  </h3>
                </div>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Brand Guard extends the same AI infrastructure to businesses by continuously monitoring brand,
                  domain, communication, marketplace, social, vendor, and reputation threats.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {BRAND_GUARD_CAPABILITIES.map((capability) => (
                    <div key={capability} className="flex gap-3 rounded-xl border border-purple-400/15 bg-purple-500/[0.06] p-4">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400 mt-0.5" aria-hidden="true" />
                      <span className="text-sm text-gray-200 leading-relaxed">{capability}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-gray-400 leading-relaxed">
                  Brand Guard helps organizations detect threats early and streamline response through automated
                  investigations, evidence collection, and takedown workflows.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-3xl mb-10">
              <div className="flex items-center gap-2 text-cyan-200 font-semibold mb-3">
                <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                <span>Our technology</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Hybrid AI architecture for scalable investigations</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Our production platform combines autonomous OpenClaw AI agents, locally hosted large language
                models, cloud AI reasoning, queue-based orchestration, continuous monitoring, multi-source threat
                intelligence, and explainable AI risk scoring.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TECHNOLOGY_POINTS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.035] p-6">
                  <Icon className="h-7 w-7 text-cyan-300 mb-5" aria-hidden="true" />
                  <h3 className="text-lg font-bold mb-2">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-gray-400 text-lg leading-relaxed max-w-4xl">
              The platform is designed for scalable AI investigations while balancing local inference with cloud
              reasoning to optimize performance, privacy, and operational cost.
            </p>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16 bg-white/[0.02] border-b border-white/10">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 text-cyan-200 text-sm font-semibold mb-5">
                <Landmark className="h-4 w-4" aria-hidden="true" />
                Founder verification
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Founder</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Agentic Insights LLC is led by a hands-on founder with enterprise architecture experience and direct
                ownership of the deployed AI trust infrastructure.
              </p>
            </div>
            <article className="rounded-2xl border border-white/10 bg-black/35 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-6">
                <div>
                  <h3 className="text-2xl font-bold">Earl Finney</h3>
                  <p className="text-cyan-200 font-semibold mt-1">Founder &amp; Lead Developer</p>
                  <p className="text-gray-400">Agentic Insights LLC</p>
                </div>
                <a
                  href={LINKEDIN_PROFILE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0a66c2] hover:bg-[#0b5cad] text-white text-sm font-bold transition-colors"
                  aria-label="Open Earl Finney LinkedIn profile"
                >
                  <Linkedin className="h-4 w-4" aria-hidden="true" />
                  LinkedIn
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Earl is an Enterprise Architect with more than 30 years of experience designing enterprise
                technology solutions for government and commercial organizations. He founded Agentic Insights LLC
                to build production AI platforms focused on trust intelligence, fraud prevention, and autonomous AI.
              </p>
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                <a
                  href={LINKEDIN_PROFILE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="text-sm text-gray-400 mb-1">Founder LinkedIn</div>
                  <div className="text-cyan-100 font-semibold break-words">linkedin.com/in/earl-finney-60259a4</div>
                </a>
                <a
                  href={LINKEDIN_COMPANY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="text-sm text-gray-400 mb-1">Company LinkedIn</div>
                  <div className="text-cyan-100 font-semibold break-words">Agentic Insights LLC</div>
                </a>
              </div>
            </article>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <div className="flex items-center gap-2 text-cyan-200 font-semibold mb-3">
                <Globe2 className="h-5 w-5" aria-hidden="true" />
                <span>Company mission</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Trustworthy digital decisions through intelligent automation</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Our vision is to build AI systems that help people and organizations make more informed, trustworthy
                digital decisions through intelligent automation, explainable AI, and continuous trust monitoring.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-6 sm:p-8">
              <h3 className="text-xl font-bold mb-5">Future credibility areas</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {FUTURE_AREAS.map((area) => (
                  <div key={area} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
                    {area.includes('Security') ? (
                      <MailCheck className="h-5 w-5 shrink-0 text-green-300" aria-hidden="true" />
                    ) : area.includes('Publications') || area.includes('Press') ? (
                      <FileText className="h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                    ) : (
                      <BriefcaseBusiness className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
                    )}
                    <span className="text-sm text-gray-200 font-semibold">{area}</span>
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
