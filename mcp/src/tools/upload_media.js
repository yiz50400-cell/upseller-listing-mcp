import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_UPLOAD_MODULE,
  DEFAULT_UPLOAD_SPACE,
  PATHS,
} from "../constants.js";
import { assertApiOk } from "../client.js";

function guessSuffix(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  return ext || ".png";
}

function guessContentType(suffix) {
  switch (String(suffix).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".png":
    default:
      return "image/png";
  }
}

/**
 * Upload local file: generate-sign → COS PUT (sign URL) → callback.
 * Returns fileUrl (from generate-sign data.url), fileKey, callback id.
 *
 * Note: images-capture showed callback.data.fileUrl often null; prefer sign.url.
 *
 * @param {ReturnType<import('../client.js').createClient>} client
 * @param {{ filePath: string, module?: string, spaceCode?: string, dryRun?: boolean }} input
 */
export async function upsellerUploadMedia(client, input) {
  const filePath = input?.filePath;
  if (!filePath) throw new Error("filePath is required");
  if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`);

  const moduleName = input.module || DEFAULT_UPLOAD_MODULE;
  const spaceCode = input.spaceCode || DEFAULT_UPLOAD_SPACE;
  const fileName = path.basename(filePath);
  const suffix = guessSuffix(filePath);
  // Original-file policy: upload these exact bytes; never resize, recompress or transcode.
  const bytes = fs.readFileSync(filePath);
  const size = bytes.length;
  const contentType = guessContentType(suffix);

  if (input.dryRun) {
    return {
      ok: true,
      dryRun: true,
      skipped: ["generate-sign", "COS PUT", "callback"],
      filePath,
      fileName,
      suffix,
      size,
      module: moduleName,
      spaceCode,
      message: "dryRun: upload chain not executed",
    };
  }

  const signRes = await client.postJson(PATHS.generateSign, {
    module: moduleName,
    spaceCode,
    fileName,
    suffix,
  });
  const signJson = assertApiOk(signRes, PATHS.generateSign);
  const signData = signJson?.data || {};
  const fileKey = signData.fileKey;
  const signedPutUrl = signData.sign;
  const fileUrl = signData.url;
  const bucket = signData.bucket;

  if (!fileKey || !signedPutUrl) {
    throw new Error("generate-sign missing fileKey or sign URL");
  }

  const put = await client.putBinary(signedPutUrl, bytes, "omit"); // COS q-header-list=host
  if (!put.ok && put.status !== 200) {
    throw new Error(`COS PUT failed status=${put.status}`);
  }

  const cbRes = await client.postJson(PATHS.uploadCallback, {
    fileKey,
    size,
    suffix,
  });
  const cbJson = assertApiOk(cbRes, PATHS.uploadCallback);
  const cbData = cbJson?.data || {};

  return {
    ok: true,
    dryRun: false,
    filePath,
    fileName,
    suffix,
    size,
    module: moduleName,
    spaceCode,
    bucket: bucket || null,
    fileKey,
    /** Prefer generate-sign.url (callback.fileUrl often null in capture). */
    fileUrl: fileUrl || cbData.fileUrl || null,
    callbackId: cbData.id ?? null,
    callbackName: cbData.name ?? null,
    cosPutStatus: put.status,
  };
}

export const uploadMediaToolSchema = {
  name: "upseller_upload_media",
  description:
    "Upload the exact original file bytes without compression, resizing or transcoding via generate-sign → COS PUT → callback. Defaults module=product spaceCode=ListingImage. Returns fileUrl/fileKey. dryRun skips network. Auth: vault cookie/deviceId env.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Absolute local path to image" },
      module: { type: "string", description: "Default product" },
      spaceCode: { type: "string", description: "Default ListingImage" },
      dryRun: { type: "boolean", description: "Skip HTTP if true" },
    },
    required: ["filePath"],
  },
};
