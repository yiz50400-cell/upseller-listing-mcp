import { PATHS } from "../constants.js";
import { assertApiOk } from "../client.js";
import { maybeParseJson, parseImgUrlList } from "../form.js";

/**
 * Sanitize draft for tool output — no cookies/tokens; truncate huge HTML.
 */
export function sanitizeDraft(data) {
  if (!data || typeof data !== "object") return null;
  const variations = maybeParseJson(
    data.variationListStr ?? data.variationList ?? data.variations ?? []
  );
  const varSummary = Array.isArray(variations)
    ? variations.map((v) => {
        const attrs = maybeParseJson(v.salesAttributesJson) || [];
        return {
          id: v.id,
          price: v.price,
          stock: v.stock,
          imageUrl: v.imageUrl ? String(v.imageUrl).slice(0, 120) : null,
          valueNames: attrs.map((a) => a.valueName).filter(Boolean),
        };
      })
    : [];

  const imgUrls = parseImgUrlList(data.imgUrl);
  const desc = data.description == null ? null : String(data.description);
  return {
    id: data.id,
    idStr: data.idStr ?? (data.id != null ? String(data.id) : null),
    shopId: data.shopId,
    shopName: data.shopName ?? null,
    site: data.site,
    state: data.state,
    itemId: data.itemId == null ? null : String(data.itemId),
    productStatus: data.productStatus ?? null,
    reviewStatus: data.reviewStatus ?? null,
    error: data.errMsg ?? null,
    itemTitle: data.itemTitle,
    categoryId: data.categoryId,
    categoryVersion: data.categoryVersion ?? null,
    currency: data.currency,
    price: data.price,
    maxPrice: data.maxPrice,
    stock: data.stock,
    hasVariation: data.hasVariation,
    auction: data.auction,
    variationTheme: data.variationTheme,
    mainImage: data.mainImage,
    imgUrlCount: imgUrls.length,
    imgUrlPreview: imgUrls.slice(0, 3).map((u) => u.slice(0, 120)),
    descriptionLen: desc ? desc.length : 0,
    descriptionPreview: desc ? desc.slice(0, 160) : null,
    brandInfo: maybeParseJson(data.brandInfo),
    variationCount: varSummary.length,
    variations: varSummary,
    sourceUrl: data.sourceUrl || "",
    updateTime: data.updateTime ?? null,
    createTime: data.createTime ?? null,
  };
}

/**
 * @param {ReturnType<import('../client.js').createClient>} client
 * @param {{ draftId: string|number }} input
 */
export async function upsellerGetDraft(client, input) {
  const draftId = input?.draftId;
  if (draftId == null || draftId === "") {
    throw new Error("draftId is required");
  }
  const res = await client.get(PATHS.edit, { id: String(draftId) });
  const json = assertApiOk(res, PATHS.edit);
  const data = json?.data;
  if (!data) throw new Error("edit response missing data");
  return {
    ok: true,
    draftId: String(draftId),
    draft: sanitizeDraft(data),
    /** Raw data kept for save_draft callers in-process; tool response omits heavy fields by default. */
    _rawData: data,
  };
}

export const getDraftToolSchema = {
  name: "upseller_get_draft",
  description:
    "GET UpSeller draft via /api/tiktok/product/edit?id=. Returns sanitized draft fields (id, shopId, site, title, images summary, variation prices). Auth: vault upseller.cookie + upseller.deviceId (env UPSELLER_COOKIE / UPSELLER_DEVICE_ID). Never publishes.",
  inputSchema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "Draft product id (required)" },
    },
    required: ["draftId"],
  },
};
