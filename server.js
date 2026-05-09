import { buildApp } from './server/app.js';

const PORT = process.env.PORT || 3000;

const app = await buildApp();

app.listen(PORT, () => {
  console.log(`FetchLab running on port ${PORT}`);
  console.log(`  Web UI:     http://localhost:${PORT}`);
  console.log(`  Auth:       /api/auth/{register,login,logout,me}`);
  console.log(`  Workspaces: /api/workspaces`);
  console.log(`  AI:         /api/ai/{diagnose,generate-tests}`);
  console.log(`  Audit:      /api/audit (admin)`);
  console.log(`  Slack:      POST /api/slack`);
  console.log(`  Teams:      POST /api/teams/test`);
  console.log(`  Widget:     GET  /api/widget?method=GET&url=...`);
});
