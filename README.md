# FetchLab - Product Missions + API Lab

FetchLab gives product and engineering teams two connected benches: **Product Missions** turns real customer evidence into a human-reviewed draft pull request, while **API Lab** provides the request, response, protocol, and scripting tools needed to investigate the product underneath it.

It runs in encrypted local draft mode without a database, or as a self-hosted team service with PostgreSQL, GitHub repository access, external model configuration, audit logs, RBAC, rate limits, OIDC SSO, and SCIM.

![FetchLab](https://img.shields.io/badge/FetchLab-v1.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![AI](https://img.shields.io/badge/AI-Claude%20Sonnet%204.6-purple) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## ✨ Product

FetchLab has two benches in one app:

- **Product Missions** - capture a customer issue, regression, AI failure, or repeated request; investigate bounded repository context; review exact proposed source; approve a fingerprinted proposal; create a draft PR; and read repository checks.
- **API Lab** - send requests, manage collections, run scripts, compare responses, test WebSocket/SSE streams, build flows, and generate OpenAPI specs.

Action policies, prompt tools, evals, request generation, and incident tooling remain available under the API Lab's advanced surfaces.

### Product Missions
Open `/app` and start with real evidence plus the customer outcome that should change. Local mode encrypts the draft on the device and performs no repository action. In a signed-in workspace, connect a fine-grained GitHub token and an external model provider. FetchLab first selects bounded repository context, then produces an exact file proposal with acceptance criteria, risks, a base commit, and a deterministic proposal fingerprint.

Approval is accepted only for the current fingerprint and investigated base. FetchLab creates a dedicated branch and draft pull request, never writes to the default branch, and has no merge or deploy operation. CI is reported as passed, failed, pending, or unverified; zero reported checks never becomes a false pass.

### 🧪 AI Test Generation
After any successful response, click **Generate Tests** in the response status bar. FetchLab analyzes the actual response body, status, and headers, then writes a complete `fl.test()` script with assertions like:
```js
fl.test('returns 200', () => { fl.expect(fl.response.status).toBe(200); });
fl.test('responds under 1s', () => { fl.expect(fl.response.time).toBeLessThan(1000); });
fl.test('body has data array', () => { fl.expect(Array.isArray(fl.response.body.data)).toBeTruthy(); });
fl.test('first item has id', () => { fl.expect(fl.response.body.data[0]).toHaveProperty('id'); });
```
The generated script is appended to your test script and runs on every send.

### 🩺 AI Error Diagnosis
On any 4xx/5xx response, the **🩺 Fix** tab shows the existing rules-based diagnosis plus an **Ask AI to diagnose** button. Claude reads the request (with secrets redacted), the response body, and headers — then returns a specific root-cause assessment, severity, and 2–4 ranked, copy-pasteable fixes that reference real values from *your* request, not generic HTTP error definitions.

### 🔀 AI Diff Explanation
Save response snapshots, then run a Diff. Click **Explain in plain English** and Claude tells you:
- A 1–2 sentence summary of what changed
- Whether it's a **breaking change** (and exactly why)
- The most important highlights with consumer impact

### 📄 AI OpenAPI Spec Generation
In the Collections sidebar, click **API Spec** on any collection. Claude analyzes every request plus the most recent matching response from history and emits a valid OpenAPI 3.0 YAML spec — paths, parameters, schemas, response shapes, the whole thing. Copy or download.

---

## 🚀 Quick Start

### Run Locally

```bash
git clone https://github.com/vkavali/fetchlab.git
cd fetchlab
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Production Build

```bash
npm run build
JWT_SECRET=replace-with-a-long-random-secret \
APP_ENCRYPTION_KEY=replace-with-32-byte-hex-or-base64 \
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker build -t fetchlab .
docker run -p 3000:3000 \
  -e JWT_SECRET=replace-with-a-long-random-secret \
  -e APP_ENCRYPTION_KEY=replace-with-32-byte-hex-or-base64 \
  -e GITHUB_TOKEN=optional-server-fallback \
  -e GITHUB_REPO=owner/repository \
  fetchlab
```

### Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select `vkavali/fetchlab` → Railway auto-detects the Dockerfile
4. Add PostgreSQL and set `DATABASE_URL`, `JWT_SECRET`, and `APP_ENCRYPTION_KEY`
5. Connect GitHub and an AI provider in a workspace, or set server fallback credentials

> Without a GitHub connection and external model provider, Product Missions remains an encrypted evidence capture tool and API Lab continues to work locally. Repository investigation and pull-request creation stay disabled rather than being simulated.

## 🏢 Enterprise Mode

FetchLab can run in two modes:

- **Local mode** (default): no auth or database; Product Mission drafts and sensitive local credentials are encrypted in browser storage, while ordinary API Lab state remains local to the device.
- **Server mode**: PostgreSQL-backed multi-user workspaces with repository execution, encrypted credentials and evidence, audit logs, rate limiting, and OIDC SSO.

### Sellable packages

- **Free** - encrypted local Product Mission drafts plus the local API Lab.
- **Team** - shared missions, workspace GitHub and model connections, draft PR creation, RBAC, and audit history.
- **Enterprise Pilot** - self-hosted setup, SSO/SCIM and retention configuration, security review support, and a guided three-mission trial against one real repository.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. When set, the server uses Postgres. When unset, falls back to in-memory (or `FETCHLAB_DATA_FILE` for JSON file persistence). |
| `FETCHLAB_DATA_FILE` | Optional path to persist auth/workspace data as JSON when no DB is configured. |
| `JWT_SECRET` | Required in production. Used to sign session tokens. |
| `APP_ENCRYPTION_KEY` | Required in production. 32 bytes (hex or base64) used for AES-256-GCM credential encryption. |
| `GITHUB_TOKEN` | Optional server fallback for Product Missions. A workspace admin can instead connect an encrypted fine-grained token in the UI. |
| `GITHUB_REPO` | Optional server fallback repository in `owner/name` form. |
| `ANTHROPIC_API_KEY` | Optional server fallback. Enables Anthropic-backed investigation and `/api/ai/*` tools. |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-haiku-4-5-20251001`. |
| `VITE_API_BASE_URL` | Optional frontend build variable. Set this to the backend origin when the web frontend and API run as separate Railway services. Leave unset for the normal single-service deployment. |
| `FETCHLAB_ALLOWED_ORIGINS` | Optional comma-separated backend allowlist for split deployments, for example `https://your-web-service.up.railway.app,https://fetchlab.app`. |
| `AUTH_DISABLED=1` | Skips auth checks server-side (single-user / dev only). |
| `RATE_LIMIT_DISABLED=1` | Disables rate limiting (tests only). |

### Auth, workspaces, and SSO

- `POST /api/auth/register` — first user becomes admin. 8+ char password.
- `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me`
- `GET /api/workspaces`, `POST /api/workspaces`, members at `/api/workspaces/:id/members` (admin role to invite)
- Product Missions: `GET/POST /api/workspaces/:id/missions`, investigation and approval under `/api/workspaces/:id/missions/:missionId`, and workspace GitHub setup at `/api/workspaces/:id/missions/config/github`.
- Action gates: `GET/POST /api/workspaces/:id/autonomy-studies`, policy state/draft/publish under `/api/workspaces/:id/autonomy-studies/:studyId/authority`, and runtime credentials at `/api/workspaces/:id/authority-tokens`.
- Runtime enforcement: `POST /api/authority/check`, `GET /api/authority/events/:eventId`, and one-time approval consumption at `POST /api/authority/events/:eventId/consume`.
- OIDC SSO: admin configures providers via `POST /api/auth/sso/admin`; users log in at `/api/auth/sso/start/:configId`.

### Tests

```bash
npm test
```

Runs Vitest across Product Mission state, proposal fingerprints, GitHub draft-PR safety, CI truthfulness, server and browser encryption, JWT auth, workspaces, action policies, UI acceptance paths, the script runner (`fl.*`), curl parser, and mocked AI endpoints.

---

## 📦 Features

### Product Missions
- **Evidence capture** - customer issues, regressions, AI failures, and repeated requests tied to a desired outcome
- **Bounded repository investigation** - source selection limits, blocked sensitive paths, secret redaction, and explicit insufficient-evidence questions
- **Exact proposal review** - complete proposed source, acceptance criteria, risks, base commit, and deterministic fingerprint
- **Human-gated GitHub execution** - isolated branch and draft pull request only; no merge or deploy capability
- **Truthful validation** - passed, failed, pending, and unverified repository check states
- **Mission record** - append-only workflow events plus enterprise audit entries

### Core
- **7 HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Request builder** — params, headers, body (JSON / form / form-urlencoded / raw / GraphQL), auth
- **Response viewer** — syntax-highlighted JSON, headers, timing, size, code generation
- **Multi-tab workspace** — open multiple requests like browser tabs
- **Collections** — organize requests into groups
- **Environment variables** — `{{baseUrl}}` interpolation, switch dev/staging/prod
- **Request history** — searchable, persisted across restarts
- **localStorage persistence** — everything survives page reloads

### Authentication
- Bearer Token, Basic Auth, API Key (header or query)
- OAuth 2.0 (client credentials, password, auth code)
- **Token Profiles** — configure a token endpoint once, auto-fetch & inject into any request, auto-refresh before expiry

### Testing & Automation
- **Pre-request scripts** — JavaScript sandbox with `fl.setHeader()`, `fl.setVariable()`, `fl.timestamp()`, `fl.uuid()`
- **Test scripts** — `fl.test("name", () => fl.expect(fl.response.status).toBe(200))`
- **AI test generation** — Claude writes assertions for you (see above)
- **Response variable extraction** — extract values via JSON path, auto-inject into next request
- **Collection runner** — batch-run all requests with pass/fail results
- **Schema validation** — define expected types, required fields, conditions

### Real-time & Streaming
- **WebSocket Tester** — connect, send/receive, message history
- **SSE Viewer** — Server-Sent Events with replay
- **GraphQL** — query/variables/operationName + schema introspection
- **Visual Flow Builder** — chain requests into multi-step workflows

### Innovative Diagnostics
- **🩺 Smart Error Diagnosis** — rules-based detection (CORS, auth, validation, rate limit) + **AI diagnosis** for context-aware fixes
- **⚡ Performance Benchmark** — run same request N times, see avg/min/max/p50/p95/p99 with histogram
- **🔀 Environment Diff** — same request to two environments, side-by-side JSON diff
- **📊 Response Diff** — compare snapshots over time + **AI explanation** of breaking-vs-non-breaking changes
- **🌳 JSON Explorer** — collapsible tree, type icons, search, click-to-copy JSON path
- **💓 API Health Dashboard** — monitor endpoints in real-time with sparkline charts
- **🔮 Smart URL Autocomplete** — suggestions from history, collections, and env variables
- **⏱ Response Timeline** — DNS, TCP, TLS, TTFB, transfer breakdown

### Sharing & Team Collaboration
- **Export** — JSON, cURL, JavaScript, Python, Go, Plain Text
- **Import** — collections and requests from JSON files
- **Team sharing** — copy collection JSON or download `.fetchlab.json`
- **Slack bot** — `/fetchlab GET https://api.example.com/users`
- **Teams webhook** — send results to Microsoft Teams channels
- **Embeddable widget** — iframe any API endpoint as a live demo
- **API docs generator** — HTML or Markdown docs from collections
- **🤖 OpenAPI 3.0 spec generator** — Claude turns your collection into a real spec

### UX Polish
- **Dark / Light theme**, **resizable panels**, **keyboard shortcuts** (Ctrl+N / Ctrl+W / Ctrl+L / Ctrl+/)
- **cURL import** — paste in URL bar, auto-parsed
- **Welcome guide & FAQ** — interactive onboarding

---

## 🏗 Tech Stack

- **React 19** + **TypeScript**
- **Tailwind CSS 4** — utility-first
- **Vite 8** — instant dev server
- **Express 5** — production server
- **@anthropic-ai/sdk** — Claude integration
- **Lucide React** — icons

---

## 🔑 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workspaces/:id/missions` | GET / POST | List or capture Product Missions |
| `/api/workspaces/:id/missions/:missionId/investigate` | POST | Read bounded repository context and prepare an exact proposal |
| `/api/workspaces/:id/missions/:missionId/approve` | POST | Approve the current fingerprint and create a draft pull request |
| `/api/workspaces/:id/missions/:missionId/validation` | POST | Refresh GitHub check status |
| `/api/workspaces/:id/missions/config` | GET | Read repository/model readiness without returning credentials |
| `/api/workspaces/:id/missions/config/github` | PUT / DELETE | Manage encrypted workspace GitHub access |
| `/api/ai/generate-request` | POST | Natural language → request spec |
| `/api/ai/generate-tests` | POST | Response → `fl.test()` assertions |
| `/api/ai/diagnose` | POST | Failed request → root-cause + fixes |
| `/api/ai/explain-diff` | POST | JSON diff → plain-English breaking analysis |
| `/api/ai/generate-spec` | POST | Collection + history → OpenAPI 3.0 YAML |
| `/api/ai/status` | GET | Whether AI is configured on this server |
| `/api/slack` | POST | Slack slash command handler |
| `/api/teams/test` | POST | Teams webhook proxy |
| `/api/widget` | GET | Embeddable API test widget |
| `/api/health` | GET | Server health check |

Model-backed behavior uses the provider configured for the signed-in user or a server fallback. Supported paths include Anthropic, AWS Bedrock, Google Vertex AI, and OpenAI-compatible endpoints. A missing external provider returns a clear unavailable state; local heuristics are not allowed to author mission code.

---

## 📁 Project Structure

```
fetchlab/
├── src/
│   ├── components/
│   │   ├── MissionWorkspace.tsx     # Evidence-to-draft-PR product workflow
│   │   ├── AIRequestBuilder.tsx     # Natural-language + cURL request builder
│   │   ├── OpenApiGenerator.tsx     # AI OpenAPI 3.0 spec modal
│   │   ├── RequestBuilder.tsx       # URL bar, params, headers, body, auth
│   │   ├── ResponseViewer.tsx       # Body, headers, explorer, schema, AI tests
│   │   ├── ErrorDiagnosis.tsx       # Rules-based + AI fix suggestions
│   │   ├── ResponseDiff.tsx         # Snapshot diff + AI breaking analysis
│   │   └── ... (Sidebar, Header, TabBar, Auth, Tokens, Snippets, …)
│   ├── product/missions.ts          # Mission types + encrypted local drafts
│   ├── store/AppContext.tsx         # API Lab state (useReducer)
│   ├── types/index.ts               # All TypeScript interfaces
│   └── utils/
│       ├── aiClient.ts              # Frontend AI fetch helpers
│       ├── curlParser.ts            # cURL command parser
│       ├── scriptRunner.ts          # `fl.*` JavaScript sandbox
│       ├── jsonDiff.ts              # Recursive JSON diff
│       └── helpers.ts, docGenerator.ts, shareLink.ts
├── server/
│   ├── missions.js                  # Workspace mission API and state transitions
│   ├── missionEngine.js             # Bounded investigation + proposal validation
│   ├── agent/github.js              # Exact commit, draft PR, and check reads
│   └── db.js                        # PostgreSQL/file/memory persistence and migrations
├── ai-routes.js                     # Express routes for API Lab AI tools
├── server.js                        # Express entrypoint
├── Dockerfile                       # Multi-stage Docker build
└── package.json
```

---

## 🤝 Contributing

PRs welcome! The codebase is straightforward React + TypeScript. Every feature is a self-contained component.

---

## 📄 License

MIT — use it however you want.
