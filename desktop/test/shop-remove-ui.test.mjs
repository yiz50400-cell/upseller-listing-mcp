import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, '../renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, '../renderer/app.js'), 'utf8');

test('the shop field has a delete control next to the dropdown', () => {
  assert.match(html, /id="f-shop"/);
  assert.match(html, /id="removeShopBtn"/);
  assert.match(html, /删除店铺/);
  const shopField = html.slice(html.indexOf('目标店铺'), html.indexOf('shopAddRow'));
  assert.match(shopField, /id="removeShopBtn"/);
  assert.match(shopField, /id="refreshShopsBtn"/);
  assert.match(shopField, /手动添加/);
});

test('the renderer only removes manual shops and clears a stale selected value', () => {
  assert.match(app, /canRemoveShop/);
  assert.match(app, /removeManualShop/);
  assert.match(app, /removeShopBtn/);
  assert.match(app, /missingSelection: 'empty'/);
  assert.match(app, /shopSel\.value = match \? match.value : ''/);
  assert.doesNotMatch(app, /upseller_delete_shop|deleteShop\(/);
  const handlerStart = app.indexOf("$('removeShopBtn').addEventListener");
  assert.ok(handlerStart >= 0, 'remove shop handler is defined');
  const handler = app.slice(handlerStart, handlerStart + 800);
  assert.match(handler, /saveState\(\{ shops: state\.shops \}\)/);
  assert.doesNotMatch(handler, /persistTasks/);
  assert.doesNotMatch(handler, /shopId:\s*''/);
  assert.doesNotMatch(handler, /tasks\.map/);
});
