import { FetchLabLogo } from '../components/FetchLabLogo';
import { usePublicLightTheme } from '../utils/usePublicLightTheme';

const SETUP_STEPS = [
  {
    title: 'Sign in before using AI',
    body: 'The AI Request Builder is hidden for guests because AI calls use authenticated server routes and workspace context.',
  },
  {
    title: 'Open LLM Provider / BYOK',
    body: 'Use the user menu in the app header, then choose LLM Provider / BYOK. This is where you choose the active model provider.',
  },
  {
    title: 'Choose a provider',
    body: 'FetchLab supports Anthropic direct, AWS Bedrock, Google Vertex AI, OpenAI-compatible endpoints, and Local mode for no external AI calls.',
  },
  {
    title: 'Save and test the connection',
    body: 'Enter the key, model, region, project, or endpoint fields required by the provider, save the config, then use Test Connection.',
  },
  {
    title: 'Decide where calls run',
    body: 'Desktop users can enable client-side AI calls. Browser users use the server route unless the deployment has another proxy setup.',
  },
];

const SCOPE_COLUMNS = [
  {
    title: 'AI can assist with',
    items: [
      'Drafting API requests from plain English.',
      'Converting cURL commands into FetchLab requests.',
      'Suggesting headers, params, auth shape, and JSON bodies.',
      'Explaining failed responses and likely root causes.',
      'Suggesting fixes for auth, validation, rate limit, timeout, and server errors.',
      'Helping generate tests, schemas, docs, and OpenAPI-style descriptions from known requests.',
      'Exporting response context as AI-ready Markdown or structured JSON with estimated token/cost impact.',
      'Generating LangChain, LlamaIndex, and CrewAI tool wrappers from tested requests.',
      'Triage of Slack incident messages through the AI Ops Agent.',
      'Summarizing agent findings and proposed next steps.',
    ],
  },
  {
    title: 'AI does not do automatically',
    items: [
      'It does not send production requests without the user pressing Send.',
      'It does not guarantee that generated payloads match your real API contract.',
      'It does not bypass authentication, permissions, rate limits, or network restrictions.',
      'It does not make a backend fix by itself unless your team enables and approves an agent action.',
      'It does not replace backend logs, observability, code review, or incident ownership.',
      'It does not make unsafe secrets safe if they are included in request bodies or prompts.',
      'It does not train a model inside FetchLab. Provider retention depends on the configured provider.',
      'It prepares repeatable evidence for security review; your team remains the final approval gate.',
    ],
  },
  {
    title: 'Human approval required',
    items: [
      'Review generated method, URL, auth, headers, params, and body before sending.',
      'Confirm the active environment before running destructive calls.',
      'Remove secrets before sharing requests, collections, prompts, or exported data.',
      'Validate AI diagnosis against backend logs and API documentation.',
      'Approve PR creation or auto-fix behavior only after testing in non-production.',
      'Choose provider, retention posture, and BYOK setup with your security requirements in mind.',
      'Run the request or collection tests after applying an AI suggestion.',
      'Decide whether AI output is acceptable for customer-facing docs.',
    ],
  },
];

