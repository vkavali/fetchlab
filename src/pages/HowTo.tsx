const FEATURES = [
  {
    id: 'requests',
    label: 'Requests',
    title: 'Send an API request',
    summary: 'Build a request, send it, inspect the response, and keep the result in a tab.',
    steps: [
      'Open the app and use the method selector to choose GET, POST, PUT, PATCH, or DELETE.',
      'Paste the endpoint into the URL field. Use Ctrl+L to focus the URL quickly.',
      'Add query params, headers, auth, and body data in the request tabs.',
      'Press Send or use Enter from the request editor to run the call.',
      'Read status, timing, headers, body, and formatted JSON in the response panel.',
    ],
    note: 'Use new tabs for separate requests so you can compare workflows without losing state.',
  },
  {
    id: 'collections',
    label: 'Collections',
    title: 'Save and organize requests',
    summary: 'Group related API calls by service, environment, or workflow.',
    steps: [
      'Open the sidebar and choose Collections.',
      'Create a collection for the API or workflow you are testing.',
      'Save the current request into the collection with a clear name.',
      'Reopen saved requests from the sidebar when you need to repeat a workflow.',
      'Use collection sharing when another developer needs the exact same request setup.',
    ],
    note: 'Name requests by outcome, for example "Create order - happy path" or "Refresh token - expired".',
  },
  {
    id: 'environments',
    label: 'Environments',
    title: 'Switch dev, staging, and production safely',
    summary: 'Use environment variables to avoid editing URLs, tokens, or IDs by hand.',
    steps: [
      'Open the environment selector in the header.',
      'Create variables such as baseUrl, workspaceId, token, or customerId.',
      'Reference variables in requests using the app variable syntax.',
      'Switch environments before sending a request to target dev, staging, or production.',
      'Review the active environment indicator before running destructive calls.',
    ],
    note: 'Keep production values separate from test values and avoid storing secrets in shared exports.',
  },
  {
    id: 'auth',
    label: 'Auth',
    title: 'Configure authentication',
    summary: 'Attach API keys, bearer tokens, basic auth, OAuth-style token profiles, and custom headers.',
    steps: [
      'Open the Auth tab in the request builder.',
      'Choose the auth type required by your API.',
      'For static tokens, paste the token or reference an environment variable.',
      'For token profiles, configure the token endpoint once and let FetchLab inject refreshed tokens.',
      'Send a request and confirm the Authorization header or custom auth header is applied.',
    ],
    note: 'Use environment variables for credentials so requests can be shared without exposing secrets.',
  },
  {
    id: 'ai-builder',
    label: 'AI Builder',
    title: 'Generate request setup from plain English',
    summary: 'Describe the API call you want and let the AI builder draft method, URL, headers, and body.',
    steps: [
      'Open AI Request Builder from the app tools.',
      'Describe the call, including endpoint, method, payload, and any auth requirements.',
      'Review the generated request before applying it.',
      'Edit fields manually if the API contract requires exact values.',
      'Send the request and use the response to refine the prompt or saved request.',
    ],
    note: 'AI output should be reviewed before sending, especially for production APIs.',
  },
  {
    id: 'tests',
    label: 'Tests',
    title: 'Write tests and scripts',
    summary: 'Validate response status, headers, body shape, and timing after a request runs.',
    steps: [
      'Open the Scripts or Tests section for the active request.',
      'Add assertions for status codes, required fields, schema shape, and response timing.',
      'Run the request and inspect the test result panel.',
      'Use generated tests as a starting point, then tighten assertions for your API.',
      'Save the tested request into a collection when it becomes part of your regression workflow.',
    ],
    note: 'Prefer specific assertions over broad checks so failures identify the broken contract quickly.',
  },
  {
    id: 'schema',
    label: 'Schema',
    title: 'Validate JSON schemas',
    summary: 'Check whether API responses match the contract your client or backend expects.',
    steps: [
      'Send a request that returns JSON.',
      'Open Schema Validator from the response tools.',
      'Paste or generate the expected schema.',
      'Run validation and review missing fields, type mismatches, or unexpected data.',
      'Save useful schemas alongside the request or export them for documentation.',
    ],
    note: 'Schema validation is most useful for integration endpoints and public API contracts.',
  },
  {
    id: 'runner',
    label: 'Runner',
    title: 'Run a collection workflow',
    summary: 'Execute multiple saved requests in sequence to test a complete API flow.',
    steps: [
      'Save the requests that make up the workflow into a collection.',
      'Open Collection Runner from the collection tools.',
      'Choose the environment and confirm variables are available.',
      'Run the collection and review pass, fail, status, and timing for each request.',
      'Fix failed requests or tests, then rerun until the workflow is stable.',
    ],
    note: 'Start with small workflows before using the runner for full regression suites.',
  },
  {
    id: 'diffs',
    label: 'Diffs',
    title: 'Compare responses and environments',
    summary: 'Find changes between two responses, two environments, or repeated calls.',
    steps: [
      'Run the same request in two environments or at two points in time.',
      'Open Response Diff or Environment Diff.',
      'Select the two sources to compare.',
      'Review changed fields, missing values, header differences, and timing deltas.',
      'Use the diff to isolate whether a failure is data, config, or API behavior.',
    ],
    note: 'Diffs are useful when staging works but production fails, or after a deploy changes payloads.',
  },
  {
    id: 'realtime',
    label: 'Realtime',
    title: 'Test WebSocket and SSE endpoints',
    summary: 'Connect to streaming APIs and inspect events, messages, reconnects, and headers.',
    steps: [
      'Open the WebSocket Tester or SSE Viewer from the tools panel.',
      'Enter the stream URL and required headers.',
      'Connect and watch messages arrive in real time.',
      'Filter or inspect raw events when debugging payload shape.',
      'Disconnect when finished so background streams do not continue running.',
    ],
    note: 'Use non-production streams for long-running tests unless you are intentionally debugging live traffic.',
  },
  {
    id: 'docs',
    label: 'Docs',
    title: 'Generate docs and OpenAPI output',
    summary: 'Turn tested requests into readable API documentation or an OpenAPI-style spec.',
    steps: [
      'Build and save representative requests in collections.',
      'Open Doc Generator or OpenAPI Generator.',
      'Select the collection or request set to document.',
      'Review generated descriptions, parameters, headers, body examples, and responses.',
      'Export the docs or copy the generated spec into your documentation workflow.',
    ],
    note: 'Generated docs should be reviewed by an API owner before publishing externally.',
  },
  {
    id: 'share',
    label: 'Share',
    title: 'Share requests and collections',
    summary: 'Send a reproducible API setup to another teammate without screenshots or guesswork.',
    steps: [
      'Open Share for the request or collection you want to send.',
      'Review what data is included before generating the share link.',
      'Remove secrets or reference environment variables instead of literal token values.',
      'Send the link to the teammate.',
      'When they open it, FetchLab imports the request or collection into their workspace.',
    ],
    note: 'Do not share production secrets in request bodies, headers, URLs, or environment exports.',
  },
  {
    id: 'security',
    label: 'Security',
    title: 'Use workspaces and security settings',
    summary: 'Keep teams, tokens, sessions, and sensitive testing data under control.',
    steps: [
      'Use separate workspaces for separate teams, clients, or API products.',
      'Enable two-factor authentication on your account.',
      'Review active sessions and revoke anything you do not recognize.',
      'Store sensitive values in environment variables rather than request names or notes.',
      'Use SSRF-safe proxy behavior and avoid sending requests to internal targets you do not own.',
    ],
    note: 'For enterprise rollout, pair these controls with audit logs, RBAC, and dependency vulnerability fixes.',
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
        <a href="/" className="fl-wordmark" style={{ fontSize: 13, color: 'var(--color-text)' }}>FETCHLAB</a>
        <div className="hidden md:flex items-center gap-9" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          <a href="/how-to" style={{ opacity: 1, color: 'var(--color-text)' }}>How-to</a>
          <a href="/ai-how-to" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">AI guide</a>
          <a href="/download" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Download</a>
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

function FeatureCard({ feature, index }: { feature: (typeof FEATURES)[number]; index: number }) {
  return (
    <article
      id={feature.id}
      className="scroll-mt-20"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-start justify-between gap-5 p-5 md:p-6"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
      >
        <div>
          <div
            className="font-mono uppercase"
            style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 10 }}
          >
            {String(index + 1).padStart(2, '0')} / {feature.label}
          </div>
          <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', margin: 0 }}>
            {feature.title}
          </h2>
        </div>
        <a
          href={`/app#${feature.id}`}
          className="hidden sm:inline-flex"
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border-strong)',
            padding: '7px 10px',
            borderRadius: 5,
            whiteSpace: 'nowrap',
          }}
        >
          Try in app
        </a>
      </div>
      <div className="grid md:grid-cols-[0.82fr_1.18fr]" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p className="p-5 md:p-6 text-sm md:text-base" style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          {feature.summary}
        </p>
        <ol className="p-5 md:p-6 space-y-3" style={{ margin: 0, borderLeft: '1px solid var(--color-border)' }}>
          {feature.steps.map((step, stepIndex) => (
            <li key={step} className="grid gap-3" style={{ gridTemplateColumns: '32px 1fr', alignItems: 'start' }}>
              <span
                className="font-mono"
                style={{
                  color: 'var(--color-accent)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  paddingTop: 2,
                }}
              >
                {String(stepIndex + 1).padStart(2, '0')}
              </span>
              <span style={{ color: 'var(--color-text)', lineHeight: 1.65 }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div
        className="font-mono p-4 md:px-6"
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--color-text-subtle)',
          background: 'var(--color-surface-2)',
        }}
      >
        NOTE: {feature.note}
      </div>
    </article>
  );
}

