#!/usr/bin/env node
/**
 * UpSeller HTTP MCP server (path A) — stdio.
 * Tools: upseller_login, upseller_run_batch, upseller_run_listing, upseller_get_draft, upseller_save_draft, upseller_upload_media, upseller_set_images.
 * Auth: env UPSELLER_COOKIE / UPSELLER_DEVICE_ID (vault: upseller.cookie / upseller.deviceId).
 * Never logs secret values. Legacy save tools remain draft-only; the runner requires explicit publication confirmation.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { REV, VAULT_COOKIE, VAULT_DEVICE_ID, ENV_COOKIE, ENV_DEVICE_ID } from "./constants.js";
import { createClient, AuthError } from "./client.js";
import { PublishGuardError, FormBuildError } from "./form.js";
import { getDraftToolSchema, upsellerGetDraft } from "./tools/get_draft.js";
import { saveDraftToolSchema, upsellerSaveDraft } from "./tools/save_draft.js";
import { uploadMediaToolSchema, upsellerUploadMedia } from "./tools/upload_media.js";
import { setImagesToolSchema, upsellerSetImages } from "./tools/set_images.js";

import { runListingToolSchema, upsellerRunListing } from './tools/run_listing.js';
import { runBatchToolSchema, upsellerRunBatch } from './tools/run_batch.js';
import { loginToolSchema, upsellerLogin } from './tools/login.js';

const TOOLS = [
  loginToolSchema,
  runBatchToolSchema,
  runListingToolSchema,
  getDraftToolSchema,
  saveDraftToolSchema,
  uploadMediaToolSchema,
  setImagesToolSchema,
];

function getClient() {
  return createClient();
}

function textResult(obj, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
    isError,
  };
}

const server = new Server(
  { name: "upseller-listing-mcp", version: REV },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const name = request.params.name;
  const args = request.params.arguments || {};
  try {
    if (name === "upseller_login") {
      const out = await upsellerLogin(args, { signal: extra?.signal });
      return textResult({ ...out, rev: REV }, !out.ok);
    }
    const client = getClient();
    switch (name) {
      case "upseller_run_batch": {
        const out = await upsellerRunBatch(client, args, {signal: extra?.signal});
        return textResult(out, !out.ok);
      }
      case "upseller_run_listing": {
        const out = await upsellerRunListing(client, args);
        return textResult(out, !out.ok);
      }
      case "upseller_get_draft": {
        const out = await upsellerGetDraft(client, args);
        // Strip _rawData from MCP response (huge / may contain long HTML)
        return textResult({
          ok: out.ok,
          draftId: out.draftId,
          draft: out.draft,
          auth: client.authMeta(),
          rev: REV,
        });
      }
      case "upseller_save_draft": {
        // Default dryRun=true when omitted; only false when explicitly passed.
        const effectiveDryRun = args.dryRun === false ? false : true;
        const out = await upsellerSaveDraft(client, {
          ...args,
          dryRun: effectiveDryRun,
        });
        return textResult({ ...out, auth: client.authMeta(), rev: REV });
      }
      case "upseller_upload_media": {
        const out = await upsellerUploadMedia(client, args);
        return textResult({ ...out, auth: client.authMeta(), rev: REV });
      }
      case "upseller_set_images": {
        const out = await upsellerSetImages(client, args);
        return textResult({ ...out, auth: client.authMeta(), rev: REV });
      }
      default:
        return textResult({ ok: false, error: `Unknown tool: ${name}` }, true);
    }
  } catch (err) {
    const safe = {
      ok: false,
      error: String(err && err.message ? err.message : err),
      name: err?.name || "Error",
      rev: REV,
      authHint: {
        cookie: `vault:${VAULT_COOKIE} / env:${ENV_COOKIE}`,
        deviceId: `vault:${VAULT_DEVICE_ID} / env:${ENV_DEVICE_ID}`,
      },
    };
    if (err instanceof AuthError || err instanceof PublishGuardError || err instanceof FormBuildError) {
      return textResult(safe, true);
    }
    return textResult(safe, true);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // stderr only — never dump env secrets
  console.error(`[upseller-listing-mcp] fatal: ${err?.message || err}`);
  process.exit(1);
});
