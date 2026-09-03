import React, { useEffect, useRef, useState } from 'react';
import { FetchLabLogo } from '../components/FetchLabLogo';
import { useCountry } from '../utils/useCountry';

/* ============================================================================
 * FetchLab - Marketing landing, "Cool Laboratory" register.
 *
 * Cool ink on warm paper. One accent (volt teal) used at <5% -
 * the cursor, status dots, the Send button, leader marks. Restraint is
 * the brand. No gradients, no glows, no floating mockups.
 *
 * Localizes for India when the visitor's country (via /api/geo) is IN -
 * INR localization, Bangalore-flavored attribution,
 * IST timestamp suffix in the investigation log. Otherwise USD / generic.
 * ========================================================================== */

/* ---------- Motion primitives (ease-out-quint, no bounce) ---------- */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

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

function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const [ref, visible] = useInView<HTMLDivElement>();
  const Comp = Tag as 'div';
  return (
    <Comp
      ref={ref as React.RefObject<HTMLDivElement>}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 620ms ${EASE} ${delay}ms, transform 620ms ${EASE} ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Comp>
  );
}

/* Section rule - gray hairline that gets briefly drawn in volt-teal
   when it enters the viewport, like a fresh scan completing. */
function SectionRule() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.4 });
  return (
    <div ref={ref} style={{ position: 'relative', height: 1, background: 'var(--color-border)' }}>
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 0, right: 0, height: 1,
          background: 'var(--color-accent)',
          transform: visible ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
          opacity: visible ? 0 : 1,
          transition: `transform 900ms ${EASE}, opacity 700ms ${EASE} 1000ms`,
        }}
      />
    </div>
  );
}

/* CTA - solid volt-teal button with micro-lift on hover, no bounce. */
function CTA({
  href,
  children,
  arrow = true,
}: {
  href: string;
  children: React.ReactNode;
  arrow?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-2"
      style={{
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-accent-ink)',
        background: hover ? 'var(--color-accent-hover)' : 'var(--color-accent)',
        padding: '11px 18px',
        borderRadius: 6,
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hover ? '0 2px 0 var(--color-accent-hover)' : '0 0 0 transparent',
        transition: `background-color 220ms ${EASE}, transform 220ms ${EASE}, box-shadow 220ms ${EASE}`,
      }}
    >
      {children}
      {arrow && (
        <span
          aria-hidden
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: 0,
            transform: hover ? 'translateX(2px)' : 'translateX(0)',
            transition: `transform 220ms ${EASE}`,
          }}
        >
          {'->'}
        </span>
      )}
    </a>
  );
}

/* Ghost button - hairline border, subtle text-only hover. */
function GhostCTA({ href, children }: { href: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-2"
      style={{
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text)',
        border: '1px solid var(--color-border-strong)',
        padding: '10px 18px',
        borderRadius: 6,
        borderColor: hover ? 'var(--color-text)' : 'var(--color-border-strong)',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: `border-color 220ms ${EASE}, transform 220ms ${EASE}`,
      }}
    >
      {children}
    </a>
  );
}

/* ---------- Number counter - ticks from a low number up to target ---------- */

function Counter({ target, duration = 700, pad = 0 }: { target: number | string; duration?: number; pad?: number }) {
  const targetN = typeof target === 'string' ? parseInt(target, 10) : target;
  const padN = typeof target === 'string' ? Math.max(pad, target.length) : pad;
  // For non-numeric labels (e.g. <Eyebrow index="*">), skip the count-up
  // animation and just render the literal. Otherwise Math.round(... * NaN)
  // leaks "NaN" into the eyebrow.
  const isNumeric = Number.isFinite(targetN);
  const [ref, visible] = useInView<HTMLSpanElement>({ threshold: 0.6 });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible || !isNumeric) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // ease-out-quart
      setValue(Math.round(eased * targetN));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, isNumeric, targetN, duration]);

  if (!isNumeric) return <span ref={ref}>{String(target)}</span>;
  const text = padN > 0 ? String(value).padStart(padN, '0') : String(value);
  return <span ref={ref}>{text}</span>;
}

/* ---------- Top scroll-progress hairline ---------- */

function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        pending = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 1,
        background: 'transparent',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          display: 'block',
          height: 1,
          background: 'var(--color-accent)',
          transform: `scaleX(${p})`,
          transformOrigin: 'left',
          transition: `transform 100ms ${EASE}`,
        }}
      />
    </div>
  );
}

/* ---------- Mission-loop meta - the status bar under the hero CTAs ---------- */

const LOOP_STEPS = ['Capture', 'Investigate', 'Propose', 'Approve', 'Verify'];

