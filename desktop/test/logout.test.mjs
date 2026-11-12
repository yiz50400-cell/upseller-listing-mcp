import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clearSessionEnv, isProtectedDocumentsEnv, logoutStatePatch } from '../lib/logout.mjs';
import { shopsAfterLogout } from '../lib/shop-list.mjs';
import { loadSessionEnv, readAuthStatus } from '../lib/auth-status.mjs';

test('clearSessionEnv deletes Cookie and DeviceId and only reports lengths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-logout-'));
  const envPath = path.join(dir, 'mcp', '.env');
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  const cookie = 'c'.repeat(48);
  const deviceId = 'd'.repeat(24);
  fs.writeFileSync(envPath, `UPSELLER_COOKIE=${cookie}\nUPSELLER_DEVICE_ID=${deviceId}\nUPSELLER_SAVE_OP=1\n`, { mode: 0o600 });
  process.env.UPSELLER_COOKIE = cookie;
  process.env.UPSELLER_DEVICE_ID = deviceId;
  const out = clearSessionEnv(envPath);
  assert.equal(out.ok, true);
  assert.equal(out.cookieLen, 0);
  assert.equal(out.deviceIdLen, 0);
  assert.equal(out.exists, false);
  assert.equal(fs.existsSync(envPath), false);
  assert.equal(process.env.UPSELLER_COOKIE, undefined);
  assert.equal(process.env.UPSELLER_DEVICE_ID, undefined);
  const dumped = JSON.stringify(out);
  assert.equal(dumped.includes(cookie), false);
  assert.equal(dumped.includes(deviceId), false);
  const status = readAuthStatus(envPath);
  assert.equal(status.loggedIn, false);
  assert.equal(status.present, false);
  assert.equal(status.cookieLen, 0);
  assert.deepEqual(loadSessionEnv(envPath), {});
  fs.rmSync(dir, { recursive: true, force: true });
});

test('clearSessionEnv refuses the Documents upseller-listing env file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-logout-docs-'));
  const protectedPath = path.join(dir, 'Documents', 'upseller-listing', 'mcp', '.env');
  fs.mkdirSync(path.dirname(protectedPath), { recursive: true });
  const cookie = 'p'.repeat(40);
  fs.writeFileSync(protectedPath, `UPSELLER_COOKIE=${cookie}\nUPSELLER_DEVICE_ID=${'q'.repeat(20)}\n`, { mode: 0o600 });
  assert.equal(isProtectedDocumentsEnv(protectedPath), true);
  process.env.UPSELLER_COOKIE = cookie;
  assert.throws(() => clearSessionEnv(protectedPath), /Documents/);
  const still = fs.readFileSync(protectedPath, 'utf8');
  assert.equal(still.includes(cookie), true);
  assert.equal(process.env.UPSELLER_COOKIE, cookie);
  delete process.env.UPSELLER_COOKIE;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('logout drops account shops and keeps manual shops and tasks', () => {
  const shops = shopsAfterLogout([
    { id: 's1', name: '旗舰店', source: 'account' },
    { id: '22', name: '22', source: 'manual' },
    { id: 'old', name: '手填店' },
    { id: 'demo', name: '示例店', demo: true },
  ]);
  assert.deepEqual(shops.map((s) => [s.id, s.name, s.source]), [
    ['22', '22', 'manual'],
    ['old', '手填店', 'manual'],
  ]);
  const patch = logoutStatePatch({
    tasks: [{ id: 't1', title: '保留' }],
    shops: [{ id: 's1', name: '旗舰店', source: 'account' }, { id: '22', name: '22', source: 'manual' }],
  });
  assert.equal(patch.tasks, undefined);
  assert.deepEqual(patch.shops.map((s) => s.id), ['22']);
});
