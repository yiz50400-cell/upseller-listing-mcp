import test from 'node:test';
import assert from 'node:assert/strict';
import {
  needsNewTaskId,
  rotateTaskIdentity,
  markTaskSaved,
  applyOnlineProductFields,
  bindSourceToTask,
} from '../lib/task-bind.mjs';
import { applyDraftFields } from '../lib/draft-form.mjs';

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