const WORKFLOWS = [
  {
    id: 'request-builder',
    label: 'AI request builder',
    title: 'Generate a request from plain English',
    steps: [
      'Click AI in the app header.',
      'Choose Natural language.',
      'Describe the API call with method, endpoint, auth, headers, and payload requirements.',
      'Use Ctrl+Enter or Generate request.',
      'Review the generated method, URL, params, headers, auth, and body before sending.',
      'Edit anything that must match your API contract exactly.',
    ],
    example: 'Create a POST request to /v1/orders with JSON body customer_id, sku, quantity, and bearer auth from {{token}}.',
    caution: 'Do not send generated production requests until a human reviews the target URL, method, auth, and body.',
  },
  {
    id: 'curl-import',
    label: 'cURL fallback',
    title: 'Import a cURL command without AI',
    steps: [
      'Click AI in the app header.',
      'Choose Paste cURL.',
      'Paste a complete curl command from docs, browser devtools, or another teammate.',
      'Generate the request.',
      'FetchLab parses method, URL, headers, params, body, and auth-like headers locally.',
      'Save the imported request into a collection if it becomes part of your workflow.',
    ],
    example: 'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d "{\\"name\\":\\"Ada\\"}"',
    caution: 'cURL parsing still works when AI is disabled, but you should remove secrets before sharing imported requests.',
  },
  {
    id: 'diagnosis',
    label: 'AI diagnosis',
    title: 'Ask AI to diagnose failed responses',
    steps: [
      'Send a request and inspect the response panel.',
      'When a failure or suspicious response appears, open the diagnosis area.',
      'Use the AI diagnosis action when the heuristic explanation is not enough.',
      'Review summary, severity, likely cause, and proposed fixes.',
      'Copy only the fix that matches the API contract or backend logs.',
      'Rerun the request after each change to confirm the fix.',
    ],
    example: 'Diagnose a 401 where the token exists but the API still rejects the request.',
    caution: 'FetchLab redacts obvious secret headers before sending diagnosis context, but request bodies can still contain sensitive data.',
  },
  {
    id: 'ai-artifact',
    label: 'AI artifacts',
    title: 'Export clean context for LLM debugging',
    steps: [
      'Send a request and open the response panel.',
      'Open the AI Artifact tab.',
      'Choose Markdown for human-readable prompts or Structured JSON for agent pipelines.',
      'Review the estimated token count and estimated input cost before copying.',
      'Copy or download the artifact and paste it into your model or agent runtime.',
      'Keep human review in the loop because artifacts summarize observed behavior, not official API contracts.',
    ],
    example: 'Export a failed 422 response as Markdown, then ask your model to generate regression tests from the observed response.',
    caution: 'Obvious secret headers are redacted, but sensitive body fields should still be reviewed before sharing.',
  },
  {
    id: 'agent-snippets',
    label: 'Agent snippets',
    title: 'Generate framework wrappers for agent tools',
    steps: [
      'Build and test the request in FetchLab first.',
      'Open the response Code tab or export dialog.',
      'Choose LangChain Tool, LlamaIndex Tool, or CrewAI Tool.',
      'Copy the generated Python wrapper.',
      'Replace placeholder auth values and run it in your agent project.',
      'Keep timeout, retry, and approval logic in your application code.',
    ],
    example: 'Turn a tested GET /v1/orders request into a LangChain tool that returns status and body for an agent.',
    caution: 'Generated wrappers are starting points. Enterprise workflows still need auth, retries, logging, and policy checks.',
  },
  {
    id: 'agent',
    label: 'AI Ops Agent',
    title: 'Use the AI Ops Agent for incident triage',
    steps: [
      'Click Agent in the app header.',
      'Check the AI, Slack, and GitHub status badges.',
      'Use Test Detection first with a sample incident message.',
      'Configure a Slack channel when you want the agent to monitor real messages.',
      'Choose sensitivity: low for fewer alerts, high for aggressive detection.',
      'Review the activity feed, diagnosis, reproduced status, and suggested fixes.',
      'Approve, ignore, snooze, or open a PR only after reviewing the issue details.',
    ],
    example: 'The /orders endpoint returns 500 after deploy a3f2c when POST contains customer_id.',
    caution: 'Keep auto-fix disabled until your team has reviewed the agent behavior on non-production incidents.',
  },
];

