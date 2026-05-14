import { useEffect, useRef, useState } from 'react';

const INDIGO = '#6366F1';
const INDIGO_HOVER = '#4F46E5';
const INDIGO_SOFT = '#EEF2FF';
const INDIGO_BORDER = '#C7D2FE';
const TEXT_DARK = '#111827';
const TEXT_BODY = '#6B7280';
const BORDER = '#E5E7EB';
const TERMINAL_BG = '#0F172A';
const TERMINAL_PANEL = '#1E293B';

/* ---------------- Reveal-on-scroll ---------------- */

function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement | null>(null);
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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const Comp = Tag as 'div';
  return (
    <Comp
      ref={ref as React.RefObject<HTMLDivElement>}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Comp>
  );
}

/* ---------------- Nav ---------------- */

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50 bg-white/85 backdrop-blur-md"
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="/" className="text-[15px] font-semibold tracking-tight" style={{ color: TEXT_DARK }}>
          FetchLab
        </a>
        <div className="hidden md:flex items-center gap-9 text-[13px]" style={{ color: TEXT_DARK }}>
          <a href="#how" className="hover:opacity-60 transition-opacity">How it works</a>
          <a href="/download" className="hover:opacity-60 transition-opacity">Download</a>
          <a href="#pricing" className="hover:opacity-60 transition-opacity">Pricing</a>
        </div>
        <a
          href="/app"
          className="text-[13px] px-4 py-1.5 rounded-full text-white font-medium transition-colors"
          style={{ backgroundColor: INDIGO }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = INDIGO_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INDIGO)}
        >
          Get Started
        </a>
      </div>
    </nav>
  );
}

/* ---------------- Hero product mockup ---------------- */

const HERO_JSON_LINES = [
  '{',
  '  "id": "usr_8f2k",',
  '  "name": "Ada Lovelace",',
  '  "status": "active",',
  '  "plan": "pro"',
  '}',
];

