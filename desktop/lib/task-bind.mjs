import { applyDraftFields } from './draft-form.mjs';

function clean(value) {
  return value == null ? '' : String(value).trim();
}

export function newTaskId(now = Date.now()) {
  return `ui-${Number(now).toString(36)}`;
}

export function markTaskSaved(task, result = {}) {
  const next = { ...(task || {}), status: 'draft', savedOnce: true };
  const draftId = clean(result.draftId || task?.draftId);
  if (draftId) {
    next.draftId = draftId;
    next.savedDraftId = draftId;
  }
  const productId = clean(task?.productId);
  if (productId) next.savedProductId = productId;
  return next;
}

export function needsNewTaskId(task, next = {}) {
  if (!task?.savedOnce && !clean(task?.savedDraftId) && !clean(task?.savedProductId)) return false;
  const savedDraft = clean(task?.savedDraftId);
  const savedProduct = clean(task?.savedProductId);
  const nextDraft = clean(next.draftId);
  const nextProduct = clean(next.productId);
  if (nextDraft) {
    if (savedDraft) return nextDraft !== savedDraft;
    return true;
  }
  if (nextProduct) {
    if (savedDraft) return true;
    if (savedProduct) return nextProduct !== savedProduct;
    return true;
  }
  return false;
}

export function rotateTaskIdentity(task, now = Date.now()) {
  const next = { ...(task || {}), id: newTaskId(now), savedOnce: false, savedDraftId: '', savedProductId: '' };
  return next;
}

export function applyOnlineProductFields(task, product = {}) {
  const next = { ...(task || {}) };
  next.productId = clean(product.productId || product.itemId);
  next.draftId = '';
  const title = product.title || product.itemTitle;
  if (title) next.title = title;
  if (product.price != null && product.price !== '') next.price = product.price;
  if (product.currency) next.currency = product.currency;
  if (product.site) next.site = String(product.site);
  const sourceShop = clean(product.shopId);
  if (sourceShop) next.sourceShopHint = sourceShop;
  return next;
}

export function bindSourceToTask(task, source = {}, now = Date.now()) {
  const kind = source.kind === 'product' ? 'product' : 'draft';
  const binding = kind === 'product'
    ? { productId: clean(source.product?.productId || source.product?.itemId || source.productId), draftId: '' }
    : { draftId: clean(source.draftId || source.draft?.draftId), productId: clean(source.draft?.itemId || source.draft?.productId) };
  const rotate = needsNewTaskId(task, binding);
  let next = rotate ? rotateTaskIdentity(task, now) : { ...(task || {}) };
  const previousId = task?.id;
  if (kind === 'product') {
    next = applyOnlineProductFields(next, source.product || source);
  } else {
    next = applyDraftFields(next, source.draft || {}, binding.draftId);
  }
  return { task: next, rotated: rotate, previousId };
}
