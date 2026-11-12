import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { applySessionEnv, readAuthStatus, loadSessionEnv } from './auth-status.mjs';
import { buildListingTasks, realShops } from './task-builder.mjs';
import { sanitizeForUi, safeError } from './sanitize.mjs';

async function loadTools(toolkitRoot) {
  const src = path.join(toolkitRoot, 'mcp', 'src');
  const [{ createClient }, { upsellerLogin }, { upsellerRunListing }, { upsellerRunBatch }, { upsellerGetDraft }, { probeUpsellerSession }, { listShops }] =
    await Promise.all([
      import(pathToFileURL(path.join(src, 'client.js')).href),
      import(pathToFileURL(path.join(src, 'tools/login.js')).href),
      import(pathToFileURL(path.join(src, 'tools/run_listing.js')).href),
      import(pathToFileURL(path.join(src, 'tools/run_batch.js')).href),
      import(pathToFileURL(path.join(src, 'tools/get_draft.js')).href),
      import(pathToFileURL(path.join(src, 'auth/session_probe.js')).href),
      import(pathToFileURL(path.join(src, 'task_resolver.js')).href),
    ]);
  return { createClient, upsellerLogin, upsellerRunListing, upsellerRunBatch, upsellerGetDraft, probeUpsellerSession, listShops };
}

/** Live auth check. Returns lengths and booleans only — never Cookie or DeviceId values. */
export async function verifiedAuth({ toolkitRoot, envPath }) {
  const base = readAuthStatus(envPath);
  if (!base.present) return base;
  const parsed = loadSessionEnv(envPath);
  const { probeUpsellerSession, createClient } = await loadTools(toolkitRoot);
  const probe = await probeUpsellerSession({
    cookie: parsed.UPSELLER_COOKIE,
    deviceId: parsed.UPSELLER_DEVICE_ID,
    clientFactory: createClient,
  });
  return {
    ...base,
    ok: Boolean(probe.loggedIn),
    loggedIn: Boolean(probe.loggedIn),
    verified: Boolean(probe.verified),
    expired: Boolean(probe.expired),
    present: true,
    networkError: Boolean(probe.networkError),
  };
}

function clientOrThrow(createClient) {
  try {
    return createClient();
  } catch (err) {
    throw err;
  }
}

export async function loginWithExistingScheme({ toolkitRoot, envPath, timeoutMs, captureSession }) {
  const { upsellerLogin } = await loadTools(toolkitRoot);
  const deps = captureSession ? { captureSession } : {};
  const out = await upsellerLogin({
    envPath,
    headless: false,
    timeoutMs: timeoutMs ?? 300000,
  }, {}, deps);
  applySessionEnv(envPath);
  const auth = await verifiedAuth({ toolkitRoot, envPath });
  return sanitizeForUi({
    ok: Boolean(out.ok) && Boolean(auth.loggedIn),
    stage: out.stage,
    envPath: out.envPath,
    cookieLen: out.cookieLen,
    deviceIdLen: out.deviceIdLen,
    mode: out.mode,
    source: out.source,
    hint: out.hint,
    auth,
  });
}

export async function runFormAction({ toolkitRoot, envPath, form, shops, mode, confirmPublish = false }) {
  if (!['preview', 'save-draft', 'publish'].includes(mode)) {
    throw new Error(`未知操作：${mode}`);
  }
  if (mode === 'publish' && confirmPublish !== true) {
    throw new Error('发布必须二次确认（confirmPublish=true）');
  }

  const publish = mode === 'publish';
  const usableShops = realShops(shops);
  const built = buildListingTasks(form, usableShops, { publish });
  applySessionEnv(envPath);
  const auth = await verifiedAuth({ toolkitRoot, envPath });
  if (!auth.loggedIn) {
    const error = auth.expired || auth.present
      ? '请重新登录。'
      : '请先到「设置」里登录。';
    return { ok: false, error, auth, warnings: built.warnings };
  }

  const { createClient, upsellerRunListing, upsellerRunBatch } = await loadTools(toolkitRoot);
  const client = clientOrThrow(createClient);
  const dryRun = mode === 'preview';
  const options = {
    dryRun,
    confirmPublish: publish && confirmPublish === true,
  };

  let result;
  if (built.tasks.length === 1) {
    result = await upsellerRunListing(client, { task: built.tasks[0], ...options });
  } else {
    result = await upsellerRunBatch(client, { tasks: built.tasks, ...options });
  }

  return sanitizeForUi({
    ok: result?.ok !== false,
    mode,
    dryRun,
    published: publish && options.confirmPublish ? Boolean(result?.published) : false,
    taskCount: built.tasks.length,
    warnings: built.warnings,
    videoIgnored: built.videoIgnored,
    auth: client.authMeta?.() || auth,
    result,
  });
}

export async function listAccountShops({ toolkitRoot, envPath }) {
  applySessionEnv(envPath);
  const { createClient, listShops } = await loadTools(toolkitRoot);
  const client = clientOrThrow(createClient);
  const rows = await listShops(client);
  const shops = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row?.id ?? '').trim(),
    name: String(row?.name ?? '').trim(),
    site: row?.site ? String(row.site) : '',
    expired: Boolean(row?.expired),
    source: 'account',
  })).filter((shop) => shop.id || shop.name);
  return sanitizeForUi({ ok: true, shops });
}

export async function loadDraft({ toolkitRoot, envPath, draftId }) {
  applySessionEnv(envPath);
  const auth = await verifiedAuth({ toolkitRoot, envPath });
  if (!auth.loggedIn) return { ok: false, error: auth.expired || auth.present ? '请重新登录。' : '请先到「设置」里登录。', auth };
  if (draftId == null || String(draftId).trim() === '') {
    return { ok: false, error: '请填写正确的草稿编号。', auth };
  }
  const { createClient, upsellerGetDraft } = await loadTools(toolkitRoot);
  const client = clientOrThrow(createClient);
  const out = await upsellerGetDraft(client, { draftId: String(draftId).trim() });
  return sanitizeForUi({
    ok: true,
    draftId: out.draftId,
    draft: out.draft,
    auth: client.authMeta?.() || auth,
  });
}

export { safeError };