function AgentLoopMeta() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % LOOP_STEPS.length), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="font-mono hidden sm:flex"
      style={{
        marginTop: 40,
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        rowGap: 8,
        color: 'var(--color-text-subtle)',
      }}
    >
      {LOOP_STEPS.map((w, i, arr) => {
        const isActive = i === active;
        return (
          <React.Fragment key={w}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: isActive ? 'var(--color-text)' : 'var(--color-text-subtle)',
                transition: `color 520ms ${EASE}`,
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: isActive ? 'var(--color-accent)' : 'var(--color-border-strong)',
                  transform: isActive ? 'scale(1)' : 'scale(0.75)',
                  transition: `background-color 520ms ${EASE}, transform 520ms ${EASE}`,
                }}
              />
              <span style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-subtle)', transition: `color 520ms ${EASE}` }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {w}
            </span>
            {i < arr.length - 1 && (
              <span aria-hidden style={{ width: 14, height: 1, background: 'var(--color-border-strong)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------- Eyebrow (mono, leader rule) ---------- */

function Eyebrow({ index, children }: { index?: string; children: React.ReactNode }) {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.8 });
  return (
    <div
      ref={ref}
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
      {index && (
        <span style={{ color: 'var(--color-accent)', minWidth: '1.4em', display: 'inline-block' }}>
          <Counter target={index} pad={index.length} />
        </span>
      )}
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 28,
          height: 1,
          background: 'var(--color-border-strong)',
          transformOrigin: 'left',
          transform: visible ? 'scaleX(1)' : 'scaleX(0)',
          transition: `transform 620ms ${EASE} 80ms`,
        }}
      />
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
          <a href="#how" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>The loop</a>
          <a href="#features" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Field manual</a>
          <a href="/how-to" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>How-to</a>
          <a href="/ai-how-to" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>AI guide</a>
          <a href="/download" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Download</a>
          <a href="/enterprise" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Enterprise</a>
          <a href="/pricing" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Pricing</a>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/app"
            className="hidden sm:inline-flex items-center"
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--color-text)',
              padding: '6px 12px',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 5,
            }}
          >
            Open app
          </a>
          <a
            href="/app"
            className="inline-flex items-center"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--color-accent-ink)',
              background: 'var(--color-accent)',
              padding: '6px 12px',
              borderRadius: 5,
            }}
          >
            Start free
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ---------- Hero visual: the actual Product Missions workflow ---------- */

function ProductMissionSpecimen() {
  const stages = [
    { label: 'Evidence', state: 'complete' },
    { label: 'Proposal', state: 'complete' },
    { label: 'Draft PR', state: 'current' },
    { label: 'Checks', state: 'waiting' },
  ];
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: '13px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-mono"
            style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 650 }}
          >
            Product mission
          </span>
          <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.1em' }}>
            Illustrative product view
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--color-success)' }} />
          <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-success)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Human review required
          </span>
        </div>
      </div>

      <div style={{ padding: '18px 16px 15px' }}>
        <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>
          Customer issue / checkout
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 650, lineHeight: 1.2 }}>
          Checkout total breaks after a discount
        </div>
        <div className="flex flex-wrap gap-4" style={{ marginTop: 9, color: 'var(--color-text-muted)', fontSize: 12.5 }}>
          <span>Support case 443</span>
          <span>acme/store</span>
          <span>Base 2a4d9e8</span>
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
        }}
      >
        <div className="grid grid-cols-4 gap-2">
          {stages.map((stage, index) => (
            <div key={stage.label} style={{ minWidth: 0 }}>
              <div style={{ height: 3, background: stage.state === 'complete' ? 'var(--color-success)' : stage.state === 'current' ? 'var(--color-accent)' : 'var(--color-border-strong)' }} />
              <div className="font-mono" style={{ marginTop: 7, fontSize: 10, color: stage.state === 'waiting' ? 'var(--color-text-subtle)' : 'var(--color-text)', letterSpacing: '0.08em' }}>
                {String(index + 1).padStart(2, '0')} {stage.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
        <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Proposed product change
        </div>
        <strong style={{ display: 'block', marginTop: 7, fontSize: 17 }}>Normalize a missing discount before calculating the total</strong>
        <p style={{ margin: '7px 0 0', color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.55 }}>
          One exact source file, measurable acceptance criteria, risks, and the investigated base commit stay attached to the review.
        </p>
        <div className="flex items-center justify-between gap-4" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
          <span className="font-mono" style={{ fontSize: 11.5, color: 'var(--color-text)' }}>src/checkout/total.ts</span>
          <span style={{ color: 'var(--color-accent)', fontSize: 12.5, fontWeight: 650 }}>Review exact source</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4" style={{ padding: '14px 16px', background: 'var(--color-surface-2)' }}>
        <div>
          <span className="font-mono" style={{ display: 'block', fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Approval boundary
          </span>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 13.5 }}>Exact proposal hash - draft branch only - no merge or deploy</strong>
        </div>
        <span
          className="font-mono"
          style={{ padding: '7px 9px', border: '1px solid var(--color-accent)', borderRadius: 4, color: 'var(--color-accent)', fontSize: 10.5, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}
        >
          AWAITING APPROVAL
        </span>
      </div>
    </div>
  );
}
/* ---------- Hero ---------- */

function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Faint engineering-paper backdrop - the whole hero sits on lab paper */}
      <div
        aria-hidden
        className="absolute inset-0 fl-grid-paper"
        style={{ opacity: 0.22, pointerEvents: 'none' }}
      />
      {/* A second, denser grid hint on the right behind the postmortem card */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden lg:block fl-grid-paper"
        style={{ width: '46%', opacity: 0.32, pointerEvents: 'none' }}
      />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-8 pb-10 md:pt-12 md:pb-14 relative">
        <Reveal>
          <div
            className="flex flex-wrap items-center gap-4"
            style={{ marginBottom: 20 }}
          >
            <FetchLabLogo markSize={46} wordmarkSize={18} />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                borderLeft: '1px solid var(--color-border-strong)',
                paddingLeft: 16,
              }}
            >
              Product Missions + API Lab
            </span>
          </div>
        </Reveal>

        <Reveal delay={40}>
          <div style={{ marginBottom: 20 }}>
            <Eyebrow index="00">Customer evidence to a reviewed code change</Eyebrow>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <h1
            className="text-[40px] md:text-[60px] lg:text-[72px]"
            style={{
              fontFamily: 'var(--font-display)',
              lineHeight: 0.98,
              letterSpacing: 0,
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 0,
            }}
          >
            Turn a customer problem{' '}
            <span className="block" style={{ color: 'var(--color-text-muted)' }}>
              into a reviewed pull request.
            </span>
          </h1>
        </Reveal>

        <div
          className="grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-start"
          style={{ marginTop: 36 }}
        >
          <Reveal delay={180}>
            <div>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.5,
                  maxWidth: '44ch',
                  color: 'var(--color-text-muted)',
                  marginBottom: 30,
                }}
              >
                Capture the real report and the outcome that should change. FetchLab reads bounded repository context,
                asks when evidence is weak, prepares an exact source proposal, and opens a draft pull request only after
                a human approves that exact version.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <CTA href="/app">Create a product mission</CTA>
                <GhostCTA href="/download">Download installer</GhostCTA>
                <GhostCTA href="/enterprise">Enterprise pilot</GhostCTA>
              </div>

              <AgentLoopMeta />
            </div>
          </Reveal>

          <div className="hidden lg:block">
            <Reveal delay={240}>
              <ProductMissionSpecimen />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Drenched teal declaration - the one big committed color moment ---------- */

