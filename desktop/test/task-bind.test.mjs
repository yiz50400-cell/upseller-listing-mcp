import test from 'node:test';
import assert from 'node:assert/strict';
import {
  needsNewTaskId,
  rotateTaskIdentity,
  markTaskSaved,
  applyOnlineProductFields,
  bindSourceToTask,
  applyBoundTaskToList,
} from '../lib/task-bind.mjs';
import { applyDraftFields } from '../lib/draft-form.mjs';
import { isSubmittedTask, statusLabel, statusAfterSuccessfulAction } from '../lib/status-badge.mjs';
import { taskListImageSrc } from '../lib/task-thumb.mjs';

const draftA = { draftId: '14926559893399425', title: 'SADOER A', shopId: '1088498', shopName: '墨西哥-14' };
const draftB = { draftId: '999888777', title: 'SADOER B', shopId: '2001', shopName: '墨西哥-9店', itemId: '' };
const productB = { productId: 'P-ONLINE-2', title: 'Online Case', shopId: '2001', shopName: '墨西哥-9店', price: '286', currency: 'MXN', site: 'MX' };

test('after a successful save of draft A, selecting draft B assigns a new taskId', () => {
  const saved = markTaskSaved({
    id: 'ui-mwcys2kc',
    ...draftA,
    productId: '',
    status: 'draft',
  }, { draftId: draftA.draftId });
  assert.equal(saved.savedDraftId, draftA.draftId);
  assert.equal(needsNewTaskId(saved, { draftId: draftB.draftId }), true);

  const bound = bindSourceToTask(saved, { kind: 'draft', draft: draftB, draftId: draftB.draftId }, 1_700_000_000_000);
  assert.equal(bound.rotated, true);
  assert.notEqual(bound.task.id, 'ui-mwcys2kc');
  assert.equal(bound.previousId, 'ui-mwcys2kc');
  assert.equal(bound.task.draftId, draftB.draftId);
  assert.equal(bound.task.savedDraftId, '');
  assert.equal(bound.task.productId, '');
  assert.match(bound.task.id, /^ui-/);
});

test('after a successful save of draft A, selecting an online product also assigns a new taskId', () => {
  const saved = markTaskSaved({ id: 'ui-mwcys2kc', ...draftA }, { draftId: draftA.draftId });
  assert.equal(needsNewTaskId(saved, { productId: productB.productId }), true);
  const bound = bindSourceToTask(saved, { kind: 'product', product: productB }, 1_700_000_000_123);
  assert.equal(bound.rotated, true);
  assert.notEqual(bound.task.id, 'ui-mwcys2kc');
  assert.equal(bound.task.draftId, '');
  assert.equal(bound.task.productId, 'P-ONLINE-2');
  assert.equal(bound.task.title, 'Online Case');
});

test('an unsaved new row binds the selection without rotating the taskId', () => {
  const fresh = { id: 'ui-newrow', title: '新任务', status: 'draft' };
  assert.equal(needsNewTaskId(fresh, { draftId: draftA.draftId }), false);
  const bound = bindSourceToTask(fresh, {
    kind: 'draft',
    draft: { itemTitle: draftA.title, shopId: draftA.shopId, shopName: draftA.shopName, itemId: '' },
    draftId: draftA.draftId,
  }, 1);
  assert.equal(bound.rotated, false);
  assert.equal(bound.task.id, 'ui-newrow');
  assert.equal(bound.task.draftId, draftA.draftId);
  assert.equal(bound.task.title, draftA.title);
});

test('re-selecting the same saved draft does not rotate, so it can load again', () => {
  const saved = markTaskSaved({ id: 'ui-mwcys2kc', ...draftA }, { draftId: draftA.draftId });
  assert.equal(needsNewTaskId(saved, { draftId: draftA.draftId }), false);
  const bound = bindSourceToTask(saved, {
    kind: 'draft',
    draft: { itemTitle: draftA.title, shopId: draftA.shopId, shopName: draftA.shopName, itemId: '' },
    draftId: draftA.draftId,
  }, 99);
  assert.equal(bound.rotated, false);
  assert.equal(bound.task.id, 'ui-mwcys2kc');
  assert.equal(bound.task.draftId, draftA.draftId);
});

test('applyOnlineProductFields copies display fields, clears draftId, and does not set a draft load id', () => {
  const next = applyOnlineProductFields({
    id: 'ui-1',
    draftId: '14926559893399425',
    productId: '',
    title: '旧草稿标题',
    shopId: '1088498',
    shopName: '墨西哥-14',
    price: '228',
  }, productB);
  assert.equal(next.draftId, '');
  assert.equal(next.productId, 'P-ONLINE-2');
  assert.equal(next.title, 'Online Case');
  assert.equal(next.price, '286');
  assert.equal(next.currency, 'MXN');
  assert.equal(next.site, 'MX');
  assert.equal(next.shopId, '1088498');
  assert.equal(next.shopName, '墨西哥-14');
  assert.equal(next.sourceShopHint, '2001');
});

