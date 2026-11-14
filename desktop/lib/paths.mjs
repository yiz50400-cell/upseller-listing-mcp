import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function unpackagedToolkitRoot() {
  return path.resolve(here, '..', '..');
}

export function defaultUserEnvPath(userDataDir) {
  return path.join(userDataDir, 'mcp', '.env');
}

/**
 * Resolve the session env file.
 * Packaged app: userData/mcp/.env (never a baked-in secret).
 * Unpackaged dev: prefer an existing repo mcp/.env if present, else userData.
 * UPSELLER_ENV_FILE always wins.
 */
export function resolveEnvPath({ userDataDir, packaged = false } = {}) {
  if (process.env.UPSELLER_ENV_FILE) {
    return path.resolve(process.env.UPSELLER_ENV_FILE);
  }
  const userPath = defaultUserEnvPath(userDataDir || path.join(process.cwd(), '.user-data'));
  if (packaged) return userPath;
  const devPath = path.join(unpackagedToolkitRoot(), 'mcp', '.env');
  if (fs.existsSync(devPath)) return devPath;
  return userPath;
}

export function toolkitRoot({ packaged = false, resourcesPath } = {}) {
  if (packaged) return path.join(resourcesPath, 'toolkit');
  return unpackagedToolkitRoot();
}
