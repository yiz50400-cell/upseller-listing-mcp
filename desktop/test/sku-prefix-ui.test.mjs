import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildListingTasks } from '../lib/task-builder.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, '../renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, '../renderer/app.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, '../lib/task-builder.mjs'), 'utf8');

test('the form no longer shows a SKU prefix field, but keeps draft id load', () => {
  assert.doesNotMatch(html, /SKU 前缀/);
  assert.doesNotMatch(html, /f-skuPrefix/);
  assert.doesNotMatch(app, /f-skuPrefix/);
  assert.doesNotMatch(app, /SKU: /);
  assert.doesNotMatch(app, /skuPrefix/);
  assert.match(html, /草稿编号/);
  assert.match(html, /id="f-draftIdManual"/);
  assert.match(html, /id="loadDraftBtn"/);
  assert.match(app, /f-draftIdManual/);
  assert.match(builder, /Leftover form\.skuPrefix/);
});

test('leftover skuPrefix on a form is not sent to the listing task', () => {
  const out = buildListingTasks({
    productId: 'P-100',
    skuPrefix: 'OLD-PREFIX',
    shopName: '墨西哥-14',
    shopId: '1088498',
    taskId: 'ui-sku',
  }, [{ id: '1088498', name: '墨西哥-14' }]);
  assert.equal(out.tasks.length, 1);
  assert.equal('skuPrefix' in out.tasks[0], false);
});

test('the task list shows product id rather than a SKU prefix label', () => {
  assert.match(app, /escapeHtml\(t\.productId \|\| ''\)/);
  assert.doesNotMatch(app, /SKU: ' \+ t\.skuPrefix/);
});
