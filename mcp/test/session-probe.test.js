import test from 'node:test';
import assert from 'node:assert/strict';
import { probeUpsellerSession } from '../src/auth/session_probe.js';

test('below-minimum session is not present and is never logged in', async () => {
  const out = await probeUpsellerSession({ cookie: 'short', deviceId: '1234567890abcdef' });
  assert.equal(out.loggedIn, false);
  assert.equal(out.present, false);
  assert.equal(out.verified, false);
  assert.ok(!('cookie' in out));
  assert.ok(!('deviceId' in out));
});

test('HTTP ok and code 0 means logged in; values stay out of the result', async () => {
  const cookie = 'c'.repeat(40);
  const deviceId = 'd'.repeat(16);
  const out = await probeUpsellerSession({
    cookie,
    deviceId,
    clientFactory: () => ({
      postForm: async () => ({ ok: true, status: 200, json: { code: 0, data: [] } }),
    }),
  });
  assert.equal(out.loggedIn, true);
  assert.equal(out.verified, true);
  assert.equal(out.present, true);
  assert.equal(out.expired, false);
  const dumped = JSON.stringify(out);
  assert.equal(dumped.includes(cookie), false);
  assert.equal(dumped.includes(deviceId), false);
});

test('401 or a non-zero API code means expired, not logged in', async () => {
  const expiredHttp = await probeUpsellerSession({
    cookie: 'c'.repeat(40),
    deviceId: 'd'.repeat(16),
    clientFactory: () => ({
      postForm: async () => ({ ok: false, status: 401, json: { code: 401 } }),
    }),
  });
  assert.equal(expiredHttp.loggedIn, false);
  assert.equal(expiredHttp.expired, true);
  assert.equal(expiredHttp.verified, true);

  const expiredCode = await probeUpsellerSession({
    cookie: 'c'.repeat(40),
    deviceId: 'd'.repeat(16),
    clientFactory: () => ({
      postForm: async () => ({ ok: true, status: 200, json: { code: 10001, msg: 'unauthorized' } }),
    }),
  });
  assert.equal(expiredCode.loggedIn, false);
  assert.equal(expiredCode.expired, true);
});

test('network failure does not claim a login', async () => {
  const out = await probeUpsellerSession({
    cookie: 'c'.repeat(40),
    deviceId: 'd'.repeat(16),
    clientFactory: () => ({
      postForm: async () => { throw new Error('fetch failed'); },
    }),
  });
  assert.equal(out.loggedIn, false);
  assert.equal(out.expired, false);
  assert.equal(out.verified, false);
  assert.equal(out.networkError, true);
});
