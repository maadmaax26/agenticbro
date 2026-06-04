/**
 * BrandGuardPricingPage.tsx — Public-facing Brand Guard landing + pricing page
 *
 * Route: /brand-guard (shown to unauthenticated visitors)
 * Shows: hero section, feature overview, 4 subscription tiers, FAQ, CTA
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContactUs } from '../components/ContactUs';

// ════════════════════════════════════════════════════════════════════════════════
// Plan Data
// ════════════════════════════════════════════════════════════════════════════════

interface PlanTier {
  id: string;
  name: string;
  price: number;
  scans: number;
  description: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  color: string;
  borderColor: string;
  bgGlow: string;
  iconColor: string;
  buttonBg: string;
  buttonHover: string;
}

const PLANS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    scans: 25,
    description: 'Try Brand Guard risk-free',
    features: [
      '25 brand scans total',
      'Email spoof detection (SPF / DKIM / DMARC)',
      'Social media impersonator scan',
      'Lookalike domain discovery',
      'Brand health score (0–100)',
      'Email alerts for new threats',
    ],
    color: 'text-gray-300',
    borderColor: 'border-gray-700',
    bgGlow: '',
    iconColor: 'text-gray-400',
    buttonBg: 'bg-gray-700 hover:bg-gray-600',
    buttonHover: '',
  },
  {
    id: 'guardian',
    name: 'Guardian',
    price: 29,
    scans: 50,
    description: 'For startups & small brands',
    highlight: true,
    badge: 'MOST POPULAR',
    features: [
      'Everything in Free, plus:',
      '50 scans / month (resets monthly)',
      'Continuous monitoring — 6-hour scan cycle',
      'Regression alerts (DMARC changes, new lookalikes)',
      'Impersonator takedown report templates',
      'Priority email support',
    ],
    color: 'text-blue-300',
    borderColor: 'border-blue-500/50',
    bgGlow: 'shadow-blue-900/30 shadow-2xl',
    iconColor: 'text-blue-400',
    buttonBg: 'bg-blue-600 hover:bg-blue-500',
    buttonHover: '',
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    price: 79,
    scans: 200,
    description: 'For growing protocols & brands',
    features: [
      'Everything in Guardian, plus:',
      '200 scans / month (resets monthly)',
      'Real-time monitoring — 15-minute scan cycle',
      'Multi-brand support (up to 5 brands)',
      'API access (programmatic scans & alerts)',
      'DMCA takedown report generation',
      'Threat correlation across platforms',
      'Slack / webhook alert delivery',
    ],
    color: 'text-purple-300',
    borderColor: 'border-purple-500/50',
    bgGlow: 'shadow-purple-900/30 shadow-2xl',
    iconColor: 'text-purple-400',
    buttonBg: 'bg-purple-600 hover:bg-purple-500',
    buttonHover: '',
  },
  {
    id: 'fortress',
    name: 'Fortress',
    price: 199,
    scans: -1,
    description: 'Enterprise-grade brand protection',
    features: [
      'Everything in Sentinel, plus:',
      'Unlimited scans',
      '24/7 real-time monitoring',
      'Multi-brand support (unlimited)',
      'Dedicated account manager',
      'Custom reporting & SLA',
      'Bulk takedown coordination',
      'Phone / vendor verification scans',
      'Executive threat briefings (weekly)',
    ],
    color: 'text-amber-300',
    borderColor: 'border-amber-500/50',
    bgGlow: 'shadow-amber-900/30 shadow-2xl',
    iconColor: 'text-amber-400',
    buttonBg: 'bg-amber-600 hover:bg-amber-500',
    buttonHover: '',
  },
];

// ════════════════════════════════════════════════════════════════════════════════
// FAQ Data
// ════════════════════════════════════════════════════════════════════════════════

const FAQS = [
  {
    q: 'What counts as a "scan"?',
    a: 'Each individual check consumes one scan credit: email spoof scan (SPF/DKIM/DMARC), impersonator scan (per platform), lookalike domain scan, threat correlation, or vendor/phone verification. A full brand health check across 4 platforms uses ~5 credits.',
  },
  {
    q: 'Do unused scans roll over?',
    a: 'Free tier scans do not roll over — use them anytime. Guardian and Sentinel monthly scans reset each billing cycle. Fortress has unlimited scans with no caps.',
  },
  {
    q: 'What is "continuous monitoring"?',
    a: 'Instead of running a one-time scan, Brand Guard automatically re-scans your brands on a schedule (every 6 hours for Guardian, every 15 minutes for Sentinel, real-time for Fortress). You get alerts when new threats appear — new impersonator accounts, DMARC policy changes, newly registered lookalike domains.',
  },
  {
    q: 'How do takedown reports work?',
    a: 'When we find an impersonator account or lookalike domain, we generate a pre-filled DMCA or platform-specific takedown report. Guardian gets templates; Sentinel gets auto-generated reports; Fortress includes bulk takedown coordination and our team files reports on your behalf.',
  },
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes. Upgrade instantly, and prorated credits are added. Downgrade at the end of your current billing cycle. No lock-in contracts.',
  },
  {
    q: 'Which platforms do you monitor?',
    a: 'X (Twitter), Instagram, TikTok, Facebook, Telegram, and LinkedIn. Email spoof and lookalike domain monitoring works on any domain.',
  },
];

// ════════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════════

export function BrandGuardPricingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const getPrice = (plan: PlanTier) => {
    if (plan.price === 0) return 0;
    return billingCycle === 'annual' ? Math.round(plan.price * 0.8) : plan.price;
  };

  const handleGetStarted = (planId: string) => {
    // Navigate to brand-guard dashboard (login/signup will show)
    navigate(`/brand-guard?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔐</span>
            <span className="font-bold text-lg">Brand Guard</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
              by Agentic Bro
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Agentic Bro
            </button>
            <button
              onClick={() => handleGetStarted('free')}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition-colors"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        {/* Gradient background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-semibold mb-8">
            <span>⚠️</span>
            <span>Your brand is being impersonated right now — and you don't know it</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Brand Impersonation Detection
            </span>
            <br />
            <span className="text-white">that never sleeps</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Brand Guard monitors X, Instagram, TikTok, Facebook, Telegram & LinkedIn for impersonator accounts — 
            plus email spoofing, lookalike domains, and vendor fraud. Get alerts before your users get scammed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={() => handleGetStarted('guardian')}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-purple-900/30"
            >
              Start Monitoring — $29/mo
            </button>
            <button
              onClick={() => handleGetStarted('free')}
              className="px-8 py-4 rounded-xl border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold text-lg transition-all"
            >
              Try Free (25 scans)
            </button>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> No credit card for free tier
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> 278+ scammers in database
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> 547+ scans run
            </span>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How Brand Guard protects you</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔍',
                title: 'Detect',
                desc: 'Scan for impersonator accounts across 6 platforms, email spoofing vulnerabilities (SPF/DKIM/DMARC), and lookalike domains registered by attackers.',
              },
              {
                icon: '🔔',
                title: 'Alert',
                desc: 'Continuous monitoring re-scans your brands automatically. Get instant alerts when new threats appear — new impersonator, DMARC change, or suspicious domain registration.',
              },
              {
                icon: '🛡️',
                title: 'Protect',
                desc: 'Generate DMCA takedown reports, coordinate platform removals, and track threat regression. Turn findings into action, not just dashboards.',
              },
            ].map((step, i) => (
              <div key={i} className="text-center p-6">
                <div className="text-5xl mb-4">{step.icon}</div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scan Types ───────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">6 scan types. One brand shield.</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Each scan type checks a different attack surface. Continuous monitoring runs them all on schedule so you don't have to remember.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: '📧',
                name: 'Email Spoof',
                desc: 'SPF, DKIM, DMARC analysis. Find out if attackers can send emails from your domain.',
                tags: ['SPF', 'DKIM', 'DMARC'],
              },
              {
                icon: '👻',
                name: 'Impersonator Scan',
                desc: 'Find fake accounts using your brand name on X, IG, TikTok, FB, Telegram, LinkedIn.',
                tags: ['6 platforms', 'real-time'],
              },
              {
                icon: '🌐',
                name: 'Lookalike Domains',
                desc: 'Certificate Transparency logs + DNS — catch typosquatting and homograph domains.',
                tags: ['crt.sh', 'DNS-over-HTTPS'],
              },
              {
                icon: '🔗',
                name: 'Threat Correlate',
                desc: 'Cross-reference impersonators, domains, and email findings to find coordinated campaigns.',
                tags: ['cross-platform', 'correlation'],
              },
              {
                icon: '📱',
                name: 'Phone / Vendor Verify',
                desc: 'Check if a phone number is VOIP, disposable, premium-rate, or high-risk country.',
                tags: ['carrier lookup', 'spam DB'],
              },
              {
                icon: '🏢',
                name: 'Domain Sweep',
                desc: 'Monitor newly registered domains that match your brand name across TLDs.',
                tags: ['new registrations', 'TLDs'],
              },
            ].map((scan, i) => (
              <div
                key={i}
                className="p-5 rounded-xl border border-white/10 bg-black/30 hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{scan.icon}</span>
                  <h3 className="font-bold text-white">{scan.name}</h3>
                </div>
                <p className="text-sm text-gray-400 mb-3">{scan.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {scan.tags.map((tag, j) => (
                    <span key={j} className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
              Start free. Upgrade when you need continuous monitoring and takedown support.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-white/5 border border-white/10">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  billingCycle === 'annual'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Annual <span className="text-green-400 text-xs ml-1">Save 20%</span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PLANS.map((plan) => {
              const displayPrice = getPrice(plan);
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 border ${plan.borderColor} ${
                    plan.highlight ? 'ring-2 ring-blue-500/40' : ''
                  } ${plan.bgGlow} bg-black/40 backdrop-blur-sm transition-all hover:scale-[1.02]`}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg">
                      {plan.badge}
                    </div>
                  )}

                  {/* Plan name */}
                  <div className="mb-5">
                    <h3 className={`text-2xl font-bold ${plan.color} mb-1`}>{plan.name}</h3>
                    <p className="text-sm text-gray-500">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-white">
                        {displayPrice === 0 ? 'Free' : `$${displayPrice}`}
                      </span>
                      {displayPrice > 0 && (
                        <span className="text-gray-500">/mo</span>
                      )}
                    </div>
                    <div className={`text-sm font-semibold mt-1 ${plan.iconColor}`}>
                      {plan.scans === -1
                        ? 'Unlimited scans'
                        : plan.scans === 25
                        ? `${plan.scans} scans total`
                        : `${plan.scans} scans / month`}
                    </div>
                    {billingCycle === 'annual' && plan.price > 0 && (
                      <div className="text-xs text-green-400 mt-1">
                        Billed ${displayPrice * 12}/yr (save ${plan.price * 12 - displayPrice * 12}/yr)
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-2.5 mb-8">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                        <span className={feature.startsWith('Everything') ? 'text-gray-300 font-semibold' : 'text-gray-400'}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleGetStarted(plan.id)}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all ${plan.buttonBg}`}
                  >
                    {plan.price === 0 ? 'Start Free' : `Get ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>


        </div>
      </section>

      {/* ── Comparison Table ───────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Feature comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-400 font-semibold">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.id} className={`text-center py-3 px-3 font-bold ${p.color}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { feature: 'Scans', free: '25 total', guardian: '50/mo', sentinel: '200/mo', fortress: 'Unlimited' },
                  { feature: 'Scan types', free: 'All 6', guardian: 'All 6', sentinel: 'All 6', fortress: 'All 6' },
                  { feature: 'Email spoof detection', free: '✓', guardian: '✓', sentinel: '✓', fortress: '✓' },
                  { feature: 'Impersonator scan', free: '✓', guardian: '✓', sentinel: '✓', fortress: '✓' },
                  { feature: 'Lookalike domain scan', free: '✓', guardian: '✓', sentinel: '✓', fortress: '✓' },
                  { feature: 'Threat correlation', free: '—', guardian: '—', sentinel: '✓', fortress: '✓' },
                  { feature: 'Phone / vendor verify', free: '—', guardian: '—', sentinel: '—', fortress: '✓' },
                  { feature: 'Continuous monitoring', free: 'Manual', guardian: 'Every 6h', sentinel: 'Every 15min', fortress: '24/7 real-time' },
                  { feature: 'Regression alerts', free: '—', guardian: '✓', sentinel: '✓', fortress: '✓' },
                  { feature: 'Takedown report templates', free: '—', guardian: '✓', sentinel: '✓', fortress: '✓' },
                  { feature: 'DMCA report generation', free: '—', guardian: '—', sentinel: '✓', fortress: '✓' },
                  { feature: 'Bulk takedown coordination', free: '—', guardian: '—', sentinel: '—', fortress: '✓' },
                  { feature: 'Multi-brand support', free: '1 brand', guardian: '1 brand', sentinel: '5 brands', fortress: 'Unlimited' },
                  { feature: 'API access', free: '—', guardian: '—', sentinel: '✓', fortress: '✓' },
                  { feature: 'Slack / webhook alerts', free: '—', guardian: '—', sentinel: '✓', fortress: '✓' },
                  { feature: 'Account manager', free: '—', guardian: '—', sentinel: '—', fortress: '✓' },
                  { feature: 'Executive threat briefings', free: '—', guardian: '—', sentinel: '—', fortress: 'Weekly' },
                  { feature: 'Support', free: 'Email', guardian: 'Priority email', sentinel: 'Priority email', fortress: 'Dedicated' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 text-gray-300 font-medium">{row.feature}</td>
                    <td className="py-3 px-3 text-center text-gray-500">{row.free}</td>
                    <td className="py-3 px-3 text-center text-blue-300">{row.guardian}</td>
                    <td className="py-3 px-3 text-center text-purple-300">{row.sentinel}</td>
                    <td className="py-3 px-3 text-center text-amber-300">{row.fortress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-semibold text-gray-200 pr-4">{faq.q}</span>
                  <span className={`text-gray-500 transition-transform shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Stop discovering impersonators <span className="text-red-400">after</span> your users do
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Every day without monitoring is a day attackers can register your lookalike domain, 
            create fake accounts, and send spoofed emails. Brand Guard catches them first.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleGetStarted('guardian')}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-purple-900/30"
            >
              Start Guardian — $29/mo
            </button>
            <button
              onClick={() => handleGetStarted('free')}
              className="px-8 py-4 rounded-xl border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold text-lg transition-all"
            >
              Free Tier — 25 Scans
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-8 px-4 border-t border-white/5 text-center">
        <p className="text-gray-600 text-sm">
          Built by{' '}
          <a href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
            Agentic Bro
          </a>
          {' '}•{' '}
          <a href="https://twitter.com/AgenticBro11" className="text-purple-400 hover:text-purple-300 transition-colors">
            @AgenticBro11
          </a>
          {' '}•{' '}
          <a href="https://t.me/Agenticbro1" className="text-cyan-400 hover:text-cyan-300 transition-colors">
            Telegram
          </a>
          {' '}•{' '}
          <ContactUs />
          {' '}•{' '}
          <span className="text-gray-500">$AGNTCBRO on Solana</span>
        </p>
      </footer>
    </div>
  );
}