const PROMPT_RECIPES = [
  {
    title: 'New endpoint',
    prompt: 'Build a GET request to list invoices from https://api.example.com/v1/invoices using bearer auth from {{billingToken}} and limit=25.',
  },
  {
    title: 'JSON body',
    prompt: 'Create a POST request to /v1/customers with JSON body name, email, plan, and metadata.source set to fetchlab.',
  },
  {
    title: 'Debug auth',
    prompt: 'Create a request for an OAuth token refresh flow using client_id, client_secret, refresh_token, and grant_type=refresh_token.',
  },
  {
    title: 'Reproduce bug',
    prompt: 'Reproduce a 422 validation error for POST /v1/orders where customer_id is missing but sku and quantity are present.',
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
          <a href="/ai-how-to" style={{ opacity: 1, color: 'var(--color-text)' }}>AI guide</a>
          <a href="/enterprise" style={{ opacity: 0.85 }} className="hover:opacity-100 transition-opacity">Enterprise</a>
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

function NumberedList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3" style={{ margin: 0, padding: 0 }}>
      {steps.map((step, index) => (
        <li key={step} className="grid gap-3" style={{ gridTemplateColumns: '34px 1fr', alignItems: 'start' }}>
          <span
            className="font-mono"
            style={{ color: 'var(--color-accent)', fontSize: 11, letterSpacing: '0.12em', paddingTop: 2 }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <span style={{ lineHeight: 1.65 }}>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ScopeMatrix() {
  return (
    <section
      id="scope"
      className="scroll-mt-20"
      style={{
        background: 'var(--color-border)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 42,
      }}
      aria-label="AI assistance scope"
    >
      <div className="p-5 md:p-6" style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 10 }}>
          Scope of AI assistance
        </div>
        <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', margin: 0 }}>
          What AI can and cannot do
        </h2>
      </div>
      <div className="grid lg:grid-cols-3 gap-px">
        {SCOPE_COLUMNS.map((column) => (
          <div key={column.title} className="p-5 md:p-6" style={{ background: 'var(--color-surface)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 16px' }}>{column.title}</h3>
            <ul className="space-y-3" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {column.items.map((item, index) => (
                <li key={item} className="grid gap-3" style={{ gridTemplateColumns: '28px 1fr', alignItems: 'start' }}>
                  <span
                    className="font-mono"
                    style={{ color: 'var(--color-accent)', fontSize: 10.5, letterSpacing: '0.10em', paddingTop: 2 }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', lineHeight: 1.65 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkflowCard({ workflow, index }: { workflow: (typeof WORKFLOWS)[number]; index: number }) {
  return (
    <article
      id={workflow.id}
      className="scroll-mt-20"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div className="p-5 md:p-6" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
        <div className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 10 }}>
          {String(index + 1).padStart(2, '0')} / {workflow.label}
        </div>
        <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', margin: 0 }}>
          {workflow.title}
        </h2>
      </div>
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-px" style={{ background: 'var(--color-border)' }}>
        <div className="p-5 md:p-6" style={{ background: 'var(--color-surface)' }}>
          <NumberedList steps={workflow.steps} />
        </div>
        <div className="p-5 md:p-6 space-y-4" style={{ background: 'var(--color-surface)' }}>
          <div>
            <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-subtle)', marginBottom: 8 }}>
              Prompt / input example
            </div>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>{workflow.example}</p>
          </div>
          <div>
            <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-subtle)', marginBottom: 8 }}>
              Safety check
            </div>
            <p style={{ color: 'var(--color-text)', lineHeight: 1.7, margin: 0 }}>{workflow.caution}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AIHowTo() {
  usePublicLightTheme();

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Nav />
      <main className="max-w-[1180px] mx-auto px-6 lg:px-8 py-14 md:py-20">
        <section className="grid lg:grid-cols-[0.92fr_1.08fr] gap-10 lg:gap-16 items-end" style={{ marginBottom: 42 }}>
          <div>
            <div className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 18 }}>
              AI operator guide
            </div>
            <h1
              className="text-5xl md:text-7xl"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.07em', lineHeight: 0.92, margin: 0, maxWidth: '11ch' }}
            >
              How to use AI in FetchLab.
            </h1>
          </div>
          <p className="text-base md:text-lg" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75, maxWidth: 650, margin: 0 }}>
            Use AI to draft requests, parse cURL, explain failures, and triage API incidents.
            Keep it review-first: configure the provider deliberately, inspect every generated request,
            and avoid sending secrets unless your retention and provider setup allow it.
          </p>
        </section>

        <ScopeMatrix />

        <section
          className="grid md:grid-cols-5 gap-px"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-border)', marginBottom: 42 }}
          aria-label="AI setup checklist"
        >
          {SETUP_STEPS.map((item, index) => (
            <div key={item.title} className="p-4" style={{ background: 'var(--color-surface)', minHeight: 170 }}>
              <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-accent)', marginBottom: 12 }}>
                Setup {String(index + 1).padStart(2, '0')}
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 8px' }}>{item.title}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{item.body}</p>
            </div>
          ))}
        </section>

        <section
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-border)', marginBottom: 42 }}
          aria-label="AI workflow index"
        >
          {WORKFLOWS.map((workflow, index) => (
            <a key={workflow.id} href={`#${workflow.id}`} style={{ background: 'var(--color-surface)', padding: '14px 16px', minHeight: 82 }}>
              <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-subtle)', marginBottom: 8 }}>
                {String(index + 1).padStart(2, '0')}
              </div>
              <div style={{ color: 'var(--color-text)', fontWeight: 600 }}>{workflow.label}</div>
            </a>
          ))}
        </section>

        <section className="space-y-5 md:space-y-6" aria-label="AI workflow instructions" style={{ marginBottom: 42 }}>
          {WORKFLOWS.map((workflow, index) => (
            <WorkflowCard key={workflow.id} workflow={workflow} index={index} />
          ))}
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
            <div className="font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 10 }}>
              Prompt recipes
            </div>
            <h2 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', margin: 0 }}>
              Useful prompts to start from
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-px" style={{ background: 'var(--color-border)' }}>
            {PROMPT_RECIPES.map((recipe) => (
              <div key={recipe.title} className="p-5" style={{ background: 'var(--color-surface)' }}>
                <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-accent)', marginBottom: 8 }}>
                  {recipe.title}
                </div>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>{recipe.prompt}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
