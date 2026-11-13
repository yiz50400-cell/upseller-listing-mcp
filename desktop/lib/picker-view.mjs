function clean(value) {
  return value == null ? '' : String(value).trim();
}

export function draftPickerLabel(task) {
  const draftId = clean(task?.draftId);
  if (!draftId) return '';
  return clean(task?.title) || draftId;
}

export function productPickerLabel(task) {
  if (clean(task?.draftId)) return '';
  const productId = clean(task?.productId);
  if (!productId) return '';
  return clean(task?.title) || productId;
}

export function filterListedItems(rows, { shopId, query } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const shop = clean(shopId);
  const q = clean(query).toLowerCase();
  return list.filter((row) => {
    if (shop && clean(row?.shopId) !== shop) return false;
    if (!q) return true;
    const blob = [
      row?.title,
      row?.draftId,
      row?.productId,
      row?.itemId,
      row?.shopName,
      row?.shopId,
    ].map((part) => String(part || '').toLowerCase()).join(' ');
    return blob.includes(q);
  });
}

export function formatListPrice(row) {
  if (row?.price == null || row.price === '') return '—';
  const amount = String(row.price);
  const currency = clean(row?.currency);
  if (currency === 'MXN') return `MX$ ${amount}`;
  return currency ? `${currency} ${amount}` : amount;
}

export function firstDisplayImage(row) {
  return clean(row?.thumbnail || row?.mainImage || '');
}
