const SECRET_KEY = /^(cookie|deviceid|device_id|authorization|password|token|secret|upseller_cookie|upseller_device_id)$/i;

export function sanitizeForUi(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 4000) return `${value.slice(0, 4000)}…`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeForUi(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SECRET_KEY.test(key) || key.startsWith('_raw')) {
        out[key] = typeof val === 'string' ? `[redacted len=${val.length}]` : '[redacted]';
        continue;
      }
      out[key] = sanitizeForUi(val, depth + 1);
    }
    return out;
  }
  return value;
}

export function safeError(err) {
  return {
    ok: false,
    error: String(err && err.message ? err.message : err),
    name: err?.name || 'Error',
  };
}