test('rotateTaskIdentity issues a new id and drops saved binding without rewriting receipts', () => {
  const rotated = rotateTaskIdentity({ id: 'ui-old', savedDraftId: 'A', savedOnce: true, title: 'keep title' }, 1_700_000_000_456);
  assert.equal(rotated.id, 'ui-loyw3vew');
  assert.equal(rotated.savedDraftId, '');
  assert.equal(rotated.savedOnce, false);
  assert.equal(rotated.title, 'keep title');
});

test('bindSourceToTask uses applyDraftFields for drafts so unpublished itemId clears productId', () => {
  const saved = markTaskSaved({
    id: 'ui-1',
    draftId: 'A',
    productId: 'OLD',
    savedDraftId: 'A',
    savedOnce: true,
  }, { draftId: 'A' });
  const bound = bindSourceToTask(saved, {
    kind: 'draft',
    draftId: 'B',
    draft: { itemId: '', itemTitle: 'New draft' },
  }, 2);
  const applied = applyDraftFields(bound.task, { itemId: '', itemTitle: 'New draft' }, 'B');
  assert.equal(applied.productId, '');
  assert.equal(bound.task.productId, '');
});

function submittedRow(status = 'submitted') {
  return {
    id: 'ui-mwerr2uc',
    title: 'Sérum Facial SADOER com Niacinamida',
    shopName: '墨西哥-14',
    shopId: '1088498',
    site: 'BR',
    price: '88',
    currency: 'BRL',
    status,
    draftId: '1737515268040591253',
    productId: '1737515268040591253',
    displayImageUrl: 'https://cdn.example.com/serum.jpg',
    mainImages: [],
    galleryImages: [],
    skuImages: [],
    receiptId: 'rec-serum',
    lastResult: { ok: true, requestId: 'req-1' },
  };
}

test('changing product on a submitted row adds a new draft row and leaves every old field unchanged', () => {
  const submitted = submittedRow('submitted');
  const snapshot = structuredClone(submitted);
  const bound = bindSourceToTask(submitted, {
    kind: 'draft',
    draft: { ...draftB, itemTitle: draftB.title, thumbnail: 'https://cdn.example.com/paste.jpg' },
    draftId: draftB.draftId,
  }, 1_700_000_000_000);
  assert.equal(bound.forked, true);
  assert.equal(bound.rotated, false);
  assert.deepEqual(submitted, snapshot);
  const list = applyBoundTaskToList([submitted], bound, { selectedId: submitted.id, checkedIds: [submitted.id] });
  assert.equal(list.tasks.length, 2);
  assert.equal(list.tasks[1], submitted);
  assert.deepEqual(list.tasks[1], snapshot);
  assert.equal(list.selectedId, bound.task.id);
  assert.ok(list.checkedIds.has('ui-mwerr2uc'));
  assert.equal(list.checkedIds.has(bound.task.id), false);
  assert.notEqual(bound.task.id, 'ui-mwerr2uc');
  assert.equal(bound.task.status, 'draft');
  assert.equal(statusLabel(bound.task), '草稿');
  assert.equal(bound.task.title, draftB.title);
  assert.equal(bound.task.shopName, '墨西哥-9店');
  assert.equal(bound.task.draftId, draftB.draftId);
  assert.equal(bound.task.displayImageUrl, 'https://cdn.example.com/paste.jpg');
  assert.deepEqual(bound.task.mainImages, []);
  assert.equal(bound.task.receiptId, undefined);
  assert.equal(bound.task.lastResult, undefined);
  assert.equal(statusLabel(list.tasks[1]), '已提交');
});

test('a historical wait row also forks a new draft instead of overwriting the submitted row', () => {
  const waiting = submittedRow('wait');
  const snapshot = structuredClone(waiting);
  const bound = bindSourceToTask(waiting, { kind: 'product', product: { ...productB, imageUrl: 'https://cdn.example.com/online.jpg' } }, 1_700_000_000_321);
  assert.equal(isSubmittedTask(waiting), true);
  assert.equal(bound.forked, true);
  assert.equal(bound.rotated, false);
  assert.deepEqual(waiting, snapshot);
  const list = applyBoundTaskToList([waiting], bound);
  assert.equal(list.tasks.length, 2);
  assert.deepEqual(list.tasks[1], snapshot);
  assert.equal(list.tasks[1].status, 'wait');
  assert.equal(statusLabel(list.tasks[1]), '已提交');
  assert.equal(bound.task.status, 'draft');
  assert.equal(bound.task.productId, productB.productId);
  assert.equal(bound.task.title, productB.title);
  assert.equal(bound.task.displayImageUrl, 'https://cdn.example.com/online.jpg');
  assert.deepEqual(bound.task.mainImages, []);
  assert.notEqual(bound.task.id, waiting.id);
});

