import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const auth = await import('../src/auth/session_env.js').catch(() => ({}));
const login = await import('../src/tools/login.js').catch(() => ({}));

test('writeSessionEnv writes cookie and deviceId with mode 600 and returns only lengths', async () => {
  assert.equal(typeof auth.writeSessionEnv, 'function');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-login-'));
  const envPath = path.join(dir, 'mcp', '.env');
  try {
    const secretCookie = 'session=REAL_COOKIE_VALUE_DO_NOT_LEAK_ABC123';
    const secretDevice = '11111111-2222-3333-4444-555555555555';
    const out = auth.writeSessionEnv({ cookie: secretCookie, deviceId: secretDevice, envPath });
    assert.equal(out.ok, true);
    assert.equal(out.envPath, envPath);
    assert.equal(out.cookieLen, secretCookie.length);
    assert.equal(out.deviceIdLen, secretDevice.length);
    assert.equal(out.cookie, undefined);
    assert.equal(out.deviceId, undefined);
    assert.ok(!JSON.stringify(out).includes(secretCookie));
    assert.ok(!JSON.stringify(out).includes(secretDevice));
    const raw = fs.readFileSync(envPath, 'utf8');
    assert.match(raw, /UPSELLER_COOKIE=/);
    assert.match(raw, /UPSELLER_DEVICE_ID=/);
    assert.ok(raw.includes(secretCookie));
    assert.ok(raw.includes(secretDevice));
    assert.equal(fs.statSync(envPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('extractSession prefers longest upseller Cookie header and DeviceId variants', () => {
  assert.equal(typeof auth.extractSession, 'function');
  const out = auth.extractSession({
    headerEvents: [
      { url: 'https://cdn.example/x', headers: { cookie: 'a=1', DeviceId: 'short' } },
      { url: 'https://app.upseller.com/api/tiktok/product/edit', headers: { Cookie: 'a=1; b=22', deviceid: '11111111-2222-3333-4444-555555555555' } },
      { url: 'https://app.upseller.com/api/x', headers: { cookie: 'a=1; b=22; c=333', DeviceId: '11111111-2222-3333-4444-555555555555' } },
    ],
    cookies: [{ name: 'sid', value: 'fromjar', domain: '.upseller.com' }],
  });
  assert.ok(out.cookie.includes('c=333'));
  assert.ok(out.cookie.includes('sid=fromjar'));
  assert.equal(out.deviceId, '11111111-2222-3333-4444-555555555555');
  assert.ok(!('raw' in out));
});

test('upseller_login uses injected capturer, writes env, never echoes secrets', async () => {
  assert.equal(typeof login.upsellerLogin, 'function');
  assert.equal(login.loginToolSchema?.name, 'upseller_login');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-login-tool-'));
  const envPath = path.join(dir, '.env');
  const secretCookie = 'leak=SHOULD_NOT_APPEAR_IN_TOOL_RESULT';
  const secretDevice = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  try {
    const out = await login.upsellerLogin(
      {},
      { envPath, timeoutMs: 1000 },
      {
        captureSession: async () => ({ cookie: secretCookie, deviceId: secretDevice, source: 'mock' }),
      }
    );
    assert.equal(out.ok, true);
    assert.equal(out.cookieLen, secretCookie.length);
    assert.equal(out.deviceIdLen, secretDevice.length);
    assert.equal(out.source, 'mock');
    assert.ok(!JSON.stringify(out).includes(secretCookie));
    assert.ok(!JSON.stringify(out).includes('SHOULD_NOT_APPEAR'));
    assert.ok(fs.readFileSync(envPath, 'utf8').includes(secretCookie));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('upseller_login rejects short or missing session without writing secrets to result', async () => {
  assert.equal(typeof login.upsellerLogin, 'function');
  await assert.rejects(
    () => login.upsellerLogin({}, {}, { captureSession: async () => ({ cookie: 'x', deviceId: '' }) }),
    /cookie|device|登录|session/i
  );
});
