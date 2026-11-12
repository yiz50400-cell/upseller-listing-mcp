function clean(value) {
  return value == null ? '' : String(value).trim();
}

export function applyDraftFields(task, draft, draftId) {
  const next = { ...(task || {}) };
  if (draftId != null && clean(draftId)) next.draftId = clean(draftId);
  if (draft?.itemId != null && clean(draft.itemId)) next.productId = clean(draft.itemId);
  if (draft?.itemTitle) next.title = draft.itemTitle;
  if (draft?.price != null && draft.price !== '') next.price = draft.price;
  if (draft?.currency) next.currency = draft.currency;
  if (draft?.site) next.site = String(draft.site);
  const shopId = clean(draft?.shopId);
  const shopName = clean(draft?.shopName);
  if (shopId || shopName) {
    next.shopId = shopId;
    next.shopName = shopName;
  }
  return next;
}

export function findShopOption(options, task) {
  const list = Array.isArray(options) ? options : [];
  const shopId = clean(task?.shopId);
  const shopName = clean(task?.shopName);
  const idOf = (option) => clean(option?.dataset?.id ?? option?.id);
  const nameOf = (option) => clean(option?.dataset?.name ?? option?.name);
  if (shopId) {
    const byId = list.find((option) => idOf(option) === shopId);
    if (byId) return byId;
  }
  if (shopName) return list.find((option) => nameOf(option) === shopName);
  return undefined;
}
