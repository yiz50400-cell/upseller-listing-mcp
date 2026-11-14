export function filterDrafts(drafts, shopId) {
  const list = Array.isArray(drafts) ? drafts : [];
  const id = shopId == null ? '' : String(shopId).trim();
  if (!id) return list;
  return list.filter((row) => String(row?.shopId || '').trim() === id);
}

export function draftOptionLabel(row) {
  const title = String(row?.title || '未命名草稿').trim() || '未命名草稿';
  const shop = String(row?.shopName || row?.shopId || '').trim();
  return shop ? `${title}  ·  ${shop}` : title;
}
