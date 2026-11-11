import { BrowserWindow } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_URL = 'https://app.upseller.com/zh-CN/';
const LOGIN_HINT = 'https://app.upseller.com/zh-CN/login';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Open a visible window that uses the Chromium already inside Electron.
 * Customers do not need Playwright, Node, or a preinstalled browser cache.
 */
export async function captureSessionWithElectron(options = {}) {
  const timeoutMs = Math.max(5000, Math.min(600000, Number(options.timeoutMs) || 300000));
  const startUrl = options.startUrl || DEFAULT_URL;
  const toolkitRoot = options.toolkitRoot;
  if (!toolkitRoot) throw new Error('操作没完成，请再试一次。');

  const { extractSession } = await import(
    pathToFileURL(path.join(toolkitRoot, 'mcp', 'src', 'auth', 'session_env.js')).href
  );

  const headerEvents = [];
  const ses = options.session;
  if (!ses) throw new Error('操作没完成，请再试一次。');

  const filter = { urls: ['https://*.upseller.com/*', 'https://upseller.com/*'] };
  const onHeaders = (details, callback) => {
    try {
      headerEvents.push({ url: details.url, headers: details.requestHeaders || {} });
    } catch {}
    callback({ requestHeaders: details.requestHeaders });
  };
  ses.webRequest.onBeforeSendHeaders(filter, onHeaders);

  const parent = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: '登录 Upseller',
    parent: parent || undefined,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);

  let closedByUser = false;
  win.on('closed', () => {
    closedByUser = true;
  });

  try {
    try {
      await win.loadURL(startUrl);
    } catch {
      await win.loadURL(LOGIN_HINT);
    }
    win.show();
    win.focus();

    const deadline = Date.now() + timeoutMs;
    let last = { cookie: '', deviceId: '' };
    while (Date.now() < deadline) {
      if (closedByUser || win.isDestroyed()) {
        throw new Error('登录窗口已关闭');
      }
      const jar = await ses.cookies.get({ domain: 'upseller.com' }).catch(() => []);
      last = extractSession({ headerEvents, cookies: jar });
      if (last.cookie.length >= 8 && last.deviceId.length >= 8) {
        return { cookie: last.cookie, deviceId: last.deviceId, source: 'electron' };
      }
      await sleep(1000);
    }
    if (last.cookie.length >= 8 && last.deviceId.length < 8) {
      throw new Error('已捕获 Cookie，但仍缺少 DeviceId：请在已打开的页面稍作操作（进入店铺/草稿）后重试');
    }
    throw new Error('等待登录超时：请在弹出的浏览器中登录 Upseller 后重试（保持窗口完成登录）');
  } finally {
    try { ses.webRequest.onBeforeSendHeaders(filter, null); } catch {}
    try { if (!win.isDestroyed()) win.close(); } catch {}
  }
}
