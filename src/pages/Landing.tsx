const NAVY = '#1a1a2e';
const NAVY_HOVER = '#2a2a3e';
const BODY = '#6b7280';
const BORDER = '#e5e7eb';
const SOFT_BG = '#fafafa';
const EMERALD = '#10b981';
const EMERALD_HOVER = '#059669';

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b" style={{ borderColor: BORDER }}>
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#" className="text-lg font-semibold tracking-tight" style={{ color: NAVY }}>
          FetchLab
        </a>
        <div className="hidden md:flex items-center gap-10 text-sm" style={{ color: NAVY }}>
          <a href="#features" className="hover:opacity-60 transition-opacity">Features</a>
          <a href="#pricing" className="hover:opacity-60 transition-opacity">Pricing</a>
          <a href="#security" className="hover:opacity-60 transition-opacity">Security</a>
        </div>
        <a
          href="#cta"
          className="text-sm px-4 py-2 rounded-md text-white transition-colors"
          style={{ backgroundColor: NAVY }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = NAVY_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = NAVY)}
        >
          Get Started
        </a>
      </div>
    </nav>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs font-medium tracking-[0.18em] uppercase mb-6"
      style={{ color: EMERALD }}
    >
      {children}
    </div>
  );
}

function Hero() {
  return (
    <section className="px-6 lg:px-8 pt-32 pb-40">
      <div className="max-w-4xl mx-auto text-center">
        <div
          className="text-xs font-medium tracking-[0.18em] uppercase mb-8"
          style={{ color: EMERALD }}
        >
          API Development Platform
        </div>
        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.05] tracking-tight mb-8"
          style={{ color: NAVY }}
        >
          The API client that fixes your APIs.
        </h1>
        <p
          className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-12"
          style={{ color: BODY }}
        >
          Send requests. Generate tests. When something breaks, FetchLab diagnoses it
          and proposes the fix.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#cta"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: EMERALD }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = EMERALD_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = EMERALD)}
          >
            Get Started Free
            <span aria-hidden>→</span>
          </a>
          <a
            href="#cta"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium border bg-white transition-colors hover:bg-gray-50"
            style={{ color: NAVY, borderColor: BORDER }}
          >
            Download for Windows
          </a>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div
      className="bg-white rounded-xl border p-8 transition-shadow hover:shadow-sm"
      style={{ borderColor: BORDER }}
    >
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center text-xl mb-6"
        style={{ backgroundColor: '#ecfdf5', color: EMERALD }}
      >
        {icon}
      </div>
      <h3 className="text-xl font-medium mb-3" style={{ color: NAVY }}>
        {title}
      </h3>
      <p className="text-base leading-relaxed" style={{ color: BODY }}>
        {body}
      </p>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="px-6 lg:px-8 py-32" style={{ backgroundColor: SOFT_BG }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <Label>What makes it different</Label>
          <h2
            className="text-4xl md:text-5xl font-medium tracking-tight max-w-2xl mx-auto"
            style={{ color: NAVY }}
          >
            Built for the way developers actually work.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon="✦"
            title="AI-Native"
            body="Describe what you need in plain English. FetchLab builds the request, writes the tests, and explains the response — no boilerplate, no copy-pasting from docs."
          />
          <FeatureCard
            icon="◆"
            title="Your Data, Your LLM"
            body="Bring your own Anthropic or OpenAI key. Requests, headers, and bodies stay on your machine. Zero training on your data, ever."
          />
          <FeatureCard
            icon="●"
            title="Ops Agent"
            body="A background agent watches your endpoints and pings Slack when something drifts. It triages the failure and proposes a fix before anyone files a ticket."
          />
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex flex-col">
      <div
        className="text-sm font-mono mb-6 pb-4 border-b"
        style={{ color: EMERALD, borderColor: BORDER }}
      >
        {n}
      </div>
      <h3 className="text-xl font-medium mb-3" style={{ color: NAVY }}>
        {title}
      </h3>
      <p className="text-base leading-relaxed" style={{ color: BODY }}>
        {body}
      </p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="px-6 lg:px-8 py-32">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <Label>How it works</Label>
          <h2
            className="text-4xl md:text-5xl font-medium tracking-tight max-w-3xl mx-auto"
            style={{ color: NAVY }}
          >
            From request to fix in three steps.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-12 md:gap-16">
          <Step
            n="01"
            title="Describe what you need"
            body="Tell FetchLab what to test in your own words. It drafts the request, headers, body, and assertions."
          />
          <Step
            n="02"
            title="FetchLab generates and tests"
            body="Run a single request or a full collection. Every response is diffed, validated, and turned into reusable tests."
          />
          <Step
            n="03"
            title="Agent watches and fixes"
            body="When an endpoint breaks, the agent locates the regression, drafts a patch, and posts it for review."
          />
        </div>
      </div>
    </section>
  );
}

