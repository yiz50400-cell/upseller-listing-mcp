import { assertApiOk } from '../client.js';
import { firstDisplayImageUrl } from './list_image.js';

export function sanitizeProductListItem(row = {}, shop = {}) {
  const productId = String(row.itemId ?? row.productId ?? '').trim();
  const skuCount = row.skuNum ?? row.skuCount ?? row.variationCount;
  return {
    productId,
    title: String(row.itemTitle ?? row.title ?? '').trim(),
    shopId: String(row.shopId ?? shop.id ?? '').trim(),
    shopName: String(row.shopName ?? shop.name ?? '').trim(),
    site: String(row.site ?? shop.site ?? '').trim(),
    price: row.price ?? row.minPrice ?? row.maxPrice ?? '',
    currency: row.currency ? String(row.currency) : '',
    state: row.state ? String(row.state) : 'online',
    updateTime: row.updateTime ?? null,
    thumbnail: firstDisplayImageUrl(row),
    ...(skuCount == null || skuCount === '' ? {} : { skuCount: Number(skuCount) || skuCount }),
  };
}

export async function listProductsForShop(client, shopId, { signal } = {}) {
  const all = [];
  for (let pageNum = 1; pageNum <= 100; pageNum++) {
    signal?.throwIfAborted?.();
    const payload = { state: 'online', shopIds: shopId, pageNum, pageSize: 100 };
    const j = assertApiOk(await client.postForm('/api/tiktok/product/index', payload), 'product-list');
    if (!Array.isArray(j.data?.list)) throw new Error('在线商品列表格式已变化');
    all.push(...j.data.list);
    if (all.length >= Number(j.data.total) || j.data.list.length < 100) return all;
  }
  throw new Error('在线商品超过查询安全范围，请改用搜索或按店筛选');
}

export async function listAccountProducts(client, { shops = [], shopId, signal } = {}) {
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
    const rows = await listProductsForShop(client, shop.id, { signal });
    out.push(...rows.map((row) => sanitizeProductListItem(row, shop)));
  }
  return out.filter((row) => row.productId);
}
