/**
 * Map GET /api/tiktok/product/edit JSON → form-urlencoded fields (capture-d keys).
 * Nested objects/arrays are JSON.stringified for form values.
 *
 * TODOs (do not invent publish):
 * - op / anyway not present on edit GET; frontend confirms save=1, publish/update=2.
 * - imgUrl must be pipe-separated HTTPS URLs: frontend ProductImage does imgUrl.split("|").
 * - variationListStr may arrive as stringified JSON or array; also try variationList/variations.
 * - categoryVersion may be null on edit; default "v1" (matches category API samples).
 */

import zlib from "node:zlib";
import { parseApiJson } from "./json.js";
import {
  DEFAULT_ANYWAY,
  DEFAULT_SAVE_OP,
  ENV_SAVE_OP,
  FORM_JSON_KEYS,
  FORM_TOP_LEVEL_KEYS,
  SAFE_SAVE_OPS,
} from "./constants.js";

export class FormBuildError extends Error {
  constructor(message) {
    super(message);
    this.name = "FormBuildError";
  }
}

export class PublishGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublishGuardError";
  }
}

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Parse JSON string if it looks like JSON; else return value. */
export function maybeParseJson(v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t) return v;
  if (!(t.startsWith("{") || t.startsWith("["))) return v;
  try {
    return parseApiJson(t);
  } catch {
    return v;
  }
}

