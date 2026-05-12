import { useEffect, useRef } from 'react';

const EMERALD = '#10b981';
const BG = '#0a0a0a';

function useFadeInOnScroll() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rootRef.current) return;
    const els = rootRef.current.querySelectorAll<HTMLElement>('.fl-fade');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('fl-visible');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return rootRef;
}

function useUnlockScroll() {
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;
    const root = document.getElementById('root');
    const prevRootHeight = root?.style.height ?? '';
    const prevRootOverflow = root?.style.overflow ?? '';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    if (root) {
      root.style.height = 'auto';
      root.style.overflow = 'visible';
    }
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.height = prevBodyHeight;
      if (root) {
        root.style.height = prevRootHeight;
        root.style.overflow = prevRootOverflow;
      }
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);
}

const styles = `
.fl-fade { opacity: 0; transform: translateY(12px); transition: opacity 600ms ease-out, transform 600ms ease-out; }
.fl-fade.fl-visible { opacity: 1; transform: translateY(0); }
.fl-link { color: #9ca3af; transition: color 150ms; }
.fl-link:hover { color: #e5e7eb; }
.fl-btn-primary { background: ${EMERALD}; color: #042f1f; transition: background 150ms; }
.fl-btn-primary:hover { background: #34d399; }
.fl-btn-secondary { background: transparent; color: #e5e7eb; border: 1px solid #27272a; transition: border-color 150ms, color 150ms; }
.fl-btn-secondary:hover { border-color: #3f3f46; color: #ffffff; }
.fl-card { background: #111111; border: 1px solid #1f1f23; }
.fl-card-pop { border: 1px solid ${EMERALD}33; }
.fl-accent { color: ${EMERALD}; }
.fl-divider { border-color: #1f1f23; }
`;

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 text-white font-semibold tracking-tight">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" stroke={EMERALD} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <span>FetchLab</span>
    </a>
  );
}

function Section({ id, children, className = '' }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`max-w-6xl mx-auto px-6 ${className}`}>
      {children}
    </section>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="fl-card fl-fade rounded-lg p-6">
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="fl-fade">
      <div className="text-xs fl-accent font-mono mb-3">STEP {n.toString().padStart(2, '0')}</div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  period,
  features,
  cta,
  href,
  highlight = false,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div className={`fl-card fl-fade rounded-lg p-6 flex flex-col ${highlight ? 'fl-card-pop' : ''}`}>
      <div className="mb-5">
        <div className="text-sm text-gray-400 mb-2">{name}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-white tracking-tight">{price}</span>
          {period && <span className="text-sm text-gray-500">/{period}</span>}
        </div>
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-sm text-gray-300">
            <span className="fl-accent mt-0.5">·</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={href}
        className={`inline-flex justify-center items-center text-sm font-medium px-4 py-2.5 rounded-md ${
          highlight ? 'fl-btn-primary' : 'fl-btn-secondary'
        }`}
      >
        {cta}
      </a>
    </div>
  );
}

