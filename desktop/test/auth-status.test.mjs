import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAuthStatus, loadSessionEnv, sessionPresent } from '../lib/auth-status.mjs';
import { sanitizeForUi } from '../lib/sanitize.mjs';

test('readAuthStatus reports lengths only and never treats a short file as logged in', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-auth-'));
  const envPath = path.join(dir, '.env');
  fs.writeFileSync(envPath, 'UPSELLER_COOKIE=abcdefghijklmnopqrstuvwxyz\nUPSELLER_DEVICE_ID=1234567890abcdef\n', { mode: 0o600 });
  const status = readAuthStatus(envPath);
  assert.equal(status.loggedIn, false);
  assert.equal(status.present, false);
  assert.equal(status.verified, false);
  assert.equal(status.cookieLen, 26);
  assert.equal(status.deviceIdLen, 16);
  assert.equal(status.mode, '600');
  const dumped = JSON.stringify(status);
  assert.equal(dumped.includes('abcdefghijklmnopqrstuvwxyz'), false);
  assert.equal(dumped.includes('1234567890abcdef'), false);
  const loaded = loadSessionEnv(envPath);
  const sanitized = sanitizeForUi({ cookie: loaded.UPSELLER_COOKIE, deviceId: loaded.UPSELLER_DEVICE_ID, cookieLen: 26 });
  assert.equal(sanitized.cookie, '[redacted len=26]');
  assert.equal(sanitized.deviceId, '[redacted len=16]');
  assert.equal(sanitized.cookieLen, 26);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a long enough file is present but still not logged in until a live check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-auth-'));
  const envPath = path.join(dir, '.env');
  const cookie = 'x'.repeat(32);
  const deviceId = 'd'.repeat(16);
  fs.writeFileSync(envPath, `UPSELLER_COOKIE=${cookie}\nUPSELLER_DEVICE_ID=${deviceId}\n`, { mode: 0o600 });
  const status = readAuthStatus(envPath);
  assert.equal(sessionPresent(32, 16), true);
  assert.equal(status.present, true);
  assert.equal(status.loggedIn, false);
  assert.equal(status.verified, false);
  assert.equal(status.cookieLen, 32);
  const dumped = JSON.stringify(status);
  assert.equal(dumped.includes(cookie), false);
  assert.equal(dumped.includes(deviceId), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('missing env is a clean logged-out status', () => {
  const status = readAuthStatus('/tmp/definitely-missing-upseller.env');
  assert.equal(status.loggedIn, false);
  assert.equal(status.present, false);
  assert.equal(status.cookieLen, 0);
  assert.equal(status.exists, false);
});
