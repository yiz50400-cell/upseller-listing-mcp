import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapFormActionResult } from '../lib/listing-service.mjs';

test('a failed action exposes the human-readable reason on result.error', () => {
  const out = wrapFormActionResult({
    ok: false,
    stage: 'needs-reconciliation',
    error: '任务 ID 已用于不同内容；如需新建商品请使用新的任务 ID',
  }, { mode: 'publish' });
  assert.equal(out.ok, false);
  assert.equal(out.mode, 'publish');
  assert.equal(out.error, '任务 ID 已用于不同内容；如需新建商品请使用新的任务 ID');
});

test('a nested result.error is lifted to the top-level error field', () => {
  const out = wrapFormActionResult({
    ok: false,
    result: { error: '源商品与目标店铺站点不同，需单独处理分类/货币' },
  }, { mode: 'save-draft' });
  assert.equal(out.ok, false);
  assert.equal(out.error, '源商品与目标店铺站点不同，需单独处理分类/货币');
});