function Declaration() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.35 });
  return (
    <section style={{ background: 'var(--color-accent)', color: 'var(--color-accent-ink)' }}>
      <div ref={ref} className="max-w-[1280px] mx-auto px-6 lg:px-8 py-24 md:py-32 lg:py-40">
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-ink)',
            opacity: visible ? 0.85 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 600ms ${EASE}, transform 600ms ${EASE}`,
            marginBottom: 24,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span aria-hidden style={{ width: 22, height: 1, background: 'currentColor', opacity: 0.7 }} />
          Shipping now - web app and installer
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(80px, 18vw, 260px)',
            lineHeight: 0.86,
            letterSpacing: 0,
            fontWeight: 600,
            color: 'var(--color-accent-ink)',
            margin: 0,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 700ms ${EASE} 120ms, transform 700ms ${EASE} 120ms`,
          }}
        >
          <Counter target="2" duration={900} /> benches.
        </h2>

        <div
          className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end"
          style={{
            marginTop: 36,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 600ms ${EASE} 320ms, transform 600ms ${EASE} 320ms`,
          }}
        >
          <p
            style={{
              fontSize: 'clamp(20px, 2.2vw, 28px)',
              lineHeight: 1.25,
              letterSpacing: 0,
              fontWeight: 500,
              color: 'var(--color-accent-ink)',
              maxWidth: '34ch',
              margin: 0,
            }}
          >
            Product Missions owns the path from customer evidence to a human-reviewed draft pull request.
            API Lab preserves the requests, responses, environments, protocols, and scripts needed to investigate the product underneath it.
          </p>
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--color-accent-ink)',
              opacity: 0.78,
              lineHeight: 1.6,
            }}
          >
            <div>Browser app - /app</div>
            <div>Windows installer - /download</div>
            <div>Enterprise - Postgres, RBAC, audit, SSO, SCIM</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- The loop - presented as an illustrative mission record ---------- */

type LogEntry = { t: string; stage: string; line: string; mark?: 'ok' | 'warn' };
const LOG_ENTRIES: LogEntry[] = [
  { t: '00:00:01', stage: 'capture',     line: 'customer report and desired product outcome saved as one mission', mark: 'ok' },
  { t: '00:00:03', stage: 'protect',     line: 'raw evidence encrypted in the workspace record', mark: 'ok' },
  { t: '00:00:06', stage: 'repository',  line: 'connected GitHub repository fixed to base commit 2a4d9e8', mark: 'ok' },
  { t: '00:00:12', stage: 'investigate', line: 'bounded source context selected; secret and workflow paths excluded', mark: 'ok' },
  { t: '00:00:31', stage: 'proposal',    line: 'one exact source change with acceptance criteria and risks prepared', mark: 'ok' },
  { t: '00:00:36', stage: 'approval',    line: 'human approved the proposal fingerprint and investigated base', mark: 'ok' },
  { t: '00:00:41', stage: 'github',      line: 'isolated branch and draft pull request created; default branch untouched', mark: 'ok' },
  { t: '00:00:48', stage: 'checks',      line: 'repository checks pending; FetchLab does not claim verification yet', mark: 'warn' },
  { t: '00:01:22', stage: 'checks',      line: 'reported repository checks completed successfully', mark: 'ok' },
  { t: '00:01:23', stage: 'review',      line: 'draft pull request ready for the engineering team', mark: 'ok' },
];

function HowItWorks() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.18 });

  return (
    <section id="how" style={{ position: 'relative' }}>
      <SectionRule />
      <ChapterMarker num="01" label="The loop" />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-24 md:py-32">
        <Reveal>
          <Eyebrow index="01">The loop</Eyebrow>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 3.8vw, 44px)',
              lineHeight: 1.08,
              letterSpacing: 0,
              fontWeight: 600,
              color: 'var(--color-text)',
              marginTop: 18,
              marginBottom: 16,
              maxWidth: '28ch',
            }}
          >
            One traceable path from report to review.
          </h2>
          <p style={{ fontSize: 17, maxWidth: '60ch', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            Product work usually breaks across support, chat, a coding agent, GitHub, and CI. FetchLab keeps the original
            evidence, exact proposal, approval, pull request, and check result in one mission record.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div
            ref={ref}
            className="mt-10 overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 8,
            }}
          >
            {/* Log header - like a terminal session title */}
            <div
              className="flex items-center justify-between font-mono"
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                fontSize: 10.5,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-text-subtle)',
              }}
            >
              <span>
                <span style={{ color: 'var(--color-accent)', marginRight: 12 }}>*</span>
                Illustrative mission record - checkout issue
              </span>
              <span>Evidence + code + review</span>
            </div>

            {/* The log itself */}
            <div
              className="font-mono"
              style={{ padding: '20px 20px', fontSize: 13, lineHeight: 1.95 }}
            >
              {LOG_ENTRIES.map((e, i) => {
                const delay = i * 80;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 110px 1fr 24px',
                      alignItems: 'baseline',
                      gap: 16,
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateX(0)' : 'translateX(-6px)',
                      transition: `opacity 360ms ${EASE} ${delay}ms, transform 360ms ${EASE} ${delay}ms`,
                    }}
                  >
                    <span style={{ color: 'var(--color-text-subtle)' }}>{e.t}</span>
                    <span
                      style={{
                        color: 'var(--color-accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.14em',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {e.stage}
                    </span>
                    <span style={{ color: 'var(--color-text)' }}>{e.line}</span>
                    <span style={{ textAlign: 'right' }}>
                      {e.mark === 'ok' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                          <path d="M2 6.5 L5 9.5 L10 3" fill="none" stroke="var(--color-success)" strokeWidth="1.7" strokeLinecap="square" />
                        </svg>
                      )}
                      {e.mark === 'warn' && (
                        <span style={{ color: 'var(--color-warning)', fontSize: 12, lineHeight: 1 }}>!</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer plate */}
            <div
              className="flex items-center justify-between font-mono"
              style={{
                padding: '10px 20px',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                fontSize: 10.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--color-text-subtle)',
              }}
            >
              <span>Default branch writes - 0</span>
              <span>Required human approvals - 1</span>
              <span>Output - <span style={{ color: 'var(--color-accent)' }}>Draft PR</span></span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Feature visuals ---------- */

function AIBuilderVisual() {
  const border = '1px solid var(--color-border)';
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.4 });
  const lines = [
    `+ fl.test('returns 201 with order id', () => {`,
    `+   fl.expect(fl.response.status).toBe(201);`,
    `+   fl.expect(fl.response.body).toHaveProperty('id');`,
    `+ });`,
    `+ fl.test('rejects body without sku', () => {`,
    `+   fl.expect(fl.response.status).toBe(422);`,
    `+ });`,
  ];

  return (
    <div
      ref={ref}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 8,
      }}
    >
      <div className="flex items-center justify-between" style={{ padding: '10px 14px', borderBottom: border }}>
        <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          Generated assertions
        </span>
        <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.06em' }}>
          tests/orders.fl - +6 lines
        </span>
      </div>

      {/* Prompt - the human side, terse */}
      <div style={{ padding: '12px 14px', borderBottom: border, background: 'var(--color-surface-2)' }}>
        <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginRight: 10 }}>
          Ask
        </span>
        <span style={{ fontSize: 13.5, color: 'var(--color-text)' }}>
          Write me tests for /v1/orders. Cover the happy path and a missing-sku failure.
        </span>
      </div>

      {/* The agent's output - each line stamps in, like the agent is writing */}
      <div className="font-mono" style={{ padding: '14px 14px', fontSize: 12, lineHeight: 1.65 }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              background: 'color-mix(in oklch, var(--color-success) 14%, transparent)',
              color: 'var(--color-success)',
              whiteSpace: 'pre',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(-3px)',
              transition: `opacity 320ms ${EASE} ${i * 60}ms, transform 320ms ${EASE} ${i * 60}ms`,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Result line - the verdict, not the click */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '10px 14px',
          borderTop: border,
          fontSize: 12,
          opacity: visible ? 1 : 0,
          transition: `opacity 320ms ${EASE} ${lines.length * 60 + 100}ms`,
        }}
      >
        <span style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-success)', marginRight: 8 }}>
            Passed
          </span>
          2 of 2 - 184 ms total
        </span>
        <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.06em' }}>
          claude-opus-4-7
        </span>
      </div>
    </div>
  );
}

function ProposalReviewVisual() {
  const items = [
    { name: 'Customer evidence', detail: 'Support case 443', state: 'Captured', active: false },
    { name: 'Investigated source', detail: 'src/checkout/total.ts', state: 'Bound', active: false },
    { name: 'Exact code proposal', detail: 'sha256: 8ab2c410...91f2', state: 'Review', active: true },
  ];
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 8 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          Checkout issue / reviewed proposal
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-subtle)', marginTop: 4 }}>
          One mission, one investigated base commit
        </div>
      </div>
      <div>
        {items.map((item, index) => (
          <div
            key={item.name}
            className="flex items-center justify-between"
            style={{
              padding: '12px 14px',
              borderBottom: index < items.length - 1 ? '1px solid var(--color-border)' : 'none',
              background: item.active ? 'var(--color-accent-soft)' : 'transparent',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                style={{
                  width: 16, height: 16, borderRadius: 3,
                  border: item.active ? '4px solid var(--color-warning)' : '1.5px solid var(--color-border-strong)',
                  background: 'var(--color-surface)',
                }}
              />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 13, color: 'var(--color-text)', fontWeight: item.active ? 650 : 550 }}>{item.name}</strong>
                <span className="font-mono" style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: 'var(--color-text-subtle)' }}>{item.detail}</span>
              </span>
            </div>
            <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: item.active ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}>
              {item.state}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Approval result</span>
        <strong style={{ color: 'var(--color-accent)', fontSize: 12.5 }}>Draft PR only</strong>
      </div>
    </div>
  );
}
function ReleaseDecisionVisual() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.45 });
  const stage = (i: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(4px)',
    transition: `opacity 360ms ${EASE} ${i * 140}ms, transform 360ms ${EASE} ${i * 140}ms`,
  });
  return (
    <div ref={ref} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 8 }}>
      <div className="flex items-center justify-between" style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          Release decision
        </span>
        <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.06em' }}>
          Workspace controlled
        </span>
      </div>
      <div style={{ padding: 14, fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.6 }}>
        <div style={{ marginBottom: 8, ...stage(0) }}>
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginRight: 8 }}>
            FETCHLAB
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>Configuration verified</span>
        </div>
        <p style={{ margin: 0, ...stage(1) }}>
          <strong>Repository access</strong> and the investigation model are configured for this workspace.
          Credentials stay encrypted on the server and are not returned to the browser or sent to the model.
        </p>
        <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--color-text-muted)', ...stage(2) }}>
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginRight: 8 }}>
            HARD BOUNDARY
          </span>
          Exact proposal only. New branch only. No default-branch write. No merge. No deploy.
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: 12, ...stage(3) }}>
          <button
            style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--color-accent-ink)', background: 'var(--color-accent)',
              padding: '6px 12px', borderRadius: 5,
            }}
          >
            Approve draft pull request
          </button>
          <button
            style={{
              fontSize: 12, fontWeight: 500,
              color: 'var(--color-text)',
              border: '1px solid var(--color-border-strong)',
              padding: '5px 12px', borderRadius: 5,
            }}
          >
            Reject proposal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Features - single long-form chapter treatment with inline figures ---------- */

function Chapter({
  num,
  title,
  body,
  marginalia,
  figLabel,
  figCaption,
  figure,
  last,
}: {
  num: string;
  title: string;
  body: React.ReactNode;
  marginalia: string;
  figLabel: string;
  figCaption: string;
  figure: React.ReactNode;
  last?: boolean;
}) {
  return (
    <article
      style={{
        paddingTop: 56,
        paddingBottom: 56,
        borderBottom: last ? 'none' : '1px dashed var(--color-border)',
      }}
    >
      <Reveal>
        <div className="grid lg:grid-cols-[1fr_280px] gap-10 lg:gap-16 items-start">
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
                marginBottom: 12,
                fontWeight: 600,
              }}
            >
              Chapter {num}
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 3.8vw, 48px)',
                lineHeight: 1.04,
                letterSpacing: 0,
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 22,
                maxWidth: '18ch',
              }}
            >
              {title}
            </h3>
            <div
              style={{
                fontSize: 17,
                color: 'var(--color-text-muted)',
                lineHeight: 1.65,
                maxWidth: '58ch',
              }}
            >
              {body}
            </div>
          </div>

          {/* Marginalia - a printed-book-style aside */}
          <aside
            className="hidden lg:block"
            style={{
              borderLeft: '1px solid var(--color-border-strong)',
              paddingLeft: 20,
              marginTop: 6,
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-text-subtle)',
                marginBottom: 8,
              }}
            >
              Marginal note
            </div>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: 'var(--color-text)',
                fontStyle: 'italic',
                margin: 0,
              }}
            >
              {marginalia}
            </p>
          </aside>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <figure style={{ margin: '36px 0 0 0' }}>
          <div
            className="font-mono"
            style={{
              fontSize: 10.5,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-text-subtle)',
              marginBottom: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span aria-hidden style={{ width: 18, height: 1, background: 'var(--color-border-strong)' }} />
            <span style={{ color: 'var(--color-accent)' }}>{figLabel}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
            <span>{figCaption}</span>
          </div>
          {figure}
        </figure>
      </Reveal>
    </article>
  );
}

function Features() {
  return (
    <section id="features" style={{ position: 'relative' }}>
      <SectionRule />
      <ChapterMarker num="02" label="Field manual" />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-24 md:py-28">
        <Reveal>
          <div style={{ marginBottom: 24 }}>
            <Eyebrow index="02">Field manual</Eyebrow>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(40px, 6vw, 88px)',
                lineHeight: 0.96,
                letterSpacing: 0,
                fontWeight: 600,
                color: 'var(--color-text)',
                marginTop: 16,
                maxWidth: '20ch',
              }}
            >
              Customer evidence and API evidence,<br />in one product.
            </h2>
          </div>
        </Reveal>

        <Chapter
          num="02.01"
          title="Product Missions turn evidence into reviewed code."
          body={
            <>
              Start with a real support report, regression, AI failure, or repeated feature request. FetchLab binds
              that evidence to the desired customer outcome and a specific repository commit.
              <br /><br />
              It reads a bounded set of source files, asks questions instead of inventing missing facts, and prepares
              exact replacement content with acceptance criteria, risks, and a deterministic fingerprint.
            </>
          }
          marginalia="A summary is not the product. The value is preserving the chain from original evidence to the exact code a human reviewed."
          figLabel="Fig. 02.01"
          figCaption="Evidence, source, proposal, approval"
          figure={<ProposalReviewVisual />}
        />

        <Chapter
          num="02.02"
          title="API Lab keeps investigation grounded in real behavior."
          body={
            <>
              Build requests, organize collections, manage environments, run scripts, compare responses, inspect JSON,
              validate schemas, test WebSocket and SSE streams, and generate OpenAPI artifacts.
              <br /><br />
              API Lab remains a full workspace, not a hidden utility. Use it beside Product Missions whenever the problem
              crosses an endpoint, model route, auth flow, streaming connection, or multi-step API workflow.
            </>
          }
          marginalia="The API client remains one complete bench. Product Missions is the other, with explicit navigation between them."
          figLabel="Fig. 02.02"
          figCaption="Requests, scripts, protocol testing"
          figure={<AIBuilderVisual />}
        />

        <Chapter
          num="02.03"
          title="Enterprise controls for teams that need governance."
          body={
            <>
              Run FetchLab with PostgreSQL-backed accounts, personal and team workspaces, encrypted evidence and credentials,
              JWT sessions, 2FA, rate limits, admin audit logs, retention controls, OIDC SSO, and SCIM provisioning.
              <br /><br />
              GitHub and model access are configured per workspace. Members can investigate and approve; viewers can inspect
              the record without creating repository changes. Every external action is auditable.
            </>
          }
          marginalia="This is the buyer-facing change: FetchLab is no longer just an installer or a local API client. It is a web app, desktop app, and enterprise-controlled AI development bench."
          figLabel="Fig. 02.03"
          figCaption="Workspace configuration and hard boundaries"
          figure={<ReleaseDecisionVisual />}
          last
        />
      </div>
    </section>
  );
}

/* ---------- Teal ticker bar - different rhythm from the Declaration ---------- */

function TickerBar() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.4 });
  // Build a marquee string from the specimens; double it so the loop is seamless
  const tickerItems = [
    'WEB APP - /APP - LIVE WORKBENCH',
    'DESKTOP - WINDOWS EXE + MSI',
    'API BENCH - REST + GRAPHQL + WEBSOCKET + SSE',
    'PRODUCT MISSIONS - EVIDENCE + PROPOSAL + DRAFT PR + CHECKS',
    'ENTERPRISE - POSTGRES + RBAC + AUDIT + SSO',
    'BOUNDARY - HUMAN APPROVAL + NO MERGE + NO DEPLOY',
  ];
  const seq = [...tickerItems, ...tickerItems];

  return (
    <section
      style={{
        background: 'var(--color-accent)',
        color: 'var(--color-accent-ink)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div ref={ref} className="max-w-[1280px] mx-auto px-6 lg:px-8 py-16 md:py-20">
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-ink)',
            opacity: visible ? 0.85 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(6px)',
            transition: `opacity 600ms ${EASE}, transform 600ms ${EASE}`,
            marginBottom: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span aria-hidden style={{ width: 22, height: 1, background: 'currentColor', opacity: 0.7 }} />
          One surface for API and AI teams
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 5.4vw, 84px)',
            lineHeight: 0.98,
            letterSpacing: 0,
            fontWeight: 600,
            color: 'var(--color-accent-ink)',
            margin: 0,
            maxWidth: '22ch',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(12px)',
            transition: `opacity 700ms ${EASE} 120ms, transform 700ms ${EASE} 120ms`,
          }}
        >
          Web app, desktop installer, API bench, AI bench, and enterprise controls in one product.
        </h2>
      </div>

      {/* Live ticker bar - continuous scroll, seamless loop */}
      <div
        aria-hidden
        style={{
          borderTop: '1px solid color-mix(in oklch, var(--color-accent-ink) 28%, transparent)',
          background: 'color-mix(in oklch, var(--color-accent) 70%, black)',
          color: 'var(--color-accent-ink)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            animation: 'fl-marquee 40s linear infinite',
            willChange: 'transform',
          }}
        >
          {seq.map((item, i) => (
            <span
              key={i}
              className="font-mono"
              style={{
                padding: '14px 28px',
                fontSize: 11,
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                opacity: 0.82,
                borderRight: '1px solid color-mix(in oklch, var(--color-accent-ink) 24%, transparent)',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Product surface archive - horizontal strip of buyer-facing proof ---------- */

const SPECIMENS = [
  { num: '0001', time: 'Primary bench', service: 'Product Missions', cause: 'Capture a customer issue, regression, AI failure, or repeated request with the outcome that must change.', pr: '/app', fix: 'Evidence', status: 'closed' },
  { num: '0002', time: 'Investigation', service: 'Bounded repository review', cause: 'Select only relevant source, exclude sensitive paths, and ask for missing evidence instead of fabricating a fix.', pr: 'Built in', fix: 'Context', status: 'closed' },
  { num: '0003', time: 'Human gate', service: 'Exact proposal approval', cause: 'Bind approval to complete proposed source, risks, acceptance criteria, base commit, and a deterministic fingerprint.', pr: 'Built in', fix: 'Review', status: 'closed' },
  { num: '0004', time: 'GitHub', service: 'Draft PR and checks', cause: 'Create an isolated branch and draft pull request, then distinguish passed, failed, pending, and unverified checks.', pr: 'Built in', fix: 'PR', status: 'closed' },
  { num: '0005', time: 'Second bench', service: 'API Lab', cause: 'Keep REST, GraphQL, WebSocket, SSE, collections, environments, scripts, diffs, and history beside the mission.', pr: 'Built in', fix: 'API', status: 'closed' },
  { num: '0006', time: 'Teams', service: 'Enterprise backend', cause: 'Use PostgreSQL accounts, workspace RBAC, encrypted credentials, audit logs, retention, SSO, and SCIM.', pr: '/enterprise', fix: 'Control', status: 'closed' },
];

function SpecimenCard({ s, index, revealed }: { s: typeof SPECIMENS[number]; index: number; revealed: boolean }) {
  const delay = index * 70;
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: '0 0 320px',
        background: 'var(--color-surface)',
        border: `1px solid ${hover ? 'var(--color-text)' : 'var(--color-border-strong)'}`,
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'relative',
        cursor: 'default',
        opacity: revealed ? 1 : 0,
        transform: revealed
          ? (hover ? 'translateY(-3px)' : 'translateY(0)')
          : 'translateY(10px)',
        transition: revealed
          ? `transform 280ms ${EASE}, border-color 220ms ${EASE}`
          : `opacity 460ms ${EASE} ${delay}ms, transform 460ms ${EASE} ${delay}ms`,
      }}
    >
      {/* Hairline underline that draws in on hover */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: -1,
          height: 1,
          background: 'var(--color-accent)',
          transform: hover ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
          transition: `transform 420ms ${EASE}`,
        }}
      />
      <div className="flex items-baseline justify-between">
        <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
          SURFACE {s.num}
        </span>
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text)', fontWeight: 500 }}>
          {s.fix}
        </span>
      </div>

      <div>
        <div className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--color-text-subtle)', textTransform: 'uppercase', marginBottom: 4 }}>
          {s.time}
        </div>
        <div className="font-mono" style={{ fontSize: 12.5, color: 'var(--color-text)' }}>
          {s.service}
        </div>
      </div>

      <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-muted)', margin: 0, flex: 1 }}>
        {s.cause}
      </p>

      <div className="flex items-baseline justify-between" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
        <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>
          {s.status === 'closed' ? 'Ready' : 'Planned'}
        </span>
        <span className="font-mono" style={{ fontSize: 12, color: s.status === 'closed' ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}>
          {s.pr}
        </span>
      </div>
    </div>
  );
}

function SpecimensArchive() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.15 });
  return (
    <section style={{ position: 'relative' }}>
      <SectionRule />
      <ChapterMarker num="05" label="Product surfaces" />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-24 md:py-28">
        <Reveal>
          <div className="flex items-end justify-between flex-wrap gap-6" style={{ marginBottom: 28 }}>
            <div>
              <Eyebrow index="05">Archive - product surfaces</Eyebrow>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(28px, 3.8vw, 44px)',
                  lineHeight: 1.08,
                  letterSpacing: 0,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  marginTop: 18,
                  marginBottom: 12,
                  maxWidth: '24ch',
                }}
              >
                What a team can use today.
              </h2>
              <p style={{ fontSize: 16, maxWidth: '52ch', color: 'var(--color-text-muted)', lineHeight: 1.55, margin: 0 }}>
                Start locally with encrypted mission drafts and the full API Lab. Sign in to connect a repository, investigate source, approve an exact proposal, and create a draft pull request.
              </p>
            </div>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>
              <Counter target={SPECIMENS.length} /> working product surfaces
            </div>
          </div>
        </Reveal>

        <div
          ref={ref}
          className="overflow-x-auto"
          style={{
            display: 'flex',
            gap: 14,
            paddingBottom: 4,
            margin: '0 -8px',
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          {SPECIMENS.map((s, i) => (
            <SpecimenCard key={s.num} s={s} index={i} revealed={visible} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Vertical chapter marker (left margin, like a printed book) ---------- */

function ChapterMarker({ num, label }: { num: string; label: string }) {
  return (
    <div
      aria-hidden
      className="hidden xl:flex"
      style={{
        position: 'absolute',
        top: 96,
        left: 28,
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--color-text-subtle)',
        alignItems: 'center',
        gap: 14,
        userSelect: 'none',
      }}
    >
      <span style={{ color: 'var(--color-accent)' }}>Sec {num}</span>
      <span aria-hidden style={{ width: 28, height: 1, background: 'var(--color-border-strong)' }} />
      <span>{label}</span>
    </div>
  );
}

/* ---------- Pull-quote - one editorial moment, no logo wall ---------- */

function PullQuote() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.4 });
  return (
    <section style={{ position: 'relative' }}>
      <SectionRule />
      <ChapterMarker num="*" label="Field notes" />
      <div ref={ref} className="max-w-[1280px] mx-auto px-6 lg:px-8 py-24 md:py-32">
        <div className="grid lg:grid-cols-[1fr_auto] gap-14 lg:gap-20 items-end">
          <div>
            <div
              style={{
                marginBottom: 32,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 600ms ${EASE}, transform 600ms ${EASE}`,
              }}
            >
              <Eyebrow index="*">Product principle</Eyebrow>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4.8vw, 64px)',
                lineHeight: 1.06,
                letterSpacing: 0,
                fontWeight: 500,
                color: 'var(--color-text)',
                margin: 0,
                maxWidth: '22ch',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(14px)',
                transition: `opacity 700ms ${EASE} 120ms, transform 700ms ${EASE} 120ms`,
              }}
            >
              The customer problem should remain attached to the code change until a human and the repository checks have reviewed it.
            </div>
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(6px)',
                transition: `opacity 600ms ${EASE} 320ms, transform 600ms ${EASE} 320ms`,
              }}
            >
              <span aria-hidden style={{ width: 28, height: 1, background: 'var(--color-border-strong)' }} />
              <span
                className="font-mono"
                style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
              >
                FetchLab mission model
              </span>
            </div>
          </div>

          {/* Right column - small "specimen receipt" with the actual fix metadata */}
          <div
            className="hidden lg:block"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(10px)',
              transition: `opacity 700ms ${EASE} 220ms, transform 700ms ${EASE} 220ms`,
            }}
          >
            <div
              style={{
                border: '1px solid var(--color-border-strong)',
                borderRadius: 8,
                background: 'var(--color-surface)',
                padding: '14px 18px',
                minWidth: 280,
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                letterSpacing: '0.06em',
              }}
            >
              <div style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: 12 }}>
                Product - receipt
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', rowGap: 6, color: 'var(--color-text-muted)' }}>
                <span>Web</span>        <span style={{ color: 'var(--color-text)' }}>/app</span>
                <span>Desktop</span>    <span style={{ color: 'var(--color-text)' }}>EXE + MSI</span>
                <span>Enterprise</span> <span style={{ color: 'var(--color-accent)' }}>RBAC + SSO</span>
                <span>Primary</span>     <span style={{ color: 'var(--color-text)' }}>Product Missions</span>
                <span>Second bench</span><span style={{ color: 'var(--color-text)' }}>API Lab</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ---------- Closing ---------- */

