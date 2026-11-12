import fs from 'node:fs';
import path from 'node:path';

export function dotenvEscape(value) {
  const s = String(value ?? '');
  if (/[\n\r"\\]/.test(s) || /\s/.test(s) || s.includes('#')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
  }
  return s;
}

function headerGet(headers, name) {
  if (!headers) return '';
  const want = String(name).toLowerCase();
  if (typeof headers === 'object' && !Array.isArray(headers)) {
    for (const [k, v] of Object.entries(headers)) {
      if (String(k).toLowerCase() === want && v != null) return String(v);
    }
    return '';
  }
  if (Array.isArray(headers)) {
    for (const h of headers) {
      const n = h && (h.name || h.key);
      if (n && String(n).toLowerCase() === want && h.value != null) return String(h.value);
    }
  }
  return '';
}

/** Minimum lengths for a session that is worth probing. Far above a trivial 8-character token. */
export const MIN_COOKIE_LEN = 32;
export const MIN_DEVICE_ID_LEN = 16;

export function sessionMeetsMinimum(cookie, deviceId) {
  return String(cookie || '').length >= MIN_COOKIE_LEN && String(deviceId || '').length >= MIN_DEVICE_ID_LEN;
}

function cookiePairs(str) {
  const pairs = [];
  for (const part of String(str || '').split(';')) {
    const piece = part.trim();
    const i = piece.indexOf('=');
    if (i <= 0) continue;
    pairs.push([piece.slice(0, i).trim(), piece.slice(i + 1)]);
  }
  return pairs;
}

/** Merge Cookie header strings and jar cookies by name, keeping first-seen order and the longer value. */
export function mergeCookieStrings(...strs) {
  const map = new Map();
  const order = [];
  for (const s of strs) {
    for (const [name, value] of cookiePairs(s)) {
      if (!name) continue;
      if (!map.has(name)) order.push(name);
      const prev = map.get(name);
      if (prev == null || String(value).length > String(prev).length) map.set(name, value);
    }
  }
  return order.map((name) => `${name}=${map.get(name)}`).join('; ');
}

export function cookieStringFromJar(cookies = []) {
  const parts = [];
  for (const c of cookies) {
    const domain = String(c.domain || '');
    if (domain && !/upseller\.com/i.test(domain)) continue;
    if (c?.name) parts.push(`${c.name}=${c.value ?? ''}`);
  }
  return parts.join('; ');
}

/** Extract Cookie + DeviceId from network header events and/or cookie jar entries. Never returns raw dumps beyond the two fields. */
export function extractSession({ headerEvents = [], cookies = [] } = {}) {
  let headerCookie = '';
  let deviceId = '';
  for (const evt of headerEvents) {
    const url = String(evt?.url || '');
    const headers = evt?.headers || {};
    if (url && !/upseller\.com/i.test(url)) continue;
    const c = headerGet(headers, 'cookie') || headerGet(headers, 'Cookie');
    const d =
      headerGet(headers, 'DeviceId') ||
      headerGet(headers, 'deviceId') ||
      headerGet(headers, 'deviceid');
    if (c && c.length > headerCookie.length) headerCookie = c;
    if (d && d.length >= MIN_DEVICE_ID_LEN && (!deviceId || d.length >= deviceId.length)) deviceId = d;
  }
  const jarCookie = cookieStringFromJar(cookies);
  const cookie = mergeCookieStrings(headerCookie, jarCookie);
  return { cookie, deviceId };
}

export function writeSessionEnv({ cookie, deviceId, envPath }) {
  const c = String(cookie || '');
  const d = String(deviceId || '');
  if (!sessionMeetsMinimum(c, d)) throw new Error('登录会话 Cookie 或 DeviceId 过短或缺失');
  const target = path.resolve(envPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const body =
    '# Auto-written by upseller_login / login-upseller. Do not commit. chmod 600.\n' +
    `UPSELLER_COOKIE=${dotenvEscape(c)}\n` +
    `UPSELLER_DEVICE_ID=${dotenvEscape(d)}\n` +
    'UPSELLER_SAVE_OP=1\n';
  fs.writeFileSync(target, body, { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(target, 0o600); } catch {}
  return {
    ok: true,
    envPath: target,
    cookieLen: c.length,
    deviceIdLen: d.length,
    mode: (fs.statSync(target).mode & 0o777).toString(8).padStart(3, '0'),
  };
}