/** Stringify for form: objects/arrays → JSON text; null/undefined → "". */
export function formStringify(key, value) {
  if (value == null) {
    if (FORM_JSON_KEYS.has(key)) {
      return key === "brandInfo" ? "{}" : "[]";
    }
    return "";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    // Already a JSON string for a JSON key? keep as-is if parseable.
    if (FORM_JSON_KEYS.has(key)) {
      const parsed = maybeParseJson(value);
      if (parsed !== value) return JSON.stringify(parsed);
      // Non-JSON string in a JSON field — wrap carefully
      if (value.trim() === "") return key === "brandInfo" ? "{}" : "[]";
      return value;
    }
    return value;
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Split imgUrl into URL list. Prefer pipe (frontend split("|")); also accept comma/JSON.
 */
export function parseImgUrlList(imgUrl) {
  if (imgUrl == null || imgUrl === "") return [];
  if (Array.isArray(imgUrl)) return imgUrl.map(String).filter(Boolean);
  if (typeof imgUrl !== "string") return [];
  const t = imgUrl.trim();
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return t.split(t.includes("|") ? "|" : /,(?=https?:\/\/|dryRun:\/\/)/).map((s) => s.trim()).filter(Boolean);
}

export function joinImgUrlList(urls) {
  // Observed MediaInfo initData/getData both split/join imgUrl with "|".
  return (urls || []).map(String).filter(Boolean).join("|");
}

/** Frontend TikTok edit page does mainImage.split("|"). */
export function joinMainImageList(urls) {
  return (urls || []).map(String).filter(Boolean).join("|");
}

export function parseMainImageList(mainImage) {
  if (mainImage == null || mainImage === "") return [];
  if (Array.isArray(mainImage)) return mainImage.map(String).filter(Boolean);
  return String(mainImage).split("|").map((s) => s.trim()).filter(Boolean);
}

/**
 * Preserve mappings returned by TikTok's Upload Product Image API.
 * Edit GET exposes resourceUriMap as JSON array of {uri,url,type:"image"}.
 * Resource metadata only: product slots are driven by imgUrl.split("|").
 * A COS upload fileKey is NOT a TikTok image URI. New COS URLs have
 * no platform mapping until UpSeller uploads them during publication.
 */
function isPlatformImageUri(uri) {
  return typeof uri === "string" && /^tos-[^/]+\/.+/.test(uri);
}

export function uriFromProductImageUrl(url, fileKey) {
  // Compatibility export: never infer a platform resource from a public URL.
  return isPlatformImageUri(fileKey) ? fileKey : "";
}

export function buildResourceUriMap(entries) {
  return (entries || [])
    .filter((e) => e && e.url)
    .map((e) => ({
      uri: e.uri ?? uriFromProductImageUrl(e.url, e.fileKey),
      url: String(e.url),
      type: e.type || "image",
    }))
    .filter(e => isPlatformImageUri(e.uri));
}

export function parseResourceUriMap(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function pickVariationList(data) {
  const candidates = [data.variationListStr, data.variationList, data.variations];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    return maybeParseJson(c);
  }
  return [];
}

function resolveSaveOp(explicit) {
  if (explicit != null && explicit !== "") {
    const n = Number(explicit);
    if (!Number.isFinite(n) || !SAFE_SAVE_OPS.has(n)) {
      throw new PublishGuardError(
        `Refusing op=${explicit}. Only SAFE_SAVE_OPS={1} allowed until live confirm; 禁发布.`
      );
    }
    return n;
  }
  if (process.env[ENV_SAVE_OP] != null && process.env[ENV_SAVE_OP] !== "") {
    const n = Number(process.env[ENV_SAVE_OP]);
    if (!Number.isFinite(n) || !SAFE_SAVE_OPS.has(n)) {
      throw new PublishGuardError(
        `Env ${ENV_SAVE_OP}=${process.env[ENV_SAVE_OP]} not in SAFE_SAVE_OPS={1}; 禁发布.`
      );
    }
    return n;
  }
  return DEFAULT_SAVE_OP;
}

/**
 * Build a plain object of form fields from edit `data` + optional patches.
 * Does not POST. Validates capture-d top-level key coverage.
 *
 * @param {object} editData - response.data from product/edit
 * @param {object} [patches]
 * @param {object} [opts]
 * @returns {{ fields: Record<string,string>, meta: object }}
 */
export function buildSaveFormFields(editData, patches = {}, opts = {}) {
  if (!editData || typeof editData !== "object") {
    throw new FormBuildError("editData required");
  }

  // Hard refuse publish-ish patches
  if (patches.publish === true || patches.doPublish === true) {
    throw new PublishGuardError("patches.publish refused; 禁发布");
  }
  if (patches.op != null && !SAFE_SAVE_OPS.has(Number(patches.op))) {
    throw new PublishGuardError(`patches.op=${patches.op} refused; 禁发布`);
  }

  const data = { ...editData };

  // Normalize aliases onto capture-d names
  if (data.variationListStr == null || data.variationListStr === "") {
    data.variationListStr = pickVariationList(data);
  } else {
    data.variationListStr = maybeParseJson(data.variationListStr);
  }
  if (data.brandInfo != null) data.brandInfo = maybeParseJson(data.brandInfo);
  if (data.attributes != null) data.attributes = maybeParseJson(data.attributes);
  if (data.certifications != null) {
    data.certifications = maybeParseJson(data.certifications);
  } else {
    data.certifications = [];
  }
  if (data.categoryVersion == null || data.categoryVersion === "") {
    data.categoryVersion = opts.defaultCategoryVersion ?? "v1";
  }
  if (data.sourceUrl == null) data.sourceUrl = "";

  // Apply documented patches
  if (patches.itemTitle != null) data.itemTitle = patches.itemTitle;
  if (patches.description != null) data.description = patches.description;
  if (patches.imgUrl != null) {
    data.imgUrl =
      typeof patches.imgUrl === "string"
        ? patches.imgUrl
        : joinImgUrlList(patches.imgUrl);
  }
  if (patches.imgUrls != null) {
    data.imgUrl = joinImgUrlList(patches.imgUrls);
  }
  // Always normalize imgUrl to pipe. Frontend ProductImage: imgUrl.split("|").
  data.imgUrl = joinImgUrlList(parseImgUrlList(data.imgUrl ?? data.mainImage));
  if (
    patches.mainImage == null &&
    (patches.imgUrl != null || patches.imgUrls != null)
  ) {
    // Cover/thumb field: first image only. Gallery count comes from imgUrl pipes.
    const list = parseImgUrlList(data.imgUrl);
    data.mainImage = list[0] || "";
  }
  if (patches.resourceUriMap != null) {
    data.resourceUriMap = Array.isArray(patches.resourceUriMap)
      ? patches.resourceUriMap
      : parseResourceUriMap(patches.resourceUriMap);
  }
  if (Array.isArray(patches.resourceUriMapEntries)) {
    data.resourceUriMap = buildResourceUriMap(patches.resourceUriMapEntries);
  }
  if (patches.sourceImgUrl != null) {
    data.sourceImgUrl = patches.sourceImgUrl;
  }
  if (patches.mainImage != null) {
    data.mainImage =
      typeof patches.mainImage === "string"
        ? patches.mainImage
        : joinMainImageList(patches.mainImage);
  }
  if (patches.resourceUriMapCompress != null) {
    data.resourceUriMapCompress = patches.resourceUriMapCompress;
  }
  if (patches.variationListStr != null) {
    data.variationListStr = maybeParseJson(patches.variationListStr);
  }

  // Structured price patch: { price?: number, pricesByVariationId?: Record<id,number> }
  if (patches.price != null || patches.pricesByVariationId) {
    const list = Array.isArray(data.variationListStr)
      ? data.variationListStr
      : maybeParseJson(data.variationListStr);
    if (!Array.isArray(list)) {
      throw new FormBuildError("Cannot apply price patch: variationListStr not array");
    }
    const byId = patches.pricesByVariationId || {};
    data.variationListStr = list.map((row) => {
      const next = { ...row };
      if (byId[String(row.id)] != null) next.price = Number(byId[String(row.id)]);
      else if (patches.price != null) next.price = Number(patches.price);
      return next;
    });
  }

  // Structured variation image patch: { variationImages?: Array<{ id|valueName|match, imageUrl }> }
  if (Array.isArray(patches.variationImages)) {
    const list = Array.isArray(data.variationListStr)
      ? data.variationListStr
      : maybeParseJson(data.variationListStr);
    if (!Array.isArray(list)) {
      throw new FormBuildError("Cannot apply variationImages: variationListStr not array");
    }
    data.variationListStr = list.map((row) => {
      const next = { ...row };
      const hit = patches.variationImages.find((p) => {
        if (p.id != null && String(p.id) === String(row.id)) return true;
        if (p.valueName != null) {
          const attrs = maybeParseJson(row.salesAttributesJson) || [];
          return attrs.some((a) => String(a.valueName) === String(p.valueName));
        }
        if (p.match != null) {
          const attrs = maybeParseJson(row.salesAttributesJson) || [];
          return attrs.some((a) => String(a.valueName).includes(String(p.match)));
        }
        return false;
      });
      if (hit?.imageUrl) next.imageUrl = hit.imageUrl;
      if (hit?.renameValueName) {
        const attrs = Array.isArray(maybeParseJson(row.salesAttributesJson))
          ? maybeParseJson(row.salesAttributesJson).map((a) => ({ ...a }))
          : [];
        for (const a of attrs) {
          if (hit.valueName && String(a.valueName) === String(hit.valueName)) {
            a.valueName = hit.renameValueName;
          } else if (hit.match && String(a.valueName).includes(String(hit.match))) {
            a.valueName = hit.renameValueName;
          }
        }
        next.salesAttributesJson = attrs;
      }
      return next;
    });
  }

  // Cached mappings belong to a particular image. Clear stale/synthetic SKU
  // metadata while preserving its image URL, identity, price and inventory.
  if (Array.isArray(data.variationListStr)) {
    data.variationListStr = data.variationListStr.map(row => {
      if (row.resourceUriMap == null) return row;
      const resource = maybeParseJson(row.resourceUriMap);
      return isPlatformImageUri(resource?.uri) && resource.url === row.imageUrl
        ? row : { ...row, resourceUriMap: null };
    });
  }

  const op = resolveSaveOp(patches.op);
  const anyway =
    patches.anyway != null ? Boolean(patches.anyway) : DEFAULT_ANYWAY;

  data.op = op;
  data.anyway = anyway;

  const fields = {};
  for (const key of FORM_TOP_LEVEL_KEYS) {
    fields[key] = formStringify(key, data[key]);
  }
  // Gallery display uses imgUrl, not resourceUriMap. Clear invalid cached
  // mappings so the publication backend can obtain actual platform URIs.
  const rawMap = parseResourceUriMap(data.resourceUriMap);
  const cleanMap = buildResourceUriMap(rawMap);
  const rewriteMap = patches.resourceUriMap != null || Array.isArray(patches.resourceUriMapEntries) || rawMap.length !== cleanMap.length;
  if (rewriteMap) {
    const mapArr = cleanMap;
    fields.resourceUriMap = formStringify("resourceUriMap", mapArr);
    // Keep compressed metadata consistent with the sanitized map.
    {
      const mapStr = JSON.stringify(mapArr);
      fields.resourceUriMapCompress =
        "gzip!" + zlib.gzipSync(Buffer.from(mapStr, "utf8")).toString("base64");
    }
  }
  if (patches.sourceImgUrl != null) {
    fields.sourceImgUrl = formStringify("sourceImgUrl", data.sourceImgUrl);
  }
  if (
    patches.mainImage != null ||
    patches.imgUrl != null ||
    patches.imgUrls != null
  ) {
    fields.mainImage = formStringify("mainImage", data.mainImage);
  }
  if (patches.resourceUriMapCompress != null && !rewriteMap) {
    fields.resourceUriMapCompress = formStringify(
      "resourceUriMapCompress",
      patches.resourceUriMapCompress
    );
  }

  // Validate required identity fields
  for (const req of ["id", "shopId", "site", "itemTitle", "categoryId"]) {
    if (fields[req] === "" || fields[req] == null) {
      throw new FormBuildError(`Missing required form field: ${req}`);
    }
  }

  const present = new Set(Object.keys(fields));
  const missingTop = FORM_TOP_LEVEL_KEYS.filter((k) => !present.has(k));
  if (missingTop.length) {
    throw new FormBuildError(`Form missing top-level keys: ${missingTop.join(",")}`);
  }

  const meta = {
    keyCount: FORM_TOP_LEVEL_KEYS.length,
    keys: [...FORM_TOP_LEVEL_KEYS],
    op,
    anyway,
    opTodo:
      "Confirmed frontend save=1; publish/update=2. Only op=1 allowed.",
    imgUrlTodo:
      "Confirmed ProductImage uses pipe-separated imgUrl; clear-all replaces the entire list.",
    variationSource: Array.isArray(editData.variationListStr)
      ? "variationListStr"
      : editData.variationListStr
        ? "variationListStr(string)"
        : editData.variationList
          ? "variationList"
          : editData.variations
            ? "variations"
            : "empty",
    imgUrlCount: parseImgUrlList(fields.imgUrl).length,
    resourceUriMapCount: fields.resourceUriMap
      ? parseResourceUriMap(fields.resourceUriMap).length
      : null,
    bodyPreviewLens: Object.fromEntries(
      Object.keys(fields).map((k) => [k, String(fields[k] ?? "").length])
    ),
  };

  return { fields, meta };
}

/**
 * Assert built form top-level key set ⊇ capture-d names.
 */
export function assertFormKeysSuperset(fields, captureTopKeys = FORM_TOP_LEVEL_KEYS) {
  const have = new Set(Object.keys(fields));
  const missing = captureTopKeys.filter((k) => !have.has(k));
  if (missing.length) {
    throw new FormBuildError(`form keys missing capture-d names: ${missing.join(",")}`);
  }
  return true;
}

export function encodeFormBody(fields) {
  const sp = new URLSearchParams();
  for (const key of FORM_TOP_LEVEL_KEYS) {
    sp.append(key, fields[key] ?? "");
  }
  // Extras (e.g. resourceUriMap) when present — UI gallery depends on them.
  for (const key of Object.keys(fields || {})) {
    if (FORM_TOP_LEVEL_KEYS.includes(key)) continue;
    sp.append(key, fields[key] ?? "");
  }
  return sp.toString();
}
