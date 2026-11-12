import fs from 'node:fs';
import { parseEnv } from 'node:util';

const ALLOWED = new Set(['UPSELLER_COOKIE', 'UPSELLER_DEVICE_ID', 'UPSELLER_SAVE_OP']);

/** Keep in sync with mcp/src/auth/session_env.js. Length floors only; login still needs a live check. */
export const MIN_COOKIE_LEN = 32;
export const MIN_DEVICE_ID_LEN = 16;

export function sessionPresent(cookieLen, deviceIdLen) {
  return Number(cookieLen) >= MIN_COOKIE_LEN && Number(deviceIdLen) >= MIN_DEVICE_ID_LEN;
}

/** Parse session env, returning only allowed keys. Never logs values. */
export function loadSessionEnv(file) {
  if (!file || !fs.existsSync(file)) return {};
  const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
  const out = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (ALLOWED.has(key)) out[key] = value;
  }
  return out;
}

/** Lengths only. Never returns Cookie or DeviceId values. */
export function readAuthStatus(envPath) {
  const exists = Boolean(envPath) && fs.existsSync(envPath);
  if (!exists) {
    return {
      ok: false,
      loggedIn: false,
      present: false,
      verified: false,
      expired: false,
      envPath,
      exists: false,
      cookieLen: 0,
      deviceIdLen: 0,
      mode: null,
    };
  }
  const stat = fs.statSync(envPath);
  const parsed = loadSessionEnv(envPath);
  const cookieLen = String(parsed.UPSELLER_COOKIE || '').length;
  const deviceIdLen = String(parsed.UPSELLER_DEVICE_ID || '').length;
  const present = sessionPresent(cookieLen, deviceIdLen);
  return {
    ok: false,
    loggedIn: false,
    present,
    verified: false,
    expired: false,
    envPath,
    exists: true,
    cookieLen,
    deviceIdLen,
    mode: (stat.mode & 0o777).toString(8).padStart(3, '0'),
  };
}

/** Load session into process.env without logging values. */
export function applySessionEnv(envPath) {
  const parsed = loadSessionEnv(envPath);
  if (parsed.UPSELLER_COOKIE) process.env.UPSELLER_COOKIE = parsed.UPSELLER_COOKIE;
  if (parsed.UPSELLER_DEVICE_ID) process.env.UPSELLER_DEVICE_ID = parsed.UPSELLER_DEVICE_ID;
  if (parsed.UPSELLER_SAVE_OP) process.env.UPSELLER_SAVE_OP = parsed.UPSELLER_SAVE_OP;
  return readAuthStatus(envPath);
}
