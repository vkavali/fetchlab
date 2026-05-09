# ⚡ FetchLab — AI-Native API Client

A fast, free, **AI-powered** API testing tool. Better than Postman: no accounts, no cloud lock-in, your data stays local — and now with Claude built in for request generation, test authoring, error diagnosis, diff explanations, and OpenAPI spec generation.

![FetchLab](https://img.shields.io/badge/FetchLab-v1.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![AI](https://img.shields.io/badge/AI-Claude%20Sonnet%204.6-purple) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## ✨ AI Features (what sets FetchLab apart)

All AI features are powered by Claude (`claude-sonnet-4-6`). They're optional — set the `ANTHROPIC_API_KEY` environment variable on your server to enable them. The rest of FetchLab works without it.

### 🪄 AI Request Builder
Click the **AI Builder** button in the header. You can either:
- **Paste a cURL command** — it's auto-parsed into a fully editable FetchLab request (URL, method, headers, body, query params).
- **Describe in plain English** — `"GET all users from the GitHub API with auth token"` becomes a real request with the right URL, method, headers, and a placeholder for your token.

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
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker build -t fetchlab .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... fetchlab
```

### Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select `vkavali/fetchlab` → Railway auto-detects the Dockerfile
4. Set the `ANTHROPIC_API_KEY` env var in Railway → Variables
5. Done — your team gets a public URL with full AI features

> Without `ANTHROPIC_API_KEY`, AI endpoints return 503 and the UI degrades gracefully — the rest of FetchLab still works perfectly.

---

## 📦 Features

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

## 🔑 API Endpoints (server.js)

| Endpoint | Method | Description |
|----------|--------|-------------|
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

All AI endpoints use `claude-sonnet-4-6`. They return 503 when `ANTHROPIC_API_KEY` isn't set so the UI can degrade gracefully.

---

## 📁 Project Structure

```
fetchlab/
├── src/
│   ├── components/
│   │   ├── AIRequestBuilder.tsx     # Natural-language + cURL request builder
│   │   ├── OpenApiGenerator.tsx     # AI OpenAPI 3.0 spec modal
│   │   ├── RequestBuilder.tsx       # URL bar, params, headers, body, auth
│   │   ├── ResponseViewer.tsx       # Body, headers, explorer, schema, AI tests
│   │   ├── ErrorDiagnosis.tsx       # Rules-based + AI fix suggestions
│   │   ├── ResponseDiff.tsx         # Snapshot diff + AI breaking analysis
│   │   └── ... (Sidebar, Header, TabBar, Auth, Tokens, Snippets, …)
│   ├── store/AppContext.tsx         # Global state (useReducer)
│   ├── types/index.ts               # All TypeScript interfaces
│   └── utils/
│       ├── aiClient.ts              # Frontend AI fetch helpers
│       ├── curlParser.ts            # cURL command parser
│       ├── scriptRunner.ts          # `fl.*` JavaScript sandbox
│       ├── jsonDiff.ts              # Recursive JSON diff
│       └── helpers.ts, docGenerator.ts, shareLink.ts
├── ai-routes.js                     # Express routes for all AI endpoints
├── server.js                        # Express server (Slack/Teams/Widget/SPA + AI)
├── Dockerfile                       # Multi-stage Docker build
└── package.json
```

---

## 🤝 Contributing

PRs welcome! The codebase is straightforward React + TypeScript. Every feature is a self-contained component.

---

## 📄 License

MIT — use it however you want.
