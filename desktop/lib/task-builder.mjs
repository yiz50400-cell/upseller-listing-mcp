/**
 * Map the desktop form onto existing MCP listing tasks.
 * Reuses upseller_run_listing / upseller_run_batch field names.
 * Video may be stored on the local form, but must NOT be sent to the
 * current pipeline — it throws if task.video is set.
 */

import { realShops, runBlockReason, isPlaceholderShopName } from '../renderer/run-guards.mjs';

function clean(value) {
  return String(value ?? '').trim();
}

export { realShops, runBlockReason };

export function matchFormShop(shops, form = {}) {
  const list = realShops(shops);
  const id = clean(form.shopId);
  const name = clean(form.shopName);
  if (id) {
    const hit = list.find((shop) => clean(shop.id) === id);
    if (hit) return hit;
  }
  if (name) {
    const hit = list.find((shop) => clean(shop.name) === name);
    if (hit) return hit;
  }
  if ((id || name) && !isPlaceholderShopName(name)) {
    return { ...(id ? { id } : {}), ...(name ? { name } : {}) };
  }
  return null;
}

export function selectedShops(shops, formOrCount = {}, maybeForm) {
  // A task maps to the single shop in the form. Leftover copyToShopCount
  // values on older tasks or stale callers are ignored and must not pick
  // extra shops.
  const form = formOrCount && typeof formOrCount === 'object' ? formOrCount : (maybeForm && typeof maybeForm === 'object' ? maybeForm : {});
  const list = realShops(shops);
  const picked = matchFormShop(shops, form);
  const used = picked ? [picked] : list.slice(0, 1);
  return { wanted: 1, used, available: list.length };
}

export function buildImageList(form) {
  const images = [];
  const mains = form.mainImages || (form.mainImage ? [form.mainImage] : []);
  if (mains.length > 1) throw new Error('主图只能选一张');
  for (const file of mains) {
    if (clean(file)) images.push({ path: clean(file), role: 'main' });
  }
  for (const file of form.galleryImages || []) {
    if (clean(file)) images.push({ path: clean(file), role: 'gallery' });
  }
  for (const item of form.skuImages || []) {
    const file = typeof item === 'string' ? item : item?.path;
    const skuName = typeof item === 'string' ? undefined : item?.skuName;
    if (clean(file)) images.push({ path: clean(file), role: 'sku', ...(clean(skuName) ? { skuName: clean(skuName) } : {}) });
  }
  return images;
}

export function buildListingTasks(form, shops, { publish = false } = {}) {
  const blocked = runBlockReason({ form, shops, demo: form.demo });
  if (blocked) throw new Error(blocked);

  const productId = clean(form.productId);
  const draftId = clean(form.draftId);
  const shopPick = selectedShops(shops, form);
  if (shopPick.used.length < 1) throw new Error('请先添加店铺。');

  const title = clean(form.title) || undefined;
  let productPrice;
  if (form.price !== '' && form.price != null) {
    productPrice = Number(form.price);
    if (!Number.isFinite(productPrice) || productPrice <= 0) throw new Error('价格必须是大于零的数值');
  }

  const images = buildImageList(form);
  const baseId = clean(form.taskId) || `ui-${Date.now().toString(36)}`;
  const tasks = shopPick.used.map((shop, index) => {
    const task = {
      taskId: shopPick.used.length > 1 ? `${baseId}-${index + 1}` : baseId,
      ...(productId ? { productId } : {}),
      ...(draftId ? { draftId } : {}),
      ...(clean(shop.id) ? { targetShopId: clean(shop.id) } : {}),
      ...(clean(shop.name) ? { targetShopName: clean(shop.name) } : {}),
      ...(title ? { title } : {}),
      ...(productPrice != null ? { productPrice } : {}),
      ...(images.length ? { images } : {}),
      publish: publish === true,
    };
    // Leftover form.skuPrefix values are ignored and are not sent to MCP.
    if (clean(form.notes)) task.notes = clean(form.notes);
    // Intentionally omit video: current MCP runner rejects it.
    return task;
  });

  return {
    tasks,
    warnings: [
      ...(clean(form.video) ? ['当前上架能力尚不处理视频；视频仅保存在本地任务中，不会发给预览/草稿/发布流程。'] : []),
    ],
    videoIgnored: Boolean(clean(form.video)),
    shopCount: shopPick.used.length,
  };
}
