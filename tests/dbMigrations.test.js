import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PostgreSQL schema migrations', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('pg');
    delete process.env.DATABASE_URL;
  });

  it('backfills auth and authority columns and creates product mission storage', async () => {
    const queries = [];
    class Pool {
      async query(sql) {
        queries.push(sql);
        return { rows: [] };
      }
      async end() {}
    }

    vi.doMock('pg', () => ({ default: { Pool } }));
    process.env.DATABASE_URL = 'postgres://fetchlab:test@localhost:5432/fetchlab_test';

    const db = await import('../server/db.js');
    await db.initDb();
    await db.closeDb();

    const schema = queries.join('\n');
    expect(schema).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0');
    expect(schema).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ');
    expect(schema).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT');
    expect(schema).toContain("ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes_hashed JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS autonomy_studies');
    expect(schema).toContain('idx_autonomy_studies_workspace');
    expect(schema).toContain('ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS workspace_id UUID');
    expect(schema).toContain("ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS scopes JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(schema).toContain('ALTER TABLE autonomy_studies ADD COLUMN IF NOT EXISTS draft_policy JSONB');
    expect(schema).toContain('ALTER TABLE autonomy_studies ADD COLUMN IF NOT EXISTS published_revision INTEGER NOT NULL DEFAULT 0');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS authority_policy_revisions');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS authority_events');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS authority_change_reviews');
    expect(schema).toContain('idx_authority_events_idempotency');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS product_missions');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS mission_events');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS github_configs');
    expect(schema).toContain('idx_product_missions_workspace');
    expect(schema).toContain('idx_mission_events_mission');
  });
});
