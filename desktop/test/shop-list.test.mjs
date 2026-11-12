import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeShops } from '../lib/shop-list.mjs';
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
