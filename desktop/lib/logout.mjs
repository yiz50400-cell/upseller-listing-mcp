import fs from 'node:fs';
import path from 'node:path';
import { readAuthStatus } from './auth-status.mjs';
import { shopsAfterLogout } from './shop-list.mjs';

/** The operator's long-lived Documents env must never be cleared by app logout. */
export function isProtectedDocumentsEnv(envPath) {
  const resolved = path.resolve(String(envPath || ''));
  return /(?:^|[/\\])Documents[/\\]upseller-listing[/\\]mcp[/\\]\.env$/i.test(resolved);
}

/** Drop Cookie and DeviceId from process.env. Never logs values. */
export function clearProcessSession() {
  delete process.env.UPSELLER_COOKIE;
  delete process.env.UPSELLER_DEVICE_ID;
}

/**
 * Remove Cookie and DeviceId from the app env file and from process.env.
 * Returns lengths only. Refuses the Documents/upseller-listing/mcp/.env path.
 */
export function clearSessionEnv(envPath) {
  if (!envPath) {
    clearProcessSession();
    return { ok: true, cleared: true, exists: false, cookieLen: 0, deviceIdLen: 0, envPath: '' };
  }
  const target = path.resolve(envPath);
  if (isProtectedDocumentsEnv(target)) {
    throw new Error('不会修改 Documents 里的登录文件。');
  }
  clearProcessSession();
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
  clearProcessSession();
  const status = readAuthStatus(target);
  return {
    ok: true,
    cleared: true,
    exists: Boolean(status.exists),
    cookieLen: Number(status.cookieLen) || 0,
    deviceIdLen: Number(status.deviceIdLen) || 0,
    envPath: target,
  };
}

export function logoutStatePatch(state = {}) {
  return {
    shops: shopsAfterLogout(state.shops),
  };
}
