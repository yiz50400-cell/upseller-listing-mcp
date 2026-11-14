import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeShops, canRemoveShop, removeManualShop, selectionAfterRemovingShop } from '../lib/shop-list.mjs';
import { runBlockReason, realShops } from '../renderer/run-guards.mjs';

test('account shops come first and unmatched manual shops stay as fallback', () => {
  const merged = mergeShops(
    [{ id: '22', name: '22' }, { id: 's1', name: '旧店名' }],
    [{ id: 's1', name: '旗舰店', site: 'US', expired: false }],
  );
  assert.deepEqual(merged.map((s) => [s.id, s.name, s.source]), [
    ['s1', '旗舰店', 'account'],
    ['22', '22', 'manual'],
  ]);
});

test('empty or expired shops cannot be used for preview or listing', () => {
  assert.equal(runBlockReason({ form: { productId: 'P1' }, shops: [] }), '请先添加店铺。');
  assert.equal(
    runBlockReason({ form: { productId: 'P1' }, shops: [{ id: '22', name: '22', expired: true }] }),
    '这家店对不上账号里的店。请改选登录后列出的店铺。',
  );
  assert.equal(realShops([{ id: 's1', name: '旗舰店', expired: true }]).length, 0);
  assert.equal(realShops([{ id: 's1', name: '旗舰店' }]).length, 1);
});

const accountBrazil = { id: '653107', name: 'Tiktok-巴西2店 (张佳)', source: 'account' };
const accountMx14 = { id: '1088498', name: '墨西哥-14', source: 'account' };
const accountMx9 = { id: '2001', name: '墨西哥-9店', source: 'account' };
const manual22 = { id: '22', name: '22', source: 'manual' };

test('manual shops can be removed, account shops cannot', () => {
  assert.equal(canRemoveShop(manual22), true);
  assert.equal(canRemoveShop(accountMx9), false);
  assert.equal(canRemoveShop({ id: '22', name: '22', source: 'account' }), false);
  assert.equal(canRemoveShop({ id: '22', name: '22', demo: true, source: 'manual' }), false);

  const shops = [accountBrazil, accountMx14, accountMx9, manual22];
  const refused = removeManualShop(shops, accountMx9);
  assert.equal(refused.removed, null);
  assert.deepEqual(refused.shops, shops);

  const removed = removeManualShop(shops, { id: '22', name: '22' });
  assert.equal(removed.removed, manual22);
  assert.deepEqual(removed.shops.map((shop) => shop.id), ['653107', '1088498', '2001']);
  assert.deepEqual(shops.map((shop) => shop.id), ['653107', '1088498', '2001', '22']);
});

test('removing the selected manual shop clears the dropdown instead of leaving a stale value', () => {
  const shops = [accountMx9, manual22];
  const { shops: next, removed } = removeManualShop(shops, manual22);
  const cleared = selectionAfterRemovingShop({ shopId: '22', shopName: '22' }, removed);
  assert.deepEqual(cleared, { shopId: '', shopName: '' });
  assert.equal(next.some((shop) => shop.id === '22' || shop.name === '22'), false);
  const kept = selectionAfterRemovingShop({ shopId: '2001', shopName: '墨西哥-9店' }, removed);
  assert.deepEqual(kept, { shopId: '2001', shopName: '墨西哥-9店' });
});

test('removing a shop does not rewrite shop fields already stored on task rows', () => {
  const tasks = [
    { id: 'ui-old', title: '已提交的精华液', shopId: '22', shopName: '22', status: 'submitted' },
    { id: 'ui-open', title: '当前行', shopId: '22', shopName: '22', status: 'draft' },
  ];
  const snapshot = structuredClone(tasks);
  const { shops } = removeManualShop([accountMx9, manual22], manual22);
  assert.deepEqual(tasks, snapshot);
  assert.equal(shops.some((shop) => shop.id === '22'), false);
});