export default function HowTo() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Nav />
      <main className="max-w-[1180px] mx-auto px-6 lg:px-8 py-14 md:py-20">
        <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-16 items-end" style={{ marginBottom: 42 }}>
          <div>
            <div
              className="font-mono uppercase"
              style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 18 }}
            >
              Operator manual / feature guide
            </div>
            <h1
              className="text-5xl md:text-7xl"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.07em',
                lineHeight: 0.92,
                margin: 0,
                maxWidth: '11ch',
              }}
            >
              How to use FetchLab.
            </h1>
          </div>
          <p className="text-base md:text-lg" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75, maxWidth: 620, margin: 0 }}>
            A practical walkthrough for the full product: requests, collections, environments,
            auth, AI-assisted setup, tests, schema validation, runners, diffs, realtime APIs,
            docs, sharing, and security controls.
            {' '}
            <a href="/ai-how-to" style={{ color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
              Use the dedicated AI guide for provider setup and agent workflows.
            </a>
          </p>
        </section>

        <section
          aria-label="Feature index"
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px"
          style={{
            border: '1px solid var(--color-border)',
            background: 'var(--color-border)',
            marginBottom: 42,
          }}
        >
          {FEATURES.map((feature, index) => (
            <a
              key={feature.id}
              href={`#${feature.id}`}
              className="group"
              style={{
                background: 'var(--color-surface)',
                padding: '14px 16px',
                minHeight: 82,
              }}
            >
              <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-subtle)', marginBottom: 8 }}>
                {String(index + 1).padStart(2, '0')}
              </div>
              <div style={{ color: 'var(--color-text)', fontWeight: 600 }}>{feature.label}</div>
            </a>
          ))}
        </section>

        <section className="space-y-5 md:space-y-6" aria-label="How-to instructions">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </section>
      </main>
    </div>
  );
}
