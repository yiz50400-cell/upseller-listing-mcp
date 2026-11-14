import { applyDraftFields } from './draft-form.mjs';
import { applyDisplayImage } from './task-thumb.mjs';
import { isSubmittedTask } from './status-badge.mjs';

function clean(value) {
  return value == null ? '' : String(value).trim();
}

export function newTaskId(now = Date.now()) {
  return `ui-${Number(now).toString(36)}`;
}

function freshDraftTask(now = Date.now()) {
  return {
    id: newTaskId(now),
    title: '新任务',
    status: 'draft',
    mainImages: [],
    galleryImages: [],
    skuImages: [],
    demo: false,
    savedOnce: false,
    savedDraftId: '',
    savedProductId: '',
  };
}

export function markTaskSaved(task, result = {}) {
  const next = { ...(task || {}), savedOnce: true };
  if (!isSubmittedTask(task)) next.status = 'draft';
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

function sourceRow(source = {}) {
  const kind = source.kind === 'product' ? 'product' : 'draft';
  return kind === 'product' ? (source.product || source) : (source.draft || source);
}

function applySourceFields(task, source = {}) {
  const kind = source.kind === 'product' ? 'product' : 'draft';
  const binding = kind === 'product'
    ? { productId: clean(source.product?.productId || source.product?.itemId || source.productId), draftId: '' }
    : { draftId: clean(source.draftId || source.draft?.draftId), productId: clean(source.draft?.itemId || source.draft?.productId) };
  let next = kind === 'product'
    ? applyOnlineProductFields(task, source.product || source)
    : applyDraftFields(task, source.draft || {}, binding.draftId);
  next = applyDisplayImage(next, sourceRow(source));
  return { next, kind, binding };
}

export function bindSourceToTask(task, source = {}, now = Date.now()) {
  const previousId = task?.id;
  if (isSubmittedTask(task)) {
    const { next } = applySourceFields(freshDraftTask(now), source);
    return { task: next, forked: true, rotated: false, previousId };
  }
  const { next: applied, binding } = applySourceFields(task, source);
  const rotate = needsNewTaskId(task, binding);
  const next = rotate ? applySourceFields(rotateTaskIdentity(task, now), source).next : applied;
  if (!next.demo && next.status !== 'live' && !isSubmittedTask(next)) next.status = 'draft';
  return { task: next, forked: false, rotated: rotate, previousId };
}

export function applyBoundTaskToList(tasks, bound, { selectedId = null, checkedIds = [] } = {}) {
  const list = Array.isArray(tasks) ? tasks.slice() : [];
  const checked = new Set(checkedIds);
  if (bound?.forked) {
    return {
      tasks: [bound.task, ...list],
      selectedId: bound.task.id,
      checkedIds: checked,
    };
  }
  if (bound?.rotated) {
    if (bound.previousId && checked.has(bound.previousId)) {
      checked.delete(bound.previousId);
      checked.add(bound.task.id);
    }
    return {
      tasks: list.map((item) => (item.id === bound.previousId ? bound.task : item)),
      selectedId: !selectedId || selectedId === bound.previousId ? bound.task.id : selectedId,
      checkedIds: checked,
    };
  }
  const currentId = bound?.task?.id || bound?.previousId;
  return {
    tasks: list.map((item) => {
      if (item.id !== currentId && item.id !== bound?.previousId) return item;
      Object.assign(item, bound.task, { id: item.id });
      return item;
    }),
    selectedId: currentId,
    checkedIds: checked,
  };
}
