# ⚡ FetchLab — Modern API Client

A fast, free, and fully local API testing tool. Better than Postman. No accounts, no cloud, no telemetry — your data never leaves your machine.

![FetchLab](https://img.shields.io/badge/FetchLab-v1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

## 🚀 Quick Start

### Run Locally

```bash
# Clone the repo
git clone https://github.com/user/fetchlab.git
cd fetchlab

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
# Build for production
npm run build

# Serve the built files
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker build -t fetchlab .
docker run -p 3000:3000 fetchlab
```

### Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the `fetchlab` repo → Railway auto-detects the Dockerfile
4. Done — your team gets a public URL

---

## ✨ Features

### Core
- **7 HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Request builder** — params, headers, body (JSON/form/raw), auth
- **Response viewer** — syntax-highlighted JSON, headers, timing, size
- **Multi-tab workspace** — open multiple requests like browser tabs
- **Collections** — organize requests into groups
- **Environment variables** — `{{baseUrl}}` interpolation, switch dev/staging/prod
- **Request history** — searchable, persisted across restarts
- **localStorage persistence** — everything survives page reloads

### Authentication (better than Postman)
- Bearer Token, Basic Auth, API Key (header or query)
- OAuth 2.0 (client credentials, password, auth code)
- **Token Profiles** — configure a token endpoint once, auto-fetch & inject into any request, auto-refresh before expiry

### Testing & Automation
- **Pre-request scripts** — JavaScript sandbox with `fl.setHeader()`, `fl.setVariable()`, `fl.timestamp()`, `fl.uuid()`
- **Test scripts** — `fl.test("name", () => { fl.expect(fl.response.status).toBe(200) })`
- **Response variable extraction** — extract values from responses via JSON path, auto-inject into next request
- **Collection runner** — batch-run all requests with pass/fail results
- **Schema validation** — define expected types, required fields, conditions (equals, contains, regex, gt, lt)

### Innovative (no other tool has these)
- **🩺 Smart Error Diagnosis** — when a request fails, auto-detects the cause (CORS, auth, validation, rate limit) and suggests fixes with copyable code snippets
- **⚡ Performance Benchmark** — run same request N times, see avg/min/max/p50/p95/p99 with latency histogram
- **🔀 Environment Diff** — send same request to two environments, compare responses side-by-side with JSON diff
- **🌳 JSON Explorer** — collapsible tree view with type icons, search, click-to-copy JSON path
- **💓 API Health Dashboard** — monitor all endpoints in real-time with sparkline charts, uptime %, trend detection
- **🔮 Smart URL Autocomplete** — suggestions from history, collections, and environment variables as you type

### Sharing & Team Collaboration
- **Export** — JSON, cURL, JavaScript, Python, Go, Plain Text with format picker
- **Import** — collections and requests from JSON files
- **Team sharing** — copy collection JSON or download `.fetchlab.json` for git repos
- **Slack bot** — `/fetchlab GET https://api.example.com/users` slash command
- **Teams webhook** — send API test results to Microsoft Teams channels
- **Embeddable widget** — iframe any API endpoint as a live demo on any webpage
- **API docs generator** — auto-generate HTML or Markdown docs from collections

### UX Polish
- **Dark / Light theme** — warm cream light theme, not blinding white
- **Resizable panels** — drag to resize sidebar, request/response split, body editor
- **Keyboard shortcuts** — Ctrl+N (new tab), Ctrl+W (close), Ctrl+L (focus URL), Ctrl+/ (sidebar)
- **Tab context menu** — right-click for Duplicate, Close Others, Close to Right
- **Request naming** — editable name field above URL bar
- **Save dialog** — name the request, pick or create a collection
- **Collection rename** — inline edit with pencil icon
- **cURL import** — paste a curl command in the URL bar, auto-parsed
- **Welcome guide** — 6-step interactive onboarding for new users
- **FAQ & Help** — 11 questions with answers, keyboard shortcuts reference

---

## 🏗 Tech Stack

- **React 19** + **TypeScript**
- **Tailwind CSS 4** — utility-first styling
- **Vite 8** — instant dev server
- **Express** — production server for API endpoints (Slack/Teams/Widget)
- **Lucide React** — icons
- **No external runtime dependencies** — everything runs in the browser

---

## 📁 Project Structure

```
fetchlab/
├── src/
│   ├── components/        # All UI components
│   │   ├── RequestBuilder.tsx    # URL bar, params, headers, body, auth
│   │   ├── ResponseViewer.tsx    # Response body, headers, explorer, schema
│   │   ├── Sidebar.tsx           # Collections, history, env, tokens, snippets
│   │   ├── Header.tsx            # Logo, theme, health, integrations, help
│   │   ├── TabBar.tsx            # Multi-tab management
│   │   ├── AuthEditor.tsx        # All auth types including token profiles
│   │   ├── TokenManager.tsx      # Token profile configuration
│   │   ├── JsonExplorer.tsx      # Visual JSON tree view
│   │   ├── SchemaValidator.tsx   # Response schema validation
│   │   ├── ErrorDiagnosis.tsx    # Smart error fix suggestions
│   │   ├── PerformanceBenchmark.tsx  # Load testing
│   │   ├── EnvDiff.tsx           # Cross-environment comparison
│   │   ├── HealthDashboard.tsx   # API monitoring
│   │   ├── CollectionRunner.tsx  # Batch request execution
│   │   ├── ScriptEditor.tsx      # Pre-request & test script editor
│   │   ├── DocGenerator.tsx      # API documentation generator
│   │   ├── ExportDialog.tsx      # Multi-format export
│   │   ├── ShareDialog.tsx       # Team sharing
│   │   ├── Integrations.tsx      # Slack/Teams/Widget setup
│   │   ├── WelcomeGuide.tsx      # Onboarding walkthrough
│   │   └── HelpMenu.tsx          # FAQ and shortcuts
│   ├── store/
│   │   └── AppContext.tsx        # Global state management (useReducer)
│   ├── types/
│   │   └── index.ts              # All TypeScript interfaces
│   └── utils/
│       ├── helpers.ts            # Formatting, code generation, export
│       ├── curlParser.ts         # cURL command parser
│       ├── scriptRunner.ts       # JavaScript sandbox for scripts
│       ├── jsonDiff.ts           # Recursive JSON diff algorithm
│       ├── docGenerator.ts       # HTML/Markdown doc generator
│       └── shareLink.ts          # Team sharing utilities
├── server.js                     # Express server (Slack/Teams/Widget/SPA)
├── Dockerfile                    # Multi-stage Docker build
└── package.json
```

---

## 🔑 API Endpoints (server.js)

When running the production server:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/slack` | POST | Slack slash command handler |
| `/api/teams/test` | POST | Teams webhook proxy |
| `/api/widget` | GET | Embeddable API test widget |
| `/api/health` | GET | Server health check |

---

## 🤝 Contributing

PRs welcome! The codebase is straightforward React + TypeScript. Every feature is a self-contained component.

---

## 📄 License

MIT — use it however you want.
