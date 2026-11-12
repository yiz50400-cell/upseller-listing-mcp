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

function extractApiMsg(blob) {
  const match = String(blob).match(/\bmsg=([^]*?)(?:\s+path=|$)/i);
  if (!match) return '';
  const msg = String(match[1] || '').replace(/\s+/g, ' ').trim();
  if (!msg || msg === 'undefined' || msg === 'null') return '';
  return msg.slice(0, 80);
}

function looksLikeDraftLookup(blob) {
  return /edit response missing data|找不到这份草稿|product\/edit|\/api\/tiktok\/product\/edit|path=\S*product\/edit/i.test(blob);
}

function looksLikeNetwork(blob) {
  return /net::ERR_|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|EHOSTUNREACH|failed to fetch|fetch failed|socket hang up|networkError|ERR_CONNECTION|Failed to fetch/i.test(blob);
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
  if (looksLikeNetwork(blob)) {
    if (/登录页面|login page|upseller\.com\/login|打不开登录/i.test(blob)) {
      return '打不开登录页面，请检查网络后再试。';
    }
    return '网络不通，请检查网络后再试。';
  }
  if (/发布必须二次确认/i.test(blob)) {
    return '发布需要再确认一次。';
  }
  const cleaned = blob.replace(/^Error:\s*/i, '');
  const first = cleaned.split(/[\n\r]/)[0].trim();

  if (/示意商品/.test(cleaned)) {
    return '示意商品不能预览或上架，请先添加真实产品并填写产品ID。';
  }
  if (/请填写产品ID|请填写产品ID或草稿ID|产品ID或草稿ID/.test(first) || (/产品ID|草稿ID/.test(first) && /填写|缺少/.test(first))) {
    return '请填写产品ID。';
  }
  if (/draftId is required|请填写正确的草稿编号|请先填写草稿编号/.test(cleaned) && !looksLikeDraftLookup(cleaned)) {
    return '请填写正确的草稿编号。';
  }
  if (looksLikeDraftLookup(cleaned)) {
    return '找不到这份草稿。请填写 Upseller 里已有草稿的编号。';
  }
  if (/目标店铺未授权|已过期或名称不唯一|对不上账号里的店/.test(cleaned)) {
    return '这家店对不上账号里的店。请改选登录后列出的店铺。';
  }
  if (/请先添加真实店铺|请先添加店铺|还没有店铺|请先在「店铺」页|请先添加.{0,8}店铺/.test(cleaned)) {
    return '请先添加店铺。';
  }
  if (/登录已失效|请重新登录|请先到「设置」|Invalid JSON API envelope|login may have expired|HTTP 401|HTTP 403|\b401\b|\b403\b/.test(first) || /登录已失效|请重新登录|Invalid JSON API envelope|login may have expired|HTTP 401|HTTP 403/.test(cleaned)) {
    return /已失效|过期|失效|401|403|expired/i.test(cleaned) ? '请重新登录。' : '请先到「设置」里登录。';
  }
  if (/源商品未找到|源商品搜索结果过多|请填写源商品/.test(cleaned)) {
    return '找不到这个产品。请填写正确的产品ID。';
  }
  if (/shop-list|platform-list|店铺列表返回格式/.test(cleaned)) {
    return '没能列出账号里的店铺，请重新登录后再试。';
  }

  const apiMsg = extractApiMsg(cleaned);
  if (apiMsg && /[\u4e00-\u9fff]/.test(apiMsg)) {
    return apiMsg.endsWith('。') ? apiMsg : `${apiMsg}。`;
  }

  // If the first line is already a clear Chinese reason, keep it even when a
  // stack or path appears later in the same blob.
  const firstLooksTechnical = /at\s+\S+\s+\(|\.(mjs|js|ts):\d+|node_modules|\\Users\\|\/Users\/|\/Library\/|TypeError|Unhandled|API code=|HTTP \d{3} for /i.test(first);
  if (/[\u4e00-\u9fff]/.test(first) && !firstLooksTechnical) {
    return first.length > 80 ? `${first.slice(0, 80)}…` : first;
  }
  return '操作没完成，请再试一次。';
}
