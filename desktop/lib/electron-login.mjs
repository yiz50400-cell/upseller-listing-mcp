import { BrowserWindow, dialog as electronDialog } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildLoginWindowOptions } from './login-window-options.mjs';

const DEFAULT_URL = 'https://app.upseller.com/zh-CN/';
const LOGIN_HINT = 'https://app.upseller.com/zh-CN/login';
const MIN_VISIBLE_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clearHeaderListener(ses) {
  try { ses.webRequest.onBeforeSendHeaders(null); } catch {}
}

export async function announceLoginSuccess(dialogApi, win) {
  if (!dialogApi?.showMessageBox || !win || win.isDestroyed()) return;
  try {
    await dialogApi.showMessageBox(win, {
      type: 'info',
      title: '登录 Upseller',
      message: '登录已完成',
      detail: '可以关闭这个窗口，回到自动上架继续操作。',
      buttons: ['完成'],
      defaultId: 0,
      noLink: true,
    });
  } catch {}
}

/**
 * Open a visible window that uses the Chromium already inside Electron.
 * The window is independent of the frameless main window so it does not
 * flash or take the app down when it opens or closes.
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

  const win = new BrowserWindow(buildLoginWindowOptions(ses));
  win.setMenuBarVisibility(false);

  let closedByUser = false;
  win.on('closed', () => {
    closedByUser = true;
  });

  const shownAt = Date.now();
  win.show();
  win.focus();

  try {
    try {
      await win.loadURL(startUrl);
    } catch {
      try {
        await win.loadURL(LOGIN_HINT);
      } catch {
        throw new Error('打不开登录窗口。请检查网络后再试。');
      }
    }
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }

    const deadline = Date.now() + timeoutMs;
    let last = { cookie: '', deviceId: '' };
    while (Date.now() < deadline) {
      if (closedByUser || win.isDestroyed()) {
        throw new Error('登录窗口已关闭');
      }
      const jar = await ses.cookies.get({ domain: 'upseller.com' }).catch(() => []);
      try {
        last = extractSession({ headerEvents, cookies: jar });
      } catch {
        last = last.cookie ? last : { cookie: '', deviceId: '' };
      }
      if (last.cookie.length >= 8 && last.deviceId.length >= 8) {
        const wait = shownAt + MIN_VISIBLE_MS - Date.now();
        if (wait > 0) await sleep(wait);
        if (!win.isDestroyed()) {
          win.setTitle('登录已完成');
          await announceLoginSuccess(options.dialog || electronDialog, win);
        }
        return { cookie: last.cookie, deviceId: last.deviceId, source: 'electron' };
      }
      await sleep(1000);
    }
    if (last.cookie.length >= 8 && last.deviceId.length < 8) {
      throw new Error('已捕获 Cookie，但仍缺少 DeviceId：请在已打开的页面稍作操作（进入店铺/草稿）后重试');
    }
    throw new Error('等待登录超时：请在弹出的浏览器中登录 Upseller 后重试（保持窗口完成登录）');
  } finally {
    clearHeaderListener(ses);
    try { if (!win.isDestroyed()) win.close(); } catch {}
  }
}
