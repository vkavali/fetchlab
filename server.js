import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// ==========================================
// SLACK INTEGRATION — /fetchlab slash command
// ==========================================
app.post('/api/slack', async (req, res) => {
  try {
    const { text, response_url } = req.body;
    if (!text) {
      return res.json({
        response_type: 'ephemeral',
        text: '🧪 *FetchLab* — Usage: `/fetchlab GET https://api.example.com/users`\n\nSupported: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`\n\nExamples:\n• `/fetchlab GET https://jsonplaceholder.typicode.com/users`\n• `/fetchlab POST https://httpbin.org/post {"key":"value"}`',
      });
    }

    // Parse: METHOD URL [BODY]
    const parts = text.trim().match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)(?:\s+(.+))?$/i);
    if (!parts) {
      return res.json({
        response_type: 'ephemeral',
        text: '❌ Invalid format. Use: `/fetchlab METHOD URL [JSON_BODY]`\nExample: `/fetchlab GET https://api.example.com/users`',
      });
    }

    const method = parts[1].toUpperCase();
    const url = parts[2];
    const body = parts[3] || undefined;

    // Acknowledge immediately (Slack requires response within 3s)
    res.json({
      response_type: 'in_channel',
      text: `⏳ Running \`${method} ${url}\`...`,
    });

    // Execute the request
    const startTime = Date.now();
    const fetchOptions = { method, headers: {} };
    if (body && !['GET', 'HEAD'].includes(method)) {
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = body;
    }

    let result;
    try {
      const response = await fetch(url, fetchOptions);
      const elapsed = Date.now() - startTime;
      const responseText = await response.text();

      let prettyBody = responseText;
      try {
        prettyBody = JSON.stringify(JSON.parse(responseText), null, 2);
      } catch { /* not JSON */ }

      const statusEmoji = response.ok ? '✅' : response.status >= 500 ? '🔴' : '🟡';

      result = {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${statusEmoji} *${method}* \`${url}\`\n*Status:* ${response.status} ${response.statusText} | *Time:* ${elapsed}ms`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `\`\`\`\n${prettyBody.substring(0, 2800)}\n\`\`\``,
            },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `_Tested via FetchLab_ | ${new Date().toLocaleTimeString()}` },
            ],
          },
        ],
      };
    } catch (err) {
      result = {
        response_type: 'in_channel',
        text: `❌ *${method}* \`${url}\`\nRequest failed: ${err.message}`,
      };
    }

    // Post delayed response to Slack
    if (response_url) {
      await fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    }
  } catch (err) {
    console.error('Slack handler error:', err);
    if (!res.headersSent) {
      res.json({ response_type: 'ephemeral', text: `Error: ${err.message}` });
    }
  }
});

