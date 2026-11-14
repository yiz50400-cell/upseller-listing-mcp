import { createClient } from '../client.js';
import { sessionMeetsMinimum } from './session_env.js';

/**
 * Lightweight read-only check that a session is accepted by Upseller.
 * Posts to the shop list endpoint and returns lengths plus a boolean only.
 * Never logs or returns Cookie / DeviceId values.
 */
export async function probeUpsellerSession({ cookie, deviceId, clientFactory = createClient } = {}) {
  const cookieLen = String(cookie || '').length;
  const deviceIdLen = String(deviceId || '').length;
  if (!sessionMeetsMinimum(cookie, deviceId)) {
    return { ok: false, loggedIn: false, verified: false, present: false, expired: false, cookieLen, deviceIdLen };
  }
  try {
    const client = clientFactory({ cookie, deviceId, requestTimeoutMs: 12000, maxReadRetries: 0 });
    const res = await client.postForm('/api/shop/platform-list', { platform: 'tiktok' });
    const httpStatus = Number(res?.status) || 0;
    const authRejected = httpStatus === 401 || httpStatus === 403
      || (res?.json && typeof res.json === 'object' && Number(res.json.code) !== 0);
    const loggedIn = Boolean(res?.ok && res?.json && typeof res.json === 'object' && res.json.code === 0);
    return {
      ok: loggedIn,
      loggedIn,
      verified: true,
      present: true,
      expired: !loggedIn && authRejected,
      cookieLen,
      deviceIdLen,
      httpStatus,
    };
  } catch (err) {
    const status = Number(err?.status) || 0;
    const authRejected = status === 401 || status === 403;
    return {
      ok: false,
      loggedIn: false,
      verified: authRejected,
      present: true,
      expired: authRejected,
      cookieLen,
      deviceIdLen,
      httpStatus: status || undefined,
      networkError: !authRejected,
    };
  }
}
