/**
 * Minimal UpSeller HTTP client.
 * Auth: Cookie from env UPSELLER_COOKIE (vault: upseller.cookie);
 *       DeviceId from env UPSELLER_DEVICE_ID (vault: upseller.deviceId).
 * Never logs secret values — only vault/env key names on error.
 */

import { parseApiJson } from "./json.js";
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import {
  BASE_URL,
  ENV_COOKIE,
  ENV_DEVICE_ID,
  USER_AGENT,
  VAULT_COOKIE,
  VAULT_DEVICE_ID,
} from "./constants.js";

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

export class UpsellerHttpError extends Error {
  constructor(message, { status, path, code } = {}) {
    super(message);
    this.name = "UpsellerHttpError";
    this.status = status;
    this.path = path;
    this.code = code;
  }
}

/**
 * @param {{ cookie?: string, deviceId?: string, fetchImpl?: typeof fetch }} [opts]
 */
export function createClient(opts = {}) {
  const cookie = opts.cookie ?? process.env[ENV_COOKIE] ?? "";
  const deviceId = opts.deviceId ?? process.env[ENV_DEVICE_ID] ?? "";
  const baseFetch = opts.fetchImpl ?? globalThis.fetch;
  const metrics = { requests: 0, retries: 0, get: 0, post: 0, put: 0 };
  const fetchImpl = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const reads = method === 'GET' || method === 'HEAD';
    const maxRetries = reads ? Math.max(0, Math.min(2, opts.maxReadRetries ?? 1)) : 0;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const signals = [controller.signal, opts.signal, init.signal].filter(Boolean);
      const signal = AbortSignal.any(signals);
      const timer = setTimeout(() => controller.abort(new Error('HTTP request deadline exceeded')), method === 'PUT' ? (opts.uploadTimeoutMs ?? opts.requestTimeoutMs ?? 45000) : (opts.requestTimeoutMs ?? 20000));
      try {
        signal.throwIfAborted();
        metrics.requests++; metrics[method.toLowerCase()] = (metrics[method.toLowerCase()] || 0) + 1;
        const response = await baseFetch(url, { ...init, signal, redirect: 'manual' });
        if (attempt < maxRetries && [429, 502, 503, 504].includes(response.status)) {
          await response.text().catch(() => {});
          metrics.retries++;
          await delay((opts.retryBaseMs ?? 250) * (attempt + 1), undefined, { signal });
          continue;
        }
        // Keep timeout active until the body is consumed, not only headers.
        const body = await response.text();
        return { status: response.status, ok: response.ok, headers: response.headers, text: async () => body };
      } catch (error) {
        if (reads && attempt < maxRetries && !opts.signal?.aborted) {
          metrics.retries++;
          await delay((opts.retryBaseMs ?? 250) * (attempt + 1), undefined, opts.signal ? { signal: opts.signal } : undefined);
          continue;
        }
        const failure = new UpsellerHttpError(method + ' request failed or timed out; ' + (reads ? 'read can be retried' : 'write may have been accepted; reconcile before retry'));
        failure.uncertainWrite = !reads;
        failure.aborted = signal.aborted;
        throw failure;
      } finally { clearTimeout(timer); }
    }
  };

  if (!cookie) {
    throw new AuthError(
      `Missing Cookie. Set env ${ENV_COOKIE} from vault key ${VAULT_COOKIE} (value never logged).`
    );
  }
  if (!deviceId) {
    throw new AuthError(
      `Missing DeviceId. Set env ${ENV_DEVICE_ID} from vault key ${VAULT_DEVICE_ID} (value never logged).`
    );
  }

  function baseHeaders(extra = {}) {
    return {
      Accept: "application/json, text/plain, */*",
      "User-Agent": USER_AGENT,
      Cookie: cookie,
      DeviceId: deviceId,
      deviceid: deviceId,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/zh-CN/products/tiktok/drafts`,
      ...extra,
    };
  }

  async function request(method, path, { query, body, contentType, rawBody } = {}) {
    const url = new URL(path, BASE_URL);
    if (url.origin !== BASE_URL || !url.pathname.startsWith('/api/')) {
      throw new Error('Authenticated requests must stay on the UpSeller API origin');
    }
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v == null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const headers = baseHeaders();
    let payload;
    if (rawBody != null) {
      payload = rawBody;
      if (contentType) headers["Content-Type"] = contentType;
    } else if (body != null) {
      if (contentType === "application/x-www-form-urlencoded") {
        headers["Content-Type"] = contentType;
        payload = typeof body === "string" ? body : new URLSearchParams(body).toString();
      } else {
        headers["Content-Type"] = contentType || "application/json";
        payload = typeof body === "string" ? body : JSON.stringify(body);
      }
    }

    const res = await fetchImpl(url.toString(), { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try {
      json = text ? parseApiJson(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, text, json, headers: res.headers };
  }

  return {
    accountKey() { return crypto.createHash('sha256').update(cookie + '\0' + deviceId).digest('hex'); },
    stats() { return { ...metrics }; },
    withSignal(signal) { return createClient({ ...opts, cookie, deviceId, fetchImpl: baseFetch, signal: opts.signal ? AbortSignal.any([opts.signal, signal]) : signal }); },
    /** Safe metadata for logs — no secret values. */
    authMeta() {
      return {
        cookieSource: `env:${ENV_COOKIE}|vault:${VAULT_COOKIE}`,
        deviceIdSource: `env:${ENV_DEVICE_ID}|vault:${VAULT_DEVICE_ID}`,
        cookiePresent: Boolean(cookie),
        deviceIdPresent: Boolean(deviceId),
        cookieLen: cookie.length,
        deviceIdLen: deviceId.length,
      };
    },
    get(path, query) {
      return request("GET", path, { query });
    },
    postJson(path, body) {
      return request("POST", path, { body, contentType: "application/json" });
    },
    postForm(path, fields) {
      return request("POST", path, {
        body: fields,
        contentType: "application/x-www-form-urlencoded",
      });
    },
    /**
     * PUT binary to pre-signed COS URL (no UpSeller Cookie).
     * images-capture: q-header-list=host only — do NOT send Content-Type
     * (unsigned extra headers break the signature).
     */
    async putBinary(signedUrl, bytes, contentType) {
      if (new URL(signedUrl).protocol !== 'https:') throw new Error('Upload URL must use HTTPS');
      const headers = {};
      // Only set Content-Type when caller opts in (default: omit for COS sign=host).
      if (contentType && contentType !== "omit") {
        // kept for non-COS callers; upload_media passes "omit"
        headers["Content-Type"] = contentType;
      }
      const res = await fetchImpl(signedUrl, {
        method: "PUT",
        headers,
        body: bytes,
      });
      const text = await res.text().catch(() => "");
      return { status: res.status, ok: res.ok, text };
    },
  };
}

/**
 * Assert UpSeller envelope code===0 when JSON present.
 */
export function assertApiOk(result, path) {
  if (!result.ok) {
    throw new UpsellerHttpError(`HTTP ${result.status} for ${path}`, {
      status: result.status,
      path,
    });
  }
  if (!result.json || typeof result.json !== 'object' || !Object.hasOwn(result.json, 'code')) {
    throw new UpsellerHttpError('Invalid JSON API envelope; login may have expired', { status: result.status, path });
  }
  if (result.json && typeof result.json === "object" && "code" in result.json) {
    if (result.json.code !== 0) {
      throw new UpsellerHttpError(
        `API code=${result.json.code} msg=${String(result.json.msg || "").slice(0, 80)} path=${path}`,
        { status: result.status, path, code: result.json.code }
      );
    }
  }
  return result.json;
}