function HeroMockup() {
  const [typed, setTyped] = useState<string[]>([]);
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [showTests, setShowTests] = useState(false);

  useEffect(() => {
    if (lineIdx >= HERO_JSON_LINES.length) {
      const t = setTimeout(() => setShowTests(true), 350);
      return () => clearTimeout(t);
    }
    const current = HERO_JSON_LINES[lineIdx];
    if (charIdx <= current.length) {
      const t = setTimeout(() => {
        setTyped((prev) => {
          const next = [...prev];
          next[lineIdx] = current.slice(0, charIdx);
          return next;
        });
        setCharIdx((c) => c + 1);
      }, 18);
      return () => clearTimeout(t);
    } else {
      setLineIdx((l) => l + 1);
      setCharIdx(0);
    }
  }, [lineIdx, charIdx]);

  return (
    <div className="relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
      {/* Glow */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[40px] blur-3xl opacity-60 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.25), transparent 70%)',
        }}
      />
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          backgroundColor: TERMINAL_BG,
          boxShadow:
            '0 30px 60px -20px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(99,102,241,0.18)',
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
          <span className="ml-3 text-[11px]" style={{ color: '#94a3b8' }}>
            FetchLab — Users / Get profile
          </span>
        </div>

        {/* URL bar */}
        <div className="p-4 flex items-center gap-2">
          <span
            className="text-[11px] font-semibold px-2 py-1 rounded"
            style={{ backgroundColor: 'rgba(99,102,241,0.18)', color: '#A5B4FC' }}
          >
            GET
          </span>
          <div
            className="flex-1 px-3 py-1.5 rounded text-[12px] font-mono"
            style={{
              backgroundColor: TERMINAL_PANEL,
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            https://api.fetchlab.dev/v1/users/me
          </div>
          <button
            className="text-[12px] font-semibold px-3 py-1.5 rounded text-white"
            style={{ backgroundColor: INDIGO }}
          >
            Send
          </button>
        </div>

        {/* Response */}
        <div
          className="mx-4 mb-3 rounded-lg overflow-hidden"
          style={{ backgroundColor: TERMINAL_PANEL, border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-[11px]" style={{ color: '#94a3b8' }}>
              Response
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(16,185,129,0.18)', color: '#34d399' }}
              >
                200 OK
              </span>
              <span className="text-[10px]" style={{ color: '#94a3b8' }}>
                182 ms
              </span>
            </div>
          </div>
          <div className="px-3 py-3 font-mono text-[12px] leading-[1.55]" style={{ color: '#e2e8f0' }}>
            {HERO_JSON_LINES.map((line, i) => (
              <div key={i} style={{ minHeight: '1.55em' }}>
                {(typed[i] ?? '').split('').map((ch, j) => {
                  let color = '#e2e8f0';
                  if (line.startsWith('  "')) {
                    const colon = line.indexOf(':');
                    if (colon > -1 && j < colon) color = '#93c5fd';
                    else if (line.includes('"', colon + 1)) color = '#fcd34d';
                  }
                  return (
                    <span key={j} style={{ color }}>
                      {ch}
                    </span>
                  );
                })}
                {lineIdx === i && charIdx <= line.length && (
                  <span style={{ color: INDIGO, animation: 'blink 1s steps(1) infinite' }}>▌</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tests */}
        <div
          className="mx-4 mb-4 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{
            backgroundColor: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.25)',
            opacity: showTests ? 1 : 0,
            transform: showTests ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 400ms ease, transform 400ms ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-[12px] font-medium" style={{ color: '#34d399' }}>
            4 tests passed
          </span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="px-6 lg:px-8 pt-20 pb-28 md:pt-28 md:pb-36">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <Reveal>
          <div
            className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-6 inline-block px-3 py-1 rounded-full"
            style={{ color: INDIGO, backgroundColor: INDIGO_SOFT }}
          >
            API Development Platform
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight mb-6"
            style={{ color: TEXT_DARK }}
          >
            The API client that fixes your APIs.
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed mb-9 max-w-lg"
            style={{ color: TEXT_BODY }}
          >
            Send requests. Generate tests. When something breaks, FetchLab diagnoses it and
            proposes the fix — quietly, in the background.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/app"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-white text-[14px] font-semibold transition-colors"
              style={{ backgroundColor: INDIGO }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = INDIGO_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INDIGO)}
            >
              Get Started Free
              <span aria-hidden>→</span>
            </a>
            <a
              href="/download"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-[14px] font-semibold bg-white transition-colors hover:bg-gray-50"
              style={{ color: TEXT_DARK, border: `1px solid ${BORDER}` }}
            >
              Download
            </a>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <HeroMockup />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Flow diagram ---------------- */

const FLOW_NODES = [
  { icon: '✎', label: 'Request' },
  { icon: '→', label: 'Send' },
  { icon: '✓', label: '200 OK' },
  { icon: '◆', label: 'Tests' },
  { icon: '◉', label: 'Agent' },
];

function FlowDiagram() {
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started) {
            setStarted(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    setActiveIdx(0);
    const interval = setInterval(() => {
      i += 1;
      if (i >= FLOW_NODES.length) {
        i = -1;
        setTimeout(() => setActiveIdx(0), 600);
      }
      setActiveIdx(i);
    }, 900);
    return () => clearInterval(interval);
  }, [started]);

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <div className="min-w-[640px] flex items-center justify-between gap-2 md:gap-4 py-8">
        {FLOW_NODES.map((node, i) => (
          <div key={node.label} className="flex items-center flex-1 last:flex-none">
            <div
              className="flex-shrink-0 flex flex-col items-center gap-2"
              style={{
                transform: activeIdx === i ? 'scale(1.06)' : 'scale(1)',
                transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-xl font-medium"
                style={{
                  backgroundColor: activeIdx >= i ? INDIGO_SOFT : '#ffffff',
                  color: activeIdx >= i ? INDIGO : TEXT_BODY,
                  border: `1px solid ${activeIdx >= i ? INDIGO_BORDER : BORDER}`,
                  boxShadow:
                    activeIdx === i
                      ? '0 10px 30px -10px rgba(99,102,241,0.45)'
                      : '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {node.icon}
              </div>
              <span
                className="text-[12px] font-medium"
                style={{
                  color: activeIdx >= i ? TEXT_DARK : TEXT_BODY,
                  transition: 'color 400ms ease',
                }}
              >
                {node.label}
              </span>
            </div>

            {i < FLOW_NODES.length - 1 && (
              <div className="flex-1 mx-2 md:mx-3 relative" style={{ height: 2, marginBottom: 22 }}>
                <svg
                  width="100%"
                  height="2"
                  viewBox="0 0 100 2"
                  preserveAspectRatio="none"
                  style={{ display: 'block' }}
                >
                  <line
                    x1="0"
                    y1="1"
                    x2="100"
                    y2="1"
                    stroke={activeIdx > i ? INDIGO : '#E5E7EB'}
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    style={{
                      strokeDashoffset: started ? 0 : 14,
                      transition: 'stroke 600ms ease, stroke-dashoffset 1200ms ease',
                      animation: activeIdx === i ? 'dash 1.5s linear infinite' : 'none',
                    }}
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowSection() {
  return (
    <section id="how" className="px-6 lg:px-8 py-24 md:py-32">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <div
              className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4 inline-block px-3 py-1 rounded-full"
              style={{ color: INDIGO, backgroundColor: INDIGO_SOFT }}
            >
              How it works
            </div>
            <h2
              className="text-3xl md:text-5xl font-semibold tracking-tight mb-4"
              style={{ color: TEXT_DARK }}
            >
              From request to fix.
            </h2>
            <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: TEXT_BODY }}>
              Every request flows through FetchLab. Tests run automatically. An agent watches the
              endpoints you care about and proposes fixes when they break.
            </p>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <FlowDiagram />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Feature mockups ---------------- */

function AIBuilderMockup() {
  return (
    <div
      className="relative rounded-2xl bg-white overflow-hidden"
      style={{
        border: `1px solid ${BORDER}`,
        boxShadow: '0 20px 50px -25px rgba(15, 23, 42, 0.25)',
        animation: 'float 7s ease-in-out infinite',
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: INDIGO_SOFT, color: INDIGO }}
          >
            ✦
          </div>
          <span className="text-[13px] font-semibold" style={{ color: TEXT_DARK }}>
            AI Request Builder
          </span>
        </div>
        <span className="text-[11px]" style={{ color: TEXT_BODY }}>
          claude-opus-4-7
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div
          className="text-[13px] px-3 py-2.5 rounded-lg"
          style={{ backgroundColor: '#F9FAFB', color: TEXT_DARK, border: `1px solid ${BORDER}` }}
        >
          Create a POST request to /v1/orders with a sample body and assert id is returned.
        </div>
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: `1px solid ${INDIGO_BORDER}`, backgroundColor: INDIGO_SOFT }}
        >
          <div className="px-3 py-2 flex items-center gap-2">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: INDIGO, color: 'white' }}
            >
              POST
            </span>
            <span className="text-[11px] font-mono" style={{ color: TEXT_DARK }}>
              /v1/orders
            </span>
          </div>
          <div className="px-3 pb-3 font-mono text-[11px]" style={{ color: TEXT_DARK }}>
            <div>{'{'}</div>
            <div className="pl-3">
              <span style={{ color: INDIGO }}>"sku"</span>: <span style={{ color: '#059669' }}>"WIDGET-12"</span>,
            </div>
            <div className="pl-3">
              <span style={{ color: INDIGO }}>"qty"</span>: <span style={{ color: '#059669' }}>2</span>
            </div>
            <div>{'}'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px]" style={{ color: TEXT_BODY }}>
          <span>✓</span>
          <span>Test: response.id exists</span>
        </div>
      </div>
    </div>
  );
}

function ProviderMockup() {
  const providers = [
    { name: 'Anthropic', selected: true, badge: 'BYOK' },
    { name: 'AWS Bedrock', selected: false, badge: 'AWS' },
    { name: 'Google Vertex', selected: false, badge: 'GCP' },
    { name: 'OpenAI', selected: false, badge: 'BYOK' },
  ];
  return (
    <div
      className="relative rounded-2xl bg-white overflow-hidden"
      style={{
        border: `1px solid ${BORDER}`,
        boxShadow: '0 20px 50px -25px rgba(15, 23, 42, 0.25)',
        animation: 'float 7s ease-in-out infinite',
      }}
    >
      <div
        className="px-4 py-3"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <span className="text-[13px] font-semibold" style={{ color: TEXT_DARK }}>
          Choose your provider
        </span>
        <div className="text-[11px] mt-0.5" style={{ color: TEXT_BODY }}>
          Your keys never leave your machine
        </div>
      </div>
      <div className="p-3 space-y-2">
        {providers.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{
              backgroundColor: p.selected ? INDIGO_SOFT : 'white',
              border: `1px solid ${p.selected ? INDIGO_BORDER : BORDER}`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  border: `2px solid ${p.selected ? INDIGO : '#CBD5E1'}`,
                }}
              >
                {p.selected && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: INDIGO }} />
                )}
              </div>
              <span className="text-[13px] font-medium" style={{ color: TEXT_DARK }}>
                {p.name}
              </span>
            </div>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: p.selected ? 'white' : '#F3F4F6',
                color: TEXT_BODY,
                border: `1px solid ${BORDER}`,
              }}
            >
              {p.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlackMockup() {
  return (
    <div
      className="relative rounded-2xl bg-white overflow-hidden"
      style={{
        border: `1px solid ${BORDER}`,
        boxShadow: '0 20px 50px -25px rgba(15, 23, 42, 0.25)',
        animation: 'float 7s ease-in-out infinite',
      }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <span style={{ color: TEXT_BODY }}>#</span>
        <span className="text-[13px] font-semibold" style={{ color: TEXT_DARK }}>
          api-alerts
        </span>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex gap-3">
          <div
            className="w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-semibold text-white"
            style={{ backgroundColor: INDIGO }}
          >
            FL
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[13px] font-semibold" style={{ color: TEXT_DARK }}>
                FetchLab Agent
              </span>
              <span className="text-[11px]" style={{ color: TEXT_BODY }}>
                2:14 PM
              </span>
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: TEXT_DARK }}>
              ⚠️ <span className="font-semibold">/v1/orders</span> returning <span style={{ color: '#dc2626' }}>500</span>{' '}
              since 14:02. Root cause: missing <span className="font-mono text-[12px]">customer_id</span> in
              schema after deploy <span className="font-mono text-[12px]">a3f2c</span>.
            </div>
            <div
              className="mt-2 rounded-md px-3 py-2 text-[12px]"
              style={{ backgroundColor: '#F9FAFB', border: `1px solid ${BORDER}` }}
            >
              <span className="font-semibold" style={{ color: TEXT_DARK }}>Proposed fix:</span>{' '}
              <span style={{ color: TEXT_BODY }}>
                add <span className="font-mono text-[11px]">customer_id</span> to request validator.
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="text-[11px] font-semibold px-2.5 py-1 rounded text-white"
                style={{ backgroundColor: INDIGO }}
              >
                Open PR
              </button>
              <button
                className="text-[11px] font-semibold px-2.5 py-1 rounded"
                style={{ color: TEXT_DARK, border: `1px solid ${BORDER}` }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBlock({
  eyebrow,
  title,
  body,
  visual,
  reverse,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <Reveal>
      <div
        className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${
          reverse ? 'md:[&>*:first-child]:order-2' : ''
        }`}
      >
        <div>
          <div
            className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4 inline-block px-3 py-1 rounded-full"
            style={{ color: INDIGO, backgroundColor: INDIGO_SOFT }}
          >
            {eyebrow}
          </div>
          <h3
            className="text-3xl md:text-4xl font-semibold tracking-tight mb-4"
            style={{ color: TEXT_DARK }}
          >
            {title}
          </h3>
          <p className="text-base md:text-lg leading-relaxed" style={{ color: TEXT_BODY }}>
            {body}
          </p>
        </div>
        <div>{visual}</div>
      </div>
    </Reveal>
  );
}

function Features() {
  return (
    <section className="px-6 lg:px-8 py-20 md:py-28 space-y-24 md:space-y-32">
      <div className="max-w-6xl mx-auto">
        <FeatureBlock
          eyebrow="AI-Native"
          title="AI that understands your APIs."
          body="Describe what you need in plain English. FetchLab drafts the request, picks the right headers, generates a sample body, and writes assertions — no copy-pasting from docs."
          visual={<AIBuilderMockup />}
        />
      </div>
      <div className="max-w-6xl mx-auto">
        <FeatureBlock
          eyebrow="Bring your own key"
          title="Your keys. Your cloud. Your rules."
          body="Plug in Anthropic, AWS Bedrock, Google Vertex, or OpenAI. Keys stay on your machine. Requests, headers, and bodies never leave your network."
          visual={<ProviderMockup />}
          reverse
        />
      </div>
      <div className="max-w-6xl mx-auto">
        <FeatureBlock
          eyebrow="Ops Agent"
          title="An agent that watches Slack."
          body="The agent monitors the endpoints you care about. When something breaks, it triages the failure, posts in Slack, and drafts the fix before anyone files a ticket."
          visual={<SlackMockup />}
        />
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

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
  return (
    <div
      className="bg-white rounded-2xl p-7 flex flex-col relative"
      style={{
        border: `1px solid ${plan.highlight ? INDIGO_BORDER : BORDER}`,
        boxShadow: plan.highlight
          ? '0 20px 50px -25px rgba(99,102,241,0.45)'
          : '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {plan.highlight && (
        <div
          className="absolute -top-3 left-7 text-[10px] font-bold tracking-[0.16em] uppercase px-2.5 py-1 rounded-full text-white"
          style={{ backgroundColor: INDIGO }}
        >
          Popular
        </div>
      )}
      <h3 className="text-[15px] font-semibold mb-2" style={{ color: TEXT_DARK }}>
        {plan.name}
      </h3>
      <div className="mb-5">
        <span className="text-4xl font-semibold tracking-tight" style={{ color: TEXT_DARK }}>
          {plan.price}
        </span>
        {plan.period && (
          <span className="text-sm ml-1" style={{ color: TEXT_BODY }}>
            {plan.period}
          </span>
        )}
      </div>
      <p className="text-[13px] mb-6 leading-relaxed" style={{ color: TEXT_BODY }}>
        {plan.description}
      </p>
      <ul className="space-y-2.5 mb-7 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="text-[13px] flex items-start gap-2" style={{ color: TEXT_DARK }}>
            <span style={{ color: INDIGO, marginTop: 1 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href="/app"
        className="block text-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors"
        style={
          plan.highlight
            ? { backgroundColor: INDIGO, color: 'white' }
            : { backgroundColor: 'white', color: TEXT_DARK, border: `1px solid ${BORDER}` }
        }
        onMouseEnter={(e) => {
          if (plan.highlight) e.currentTarget.style.backgroundColor = INDIGO_HOVER;
        }}
        onMouseLeave={(e) => {
          if (plan.highlight) e.currentTarget.style.backgroundColor = INDIGO;
        }}
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
    <section
      id="pricing"
      className="px-6 lg:px-8 py-24 md:py-32"
      style={{ backgroundColor: INDIGO_SOFT }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <div
              className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4 inline-block px-3 py-1 rounded-full bg-white"
              style={{ color: INDIGO }}
            >
              Pricing
            </div>
            <h2
              className="text-3xl md:text-5xl font-semibold tracking-tight mb-4"
              style={{ color: TEXT_DARK }}
            >
              Start free. Scale when ready.
            </h2>
            <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: TEXT_BODY }}>
              No credit card to start. Upgrade anytime.
            </p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <PricingCard plan={p} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- CTA + Footer ---------------- */

function CTA() {
  return (
    <section className="px-6 lg:px-8 py-24 md:py-32">
      <Reveal>
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl md:text-5xl font-semibold tracking-tight mb-4"
            style={{ color: TEXT_DARK }}
          >
            Ready to ship faster?
          </h2>
          <p className="text-base md:text-lg mb-10" style={{ color: TEXT_BODY }}>
            Join developers using FetchLab to build, test, and monitor their APIs.
          </p>
          <a
            href="/app"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white text-[15px] font-semibold transition-colors"
            style={{ backgroundColor: INDIGO }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = INDIGO_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INDIGO)}
          >
            Get Started Free
            <span aria-hidden>→</span>
          </a>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 lg:px-8 py-8" style={{ borderTop: `1px solid ${BORDER}` }}>
      <div
        className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-[13px]"
        style={{ color: TEXT_BODY }}
      >
        <div className="flex items-center gap-5">
          <span className="font-semibold" style={{ color: TEXT_DARK }}>
            FetchLab
          </span>
          <a href="/privacy" className="hover:opacity-60 transition-opacity">
            Privacy
          </a>
          <a href="/terms" className="hover:opacity-60 transition-opacity">
            Terms
          </a>
        </div>
        <div>© 2025 FetchLab</div>
      </div>
    </footer>
  );
}

/* ---------------- Root ---------------- */

const STYLES = `
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes blink {
    0%, 50% { opacity: 1; }
    50.01%, 100% { opacity: 0; }
  }
  @keyframes dash {
    0% { stroke-dashoffset: 14; }
    100% { stroke-dashoffset: 0; }
  }
`;

export default function Landing() {
  return (
    <div className="bg-white min-h-screen font-sans antialiased" style={{ color: TEXT_DARK }}>
      <style>{STYLES}</style>
      <Nav />
      <Hero />
      <FlowSection />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
