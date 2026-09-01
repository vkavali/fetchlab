import { FetchLabLogo } from '../components/FetchLabLogo';
import { usePublicLightTheme } from '../utils/usePublicLightTheme';

const READY = [
  'Browser-hosted web app plus Windows EXE/MSI installer for desktop teams.',
  'Bring-your-own-key AI provider setup, including local mode for no external AI calls.',
  '2FA, session controls, account lockout tests, and encrypted local settings.',
  'Admin-only audit logs for auth, workspace, enterprise settings, retention, SCIM, and SOC 2 evidence events.',
  'Global admin/user controls plus workspace admin/member/viewer RBAC.',
  'OIDC SSO configuration, SCIM v2 user provisioning endpoints, and admin status checks.',
  'Configurable retention policy execution for audit logs, request history, sessions, agent records, and evidence.',
  'SOC 2 evidence tracking workflow with control IDs, owners, status, details, and audit events.',
  'SSRF-safe request proxy behavior covered by tests.',
  'AI-ready response artifacts with Markdown, structured JSON, and token/cost estimates.',
  'Agent framework snippets for LangChain, LlamaIndex, and CrewAI.',
];

const PILOT_PACKAGE = [
  'Private workspace setup with admin, member, and viewer roles.',
  'OIDC SSO setup support and 2FA policy for all users.',
  'Encrypted credentials with bring-your-own-key LLM provider routing.',
  'Audit log review for auth, workspace changes, AI usage, and agent actions.',
  '30-day guided rollout for one engineering team.',
  'Security questionnaire support for pilot and vendor review.',
];

const ROADMAP = [
  {
    phase: 'Day 1',
    title: 'Launch a workspace',
    body: 'Create the team workspace, connect your model provider, import collections, and invite the first engineering group.',
  },
  {
    phase: 'Week 1',
    title: 'Prove the workflow',
    body: 'Run API tests, generate AI-assisted assertions, configure agent monitoring, and review audit/security controls with admins.',
  },
  {
    phase: 'Month 1',
    title: 'Expand adoption',
    body: 'Roll out to more teams, standardize provider routing, use SCIM provisioning, and export evidence for vendor/security review.',
  },
];

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'color-mix(in oklch, var(--color-bg) 90%, transparent)',
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
          <a href="/how-to" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">How-to</a>
          <a href="/ai-how-to" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">AI guide</a>
          <a href="/download" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Download</a>
          <a href="/enterprise" style={{ opacity: 1, color: 'var(--color-text)' }}>Enterprise</a>
          <a href="/pricing" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Pricing</a>
        </div>
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
          Open app
        </a>
      </div>
    </nav>
  );
}

function Checklist({ title, items, tone }: { title: string; items: string[]; tone: 'ready' | 'pilot' }) {
  return (
    <section
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div className="p-5 md:p-6" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
        <div className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: tone === 'ready' ? 'var(--color-accent)' : 'var(--color-warning)', marginBottom: 8 }}>
          {tone === 'ready' ? 'Available today' : 'Enterprise pilot package'}
        </div>
        <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', margin: 0 }}>
          {title}
        </h2>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {items.map((item, index) => (
          <div key={item} className="grid gap-3 p-4" style={{ gridTemplateColumns: '32px 1fr' }}>
            <span
              className="font-mono"
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: tone === 'ready' ? 'var(--color-accent-soft)' : 'var(--color-warning-soft)',
                color: tone === 'ready' ? 'var(--color-accent)' : 'var(--color-warning)',
                fontSize: 10,
              }}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.65, margin: 0 }}>{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Enterprise() {
  usePublicLightTheme();

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Nav />
      <main className="max-w-[1180px] mx-auto px-6 lg:px-8 py-14 md:py-20">
        <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-16 items-end" style={{ marginBottom: 42 }}>
          <div>
            <div className="font-mono uppercase" style={{ color: 'var(--color-accent)', fontSize: 11, letterSpacing: '0.16em', marginBottom: 18 }}>
              Enterprise
            </div>
            <h1
              className="text-4xl md:text-6xl"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.07em',
                lineHeight: 0.92,
                margin: 0,
                maxWidth: '11ch',
              }}
            >
              One workbench for API and AI engineering teams.
            </h1>
          </div>
          <div>
            <p className="text-base md:text-lg" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75, maxWidth: 650, margin: 0 }}>
              FetchLab is a browser app and Windows desktop installer for teams building AI products.
              It combines an API Workbench for requests, collections, environments, and protocol testing
              with an AI Workbench for Launch Gate reviews, model providers, AI-assisted tests, agent monitoring, eval prep, and coding-agent workflows.
              Enterprise pilots add self-hosted deployment, PostgreSQL, RBAC, encrypted secrets, audit logs, SCIM, retention controls, OIDC SSO, and launch evidence packets.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/app"
                className="inline-flex items-center"
                style={{
                  fontSize: 13,
                  fontWeight: 650,
                  color: 'var(--color-accent-ink)',
                  background: 'var(--color-accent)',
                  padding: '10px 14px',
                  borderRadius: 5,
                }}
              >
                Start free
              </a>
              <a
                href="mailto:hello@fetchlab.dev?subject=FetchLab%20Enterprise%20Pilot"
                className="inline-flex items-center"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border-strong)',
                  padding: '10px 14px',
                  borderRadius: 5,
                }}
              >
                Book enterprise pilot
              </a>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-5" style={{ marginBottom: 44 }}>
          <Checklist title="What teams get today" items={READY} tone="ready" />
          <Checklist title="How enterprise pilots run" items={PILOT_PACKAGE} tone="pilot" />
        </section>

        <section
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div className="p-5 md:p-6" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
            <div className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 8 }}>
              Simple rollout
            </div>
            <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', margin: 0 }}>
              From trial to team standard
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px" style={{ background: 'var(--color-border)' }}>
            {ROADMAP.map(item => (
              <div key={item.phase} className="p-5" style={{ background: 'var(--color-surface)' }}>
                <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-warning)', marginBottom: 10 }}>
                  {item.phase}
                </div>
                <h3 style={{ color: 'var(--color-text)', fontSize: 18, fontWeight: 650, margin: '0 0 10px' }}>{item.title}</h3>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
