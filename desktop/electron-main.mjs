import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { resolveEnvPath, toolkitRoot } from './lib/paths.mjs';
import { loadState, saveState } from './lib/task-store.mjs';
import { loginWithExistingScheme, runFormAction, loadDraft, listAccountShops, listAccountDrafts, listAccountProducts, safeError, verifiedAuth } from './lib/listing-service.mjs';
import { captureSessionWithElectron } from './lib/electron-login.mjs';
import { sanitizeForUi, friendlyErrorMessage } from './lib/sanitize.mjs';
import { mergeShops } from './lib/shop-list.mjs';
import { clearSessionEnv, logoutStatePatch } from './lib/logout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const packaged = app.isPackaged;

let mainWindow = null;
let loginInFlight = null;

function roots() {
  const userDataDir = app.getPath('userData');
  return {
    userDataDir,
    envPath: resolveEnvPath({ userDataDir, packaged }),
    toolkit: toolkitRoot({ packaged, resourcesPath: process.resourcesPath }),
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0d12',
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(here, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

async function snapshot(userDataDir, envPath, toolkit, { refreshShops = false } = {}) {
  const state = loadState(userDataDir);
  const auth = await verifiedAuth({ toolkitRoot: toolkit, envPath });
  let shops = Array.isArray(state.shops) ? state.shops : [];
  let shopsError = '';
  if (refreshShops && auth.loggedIn) {
    try {
      const listed = await listAccountShops({ toolkitRoot: toolkit, envPath });
      const next = mergeShops(state.shops, listed.shops);
      shops = next;
      saveState(userDataDir, { ...loadState(userDataDir), shops: next });
    } catch (err) {
      shopsError = friendlyErrorMessage(err);
    }
  }
  return {
    ...state,
    shops,
    shopsError,
    auth,
    meta: {
      packaged,
      productConcurrency: 8,
      version: app.getVersion(),
      requiresCursor: false,
      requiresCodex: false,
    },
  };
}


process.on('uncaughtException', (err) => {
  console.error(err);
});
process.on('unhandledRejection', (err) => {
  console.error(err);
});

app.whenReady().then(() => {
  const { userDataDir, envPath, toolkit } = roots();
  fs.mkdirSync(path.join(userDataDir, 'mcp'), { recursive: true });

  ipcMain.handle('desktop:getState', async () => snapshot(userDataDir, envPath, toolkit));
  ipcMain.handle('desktop:refreshShops', async () => snapshot(userDataDir, envPath, toolkit, { refreshShops: true }));

  ipcMain.handle('desktop:saveState', async (_evt, patch = {}) => {
    const current = loadState(userDataDir);
    const next = {
      ...current,
      ...patch,
      tasks: patch.tasks ?? current.tasks,
      shops: patch.shops ?? current.shops,
      materials: patch.materials ?? current.materials,
      settings: { ...current.settings, ...(patch.settings || {}) },
    };
    saveState(userDataDir, next);
    return snapshot(userDataDir, envPath, toolkit);
  });

  const loginSession = session.fromPartition('persist:upseller-login');

  ipcMain.handle('desktop:logout', async () => {
    try {
      const cleared = clearSessionEnv(envPath);
      try {
        await loginSession.clearStorageData();
      } catch (err) {
        console.error(err);
      }
      const current = loadState(userDataDir);
      const patch = logoutStatePatch(current);
      saveState(userDataDir, { ...current, ...patch });
      const snap = await snapshot(userDataDir, envPath, toolkit);
      return {
        ok: true,
        cookieLen: cleared.cookieLen,
        deviceIdLen: cleared.deviceIdLen,
        ...snap,
      };
    } catch (err) {
      return { ...safeError(err), ...(await snapshot(userDataDir, envPath, toolkit)) };
    }
  });

  ipcMain.handle('desktop:login', async (_evt, opts = {}) => {
    if (loginInFlight) return loginInFlight;
    loginInFlight = (async () => {
      try {
        const out = await loginWithExistingScheme({
          toolkitRoot: toolkit,
          envPath,
          timeoutMs: opts.timeoutMs,
          captureSession: (options) => captureSessionWithElectron({
            toolkitRoot: toolkit,
            session: loginSession,
            timeoutMs: options.timeoutMs,
            startUrl: options.startUrl,
          }),
        });
        const snap = await snapshot(userDataDir, envPath, toolkit, { refreshShops: true });
        return { ...out, auth: snap.auth, shops: snap.shops, shopsError: snap.shopsError };
      } catch (err) {
        return { ...safeError(err), ...(await snapshot(userDataDir, envPath, toolkit)) };
      } finally {
        loginInFlight = null;
      }
    })();
    return loginInFlight;
  });

  ipcMain.handle('desktop:runAction', async (_evt, payload = {}) => {
    try {
      const state = loadState(userDataDir);
      return await runFormAction({
        toolkitRoot: toolkit,
        envPath,
        form: payload.form || {},
        shops: payload.shops || state.shops,
        mode: payload.mode,
        confirmPublish: payload.confirmPublish === true,
      });
    } catch (err) {
      return { ...safeError(err), auth: await verifiedAuth({ toolkitRoot: toolkit, envPath }) };
    }
  });

  ipcMain.handle('desktop:loadDraft', async (_evt, draftId) => {
    try {
      return await loadDraft({ toolkitRoot: toolkit, envPath, draftId });
    } catch (err) {
      return { ...safeError(err), auth: await verifiedAuth({ toolkitRoot: toolkit, envPath }) };
    }
  });

  ipcMain.handle('desktop:listDrafts', async (_evt, shopId) => {
    try {
      return await listAccountDrafts({ toolkitRoot: toolkit, envPath, shopId });
    } catch (err) {
      return { ...safeError(err), drafts: [], auth: await verifiedAuth({ toolkitRoot: toolkit, envPath }) };
    }
  });

  ipcMain.handle('desktop:listProducts', async (_evt, shopId) => {
    try {
      return await listAccountProducts({ toolkitRoot: toolkit, envPath, shopId });
    } catch (err) {
      return { ...safeError(err), products: [], auth: await verifiedAuth({ toolkitRoot: toolkit, envPath }) };
    }
  });

  ipcMain.handle('desktop:pickFiles', async (evt, kind = 'images') => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const image = kind === 'video'
      ? [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv'] }]
      : [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }];
    const result = await dialog.showOpenDialog(win, {
      properties: kind === 'main' ? ['openFile'] : ['openFile', 'multiSelections'],
      filters: image,
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle('desktop:windowControl', async (evt, action) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    if (!win) return false;
    if (action === 'min') win.minimize();
    else if (action === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (action === 'close') win.close();
    return true;
  });

  mainWindow = createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Avoid unused import warnings if tree-shaken elsewhere
void pathToFileURL;
void sanitizeForUi;
