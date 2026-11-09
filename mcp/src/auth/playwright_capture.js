import path from 'node:path';
import { extractSession } from './session_env.js';

const DEFAULT_URL = 'https://app.upseller.com/zh-CN/';
const LOGIN_HINT = 'https://app.upseller.com/zh-CN/login';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    throw new Error(
      '未安装 Playwright。请在交付目录执行: npm install && npx playwright install chromium'
    );
  }
}

/**
 * Open a visible browser, wait until Upseller Cookie+DeviceId appear (already logged-in or after user login).
 * @returns {{cookie:string, deviceId:string, source:string}}
 */
export async function captureSessionWithPlaywright(options = {}) {
  const timeoutMs = Math.max(5000, Math.min(600000, Number(options.timeoutMs) || 300000));
  const startUrl = options.startUrl || DEFAULT_URL;
  const { chromium } = await loadPlaywright();
  const userDataDir = options.userDataDir
    ? path.resolve(options.userDataDir)
    : path.join(process.cwd(), '.upseller-login-profile');

  const headerEvents = [];
  let context;
  let browser;
  const launchOpts = {
    headless: options.headless === true,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  };
  try {
    // Persistent context keeps an already-logged-in profile between runs.
    context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOpts,
      channel: options.channel || undefined,
    });
  } catch {
    browser = await chromium.launch(launchOpts);
    context = await browser.newContext();
  }

  try {
    const page = context.pages()[0] || (await context.newPage());
    page.on('request', (req) => {
      try {
        const url = req.url();
        if (!/upseller\.com/i.test(url)) return;
        headerEvents.push({ url, headers: req.headers() });
      } catch {}
    });

    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(60000, timeoutMs) }).catch(async () => {
      await page.goto(LOGIN_HINT, { waitUntil: 'domcontentloaded', timeout: Math.min(60000, timeoutMs) });
    });

    const deadline = Date.now() + timeoutMs;
    let last = { cookie: '', deviceId: '' };
    while (Date.now() < deadline) {
      const jar = await context.cookies('https://app.upseller.com').catch(() => []);
      last = extractSession({ headerEvents, cookies: jar });
      if (last.cookie.length >= 8 && last.deviceId.length >= 8) {
        return { cookie: last.cookie, deviceId: last.deviceId, source: 'playwright' };
      }
      // If still on a clearly logged-out shell, nudge to login page once.
      const url = page.url();
      if (/login|signin|passport/i.test(url) === false && last.cookie.length < 8) {
        // stay; user may already be in app — wait for API traffic to emit DeviceId
      }
      await page.waitForTimeout(1000);
    }
    if (last.cookie.length >= 8 && last.deviceId.length < 8) {
      throw new Error('已捕获 Cookie，但仍缺少 DeviceId：请在已打开的页面稍作操作（进入店铺/草稿）后重试');
    }
    throw new Error('等待登录超时：请在弹出的浏览器中登录 Upseller 后重试（保持窗口完成登录）');
  } finally {
    try { await context?.close(); } catch {}
    try { await browser?.close(); } catch {}
  }
}
