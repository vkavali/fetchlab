import { buildApp } from './server/app.js';
import { startSlackBot } from './server/agent/slack-bot.js';

const PORT = process.env.PORT || 3000;

const app = await buildApp();

app.listen(PORT, async () => {
  console.log(`FetchLab running on port ${PORT}`);
  console.log(`  Web UI:     http://localhost:${PORT}`);
  console.log(`  Auth:       /api/auth/{register,login,logout,me}`);
  console.log(`  Workspaces: /api/workspaces`);
  console.log(`  AI:         ${process.env.ANTHROPIC_API_KEY ? 'enabled' : 'DISABLED — set ANTHROPIC_API_KEY'} — /api/ai/{generate-request,generate-tests,diagnose,explain-diff,generate-spec}`);
  console.log(`  Audit:      /api/audit (admin)`);
  console.log(`  Agent:      /api/agent/{issues,activity,configure,status}`);
  console.log(`  Slack:      POST /api/slack`);
  console.log(`  Teams:      POST /api/teams/test`);
  console.log(`  Widget:     GET  /api/widget?method=GET&url=...`);

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
    try {
      await startSlackBot();
    } catch (err) {
      console.error('[agent] Slack bot failed to start:', err.message);
    }
  }
});
