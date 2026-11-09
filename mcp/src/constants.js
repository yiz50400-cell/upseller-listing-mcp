/**
 * UpSeller HTTP MCP constants (path A).
 * Secrets: only vault KEY NAMES or env VAR NAMES — never values in logs/git/chat.
 */

export const REV = "0.3.0";

export const BASE_URL = "https://app.upseller.com";

/** Vault key names (do not log env values). */
export const VAULT_COOKIE = "upseller.cookie";
export const VAULT_DEVICE_ID = "upseller.deviceId";
export const ENV_COOKIE = "UPSELLER_COOKIE";
export const ENV_DEVICE_ID = "UPSELLER_DEVICE_ID";
/** Optional override once live dryRun confirms save-op. */
export const ENV_SAVE_OP = "UPSELLER_SAVE_OP";

export const PATHS = {
  edit: "/api/tiktok/product/edit",
  checkEditPrice: "/api/tiktok/product/check-edit-price",
  add: "/api/tiktok/product/add",
  generateSign: "/api/media/file/upload/generate-sign",
  uploadCallback: "/api/media/file/upload/callback",
};

/**
 * Top-level form-urlencoded keys from capture-d form-keys-redacted.json
 * (nested brandInfo.id / variationListStr[].* are JSON interior, not separate form fields).
 */
export const FORM_TOP_LEVEL_KEYS = [
  "id",
  "shopId",
  "site",
  "itemTitle",
  "categoryId",
  "description",
  "sourceUrl",
  "categoryVersion",
  "brandInfo",
  "attributes",
  "hasVariation",
  "auction",
  "variationListStr",
  "variationTheme",
  "imgUrl",
  "certifications",
  "op",
  "anyway",
];

/**
 * Fields that are JSON object/array in the form body (stringify if object/array).
 * capture-d types: brandInfo=json-object; attributes/variationListStr/certifications=json-array.
 */
export const FORM_JSON_KEYS = new Set([
  "brandInfo",
  "attributes",
  "variationListStr",
  "certifications",
]);

// Live frontend submitData maps save=1, publish/update=2. No guessed operations.
export const DEFAULT_SAVE_OP = 1;
export const SAFE_SAVE_OPS = new Set([1]);
export const DEFAULT_ANYWAY = false;

export const DEFAULT_UPLOAD_MODULE = "product";
export const DEFAULT_UPLOAD_SPACE = "ListingImage";

export const USER_AGENT =
  "upseller-listing-mcp/0.1 (+path-A; draft-save-only; no-publish)";
