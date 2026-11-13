import { assertApiOk } from '../client.js';

export function sanitizeDraftListItem(row = {}, shop = {}) {
  const draftId = String(row.idStr ?? row.id ?? '').trim();
  return {
    draftId,
    title: String(row.itemTitle ?? row.title ?? '').trim(),
    shopId: String(row.shopId ?? shop.id ?? '').trim(),
    shopName: String(row.shopName ?? shop.name ?? '').trim(),
    site: String(row.site ?? shop.site ?? '').trim(),
    price: row.price ?? row.minPrice ?? row.maxPrice ?? '',
    currency: row.currency ? String(row.currency) : '',
    state: row.state ? String(row.state) : 'draft',
    updateTime: row.updateTime ?? null,
    itemId: row.itemId == null || row.itemId === '' ? null : String(row.itemId),
  };
}

export async function listDraftsForShop(client, shopId, { signal } = {}) {
  const all = [];
  for (let pageNum = 1; pageNum <= 100; pageNum++) {
    signal?.throwIfAborted?.();
    const payload = { state: 'draft', shopIds: shopId, pageNum, pageSize: 100 };
    const j = assertApiOk(await client.postForm('/api/tiktok/product/index', payload), 'draft-list');
    if (!Array.isArray(j.data?.list)) throw new Error('草稿列表格式已变化');
    all.push(...j.data.list);
    if (all.length >= Number(j.data.total) || j.data.list.length < 100) return all;
  }
  throw new Error('草稿超过查询安全范围，需精确指定 draftId');
}

export async function listAccountDrafts(client, { shops = [], shopId, signal } = {}) {
  const list = Array.isArray(shops) ? shops : [];
  const wanted = shopId != null && String(shopId).trim() !== '' ? String(shopId).trim() : '';
  const available = list.filter((shop) => shop?.id && !shop.expired);
  const targets = wanted
    ? (available.filter((shop) => String(shop.id) === wanted).length
      ? available.filter((shop) => String(shop.id) === wanted)
      : [{ id: wanted }])
    : available;
  const out = [];
  for (const shop of targets) {
    const rows = await listDraftsForShop(client, shop.id, { signal });
    out.push(...rows.map((row) => sanitizeDraftListItem(row, shop)));
  }
  return out.filter((row) => row.draftId);
}
