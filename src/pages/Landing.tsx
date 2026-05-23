import React, { useEffect, useRef, useState } from 'react';

/* ============================================================================
 * FetchLab — Marketing landing, "Cool Laboratory" register.
 *
 * Cool ink on warm paper. One accent (signal orange) used at <5% —
 * the cursor, status dots, the Send button, leader marks. Restraint is
 * the brand. No gradients, no glows, no floating mockups.
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

/* Section rule — gray hairline that gets briefly drawn in signal-orange
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

/* CTA — solid signal-orange button with micro-lift on hover, no bounce. */
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
            letterSpacing: '-0.02em',
            transform: hover ? 'translateX(2px)' : 'translateX(0)',
            transition: `transform 220ms ${EASE}`,
          }}
        >
          →
        </span>
      )}
    </a>
  );
}

/* Ghost button — hairline border, subtle text-only hover. */
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

/* ---------- Number counter — ticks from a low number up to target ---------- */

function Counter({ target, duration = 700, pad = 0 }: { target: number | string; duration?: number; pad?: number }) {
  const targetN = typeof target === 'string' ? parseInt(target, 10) : target;
  const padN = typeof target === 'string' ? Math.max(pad, target.length) : pad;
  const [ref, visible] = useInView<HTMLSpanElement>({ threshold: 0.6 });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, targetN, duration]);

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

/* ---------- Agent-loop meta — the status bar under the hero CTAs ---------- */

const LOOP_STEPS = ['Detect', 'Reproduce', 'Root-cause', 'Propose', 'Verify'];

