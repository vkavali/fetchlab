import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { initDb, _resetForTests } from '../server/db.js';
import { resetKeyCache } from '../server/encryption.js';
import { totp } from '../server/totp.js';
import * as db from '../server/db.js';
import { decrypt } from '../server/encryption.js';

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-2fa-secret-very-long-key';
  process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  resetKeyCache();
  delete process.env.DATABASE_URL;
  delete process.env.FETCHLAB_DATA_FILE;
  await initDb();
  const { buildApp } = await import('../server/app.js');
  app = await buildApp({ skipDbInit: true });
});

beforeEach(async () => {
  _resetForTests();
});

async function registerUser(email = 'user@2fa.test') {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'U' });
  return { token: res.body.token, user: res.body.user, cookies: res.headers['set-cookie'] };
}

describe('2FA setup + verification', () => {
  it('rejects /2fa/setup without auth', async () => {
    const res = await request(app).post('/api/auth/2fa/setup').send({});
    expect(res.status).toBe(401);
  });

  it('completes the full 2FA enrollment flow', async () => {
    const { token, user } = await registerUser();
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.body.otpauth_url).toContain('otpauth://totp/FetchLab');

    const code = totp(setup.body.secret);
    const verify = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });
    expect(verify.status).toBe(200);
    expect(verify.body.enabled).toBe(true);
    expect(verify.body.recovery_codes).toHaveLength(10);
    verify.body.recovery_codes.forEach(c => expect(c).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/));

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.totp_enabled).toBe(true);
    void user;
  });

  it('rejects /2fa/verify with a wrong code', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    const verify = await request(app)
      .post('/api/auth/2fa/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' });
    expect(verify.status).toBe(401);
  });

  it('blocks login until 2FA code is provided once enabled', async () => {
    const { token } = await registerUser('login-2fa@test.io');
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    await request(app).post('/api/auth/2fa/verify').set('Authorization', `Bearer ${token}`).send({ code: totp(setup.body.secret) });

    const login = await request(app).post('/api/auth/login').send({ email: 'login-2fa@test.io', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.twofa_required).toBe(true);
    expect(login.body.pending_token).toBeTypeOf('string');
    expect(login.body.token).toBeUndefined();

    const code = totp(setup.body.secret);
    const verify = await request(app)
      .post('/api/auth/login/2fa')
      .send({ code, pending_token: login.body.pending_token });
    expect(verify.status).toBe(200);
    expect(verify.body.token).toBeTypeOf('string');
    expect(verify.body.user.totp_enabled).toBe(true);
  });

  it('accepts a recovery code once and refuses to reuse it', async () => {
    const { token } = await registerUser('recover@test.io');
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    const verify = await request(app).post('/api/auth/2fa/verify').set('Authorization', `Bearer ${token}`).send({ code: totp(setup.body.secret) });
    const [first] = verify.body.recovery_codes;

    const login = await request(app).post('/api/auth/login').send({ email: 'recover@test.io', password: 'password123' });
    const r1 = await request(app)
      .post('/api/auth/login/2fa')
      .send({ recovery_code: first, pending_token: login.body.pending_token });
    expect(r1.status).toBe(200);

    const login2 = await request(app).post('/api/auth/login').send({ email: 'recover@test.io', password: 'password123' });
    const r2 = await request(app)
      .post('/api/auth/login/2fa')
      .send({ recovery_code: first, pending_token: login2.body.pending_token });
    expect(r2.status).toBe(401);
  });

  it('refuses to disable 2FA without password+code', async () => {
    const { token } = await registerUser('disable@test.io');
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    await request(app).post('/api/auth/2fa/verify').set('Authorization', `Bearer ${token}`).send({ code: totp(setup.body.secret) });

    let res = await request(app).post('/api/auth/2fa/disable').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);

    res = await request(app).post('/api/auth/2fa/disable').set('Authorization', `Bearer ${token}`).send({ password: 'wrong-password', code: '000000' });
    expect(res.status).toBe(401);

    res = await request(app).post('/api/auth/2fa/disable').set('Authorization', `Bearer ${token}`).send({ password: 'password123', code: '000000' });
    expect(res.status).toBe(401);

    res = await request(app).post('/api/auth/2fa/disable').set('Authorization', `Bearer ${token}`).send({ password: 'password123', code: totp(setup.body.secret) });
    expect(res.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.totp_enabled).toBe(false);
  });

  it('allows regenerating recovery codes (and invalidates the old set)', async () => {
    const { token } = await registerUser('regen@test.io');
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    const verify = await request(app).post('/api/auth/2fa/verify').set('Authorization', `Bearer ${token}`).send({ code: totp(setup.body.secret) });
    const [oldCode] = verify.body.recovery_codes;

    const regen = await request(app)
      .post('/api/auth/2fa/recovery-codes/regenerate')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'password123' });
    expect(regen.status).toBe(200);
    expect(regen.body.recovery_codes).toHaveLength(10);

    // Old code should now be invalid
    const login = await request(app).post('/api/auth/login').send({ email: 'regen@test.io', password: 'password123' });
    const r = await request(app)
      .post('/api/auth/login/2fa')
      .send({ recovery_code: oldCode, pending_token: login.body.pending_token });
    expect(r.status).toBe(401);
  });

  it('encrypts the TOTP secret at rest', async () => {
    const { token } = await registerUser('crypto@test.io');
    await request(app).post('/api/auth/2fa/setup').set('Authorization', `Bearer ${token}`).send({});
    const userRow = await db.findUserByEmail('crypto@test.io');
    expect(userRow.totp_secret_enc).toMatch(/^v1:/);
    expect(typeof decrypt(userRow.totp_secret_enc)).toBe('string');
  });
});

describe('Account lockout', () => {
  it('locks the account after 5 failed login attempts', async () => {
    await registerUser('lockout@test.io');
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: 'lockout@test.io', password: 'wrong' });
      expect(r.status).toBe(401);
    }
    // 6th attempt — even with correct password — should now be locked
    const locked = await request(app).post('/api/auth/login').send({ email: 'lockout@test.io', password: 'password123' });
    expect(locked.status).toBe(423);
    expect(locked.body.locked_until).toBeTypeOf('string');
  });

  it('successful login resets the failure counter', async () => {
    await registerUser('reset-fail@test.io');
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send({ email: 'reset-fail@test.io', password: 'wrong' });
    }
    const ok = await request(app).post('/api/auth/login').send({ email: 'reset-fail@test.io', password: 'password123' });
    expect(ok.status).toBe(200);
    const u = await db.findUserByEmail('reset-fail@test.io');
    expect(u.failed_login_count).toBe(0);
    expect(u.locked_until).toBeFalsy();
  });
});
