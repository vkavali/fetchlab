import React, { useEffect, useRef, useState } from 'react';
import { FetchLabLogo } from '../components/FetchLabLogo';
import { useCountry, type Currency } from '../utils/useCountry';

/* ============================================================================
 * FetchLab - /pricing
 *
 * Standalone pricing data sheet. Same 'Cool Laboratory' register as the rest
 * of the marketing surface: cool ink on warm paper, volt-teal accent,
 * hairline borders, mono labels, instrument table.
 *
 * Currency is derived from the visitor's country (see useCountry - server
 * geo on /api/geo, with ?country= override for QA). India gets INR by
 * default; everyone else gets USD. A tiny 'Change' link below the plate
 * lets the user flip if detection misfires. No tab UI, no settings page.
 * ========================================================================== */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const STORAGE_WAITLIST = 'fetchlab_payment_waitlist';

/* ---------- Reveal on scroll ---------- */

function useInView<T extends HTMLElement>(opts?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      opts ?? { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, visible] as const;
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, visible] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 620ms ${EASE} ${delay}ms, transform 620ms ${EASE} ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Eyebrow ---------- */

function Eyebrow({ index, children }: { index?: string; children: React.ReactNode }) {
  return (
    <div
      className="font-mono uppercase"
      style={{
        fontSize: 11,
        letterSpacing: '0.14em',
        color: 'var(--color-text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.6rem',
      }}
    >
      {index && <span style={{ color: 'var(--color-accent)' }}>{index}</span>}
      <span aria-hidden style={{ display: 'inline-block', width: 28, height: 1, background: 'var(--color-border-strong)' }} />
      <span>{children}</span>
    </div>
  );
}

/* ---------- Nav ---------- */

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'color-mix(in oklch, var(--color-bg) 88%, transparent)',
        backdropFilter: 'saturate(140%) blur(6px)',
        WebkitBackdropFilter: 'saturate(140%) blur(6px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="/" aria-label="FetchLab home">
          <FetchLabLogo markSize={28} wordmarkSize={13.5} />
        </a>
        <div className="hidden md:flex items-center gap-9" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          <a href="/#how" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">The loop</a>
          <a href="/#features" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Field manual</a>
          <a href="/how-to" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">How-to</a>
          <a href="/ai-how-to" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">AI guide</a>
          <a href="/download" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Download</a>
          <a href="/enterprise" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Enterprise</a>
          <a href="/pricing" style={{ opacity: 1, color: 'var(--color-text)' }}>Pricing</a>
        </div>
        <div className="flex items-center gap-2">
          <a href="/app" className="hidden sm:inline-flex items-center" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)', padding: '6px 12px', border: '1px solid var(--color-border-strong)', borderRadius: 5 }}>Open app</a>
          <a href="/app" className="inline-flex items-center" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent-ink)', background: 'var(--color-accent)', padding: '6px 12px', borderRadius: 5 }}>Start free</a>
        </div>
      </div>
    </nav>
  );
}

/* ---------- 'Change' link - tiny fallback when detection is wrong ---------- */