// ==========================================
// TEAMS INTEGRATION — Incoming webhook proxy
// ==========================================
app.post('/api/teams/test', async (req, res) => {
  try {
    const { method = 'GET', url, body, webhookUrl } = req.body;
    if (!url || !webhookUrl) {
      return res.status(400).json({ error: 'Missing url or webhookUrl' });
    }

    const startTime = Date.now();
    const fetchOptions = { method };
    if (body && !['GET', 'HEAD'].includes(method)) {
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const elapsed = Date.now() - startTime;
    const responseText = await response.text();

    let prettyBody = responseText;
    try { prettyBody = JSON.stringify(JSON.parse(responseText), null, 2); } catch {}

    const statusColor = response.ok ? '00C853' : response.status >= 500 ? 'FF1744' : 'FFD600';

    // Send to Teams webhook (Adaptive Card)
    const teamsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: statusColor,
      summary: `API Test: ${method} ${url}`,
      sections: [
        {
          activityTitle: `🧪 FetchLab API Test`,
          activitySubtitle: `${method} ${url}`,
          facts: [
            { name: 'Status', value: `${response.status} ${response.statusText}` },
            { name: 'Time', value: `${elapsed}ms` },
            { name: 'Size', value: `${new Blob([responseText]).size} bytes` },
          ],
          text: `\`\`\`\n${prettyBody.substring(0, 2000)}\n\`\`\``,
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsPayload),
    });

    res.json({ success: true, status: response.status, time: elapsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// EMBEDDABLE WIDGET — standalone HTML
// ==========================================
app.get('/api/widget', (req, res) => {
  const { method = 'GET', url, title = 'API Demo' } = req.query;
  if (!url) return res.status(400).send('Missing ?url= parameter');

  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — FetchLab Widget</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0f0f17;color:#e5e7eb;padding:16px}
.widget{border:1px solid #1e1e2e;border-radius:12px;overflow:hidden;max-width:600px}
.header{background:#111118;padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #1e1e2e}
.method{font-family:monospace;font-weight:700;font-size:12px;padding:4px 8px;border-radius:6px;background:#22c55e20;color:#22c55e}
.method.POST{background:#3b82f620;color:#3b82f6}
.method.PUT{background:#f59e0b20;color:#f59e0b}
.method.DELETE{background:#ef444420;color:#ef4444}
.url{font-family:monospace;font-size:13px;color:#9ca3af;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.send{background:#3b82f6;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600}
.send:hover{background:#2563eb}
.send:disabled{opacity:0.5;cursor:wait}
.status-bar{padding:8px 16px;font-size:12px;display:flex;gap:12px;border-bottom:1px solid #1e1e2e;background:#0a0a0f}
.status{font-weight:700;font-family:monospace}
.status.ok{color:#22c55e}.status.err{color:#ef4444}.status.warn{color:#f59e0b}
.body{padding:12px 16px;max-height:300px;overflow:auto}
.body pre{font-family:monospace;font-size:11px;color:#d1d5db;white-space:pre-wrap;word-break:break-all;line-height:1.6}
.footer{padding:8px 16px;font-size:10px;color:#4b5563;border-top:1px solid #1e1e2e;text-align:right}
</style>
</head>
<body>
<div class="widget">
  <div class="header">
    <span class="method ${method}">${method}</span>
    <span class="url">${url}</span>
    <button class="send" onclick="run()" id="btn">▶ Run</button>
  </div>
  <div id="status-bar" class="status-bar" style="display:none"></div>
  <div class="body"><pre id="response">Click Run to test this API endpoint</pre></div>
  <div class="footer">Powered by FetchLab</div>
</div>
<script>
async function run(){
  const btn=document.getElementById('btn');
  const pre=document.getElementById('response');
  const bar=document.getElementById('status-bar');
  btn.disabled=true;btn.textContent='⏳ Running...';
  pre.textContent='Loading...';
  const start=Date.now();
  try{
    const res=await fetch('${url}',{method:'${method}'});
    const elapsed=Date.now()-start;
    const text=await res.text();
    let pretty=text;
    try{pretty=JSON.stringify(JSON.parse(text),null,2)}catch{}
    const cls=res.ok?'ok':res.status>=500?'err':'warn';
    bar.style.display='flex';
    bar.innerHTML='<span class="status '+cls+'">'+res.status+' '+res.statusText+'</span><span style="color:#6b7280">'+elapsed+'ms</span>';
    pre.textContent=pretty;
  }catch(e){
    bar.style.display='flex';
    bar.innerHTML='<span class="status err">Error</span>';
    pre.textContent='Request failed: '+e.message;
  }
  btn.disabled=false;btn.textContent='▶ Run';
}
</script>
</body></html>`);
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
});

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FetchLab running on port ${PORT}`);
  console.log(`  Web UI: http://localhost:${PORT}`);
  console.log(`  Slack:  POST http://localhost:${PORT}/api/slack`);
  console.log(`  Teams:  POST http://localhost:${PORT}/api/teams/test`);
  console.log(`  Widget: GET  http://localhost:${PORT}/api/widget?method=GET&url=...`);
});