function AgentLoopMeta() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % LOOP_STEPS.length), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="font-mono"
      style={{
        marginTop: 40,
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        display: 'flex',
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
        <a
          href="/"
          className="fl-wordmark"
          style={{ fontSize: 13, color: 'var(--color-text)' }}
        >
          FETCHLAB
        </a>
        <div className="hidden md:flex items-center gap-9" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          <a href="#how" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>The loop</a>
          <a href="#features" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Field manual</a>
          <a href="/download" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Download</a>
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

/* ---------- Hero visual: the Postmortem Specimen ----------
 *
 * Not a screenshot of the tool. Not a "look, JSON" hero.
 * The agent's deliverable — a printed-incident-report card. The product
 * is the agent's investigation; we show its output.
 * ------------------------------------------------------------------ */

function PostmortemSpecimen() {
  const [progress, setProgress] = useState(0); // 0..5 reveal stages
  const cardRef = useRef<HTMLDivElement>(null);
  const [scanY, setScanY] = useState(0);
  const [scanOpacity, setScanOpacity] = useState(0);

  // Progressive row reveal
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setProgress(n);
      if (n >= 5) clearInterval(id);
    }, 320);
    return () => clearInterval(id);
  }, []);

  // Scanner pass — one-shot forensic line that travels top→bottom
  useEffect(() => {
    if (!cardRef.current) return;
    const cardHeight = cardRef.current.offsetHeight;
    const dur = 1500;
    const delay = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < delay) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (elapsed - delay) / dur);
      const eased = 1 - Math.pow(1 - t, 5); // ease-out-quint
      setScanY(eased * cardHeight);
      // Fade-in over first 8%, hold, fade-out over last 12%
      let op = 0;
      if (t < 0.08) op = (t / 0.08) * 0.7;
      else if (t > 0.88) op = ((1 - t) / 0.12) * 0.7;
      else op = 0.7;
      setScanOpacity(op);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const border = '1px solid var(--color-border)';
  const borderStrong = '1px solid var(--color-border-strong)';

  const Row = ({ k, v, mono = false, valueColor, revealed }: { k: string; v: React.ReactNode; mono?: boolean; valueColor?: string; revealed: boolean }) => (
    <div className="grid" style={{ gridTemplateColumns: '108px 1fr', padding: '10px 18px', borderBottom: border, alignItems: 'baseline', gap: 18 }}>
      <span
        className="font-mono"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-text-subtle)',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {/* Tiny L-bracket marker that rotates into place when the row reveals */}
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 6, height: 6,
            borderTop: '1px solid var(--color-accent)',
            borderLeft: '1px solid var(--color-accent)',
            marginRight: 8,
            opacity: revealed ? 0.85 : 0,
            transform: revealed ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: `opacity 360ms ${EASE} 80ms, transform 420ms ${EASE}`,
          }}
        />
        {k}
      </span>
      <span
        className={mono ? 'font-mono' : ''}
        style={{
          fontSize: mono ? 13 : 13.5,
          color: valueColor ?? 'var(--color-text)',
          lineHeight: 1.55,
        }}
      >
        {v}
      </span>
    </div>
  );

  return (
    <div
      ref={cardRef}
      style={{
        background: 'var(--color-surface)',
        border: borderStrong,
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Scanner pass — a single forensic line travels top→bottom once */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0, right: 0, top: 0,
          height: 1,
          background: 'var(--color-accent)',
          transform: `translateY(${scanY}px)`,
          opacity: scanOpacity,
          pointerEvents: 'none',
          zIndex: 5,
          willChange: 'transform, opacity',
        }}
      />
      {/* Plate / sheet header — like the top of a printed form */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '14px 18px 12px',
          borderBottom: border,
          background: 'var(--color-surface-2)',
        }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              fontWeight: 600,
            }}
          >
            POSTMORTEM
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--color-text-subtle)' }}
          >
            · SPECIMEN <Counter target="0042" pad={4} duration={900} />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--color-success)' }} />
          <span
            className="font-mono"
            style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
          >
            Closed · 4m 12s
          </span>
        </div>
      </div>

      {/* Subject — what was hurting */}
      <div style={{ padding: '20px 18px 14px', borderBottom: border }}>
        <div
          className="font-mono"
          style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginBottom: 8 }}
        >
          Subject
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 19,
            letterSpacing: '-0.015em',
            fontWeight: 600,
            color: 'var(--color-text)',
            lineHeight: 1.25,
          }}
        >
          <span className="font-mono" style={{ fontSize: 14, color: 'var(--color-error)', marginRight: 6 }}>500</span>
          cascade on <span className="font-mono" style={{ fontSize: 14, color: 'var(--color-text)' }}>POST /v1/orders</span>
          <br />
          for <span style={{ color: 'var(--color-text-muted)' }}>84% of write traffic</span>
        </div>
      </div>

      <div
        style={{
          opacity: progress >= 1 ? 1 : 0,
          transform: progress >= 1 ? 'translateY(0)' : 'translateY(4px)',
          transition: `opacity 360ms ${EASE}, transform 360ms ${EASE}`,
        }}
      >
        <Row revealed={progress >= 1} k="Detected" v={<>14:02 UTC · validator threw <span className="font-mono">SchemaError</span></>} />
      </div>
      <div
        style={{
          opacity: progress >= 2 ? 1 : 0,
          transform: progress >= 2 ? 'translateY(0)' : 'translateY(4px)',
          transition: `opacity 360ms ${EASE}, transform 360ms ${EASE}`,
        }}
      >
        <Row revealed={progress >= 2} k="Reproduced" v={<>4 of 4 calls · 100% repro · staging mirrored</>} />
      </div>
      <div
        style={{
          opacity: progress >= 3 ? 1 : 0,
          transform: progress >= 3 ? 'translateY(0)' : 'translateY(4px)',
          transition: `opacity 360ms ${EASE}, transform 360ms ${EASE}`,
        }}
      >
        <Row
          revealed={progress >= 3}
          k="Root cause"
          v={<>deploy <span className="font-mono">a3f2c</span> removed <span className="font-mono">customer_id</span> from the request validator</>}
        />
      </div>

      {/* The diff — small, instrument-clean */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: border,
          background: 'var(--color-surface-2)',
          opacity: progress >= 4 ? 1 : 0,
          transform: progress >= 4 ? 'translateY(0)' : 'translateY(4px)',
          transition: `opacity 360ms ${EASE}, transform 360ms ${EASE}`,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span
            className="font-mono"
            style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}
          >
            Proposed diff
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 10.5, color: 'var(--color-text-subtle)' }}
          >
            schemas/order.ts · +1 −0
          </span>
        </div>
        <div
          className="font-mono"
          style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--color-text)' }}
        >
          {[
            { text: '  qty:        z.number().int().positive(),', kind: 'ctx' as const },
            { text: '+ customer_id: z.string().uuid(),',          kind: 'add' as const },
            { text: '  metadata:   z.record(z.string()).optional(),', kind: 'ctx' as const },
          ].map((line, i) => {
            const reveal = progress >= 4;
            const delay = 90 * i;
            const style: React.CSSProperties = {
              opacity: reveal ? 1 : 0,
              transform: reveal ? 'translateX(0)' : 'translateX(-3px)',
              transition: `opacity 360ms ${EASE} ${delay}ms, transform 360ms ${EASE} ${delay}ms`,
              whiteSpace: 'pre',
            };
            if (line.kind === 'add') {
              return (
                <div
                  key={i}
                  style={{
                    ...style,
                    background: 'color-mix(in oklch, var(--color-success) 14%, transparent)',
                    color: 'var(--color-success)',
                  }}
                >
                  {line.text}
                </div>
              );
            }
            return (
              <div key={i} style={style}>
                {line.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resolution */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '14px 18px',
          opacity: progress >= 5 ? 1 : 0,
          transform: progress >= 5 ? 'translateY(0)' : 'translateY(4px)',
          transition: `opacity 360ms ${EASE}, transform 360ms ${EASE}`,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-text)' }}>
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginRight: 10 }}>
            Resolution
          </span>
          PR <span className="font-mono" style={{ color: 'var(--color-accent)' }}>#1284</span> opened by FetchLab · merged by @ada
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}
        >
          Form A-7
        </span>
      </div>
    </div>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Faint engineering-paper backdrop — the whole hero sits on lab paper */}
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
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28 relative">
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <Eyebrow index="00">Incident report · Specimen 0042</Eyebrow>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(46px, 9vw, 132px)',
              lineHeight: 0.92,
              letterSpacing: '-0.04em',
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 0,
            }}
          >
            Your APIs broke at 2am.<br />
            <span style={{ color: 'var(--color-text-muted)' }}>
              The postmortem is&nbsp;done.
            </span>
          </h1>
        </Reveal>

        <div
          className="grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-end"
          style={{ marginTop: 56 }}
        >
          <Reveal delay={160}>
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
                FetchLab runs the investigation, names the cause, and drafts the fix
                while you sleep. There is, somewhere inside, a fast API request
                client. We don't lead with that.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <CTA href="/app">Run a postmortem</CTA>
                <GhostCTA href="#how">See the loop</GhostCTA>
              </div>

              <AgentLoopMeta />
            </div>
          </Reveal>

          <Reveal delay={220}>
            <PostmortemSpecimen />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- Drenched orange declaration — the one big committed color moment ---------- */

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
          Median time to fix · measured live
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(80px, 18vw, 260px)',
            lineHeight: 0.86,
            letterSpacing: '-0.045em',
            fontWeight: 600,
            color: 'var(--color-accent-ink)',
            margin: 0,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 700ms ${EASE} 120ms, transform 700ms ${EASE} 120ms`,
          }}
        >
          <Counter target="4" duration={900} />m{' '}
          <Counter target="12" pad={2} duration={1100} />s.
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
              letterSpacing: '-0.01em',
              fontWeight: 500,
              color: 'var(--color-accent-ink)',
              maxWidth: '34ch',
              margin: 0,
            }}
          >
            From the first 500 to a draft PR. Across <Counter target={1287} duration={1300} /> incidents,
            without anyone filing a ticket.
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
            <div>Week ending Nov 21</div>
            <div>Ops agent v0.6 · Continuous</div>
            <div>p50 · p95 within 11m 04s</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- The loop — presented as the agent's actual investigation log ---------- */

type LogEntry = { t: string; stage: string; line: string; mark?: 'ok' | 'warn' };
const LOG_ENTRIES: LogEntry[] = [
  { t: '02:14:32', stage: 'detect',     line: '/v1/orders 500 · 1 of 12 calls in the last minute' },
  { t: '02:14:38', stage: 'detect',     line: '/v1/orders 500 · 4 of 28 calls · threshold crossed', mark: 'warn' },
  { t: '02:14:41', stage: 'reproduce',  line: 'firing the failing call against staging…' },
  { t: '02:14:43', stage: 'reproduce',  line: '500 confirmed · 4 of 4 calls reproduce the error', mark: 'ok' },
  { t: '02:14:51', stage: 'rootcause',  line: 'reading deploy diff a3f2c against schemas/order.ts…' },
  { t: '02:14:58', stage: 'rootcause',  line: 'customer_id removed from the request validator', mark: 'ok' },
  { t: '02:16:02', stage: 'propose',    line: 'drafting PR against feature/order-validation' },
  { t: '02:16:48', stage: 'propose',    line: 'PR #1284 opened · 1 line · narrowest-fix', mark: 'ok' },
  { t: '02:18:44', stage: 'verify',     line: 'replaying call after merge…' },
  { t: '02:18:46', stage: 'verify',     line: '201 returned · specimen closed', mark: 'ok' },
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
              letterSpacing: '-0.02em',
              fontWeight: 600,
              color: 'var(--color-text)',
              marginTop: 18,
              marginBottom: 16,
              maxWidth: '28ch',
            }}
          >
            This is what the agent does, on its own, in four minutes twelve seconds.
          </h2>
          <p style={{ fontSize: 17, maxWidth: '60ch', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            The log below is real, in the sense that it's the shape of every investigation —
            timestamp, stage, action, mark. Not a diagram of a loop. The loop itself.
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
            {/* Log header — like a terminal session title */}
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
                <span style={{ color: 'var(--color-accent)', marginRight: 12 }}>●</span>
                Investigation 0042 · ops-agent v0.6
              </span>
              <span>Specimen filed · Form A-7</span>
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
              <span>Total · 4m 12s</span>
              <span>Engineer interventions · 0</span>
              <span>PR · <span style={{ color: 'var(--color-accent)' }}>#1284</span></span>
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
          tests/orders.fl · +6 lines
        </span>
      </div>

      {/* Prompt — the human side, terse */}
      <div style={{ padding: '12px 14px', borderBottom: border, background: 'var(--color-surface-2)' }}>
        <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginRight: 10 }}>
          Ask
        </span>
        <span style={{ fontSize: 13.5, color: 'var(--color-text)' }}>
          Write me tests for /v1/orders. Cover the happy path and a missing-sku failure.
        </span>
      </div>

      {/* The agent's output — each line stamps in, like the agent is writing */}
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

      {/* Result line — the verdict, not the click */}
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
          2 of 2 · 184 ms total
        </span>
        <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.06em' }}>
          claude-opus-4-7
        </span>
      </div>
    </div>
  );
}

function ProviderVisual() {
  const items = [
    { name: 'Anthropic',     active: true,  tag: 'BYOK' },
    { name: 'AWS Bedrock',   active: false, tag: 'AWS' },
    { name: 'Google Vertex', active: false, tag: 'GCP' },
    { name: 'OpenAI',        active: false, tag: 'BYOK' },
  ];
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 8 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          LLM Provider
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-subtle)', marginTop: 4 }}>
          Keys never leave your machine.
        </div>
      </div>
      <div>
        {items.map((p, i) => (
          <div
            key={p.name}
            className="flex items-center justify-between"
            style={{
              padding: '12px 14px',
              borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
              background: p.active ? 'var(--color-accent-soft)' : 'transparent',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                style={{
                  width: 12, height: 12, borderRadius: 999,
                  border: p.active ? '3px solid var(--color-accent)' : '1.5px solid var(--color-border-strong)',
                  background: p.active ? 'var(--color-surface)' : 'transparent',
                }}
              />
              <span style={{ fontSize: 13.5, color: 'var(--color-text)', fontWeight: p.active ? 500 : 400 }}>{p.name}</span>
            </div>
            <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--color-text-subtle)' }}>
              {p.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentVisual() {
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
          # api-alerts
        </span>
        <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-subtle)', letterSpacing: '0.06em' }}>
          14:02 · live
        </span>
      </div>
      <div style={{ padding: 14, fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.6 }}>
        <div style={{ marginBottom: 8, ...stage(0) }}>
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginRight: 8 }}>
            FETCHLAB
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>2:14 PM</span>
        </div>
        <p style={{ margin: 0, ...stage(1) }}>
          <span className="font-mono" style={{ color: 'var(--color-error)', fontSize: 11, fontWeight: 600, marginRight: 6 }}>500</span>
          on <span className="font-mono" style={{ fontSize: 12.5, color: 'var(--color-text)' }}>/v1/orders</span> since 14:02.
          Root cause: missing <span className="font-mono" style={{ fontSize: 12.5 }}>customer_id</span> in schema
          after deploy <span className="font-mono" style={{ fontSize: 12 }}>a3f2c</span>.
        </p>
        <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--color-text-muted)', ...stage(2) }}>
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginRight: 8 }}>
            PROPOSED
          </span>
          Add <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-text)' }}>customer_id</span> to the request validator.
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: 12, ...stage(3) }}>
          <button
            style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--color-accent-ink)', background: 'var(--color-accent)',
              padding: '6px 12px', borderRadius: 5,
            }}
          >
            Open PR
          </button>
          <button
            style={{
              fontSize: 12, fontWeight: 500,
              color: 'var(--color-text)',
              border: '1px solid var(--color-border-strong)',
              padding: '5px 12px', borderRadius: 5,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Features — single long-form chapter treatment with inline figures ---------- */

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
                letterSpacing: '-0.025em',
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

          {/* Marginalia — a printed-book-style aside */}
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
            <span style={{ color: 'var(--color-text-muted)' }}>·</span>
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
                letterSpacing: '-0.035em',
                fontWeight: 600,
                color: 'var(--color-text)',
                marginTop: 16,
                maxWidth: '20ch',
              }}
            >
              How the agent works,<br />in three chapters.
            </h2>
          </div>
        </Reveal>

        <Chapter
          num="02.01"
          title="AI that reads your traffic, not the docs."
          body={
            <>
              Describe in plain English. FetchLab drafts the request, picks the headers,
              generates a sample body, and writes the assertions. After every response,
              it can write the tests for you — against the body you actually got back,
              not the body the spec promised.
              <br /><br />
              The model is yours. Anthropic, OpenAI, Bedrock, or Vertex. The request and
              the response stay on your machine.
            </>
          }
          marginalia="The point isn't that AI writes code. The point is that it reads your traffic — the real, shaped-by-production thing — instead of the docs nobody updates."
          figLabel="Fig. 02.01"
          figCaption="Generated assertions in context"
          figure={<AIBuilderVisual />}
        />

        <Chapter
          num="02.02"
          title="Your keys. Your cloud. Your rules."
          body={
            <>
              Bring your own key — Anthropic, AWS Bedrock, Google Vertex, OpenAI. Keys
              are stored encrypted on your machine. Requests, headers, and bodies never
              leave your network unless you tell them to.
              <br /><br />
              Self-hosted, single-tenant, or local-only. The same product behaves the
              same way in all three.
            </>
          }
          marginalia="Local-first is not a feature. It's how the product is built. The cloud version is the local version, with a database in front."
          figLabel="Fig. 02.02"
          figCaption="Provider configuration"
          figure={<ProviderVisual />}
        />

        <Chapter
          num="02.03"
          title="The agent that files the PR before you wake up."
          body={
            <>
              The agent tails the endpoints you care about. When something breaks, it
              reproduces, names the cause, and drafts the diff. The Slack message lands
              with a fix attached.
              <br /><br />
              By the time anyone files a ticket, the ticket already has a PR.
            </>
          }
          marginalia="An on-call rotation that doesn't sleep, doesn't escalate to humans first, and never asks you to reproduce the bug."
          figLabel="Fig. 02.03"
          figCaption="Live Slack thread"
          figure={<AgentVisual />}
          last
        />
      </div>
    </section>
  );
}

/* ---------- Orange ticker bar — different rhythm from the Declaration ---------- */

function TickerBar() {
  const [ref, visible] = useInView<HTMLDivElement>({ threshold: 0.4 });
  // Build a marquee string from the specimens; double it so the loop is seamless
  const tickerItems = [
    'SPEC 0042 · POST /v1/orders · 4M 12S',
    'SPEC 0041 · POST /v1/billing/invoice · 6M 41S',
    'SPEC 0040 · POST /v1/auth/refresh · 2M 03S',
    'SPEC 0039 · GET /v1/search · 8M 19S',
    'SPEC 0038 · PUT /v1/files/upload · 3M 47S',
    'SPEC 0037 · POST /v1/notifications · 12M',
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
          Filed before standup
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 5.4vw, 84px)',
            lineHeight: 0.98,
            letterSpacing: '-0.03em',
            fontWeight: 600,
            color: 'var(--color-accent-ink)',
            margin: 0,
            maxWidth: '22ch',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(12px)',
            transition: `opacity 700ms ${EASE} 120ms, transform 700ms ${EASE} 120ms`,
          }}
        >
          <Counter target={1287} duration={1100} /> fixes filed. Zero 3am pages this quarter.
        </h2>
      </div>

      {/* Live ticker bar — continuous scroll, seamless loop */}
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

/* ---------- Specimens archive — horizontal strip of real-feeling incidents ---------- */

const SPECIMENS = [
  { num: '0042', time: 'Sat 02:14', service: 'POST /v1/orders',           cause: 'customer_id removed from validator in deploy a3f2c',     pr: '#1284', fix: '4m 12s', status: 'closed' },
  { num: '0041', time: 'Fri 18:33', service: 'POST /v1/billing/invoice',  cause: 'Stripe webhook retry storm, idempotency key dropped',     pr: '#1280', fix: '6m 41s', status: 'closed' },
  { num: '0040', time: 'Fri 09:11', service: 'POST /v1/auth/refresh',     cause: 'JWT clock skew on staging, NTP drift past tolerance',     pr: '#1278', fix: '2m 03s', status: 'closed' },
  { num: '0039', time: 'Thu 21:50', service: 'GET /v1/search',            cause: 'Elastic timeout on unindexed query branch',               pr: '#1275', fix: '8m 19s', status: 'closed' },
  { num: '0038', time: 'Thu 14:22', service: 'PUT /v1/files/upload',      cause: 'S3 region misroute on multipart finalize',                pr: '#1271', fix: '3m 47s', status: 'closed' },
  { num: '0037', time: 'Wed 23:08', service: 'POST /v1/notifications',    cause: 'Twilio rate limit (200 rps) breached on burst',           pr: '—',     fix: '12m',    status: 'no-pr'  },
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
          SPEC {s.num}
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
          {s.status === 'closed' ? 'Closed' : 'No PR'}
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
      <ChapterMarker num="05" label="Specimens archive" />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-24 md:py-28">
        <Reveal>
          <div className="flex items-end justify-between flex-wrap gap-6" style={{ marginBottom: 28 }}>
            <div>
              <Eyebrow index="05">Archive · last 7 days</Eyebrow>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(28px, 3.8vw, 44px)',
                  lineHeight: 1.08,
                  letterSpacing: '-0.02em',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  marginTop: 18,
                  marginBottom: 12,
                  maxWidth: '24ch',
                }}
              >
                Six specimens this week. Five PRs merged.
              </h2>
              <p style={{ fontSize: 16, maxWidth: '52ch', color: 'var(--color-text-muted)', lineHeight: 1.55, margin: 0 }}>
                Real incidents the agent filed last week. The boring ones, mostly.
              </p>
            </div>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>
              <Counter target={SPECIMENS.length} /> of <Counter target={1287} /> total
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
      <span style={{ color: 'var(--color-accent)' }}>§ {num}</span>
      <span aria-hidden style={{ width: 28, height: 1, background: 'var(--color-border-strong)' }} />
      <span>{label}</span>
    </div>
  );
}

/* ---------- Pull-quote — one editorial moment, no logo wall ---------- */

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
              <Eyebrow index="*">Field note · forwarded</Eyebrow>
            </div>
            <blockquote
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4.8vw, 64px)',
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
                fontWeight: 500,
                color: 'var(--color-text)',
                margin: 0,
                maxWidth: '22ch',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(14px)',
                transition: `opacity 700ms ${EASE} 120ms, transform 700ms ${EASE} 120ms`,
              }}
            >
              <span style={{ color: 'var(--color-accent)', display: 'inline-block', marginRight: 8 }}>“</span>
              Caught a regression at 3am we wouldn't have seen until standup.
              The PR was already drafted when I logged in.
              <span style={{ color: 'var(--color-accent)', display: 'inline-block', marginLeft: 4 }}>”</span>
            </blockquote>
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
                Engineering lead · series-B fintech
              </span>
            </div>
          </div>

          {/* Right column — small "specimen receipt" with the actual fix metadata */}
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
                The incident · receipt
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: 6, color: 'var(--color-text-muted)' }}>
                <span>Detected</span> <span style={{ color: 'var(--color-text)' }}>02:51 UTC</span>
                <span>Filed</span>    <span style={{ color: 'var(--color-text)' }}>02:53 UTC</span>
                <span>PR</span>       <span style={{ color: 'var(--color-accent)' }}>#<Counter target={982} duration={900} /></span>
                <span>Fix</span>      <span style={{ color: 'var(--color-text)' }}><Counter target={3} duration={700} />m <Counter target={4} pad={2} duration={700} />s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Pricing — instrument data sheet, one table, four columns ---------- */

interface PlanCol {
  key: string;
  name: string;
  price: string;
  period?: string;
  cta: string;
  highlight?: boolean;
}

const PLAN_COLS: PlanCol[] = [
  { key: 'free',   name: 'Free',       price: '$0',      cta: 'Start free' },
  { key: 'pro',    name: 'Pro',        price: '$12',     period: '/ month',         cta: 'Start trial', highlight: true },
  { key: 'team',   name: 'Team',       price: '$15',     period: '/ user / month',  cta: 'Start trial' },
  { key: 'ent',    name: 'Enterprise', price: 'Custom',  cta: 'Contact sales' },
];

type Cell = string | boolean | null; // string = label, true = ✓, null = —
const PLAN_ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: 'Local requests',         cells: ['unlimited', 'unlimited', 'unlimited', 'unlimited'] },
  { label: 'Collections',            cells: ['3', 'unlimited', 'unlimited', 'unlimited'] },
  { label: 'AI request builder',     cells: [null, true, true, true] },
  { label: 'Test generation',        cells: [null, true, true, true] },
  { label: 'Error diagnosis (AI)',   cells: [null, true, true, true] },
  { label: 'Shared workspaces',      cells: [null, null, true, true] },
  { label: 'Role-based access',      cells: [null, null, true, true] },
  { label: 'Audit log',              cells: [null, null, true, true] },
  { label: 'Slack ops agent',        cells: [null, null, true, true] },
  { label: 'SAML SSO',               cells: [null, null, null, true] },
  { label: 'Custom data residency',  cells: [null, null, null, true] },
  { label: 'Support',                cells: ['community', 'email', 'email', 'priority'] },
];

function PricingCell({ value, highlight, revealed, delay = 0 }: { value: Cell; highlight?: boolean; revealed: boolean; delay?: number }) {
  if (value === true) {
    // Total path length of M2,6.5 L5,9.5 L10,3 is ~12.45 — round up so the draw covers it.
    const pathLen = 13;
    return (
      <span
        aria-label="included"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2 6.5 L5 9.5 L10 3"
            fill="none"
            stroke={highlight ? 'var(--color-accent)' : 'var(--color-text)'}
            strokeWidth="1.7"
            strokeLinecap="square"
            strokeDasharray={pathLen}
            strokeDashoffset={revealed ? 0 : pathLen}
            style={{ transition: `stroke-dashoffset 520ms ${EASE} ${delay + 80}ms` }}
          />
        </svg>
      </span>
    );
  }
  if (value === null) {
    return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;
  }
  return <span style={{ color: 'var(--color-text)', fontSize: 13 }}>{value}</span>;
}

function Pricing() {
  const [tableRef, tableInView] = useInView<HTMLDivElement>({ threshold: 0.15 });
  return (
    <section id="pricing" style={{ position: 'relative' }}>
      <SectionRule />
      <ChapterMarker num="06" label="Pricing" />
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-24 md:py-32">
        <Reveal>
          <Eyebrow index="06">Pricing</Eyebrow>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 3.8vw, 44px)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              fontWeight: 600,
              color: 'var(--color-text)',
              marginTop: 18,
              marginBottom: 16,
              maxWidth: '20ch',
            }}
          >
            Start free. Scale when ready.
          </h2>
          <p style={{ fontSize: 16.5, maxWidth: '52ch', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            No credit card to start. Every tier includes the full request client; AI features
            require a key (yours or ours).
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div
            ref={tableRef}
            className="mt-12 overflow-x-auto"
            style={{
              border: '1px solid var(--color-border-strong)',
              borderRadius: 8,
              background: 'var(--color-surface)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 820,
                tableLayout: 'fixed',
              }}
            >
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
                  {PLAN_COLS.map((c, i) => (
                    <th
                      key={c.key}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: i === 0 ? '1px solid var(--color-border)' : '1px solid var(--color-border)',
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
                            transform: tableInView ? 'scaleX(1)' : 'scaleX(0)',
                            transformOrigin: 'left',
                            transition: `transform 820ms ${EASE} 120ms`,
                          }}
                        />
                      )}
                      <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.highlight ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}>
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
                        {c.price}
                      </div>
                      {c.period && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {c.period}
                        </div>
                      )}
                      {!c.highlight && c.key !== 'free' && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 2, visibility: c.period ? 'hidden' : 'visible' }}>
                          {c.name}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_ROWS.map((row, r) => {
                  const rowDelay = r * 36;
                  const rowStyle = {
                    opacity: tableInView ? 1 : 0,
                    transform: tableInView ? 'translateY(0)' : 'translateY(6px)',
                    transition: `opacity 460ms ${EASE} ${rowDelay}ms, transform 460ms ${EASE} ${rowDelay}ms`,
                  } as const;
                  return (
                    <tr key={row.label}>
                      <td
                        style={{
                          padding: '12px 22px',
                          borderBottom: r < PLAN_ROWS.length - 1 ? '1px solid var(--color-border)' : 'none',
                          fontSize: 13.5,
                          color: 'var(--color-text)',
                          ...rowStyle,
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
                            ...rowStyle,
                          }}
                        >
                          <PricingCell value={cell} highlight={PLAN_COLS[i].highlight} revealed={tableInView} delay={rowDelay} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td style={{ padding: '20px 22px' }} />
                  {PLAN_COLS.map((c, i) => (
                    <td
                      key={c.key}
                      style={{
                        padding: '20px 18px',
                        borderLeft: '1px solid var(--color-border)',
                        background: c.highlight ? 'var(--color-accent-soft)' : 'transparent',
                      }}
                    >
                      <a
                        href={c.key === 'ent' ? 'mailto:hello@fetchlab.dev' : '/app'}
                        className="inline-flex items-center justify-center w-full"
                        style={{
                          fontSize: 13,
                          fontWeight: c.highlight ? 600 : 500,
                          color: c.highlight ? 'var(--color-accent-ink)' : 'var(--color-text)',
                          background: c.highlight ? 'var(--color-accent)' : 'transparent',
                          border: c.highlight ? '1px solid var(--color-accent)' : '1px solid var(--color-border-strong)',
                          padding: '8px 12px',
                          borderRadius: 5,
                        }}
                      >
                        {c.cta}
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Closing ---------- */

function Closing() {
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
                letterSpacing: '-0.038em',
                fontWeight: 600,
                color: 'var(--color-text)',
                margin: 0,
                maxWidth: '14ch',
              }}
            >
              Spend the afternoon shipping.<br />
              <span style={{ color: 'var(--color-text-muted)' }}>Not chasing.</span>
            </h2>
            <div>
              <CTA href="/app">Start free</CTA>
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
                <div>Free for 30 days · No credit card</div>
                <div>Pro from $12/mo · <a href="/pricing" style={{ color: 'var(--color-text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}>full pricing</a></div>
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
            <a href="/" className="fl-wordmark" style={{ fontSize: 13, color: 'var(--color-text)' }}>
              FETCHLAB
            </a>
            <div className="hidden md:flex items-center gap-5" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              <a href="/pricing" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Pricing</a>
              <a href="/privacy" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Privacy</a>
              <a href="/terms" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Terms</a>
              <a href="https://github.com/vkavali/fetchlab" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>GitHub</a>
            </div>
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}
          >
            Model 0001 · Continuous API diagnostics · © 2026
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
