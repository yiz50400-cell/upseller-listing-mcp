import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { applySessionEnv, readAuthStatus } from './auth-status.mjs';
import { buildListingTasks } from './task-builder.mjs';
import { sanitizeForUi, safeError } from './sanitize.mjs';

async function loadTools(toolkitRoot) {
  const src = path.join(toolkitRoot, 'mcp', 'src');
  const [{ createClient }, { upsellerLogin }, { upsellerRunListing }, { upsellerRunBatch }, { upsellerGetDraft }] =
    await Promise.all([
      import(pathToFileURL(path.join(src, 'client.js')).href),
      import(pathToFileURL(path.join(src, 'tools/login.js')).href),
      import(pathToFileURL(path.join(src, 'tools/run_listing.js')).href),
      import(pathToFileURL(path.join(src, 'tools/run_batch.js')).href),
      import(pathToFileURL(path.join(src, 'tools/get_draft.js')).href),
    ]);
  return { createClient, upsellerLogin, upsellerRunListing, upsellerRunBatch, upsellerGetDraft };
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
  return sanitizeForUi({
    ok: Boolean(out.ok),
    stage: out.stage,
    envPath: out.envPath,
    cookieLen: out.cookieLen,
    deviceIdLen: out.deviceIdLen,
    mode: out.mode,
    source: out.source,
    hint: out.hint,
    auth: readAuthStatus(envPath),
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
  const built = buildListingTasks(form, shops, { publish });
  const auth = applySessionEnv(envPath);
  if (!auth.loggedIn) {
    return { ok: false, error: '尚未登录。请先在「设置」中登录 Upseller（成功只回长度，不回显凭证）。', auth, warnings: built.warnings };
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

export async function loadDraft({ toolkitRoot, envPath, draftId }) {
  const auth = applySessionEnv(envPath);
  if (!auth.loggedIn) return { ok: false, error: '尚未登录', auth };
  const { createClient, upsellerGetDraft } = await loadTools(toolkitRoot);
  const client = clientOrThrow(createClient);
  const out = await upsellerGetDraft(client, { draftId });
  return sanitizeForUi({
    ok: true,
    draftId: out.draftId,
    draft: out.draft,
    auth: client.authMeta?.() || auth,
  });
}

export { safeError };
