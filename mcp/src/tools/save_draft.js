import { PATHS } from "../constants.js";
import { assertApiOk } from "../client.js";
import {
  assertFormKeysSuperset,
  buildSaveFormFields,
  encodeFormBody,
  PublishGuardError,
} from "../form.js";
import { upsellerGetDraft } from "./get_draft.js";

/**
 * Save draft (NOT publish).
 * Flow: GET edit → build form (capture-d keys) → apply patches →
 *   if dryRun: return body meta without POST;
 *   else: POST check-edit-price then POST product/add (same fields).
 *
 * Sample capture listed add before check-edit-price (CDP timing); we follow
 * task preference: check then add. Documented in meta.postOrder.
 *
 * @param {ReturnType<import('../client.js').createClient>} client
 * @param {{ draftId: string, patches?: object, dryRun?: boolean, editData?: object }} input
 */
export async function upsellerSaveDraft(client, input) {
  const draftId = input?.draftId;
  if (draftId == null || draftId === "") throw new Error("draftId is required");
  const patches = input.patches || {};
  const dryRun = input.dryRun !== false;

  if (patches.publish === true) {
    throw new PublishGuardError("publish patch refused");
  }

  let editData = input.editData;
  if (!editData) {
    const got = await upsellerGetDraft(client, { draftId });
    editData = got._rawData;
  }

  const { fields, meta } = buildSaveFormFields(editData, patches);
  assertFormKeysSuperset(fields);
  const body = encodeFormBody(fields);

  const result = {
    ok: true,
    draftId: String(draftId),
    dryRun,
    published: false,
    postOrder: ["check-edit-price", "add"],
    form: {
      keyCount: meta.keyCount,
      keys: meta.keys,
      op: meta.op,
      anyway: meta.anyway,
      opTodo: meta.opTodo,
      imgUrlTodo: meta.imgUrlTodo,
      imgUrlCount: meta.imgUrlCount,
      resourceUriMapCount: meta.resourceUriMapCount,
      variationSource: meta.variationSource,
      bodyLen: body.length,
      bodyPreviewLens: meta.bodyPreviewLens,
    },
    checkEditPrice: null,
    add: null,
  };

  if (dryRun) {
    result.message =
      "dryRun=true: form built+validated; POSTs skipped. 禁自动 save 真草稿.";
    return result;
  }

  // Live POST path — caller must opt in (dryRun false). Still never publish.
  const check = await client.postForm(PATHS.checkEditPrice, fields);
  const checkJson = assertApiOk(check, PATHS.checkEditPrice);
  result.checkEditPrice = {
    status: check.status,
    code: checkJson?.code,
    msg: checkJson?.msg,
  };

  const add = await client.postForm(PATHS.add, fields);
  const addJson = assertApiOk(add, PATHS.add);
  result.add = {
    status: add.status,
    code: addJson?.code,
    msg: addJson?.msg,
  };
  result.message = "Draft save POSTs completed (check-edit-price → add). Not published.";
  return result;
}

export const saveDraftToolSchema = {
  name: "upseller_save_draft",
  description:
    "Build form from GET edit, apply patches, then POST check-edit-price → product/add. dryRun defaults true; explicit false required for writes. Frontend-confirmed op=1 saves; publish/update op=2 is refused. Auth via cookie/deviceId env.",
  inputSchema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "Draft id" },
      dryRun: {
        type: "boolean",
        description: "If true (recommended), do not POST — only build/validate form",
        default: true,
      },
      patches: {
        type: "object",
        description:
          "Optional: itemTitle, description, imgUrl|imgUrls, variationListStr, price, pricesByVariationId, variationImages[{id|valueName|match,imageUrl,renameValueName?}]. Never set publish.",
      },
    },
    required: ["draftId"],
  },
};