function Closing() {
  const { country } = useCountry();
  const isIN = country === 'IN';
  return (
    <section style={{ position: 'relative' }}>
      <SectionRule />
      <ChapterMarker num="07" label="Run it" />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-28 md:py-36">
        <Reveal>
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-10 lg:gap-16 items-end">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(44px, 8vw, 116px)',
                lineHeight: 0.94,
                letterSpacing: 0,
                fontWeight: 600,
                color: 'var(--color-text)',
                margin: 0,
                maxWidth: '14ch',
              }}
            >
              Bring one real product problem.<br />
              <span style={{ color: 'var(--color-text-muted)' }}>Leave with a reviewable change.</span>
            </h2>
            <div>
              <div className="flex flex-wrap gap-3"><CTA href="/app">Create a product mission</CTA><GhostCTA href="/download">Download installer</GhostCTA></div>
              <div
                className="font-mono"
                style={{
                  marginTop: 14,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-subtle)',
                  lineHeight: 1.6,
                }}
              >
                <div>Web app available now - Windows installer included</div>
                <div>
                  Local mode free - startup pilot $0 for 30 days -{' '}
                  <a href="/pricing" style={{ color: 'var(--color-text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}>full pricing</a>
                </div>
                {isIN && (
                  <div style={{ color: 'var(--color-text-subtle)', marginTop: 4 }}>
                    Made for engineering teams from Bangalore to Berlin
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function Footer() {
  return (
    <footer>
      <SectionRule />
      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-6">
            <a href="/" aria-label="FetchLab home">
              <FetchLabLogo markSize={28} wordmarkSize={13.5} />
            </a>
            <div className="hidden md:flex items-center gap-5" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              <a href="/pricing" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Pricing</a>
              <a href="/enterprise" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Enterprise</a>
              <a href="/privacy" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Privacy</a>
              <a href="/terms" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Terms</a>
              <a href="https://github.com/vkavali/fetchlab" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>GitHub</a>
            </div>
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}
          >
            FetchLab - Product Missions + API Lab - (c) 2026
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Root ---------- */

export default function Landing() {
  // Marketing is always light. If the user came from a dark in-app session
  // and bounced back to /, force the page to brand-light.
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    if (wasDark) html.classList.remove('dark');
    return () => {
      if (wasDark) html.classList.add('dark');
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <ScrollProgress />
      <Nav />
      <Hero />
      <Declaration />
      <HowItWorks />
      <Features />
      <TickerBar />
      <SpecimensArchive />
      <PullQuote />
      <Closing />
      <Footer />
    </div>
  );
}