function CurrencyChange({ currency, onToggle }: { currency: Currency; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="font-mono"
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--color-text-subtle)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: `color 200ms ${EASE}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-subtle)'; }}
      title={currency === 'INR' ? 'Switch to USD pricing' : 'Switch to INR pricing'}
    >
      Showing prices in {currency === 'INR' ? 'INR' : '$'}
      <span aria-hidden style={{ opacity: 0.5 }}>-</span>
      <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
        Change
      </span>
    </button>
  );
}

/* ---------- Pricing data ---------- */

interface PlanCol {
  key: string;
  name: string;
  price: { USD: string; INR: string };
  period?: { USD?: string; INR?: string };
  cta: string;
  highlight?: boolean;
  /** Triggers the waitlist modal instead of going direct */
  waitlist?: boolean;
  href?: string;
}

const PLAN_COLS: PlanCol[] = [
  { key: 'free', name: 'Free',       price: { USD: '$0',     INR: 'INR 0' },      cta: 'Start free',     href: '/app' },
  { key: 'pro',  name: 'Pro',        price: { USD: '$12',    INR: 'INR 999' },    period: { USD: '/ month', INR: '/ month' },          cta: 'Start Pro trial', highlight: true, href: '/app' },
  { key: 'team', name: 'Team',       price: { USD: '$15',    INR: 'INR 2,499' },  period: { USD: '/ user / month', INR: '/ user / month' }, cta: 'Book team pilot', href: 'mailto:hello@fetchlab.dev?subject=FetchLab%20Team%20Pilot' },
  { key: 'ent',  name: 'Enterprise', price: { USD: 'Custom', INR: 'Custom' },  cta: 'Contact sales',  href: 'mailto:hello@fetchlab.dev?subject=FetchLab%20Enterprise%20Pilot' },
];

type Cell = string | { USD: string; INR: string } | boolean | null;

const PLAN_ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: 'Local requests',         cells: ['unlimited', 'unlimited', 'unlimited', 'unlimited'] },
  { label: 'Collections',            cells: ['3', 'unlimited', 'unlimited', 'unlimited'] },
  { label: 'Local action gates',     cells: ['1', 'unlimited', 'unlimited', 'unlimited'] },
  { label: 'Encrypted policy export', cells: [true, true, true, true] },
  { label: 'Runtime decision API',   cells: [null, null, true, true] },
  { label: 'Exact-action approvals', cells: [null, null, true, true] },
  { label: 'Authority release diff', cells: [null, null, true, true] },
  { label: 'Immutable policy history', cells: [null, null, true, true] },
  { label: 'AI request builder',     cells: [null, true, true, true] },
  { label: 'Test generation',        cells: [null, true, true, true] },
  { label: 'Error diagnosis (AI)',   cells: [null, true, true, true] },
  { label: 'Shared workspaces',      cells: [null, null, true, true] },
  { label: 'Role-based access',      cells: [null, null, true, true] },
  { label: 'Audit log',              cells: [null, null, true, true] },
  { label: 'Slack ops agent',        cells: [null, null, true, true] },
  { label: 'OIDC SSO',               cells: [null, null, null, true] },
  { label: 'Custom data residency',  cells: [null, null, null, true] },
  { label: 'Support',                cells: ['community', 'email', 'email', 'priority'] },
];

function PricingCell({ value, highlight }: { value: Cell; highlight?: boolean }) {
  if (value === true) {
    return (
      <span aria-label="included" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2 6.5 L5 9.5 L10 3" fill="none" stroke={highlight ? 'var(--color-accent)' : 'var(--color-text)'} strokeWidth="1.7" strokeLinecap="square" />
        </svg>
      </span>
    );
  }
  if (value === null) return <span style={{ color: 'var(--color-text-subtle)' }}>-</span>;
  return <span style={{ color: 'var(--color-text)', fontSize: 13 }}>{value as string}</span>;
}

/* ---------- Waitlist modal ----------
 *
 * Payments aren't wired up yet. This modal captures email intent into
 * localStorage and offers a direct free-trial start. No fake checkout.
 */

function WaitlistModal({
  plan,
  currency,
  onClose,
}: {
  plan: PlanCol;
  currency: Currency;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!isEmailValid) return;
    try {
      const raw = localStorage.getItem(STORAGE_WAITLIST);
      const existing: { email: string; plan: string; currency: string; ts: number }[] = raw ? JSON.parse(raw) : [];
      const entry = { email: email.trim(), plan: plan.key, currency, ts: Date.now() };
      const next = [...existing.filter(x => !(x.email === entry.email && x.plan === entry.plan)), entry];
      localStorage.setItem(STORAGE_WAITLIST, JSON.stringify(next));
    } catch { /* ignore storage failures */ }
    setSubmitted(true);
  };

  const planLabel = plan.highlight ? 'Pro' : plan.name;
  const provider = currency === 'INR' ? 'Razorpay' : 'Stripe';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'color-mix(in oklch, var(--color-text) 28%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 460,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 8,
          overflow: 'hidden',
          animation: `wl-modal-in 280ms ${EASE} both`,
        }}
      >
        {/* Plate header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--color-accent)' }} />
            Notice - {planLabel} tier
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'var(--color-text-muted)',
              padding: '4px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
            }}
          >
            ESC
          </button>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px 22px 4px' }}>
              <h2
                id="waitlist-title"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 26,
                  lineHeight: 1.12,
                  letterSpacing: '-0.02em',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  margin: 0,
                  marginBottom: 10,
                }}
              >
                Payments aren't live yet.
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)', margin: 0 }}>
                We're getting {provider} set up for {currency === 'INR' ? 'India' : 'the rest of the world'}.
                Leave your email and we'll write to you the moment it ships.
              </p>
            </div>

            <div style={{ padding: '14px 22px 4px' }}>
              <div
                className="font-mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-subtle)',
                  marginBottom: 6,
                }}
              >
                Notify when {provider} is live
              </div>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setTouched(false); }}
                placeholder="you@yourcompany.dev"
                required
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  padding: '10px 12px',
                  background: 'var(--color-input-bg)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 5,
                  color: 'var(--color-text)',
                }}
              />
              {touched && !isEmailValid && (
                <div
                  className="font-mono"
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    letterSpacing: '0.10em',
                    color: 'var(--color-error)',
                  }}
                >
                  That doesn't look like a valid email.
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px 22px' }}>
              <button
                type="submit"
                className="w-full"
                style={{
                  width: '100%',
                  padding: '11px 18px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--color-accent-ink)',
                  background: 'var(--color-accent)',
                  border: '1px solid var(--color-accent)',
                  borderRadius: 5,
                  transition: `background-color 200ms ${EASE}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-accent)'; }}
              >
                Notify me when {provider} ships
              </button>

              <div
                className="font-mono"
                style={{
                  marginTop: 18,
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--color-border-strong)' }} />
                Or
                <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--color-border-strong)' }} />
              </div>

              <a
                href="/app"
                className="inline-flex items-center justify-center w-full"
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: '10px 18px',
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  background: 'transparent',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 5,
                }}
              >
                Start the 30-day free trial today
                <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginLeft: 8 }}>{'->'}</span>
              </a>

              <div
                className="font-mono"
                style={{
                  marginTop: 12,
                  fontSize: 10.5,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-subtle)',
                  textAlign: 'center',
                }}
              >
                Free for 30 days - no payment information
              </div>
            </div>
          </form>
        ) : (
          <div style={{ padding: '32px 22px' }}>
            <div
              className="font-mono"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                color: 'var(--color-success)',
                marginBottom: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span aria-hidden style={{ width: 18, height: 1, background: 'currentColor', opacity: 0.6 }} />
              Filed - waitlist
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                fontWeight: 600,
                color: 'var(--color-text)',
                margin: 0,
                marginBottom: 8,
              }}
            >
              Thanks. We'll write the moment {provider} is live.
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)', margin: 0, marginBottom: 18 }}>
              In the meantime, the free 30-day trial is the full Pro experience.
              No card, no upgrade nag.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="/app"
                className="inline-flex items-center gap-2"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: '10px 18px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--color-accent-ink)',
                  background: 'var(--color-accent)',
                  borderRadius: 5,
                }}
              >
                Open the lab
                <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{'->'}</span>
              </a>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  background: 'transparent',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 5,
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Footer ---------- */