test('changing product on a draft row stays on the same row and remains a draft', () => {
  const draft = { id: 'ui-draft-row', title: '新任务', status: 'draft', mainImages: [] };
  const bound = bindSourceToTask(draft, {
    kind: 'draft',
    draft: { itemTitle: draftA.title, shopId: draftA.shopId, shopName: draftA.shopName, thumbnail: 'https://cdn.example.com/a.jpg' },
    draftId: draftA.draftId,
  }, 7);
  assert.equal(bound.forked, false);
  assert.equal(bound.rotated, false);
  assert.equal(bound.task.id, 'ui-draft-row');
  assert.equal(bound.task.status, 'draft');
  assert.equal(statusLabel(bound.task), '草稿');
  const list = applyBoundTaskToList([draft], bound, { selectedId: draft.id });
  assert.equal(list.tasks.length, 1);
  assert.equal(list.tasks[0].id, 'ui-draft-row');
  assert.equal(list.tasks[0].status, 'draft');
  assert.equal(list.selectedId, 'ui-draft-row');
});

test('a saved draft row still rotates in place and does not fork a second visible row', () => {
  const saved = markTaskSaved({ id: 'ui-mwcys2kc', ...draftA, status: 'draft' }, { draftId: draftA.draftId });
  const bound = bindSourceToTask(saved, { kind: 'draft', draft: draftB, draftId: draftB.draftId }, 1_700_000_000_000);
  assert.equal(bound.forked, false);
  assert.equal(bound.rotated, true);
  assert.equal(bound.task.status, 'draft');
  const list = applyBoundTaskToList([saved], bound, { selectedId: saved.id });
  assert.equal(list.tasks.length, 1);
  assert.equal(list.tasks[0].id, bound.task.id);
  assert.notEqual(list.tasks[0].id, 'ui-mwcys2kc');
  assert.equal(list.selectedId, bound.task.id);
});

test('preview and save-draft keep submitted and wait rows submitted', () => {
  assert.equal(statusAfterSuccessfulAction('preview', 'submitted'), 'submitted');
  assert.equal(statusAfterSuccessfulAction('preview', 'wait'), 'wait');
  assert.equal(statusAfterSuccessfulAction('save-draft', 'submitted'), 'submitted');
  assert.equal(statusAfterSuccessfulAction('save-draft', 'wait'), 'wait');
  const submitted = markTaskSaved(submittedRow('submitted'), { draftId: '1737515268040591253' });
  assert.equal(submitted.status, 'submitted');
  assert.equal(statusLabel(submitted), '已提交');
  const waiting = markTaskSaved(submittedRow('wait'), { draftId: '1737515268040591253' });
  assert.equal(waiting.status, 'wait');
  assert.equal(statusLabel(waiting), '已提交');
});

test('demo and live rows are not treated as submitted and do not overwrite a submitted row', () => {
  assert.equal(isSubmittedTask({ demo: true, status: 'wait' }), false);
  assert.equal(isSubmittedTask({ demo: true, status: 'submitted' }), false);
  assert.equal(isSubmittedTask({ status: 'live' }), false);
  assert.equal(isSubmittedTask({ status: 'draft' }), false);
  const demo = { id: 't-demo-2', demo: true, status: 'wait', title: '智能手表 Lite' };
  const bound = bindSourceToTask(demo, { kind: 'draft', draft: draftA, draftId: draftA.draftId }, 3);
  assert.equal(bound.forked, false);
  assert.equal(bound.task.demo, true);
  assert.equal(statusLabel(bound.task), '示例');
  const submitted = submittedRow('submitted');
  const snapshot = structuredClone(submitted);
  const list = applyBoundTaskToList([submitted], bound);
  assert.equal(list.tasks.length, 1);
  assert.deepEqual(list.tasks[0], snapshot);
});

test('loading a pictured source stores a display URL for the list and does not write it into mainImages', () => {
  const bound = bindSourceToTask({ id: 'ui-newrow', title: '新任务', status: 'draft', mainImages: [] }, {
    kind: 'product',
    product: { ...productB, thumbnail: 'https://cdn.example.com/online.jpg' },
  }, 8);
  assert.equal(bound.task.displayImageUrl, 'https://cdn.example.com/online.jpg');
  assert.deepEqual(bound.task.mainImages, []);
  assert.equal(taskListImageSrc(bound.task), 'https://cdn.example.com/online.jpg');
});