function Security() {
  const items = [
    'AES-256-GCM encryption',
    'Two-factor authentication',
    'Audit logging',
    'BYOK / Bring-your-own-key',
    'Zero data retention',
  ];
  return (
    <section id="security" className="px-6 lg:px-8 py-32" style={{ backgroundColor: SOFT_BG }}>
      <div className="max-w-5xl mx-auto text-center">
        <Label>Enterprise security</Label>
        <h2
          className="text-4xl md:text-5xl font-medium tracking-tight mb-16 max-w-3xl mx-auto"
          style={{ color: NAVY }}
        >
          Built for teams that can't afford to be careless.
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {items.map((item) => (
            <div
              key={item}
              className="bg-white border rounded-full px-5 py-2.5 text-sm font-medium"
              style={{ color: NAVY, borderColor: BORDER }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

function PricingCard({ plan }: { plan: Plan }) {
  const border = plan.highlight ? EMERALD : BORDER;
  return (
    <div
      className="bg-white rounded-xl p-8 flex flex-col"
      style={{
        border: `1px solid ${border}`,
        boxShadow: plan.highlight ? `0 0 0 1px ${EMERALD}` : undefined,
      }}
    >
      {plan.highlight && (
        <div
          className="text-xs font-medium tracking-wider uppercase mb-4"
          style={{ color: EMERALD }}
        >
          Recommended
        </div>
      )}
      <h3 className="text-lg font-medium mb-2" style={{ color: NAVY }}>
        {plan.name}
      </h3>
      <div className="mb-6">
        <span className="text-4xl font-medium" style={{ color: NAVY }}>
          {plan.price}
        </span>
        {plan.period && (
          <span className="text-sm ml-1" style={{ color: BODY }}>
            {plan.period}
          </span>
        )}
      </div>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: BODY }}>
        {plan.description}
      </p>
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="text-sm flex items-start gap-2" style={{ color: NAVY }}>
            <span style={{ color: EMERALD }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href="#cta"
        className="block text-center text-sm font-medium px-4 py-2.5 rounded-md transition-colors"
        style={
          plan.highlight
            ? { backgroundColor: NAVY, color: 'white' }
            : { backgroundColor: 'white', color: NAVY, border: `1px solid ${BORDER}` }
        }
      >
        {plan.cta}
      </a>
    </div>
  );
}

function Pricing() {
  const plans: Plan[] = [
    {
      name: 'Free',
      price: '$0',
      description: 'Everything you need to start sending requests.',
      features: ['Unlimited local requests', 'Up to 3 collections', 'Community support'],
      cta: 'Start free',
    },
    {
      name: 'Pro',
      price: '$12',
      period: '/ month',
      description: 'For developers building APIs every day.',
      features: ['Unlimited collections', 'AI request builder', 'Test generation', 'Email support'],
      cta: 'Start Pro trial',
      highlight: true,
    },
    {
      name: 'Team',
      price: '$15',
      period: '/ user / month',
      description: 'Share collections, environments, and history.',
      features: ['Shared workspaces', 'Role-based access', 'Audit logging', 'Slack integration'],
      cta: 'Start team trial',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'SSO, dedicated support, and procurement-friendly terms.',
      features: ['SAML SSO', 'Custom data residency', 'Dedicated CSM', 'Priority SLAs'],
      cta: 'Contact sales',
    },
  ];

  return (
    <section id="pricing" className="px-6 lg:px-8 py-32">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <Label>Pricing</Label>
          <h2
            className="text-4xl md:text-5xl font-medium tracking-tight"
            style={{ color: NAVY }}
          >
            Start free. Scale when ready.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => (
            <PricingCard key={p.name} plan={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="px-6 lg:px-8 py-32" style={{ backgroundColor: SOFT_BG }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="text-4xl md:text-5xl font-medium tracking-tight mb-10"
          style={{ color: NAVY }}
        >
          Ready to build?
        </h2>
        <a
          href="#"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md text-white text-base font-medium transition-colors"
          style={{ backgroundColor: EMERALD }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = EMERALD_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = EMERALD)}
        >
          Get Started Free
          <span aria-hidden>→</span>
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 lg:px-8 py-10 border-t" style={{ borderColor: BORDER }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style={{ color: BODY }}>
        <div className="flex items-center gap-6">
          <span className="font-semibold" style={{ color: NAVY }}>FetchLab</span>
          <a href="#" className="hover:opacity-60 transition-opacity">Privacy</a>
          <a href="#" className="hover:opacity-60 transition-opacity">Terms</a>
        </div>
        <div>© 2025 FetchLab</div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="bg-white min-h-screen font-sans antialiased" style={{ color: NAVY }}>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Security />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
