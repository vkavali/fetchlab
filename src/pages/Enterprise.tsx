import { FetchLabLogo } from '../components/FetchLabLogo';
import { usePublicLightTheme } from '../utils/usePublicLightTheme';

const READY = [
  'Browser-hosted web app plus Windows EXE/MSI installer for desktop teams.',
  'Product Missions preserve the customer evidence, desired outcome, repository state, proposal, approval, pull request, and check result.',
  'Repository investigation reads bounded source and rejects secret paths, generated dependencies, traversal, oversized changes, and CI workflow edits.',
  'Insufficient evidence produces explicit questions instead of an invented solution.',
  'Human approval is bound to the exact source proposal fingerprint and investigated base commit.',
  'GitHub execution creates an isolated branch and draft pull request only; FetchLab has no merge or deploy action.',
  'Repository checks remain passed, failed, pending, or unverified. Zero checks never becomes a false pass.',
  'Encrypted local drafts remain available when no database or server is configured.',
  'The connected API Lab retains REST, GraphQL, WebSocket, SSE, collections, environments, scripts, diffs, and request history.',
  'Bring-your-own-key model setup supports Anthropic, AWS Bedrock, Google Vertex AI, and OpenAI-compatible endpoints.',
  'PostgreSQL accounts, 2FA, session controls, lockouts, rate limits, and workspace admin/member/viewer RBAC.',
  'Admin-only audit records cover mission, GitHub, auth, workspace, and enterprise changes.',
  'OIDC SSO configuration, SCIM v2 user provisioning endpoints, and admin status checks.',
  'Configurable retention for audit logs, request history, sessions, mission records, and evidence.',
];

const PILOT_PACKAGE = [
  'Choose one repository, one product owner, and one engineering reviewer.',
  'Bring three recent customer issues or AI product failures with evidence and a clear desired outcome.',
  'Connect a scoped GitHub credential and the model provider approved by the startup.',
  'Run each issue through investigation, exact source review, approval, draft pull request creation, and repository checks.',
  'Track where FetchLab asks for evidence, where proposals are rejected, and whether the team merges anything after its own review.',
  'Continue only if the same team voluntarily uses it for another real problem; the free pilot is product validation, not proof of adoption.',
];

const ROADMAP = [
  {
    phase: 'Day 1',
    title: 'Connect one repository',
    body: 'Create the workspace, assign roles, connect a scoped GitHub token, and configure the approved model provider.',
  },
  {
    phase: 'Week 1',
    title: 'Run three real missions',
    body: 'Start from actual support or production evidence. Review every question, proposal, approval boundary, draft pull request, and check result.',
  },
  {
    phase: 'Month 1',
    title: 'Measure repeat use',
    body: 'Compare time and manual handoffs against the existing workflow. Keep the product only if the team chooses it for the next problem without prompting.',
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
        <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: 0, margin: 0 }}>
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
                letterSpacing: 0,
                lineHeight: 0.92,
                margin: 0,
                maxWidth: '11ch',
              }}
            >
              Turn customer evidence into reviewed code.
            </h1>
          </div>
          <div>
            <p className="text-base md:text-lg" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75, maxWidth: 650, margin: 0 }}>
              FetchLab gives product and engineering teams one traceable mission from a real customer problem to a reviewable
              draft pull request. It keeps the original evidence attached to bounded repository investigation, exact proposed
              source, human approval, GitHub state, and CI status. Enterprise deployments add PostgreSQL, workspace RBAC,
              encrypted evidence and credentials, audit logs, retention controls, OIDC SSO, and SCIM.
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
                Create a product mission
              </a>
              <a
                href="mailto:vkavali10@gmail.com?subject=FetchLab%20Enterprise%20Pilot"
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
            <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: 0, margin: 0 }}>
              From one real issue to repeat use
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