function Footer() {
  return (
    <footer>
      <hr className="fl-rule" />
      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-6">
            <a href="/" aria-label="FetchLab home">
              <FetchLabLogo markSize={28} wordmarkSize={13.5} />
            </a>
            <div className="hidden md:flex items-center gap-5" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              <a href="/pricing" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Pricing</a>
              <a href="/enterprise" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Enterprise</a>
              <a href="/privacy" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Privacy</a>
              <a href="/terms" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Terms</a>
              <a href="https://github.com/vkavali/fetchlab" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">GitHub</a>
            </div>
          </div>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>
            Model 0001 - Continuous API diagnostics - (c) 2026
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Page ---------- */

export default function Pricing() {
  const { currency, toggleCurrency } = useCountry();
  const [modalPlan, setModalPlan] = useState<PlanCol | null>(null);

  // Marketing is always light, same as the landing.
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    if (wasDark) html.classList.remove('dark');
    return () => { if (wasDark) html.classList.add('dark'); };
  }, []);

  const handleCtaClick = (plan: PlanCol) => {
    if (plan.waitlist) {
      setModalPlan(plan);
    } else if (plan.href) {
      window.location.assign(plan.href);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Local keyframes - the modal entrance */}
      <style>{`
        @keyframes wl-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>

      <Nav />

      <section>
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8 pt-20 pb-12 md:pt-28 md:pb-14">
          <Reveal>
            <Eyebrow index="06">Pricing</Eyebrow>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(40px, 6.4vw, 88px)',
                lineHeight: 0.96,
                letterSpacing: '-0.035em',
                fontWeight: 600,
                color: 'var(--color-text)',
                marginTop: 18,
                marginBottom: 18,
                maxWidth: '20ch',
              }}
            >
              Start free.<br />
              <span style={{ color: 'var(--color-text-muted)' }}>Scale when ready.</span>
            </h1>
            <p style={{ fontSize: 17, maxWidth: '54ch', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
              No credit card to start. Every tier includes the full request client.
              AI features run on a key (yours, or ours).
            </p>
          </Reveal>

          {/* Specimen plate - geo-derived locale strip */}
          <Reveal delay={120}>
            <div
              className="mt-10 flex flex-wrap items-center justify-between gap-4"
              style={{
                padding: '14px 18px',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                background: 'var(--color-surface)',
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-subtle)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span aria-hidden style={{ width: 18, height: 1, background: 'var(--color-border-strong)' }} />
                {currency === 'INR'
                  ? 'India - INR - PPP-adjusted - GST at invoice'
                  : 'Global - USD - billed monthly'}
              </div>
              <CurrencyChange currency={currency} onToggle={toggleCurrency} />
            </div>
          </Reveal>
        </div>
      </section>

      <section>
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8 pb-24 md:pb-32">
          <Reveal delay={120}>
            <div
              className="overflow-x-auto"
              style={{
                border: '1px solid var(--color-border-strong)',
                borderRadius: 8,
                background: 'var(--color-surface)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '17%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid var(--color-border)', padding: '20px 22px', textAlign: 'left', verticalAlign: 'top' }}>
                      <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>
                        Plan
                      </div>
                    </th>
                    {PLAN_COLS.map(c => (
                      <th
                        key={c.key}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          borderLeft: '1px solid var(--color-border)',
                          padding: '20px 18px',
                          textAlign: 'left',
                          verticalAlign: 'top',
                          position: 'relative',
                          background: c.highlight ? 'var(--color-accent-soft)' : 'transparent',
                        }}
                      >
                        {c.highlight && (
                          <div
                            aria-hidden
                            style={{
                              position: 'absolute',
                              top: -1, left: 0, right: 0,
                              height: 2,
                              background: 'var(--color-accent)',
                            }}
                          />
                        )}
                        <div
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: c.highlight ? 'var(--color-accent)' : 'var(--color-text-subtle)',
                          }}
                        >
                          {c.highlight ? 'Recommended' : c.name}
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            fontFamily: 'var(--font-display)',
                            fontSize: 28,
                            letterSpacing: '-0.02em',
                            fontWeight: 600,
                            color: 'var(--color-text)',
                          }}
                        >
                          {c.price[currency]}
                        </div>
                        {c.period?.[currency] ? (
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {c.period[currency]}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 2 }}>
                            {c.highlight ? 'Pro' : c.name}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLAN_ROWS.map((row, r) => (
                    <tr key={row.label}>
                      <td
                        style={{
                          padding: '12px 22px',
                          borderBottom: r < PLAN_ROWS.length - 1 ? '1px solid var(--color-border)' : 'none',
                          fontSize: 13.5,
                          color: 'var(--color-text)',
                        }}
                      >
                        {row.label}
                      </td>
                      {row.cells.map((cell, i) => (
                        <td
                          key={i}
                          style={{
                            padding: '12px 18px',
                            borderBottom: r < PLAN_ROWS.length - 1 ? '1px solid var(--color-border)' : 'none',
                            borderLeft: '1px solid var(--color-border)',
                            fontSize: 13,
                            color: 'var(--color-text-muted)',
                            background: PLAN_COLS[i].highlight ? 'var(--color-accent-soft)' : 'transparent',
                          }}
                        >
                          <PricingCell value={cell} highlight={PLAN_COLS[i].highlight} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '20px 22px' }} />
                    {PLAN_COLS.map(c => (
                      <td
                        key={c.key}
                        style={{
                          padding: '20px 18px',
                          borderLeft: '1px solid var(--color-border)',
                          background: c.highlight ? 'var(--color-accent-soft)' : 'transparent',
                        }}
                      >
                        <button
                          onClick={() => handleCtaClick(c)}
                          className="inline-flex items-center justify-center w-full"
                          style={{
                            width: '100%',
                            fontSize: 13,
                            fontWeight: c.highlight ? 600 : 500,
                            color: c.highlight ? 'var(--color-accent-ink)' : 'var(--color-text)',
                            background: c.highlight ? 'var(--color-accent)' : 'transparent',
                            border: c.highlight ? '1px solid var(--color-accent)' : '1px solid var(--color-border-strong)',
                            padding: '9px 12px',
                            borderRadius: 5,
                            cursor: 'pointer',
                          }}
                        >
                          {c.cta}
                          {c.waitlist && (
                            <span
                              className="font-mono"
                              style={{ marginLeft: 8, fontSize: 9.5, letterSpacing: '0.16em', color: c.highlight ? 'var(--color-accent-ink)' : 'var(--color-text-subtle)', opacity: 0.85 }}
                            >
                              - NOTIFY
                            </span>
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Reveal>

          {/* Footer note about payments - adapts to the visitor's currency */}
          <Reveal delay={180}>
            <div
              className="mt-8 grid lg:grid-cols-2 gap-6 lg:gap-12 items-start"
              style={{
                padding: '20px 22px',
                border: '1px dashed var(--color-border-strong)',
                borderRadius: 6,
              }}
            >
              <div>
                <div
                  className="font-mono"
                  style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginBottom: 8 }}
                >
                  Simple buying path
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text)', margin: 0 }}>
                  {currency === 'INR' ? (
                    <>
                      Start free immediately. For Team and Enterprise, book a pilot and we will handle setup,
                      invoice, and rollout directly.
                    </>
                  ) : (
                    <>
                      Start free immediately. For Team and Enterprise, book a pilot and we will handle setup,
                      invoice, and rollout directly.
                    </>
                  )}
                </p>
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 11.5, letterSpacing: '0.10em', color: 'var(--color-text-muted)', lineHeight: 1.85 }}
              >
                {currency === 'INR' ? (
                  <>
                    <div>- INR pricing is PPP-adjusted, not a USD multiplication.</div>
                    <div>- GST and purchase-order details handled on invoice.</div>
                    <div>- Team pilots include onboarding and workspace setup.</div>
                    <div>- Annual contracts available for Enterprise.</div>
                  </>
                ) : (
                  <>
                    <div>- Pricing in USD, billed monthly or annually.</div>
                    <div>- Team pilots include onboarding and workspace setup.</div>
                    <div>- Purchase orders available for Enterprise.</div>
                  </>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />

      {modalPlan && (
        <WaitlistModal plan={modalPlan} currency={currency} onClose={() => setModalPlan(null)} />
      )}
    </div>
  );
}
