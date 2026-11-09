import { parseImgUrlList, joinImgUrlList, buildResourceUriMap, maybeParseJson } from "../form.js";
import { upsellerGetDraft } from "./get_draft.js";
import { upsellerSaveDraft } from "./save_draft.js";
import { upsellerUploadMedia } from "./upload_media.js";

/**
 * Upload materials → replace draft imgUrl entirely (clear-all, pipe-delimited)
 * and optionally patch variation imageUrls → save_draft.
 *
 * Frontend ProductImage gallery: imgUrl.split("|").
 * mainImage = first URL cover only.
 *
 * dryRun skips upload POSTs and save POSTs (still builds planned patches).
 *
 * @param {ReturnType<import('../client.js').createClient>} client
 * @param {object} input
 */
export async function upsellerSetImages(client, input) {
  const draftId = input?.draftId;
  if (!draftId) throw new Error("draftId is required");
  const dryRun = input.dryRun !== false; // default true for safety
  const before = await upsellerGetDraft(client, { draftId });
  const beforeData = before._rawData || {};
  if (beforeData.state !== 'draft') throw new Error('set_images only edits drafts');
  if (String(beforeData.idStr ?? beforeData.id) !== String(draftId)) throw new Error('Draft identity mismatch');

  const uploaded = [];
  const errors = [];

  async function ensureUpload(filePath, alreadyUrl, alreadyFileKey) {
    if (alreadyUrl) {
      return { url: alreadyUrl, fileKey: alreadyFileKey || null, dryRun: false };
    }
    if (!filePath) return { url: null, fileKey: null, dryRun: Boolean(dryRun) };
    const up = await upsellerUploadMedia(client, { filePath, dryRun });
    uploaded.push(up);
    if (dryRun) {
      return {
        url: `dryRun://upload/${encodeURIComponent(filePath)}`,
        fileKey: up.fileKey || `dryRun-key/${encodeURIComponent(filePath)}`,
        dryRun: true,
      };
    }
    if (!up.fileUrl) throw new Error('Upload completed without a public fileUrl');
    return { url: up.fileUrl, fileKey: up.fileKey || null, dryRun: false };
  }

  const productEntries = [];
  const mainUp = await ensureUpload(
    input.mainImagePath,
    input.mainImageUrl,
    input.mainImageFileKey
  );
  if (mainUp.url) productEntries.push(mainUp);
  for (const p of input.galleryImagePaths || []) {
    const up = await ensureUpload(p, null, null);
    if (up.url) productEntries.push(up);
  }
  for (const u of input.galleryImageUrls || []) {
    productEntries.push({ url: u, fileKey: null, dryRun: false });
  }

  const productUrls = productEntries.map((e) => e.url).filter(Boolean);

  let variationList = beforeData.variationListStr ?? beforeData.variationList ?? beforeData.variations;
  if (typeof variationList === "string") {
    try {
      variationList = maybeParseJson(variationList);
    } catch {
      variationList = [];
    }
  }
  if (!Array.isArray(variationList)) variationList = [];

  function variationMatches(row) {
    if (row.id != null) {
      return variationList.some((v) => String(v.id) === String(row.id));
    }
    if (!row.valueName && !row.match) return false;
    return variationList.some((v) => {
      let attrs = v.salesAttributesJson;
      if (typeof attrs === "string") {
        try {
          attrs = JSON.parse(attrs);
        } catch {
          attrs = [];
        }
      }
      if (!Array.isArray(attrs)) return false;
      return attrs.some((a) =>
        row.valueName
          ? String(a.valueName) === String(row.valueName)
          : String(a.valueName).includes(String(row.match))
      );
    });
  }

  const variationImages = [];
  for (const row of input.variationImagePaths || []) {
    if (!variationMatches(row)) {
      throw new Error(
        `variation color match failed for valueName/match=${row.valueName || row.match || row.id}`
      );
    }
    const up = await ensureUpload(row.filePath, row.imageUrl, row.fileKey);
    variationImages.push({
      id: row.id,
      valueName: row.valueName,
      match: row.match,
      imageUrl: up.url,
      renameValueName: row.renameValueName,
    });
  }

  const patches = {};
  if (productUrls.length) {
    patches.imgUrl = joinImgUrlList(productUrls);
    patches.mainImage = productUrls[0];
    patches.resourceUriMapEntries = productEntries.map((e) => ({
      url: e.url,
      fileKey: e.fileKey,
      type: "image",
    }));
    patches.resourceUriMap = buildResourceUriMap(patches.resourceUriMapEntries);
    patches.sourceImgUrl = productUrls[0];
  }
  if (variationImages.length) {
    patches.variationImages = variationImages;
  }

  const save = await upsellerSaveDraft(client, {
    draftId,
    patches,
    dryRun,
    editData: beforeData,
  });

  let verification = null;
  if (!dryRun) {
    const after = await upsellerGetDraft(client, { draftId });
    const data = after._rawData;
    const actualRows = maybeParseJson(data.variationListStr ?? data.variationList ?? data.variations ?? []);
    const byId = new Map(actualRows.map(row => [String(row.id), row]));
    const expectedUrls = productUrls.length ? productUrls : parseImgUrlList(beforeData.imgUrl);
    // Use the actual UI parser, not our legacy-compatible parser, to catch collapse.
    const actualUrls = String(data.imgUrl || '').split('|').filter(Boolean);
    const rowMatches = (row, patch) => {
      if (patch.id != null) return String(row.id) === String(patch.id);
      const attrs = maybeParseJson(row.salesAttributesJson) || [];
      return attrs.some(a => patch.valueName != null ? String(a.valueName) === String(patch.valueName) : patch.match != null && String(a.valueName).includes(String(patch.match)));
    };
    const checks = {
      draft: data.state === 'draft' && String(data.idStr ?? data.id) === String(draftId),
      gallery: JSON.stringify(actualUrls) === JSON.stringify(expectedUrls),
      rows: actualRows.length === variationList.length && byId.size === variationList.length && variationList.every(row => byId.has(String(row.id))),
      pricesAndStock: variationList.every(row => ['price', 'stock'].every(key => byId.get(String(row.id))?.[key] === row[key])),
      variationImages: variationImages.every(patch => variationList.filter(row => rowMatches(row, patch)).every(row => {
        const actual = byId.get(String(row.id));
        return actual?.imageUrl === patch.imageUrl && (!patch.renameValueName || (maybeParseJson(actual.salesAttributesJson) || []).some(a => a.valueName === patch.renameValueName));
      })),
    };
    verification = { ok: Object.values(checks).every(Boolean), checks, state: data.state, expectedCount: expectedUrls.length, actualCount: actualUrls.length, variationCount: actualRows.length };
    if (!verification.ok) errors.push({ where: 'read-back', error: 'Saved draft does not match requested image state', checks });
  }

  const ok =
    errors.length === 0 &&
    save.ok &&
    (verification == null || verification.ok === true);

  return {
    ok,
    dryRun,
    draftId: String(draftId),
    clearAllProductImages: productUrls.length > 0,
    productImageCount: productUrls.length,
    productImgUrlPreview: parseImgUrlList(patches.imgUrl || "").map((u) =>
      u.slice(0, 120)
    ),
    resourceUriMapCount: Array.isArray(patches.resourceUriMap)
      ? patches.resourceUriMap.length
      : 0,
    resourceUriMapHosts: (patches.resourceUriMap || []).map((it) => {
      try {
        return new URL(it.url).host;
      } catch {
        return null;
      }
    }),
    variationPatchCount: variationImages.length,
    uploaded: uploaded.map((u) => ({
      dryRun: u.dryRun,
      fileName: u.fileName,
      fileUrl: u.fileUrl || null,
      fileKey: u.fileKey || null,
      size: u.size,
    })),
    save,
    verification,
    errors,
    notes: [
      'clear-all = replace imgUrl with pipe-separated URLs (UI: imgUrl.split("|")).',
      "mainImage = first URL cover; resourceUriMap synced.",
      "Live save verifies exact gallery order, SKU images, draft state, row IDs, prices and stock before ok=true.",
      "Default dryRun=true. 禁发布.",
    ],
  };
}

export const setImagesToolSchema = {
  name: "upseller_set_images",
  description:
    "Upload local materials then replace draft imgUrl entirely (pipe-delimited clear-all main+gallery) and optionally variation imageUrls; calls save_draft. dryRun default true. 禁发布.",
  inputSchema: {
    type: "object",
    properties: {
      draftId: { type: "string" },
      mainImagePath: { type: "string" },
      galleryImagePaths: { type: "array", items: { type: "string" } },
      mainImageUrl: { type: "string", description: "Skip upload if URL already known" },
      galleryImageUrls: { type: "array", items: { type: "string" } },
      variationImagePaths: {
        type: "array",
        items: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            id: { type: "string" },
            valueName: { type: "string" },
            match: { type: "string" },
            renameValueName: { type: "string" },
            imageUrl: { type: "string" },
          },
        },
      },
      dryRun: { type: "boolean", default: true },
    },
    required: ["draftId"],
  },
};
