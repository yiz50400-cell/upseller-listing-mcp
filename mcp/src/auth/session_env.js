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

/** Extract Cookie + DeviceId from network header events and/or cookie jar entries. Never returns raw dumps beyond the two fields. */
export function extractSession({ headerEvents = [], cookies = [] } = {}) {
  let cookie = '';
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
    if (c && c.length > cookie.length) cookie = c;
    if (d && d.length >= 8 && (!deviceId || d.length >= deviceId.length)) deviceId = d;
  }
  if ((!cookie || cookie.length < 8) && Array.isArray(cookies) && cookies.length) {
    const parts = [];
    for (const c of cookies) {
      const domain = String(c.domain || '');
      if (domain && !/upseller\.com/i.test(domain)) continue;
      if (c?.name) parts.push(`${c.name}=${c.value ?? ''}`);
    }
    if (parts.length) cookie = parts.join('; ');
  }
  return { cookie, deviceId };
}

export function writeSessionEnv({ cookie, deviceId, envPath }) {
  const c = String(cookie || '');
  const d = String(deviceId || '');
  if (c.length < 8) throw new Error('登录会话 Cookie 过短或缺失');
  if (d.length < 8) throw new Error('登录会话 DeviceId 过短或缺失');
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
