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
    error: friendlyErrorMessage(err),
    name: 'Error',
  };
}

/** One short, plain-language Chinese sentence. Never return stacks, paths, or Playwright text. */
export function friendlyErrorMessage(err) {
  const raw = String(err && (err.message || err.shortMessage) ? (err.message || err.shortMessage) : err || '');
  const blob = raw.replace(/\s+/g, ' ').trim();
  if (/Executable doesn't exist|playwright install|ms-playwright|browserType\.launch|chromium-\d+|npx playwright/i.test(blob)) {
    return '打不开登录窗口。请换用最新试用包后再试，不用单独安装浏览器。';
  }
  if (/未能从浏览器会话提取|有效 Cookie\/DeviceId/i.test(blob)) {
    return '还没有登录成功，请在弹出的窗口里完成登录后再试。';
  }
  if (/仍缺少 DeviceId|缺少 DeviceId/i.test(blob)) {
    return '登录还差一步：请在打开的页面里点进店铺或草稿，然后再试一次。';
  }
  if (/等待登录超时/i.test(blob)) {
    return '等待登录超时。请再点一次「登录」，并在弹出的窗口里完成登录。';
  }
  if (/登录窗口已关闭|login window/i.test(blob)) {
    return '登录窗口被关掉了，请再点一次「登录」。';
  }
  if (/尚未登录/i.test(blob)) {
    return '还没有登录，请先到「设置」里登录。';
  }
  if (/net::ERR_|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ENOTFOUND|ECONNREFUSED|failed to load|ERR_CONNECTION/i.test(blob)) {
    return '打不开登录页面，请检查网络后再试。';
  }
  if (/发布必须二次确认/i.test(blob)) {
    return '发布需要再确认一次。';
  }
  const first = blob.split(/[\n\r]/)[0].trim();
  const looksTechnical = /at\s+\S+\s+\(|\.(mjs|js|ts):\d+|node_modules|\\Users\\|\/Users\/|\/Library\/|stack|TypeError|Unhandled/i.test(blob);
  if (/[\u4e00-\u9fff]/.test(first) && !looksTechnical) {
    return first.length > 80 ? `${first.slice(0, 80)}…` : first;
  }
  return '操作没完成，请再试一次。';
}