export default function Landing() {
  useUnlockScroll();
  const rootRef = useFadeInOnScroll();

  return (
    <div
      ref={rootRef}
      className="min-h-screen w-full text-gray-100 font-sans"
      style={{ background: BG }}
    >
      <style>{styles}</style>

      {/* Top nav */}
      <header className="border-b fl-divider">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-6 text-sm">
            <a href="#features" className="fl-link hidden sm:inline">Features</a>
            <a href="#pricing" className="fl-link hidden sm:inline">Pricing</a>
            <a href="/app" className="fl-link">Sign in</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <Section className="pt-24 sm:pt-32 pb-20 sm:pb-28">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-white leading-[1.05] mb-6">
            The API client that <span className="fl-accent">fixes</span> your APIs.
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed mb-10 max-w-2xl">
            Send requests. Generate tests. Monitor your Slack. When something
            breaks, FetchLab diagnoses it and proposes the fix.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/app"
              className="fl-btn-primary inline-flex items-center justify-center text-sm font-medium px-5 py-3 rounded-md"
            >
              Get Started Free
            </a>
            <a
              href="#features"
              className="fl-btn-secondary inline-flex items-center justify-center text-sm font-medium px-5 py-3 rounded-md"
            >
              Download Desktop
            </a>
          </div>
          <p className="text-xs text-gray-500 mt-6">No credit card · 7-day trial</p>
        </div>
      </Section>

      {/* Features */}
      <Section id="features" className="py-20 sm:py-24 border-t fl-divider">
        <div className="mb-12 fl-fade">
          <div className="text-xs fl-accent font-mono mb-3">WHY FETCHLAB</div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight max-w-2xl">
            Not another REST client. An agent that knows your API.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            title="AI-Native"
            body="Generate requests from natural language, auto-write tests, and diagnose errors with full context from your codebase and history."
          />
          <FeatureCard
            title="Your Data, Your LLM"
            body="Bring your own API key. Anthropic, AWS Bedrock, Google Vertex, OpenAI, or run local. We never see your data."
          />
          <FeatureCard
            title="Ops Agent"
            body="Connect Slack. FetchLab watches for API issues in your team chat, reproduces them, and proposes fixes with one-click apply."
          />
        </div>
      </Section>

      {/* How It Works */}
      <Section id="how" className="py-20 sm:py-24 border-t fl-divider">
        <div className="mb-12 fl-fade">
          <div className="text-xs fl-accent font-mono mb-3">HOW IT WORKS</div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight max-w-2xl">
            Three steps from request to resolution.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <Step n={1} title="Send a request" body="Type a URL, paste a curl, or describe the call in plain English." />
          <Step
            n={2}
            title="Generate tests"
            body="FetchLab writes assertions from the response and monitors them on every run."
          />
          <Step
            n={3}
            title="Diagnose and fix"
            body="When something breaks, the agent explains the diff and proposes a one-click fix."
          />
        </div>
      </Section>

      {/* Security */}
      <Section id="security" className="py-20 sm:py-24 border-t fl-divider">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="fl-fade">
            <div className="text-xs fl-accent font-mono mb-3">SECURITY</div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              Enterprise-grade by default.
            </h2>
            <p className="text-sm text-gray-400 mt-4 leading-relaxed max-w-md">
              Your credentials, requests, and responses never leave your control.
              Auditable from day one.
            </p>
          </div>
          <ul className="space-y-3 fl-fade">
            {[
              'AES-256-GCM encryption at rest',
              '2FA with authenticator app',
              'SOC 2-aligned audit logging',
              'BYOK — your LLM keys stay with you',
              'Zero data retention option',
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm text-gray-300">
                <span className="fl-accent">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" className="py-20 sm:py-24 border-t fl-divider">
        <div className="mb-12 fl-fade">
          <div className="text-xs fl-accent font-mono mb-3">PRICING</div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight max-w-2xl">
            Start free. Scale when you're ready.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PriceCard
            name="Free"
            price="$0"
            features={[
              'Individual use',
              '7-day trial of Pro features',
              'No credit card required',
              'Unlimited local requests',
            ]}
            cta="Get Started"
            href="/app"
          />
          <PriceCard
            name="Pro"
            price="$12"
            period="mo"
            features={[
              'All AI features',
              'Unlimited requests',
              'Full history & search',
              'Priority support',
            ]}
            cta="Start Pro Trial"
            href="/app"
            highlight
          />
          <PriceCard
            name="Team"
            price="$15"
            period="user/mo"
            features={[
              'Shared workspaces',
              'Slack ops agent',
              'SSO',
              'Role-based access',
            ]}
            cta="Start Team Trial"
            href="/app"
          />
          <PriceCard
            name="Enterprise"
            price="Custom"
            features={[
              'Bring your own LLM',
              'Full audit logs',
              'Dedicated support',
              'Custom SLAs',
            ]}
            cta="Contact us"
            href="mailto:hello@fetchlab.dev"
          />
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t fl-divider mt-12">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-gray-500">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>© 2025 FetchLab</span>
            <span className="text-gray-700">·</span>
            <a href="/privacy" className="fl-link">Privacy Policy</a>
            <span className="text-gray-700">·</span>
            <a href="/terms" className="fl-link">Terms of Service</a>
          </div>
          <div className="text-gray-500">Built by Venkatesh Kavali</div>
        </div>
      </footer>
    </div>
  );
}
