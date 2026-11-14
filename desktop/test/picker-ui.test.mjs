import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { draftPickerLabel, productPickerLabel, filterListedItems, firstDisplayImage, pickerThumbHtml } from '../lib/picker-view.mjs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(rootDir, '../renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(rootDir, '../renderer/app.js'), 'utf8');
const css = fs.readFileSync(path.join(rootDir, '../renderer/styles.css'), 'utf8');

test('the form has two separate entry points for drafts and online products', () => {
  assert.match(html, /从草稿箱选择/);
  assert.match(html, /复制在线商品/);
  assert.match(html, /id="openDraftPickerBtn"/);
  assert.match(html, /id="openProductPickerBtn"/);
  assert.match(html, /id="pickerModal"/);
  assert.doesNotMatch(html, /id="f-draft"(?![A-Za-z0-9])/);
  assert.doesNotMatch(html, /产品编号或草稿编号/);
  assert.doesNotMatch(html, /field-hint/);
  assert.match(html, /id="loadDraftBtn"/);
  assert.match(html, /id="f-draftIdManual"/);
  assert.match(html, /placeholder="草稿编号"/);
});

test('a new unsaved row does not keep the previous draft display name', () => {
  assert.equal(draftPickerLabel({ title: '新任务' }), '');
  assert.equal(draftPickerLabel({ title: 'SADOER Suero Nutritivo para Pestañas – Esencia Cuidado', draftId: '' }), '');
  assert.equal(draftPickerLabel({ draftId: '14926559893399425', title: 'SADOER Suero' }), 'SADOER Suero');
  assert.equal(productPickerLabel({ title: '新任务' }), '');
  assert.equal(productPickerLabel({ draftId: '14926559893399425', productId: 'x', title: 'Draft title' }), '');
  assert.equal(productPickerLabel({ productId: 'P-1', draftId: '', title: 'Online Case' }), 'Online Case');
});

test('filterListedItems searches by title or id and can filter by shop', () => {
  const rows = [
    { draftId: '111', productId: '', title: 'SADOER Suero Nutritivo', shopId: '1088498', shopName: '墨西哥-14', price: 228 },
    { draftId: '222', productId: '', title: 'Funda de celular', shopId: '2001', shopName: '墨西哥-9店', price: 286 },
    { productId: 'P-9', title: 'Amplificador Wifi', shopId: '2001', shopName: '墨西哥-9店', price: 100 },
  ];
  assert.deepEqual(filterListedItems(rows, { query: 'Suero' }).map((row) => row.draftId), ['111']);
  assert.deepEqual(filterListedItems(rows, { query: '111' }).map((row) => row.draftId), ['111']);
  assert.deepEqual(filterListedItems(rows, { query: 'P-9' }).map((row) => row.productId), ['P-9']);
  assert.deepEqual(filterListedItems(rows, { shopId: '2001' }).map((row) => row.draftId || row.productId), ['222', 'P-9']);
});

test('the renderer opens a list picker rather than a native select, and re-picking the same item still loads', () => {
  assert.match(app, /openDraftPickerBtn/);
  assert.match(app, /openProductPickerBtn/);
  assert.match(app, /picker-row/);
  assert.match(css, /picker-title/);
  assert.doesNotMatch(app, /task\.draftId \|\| select\.value/);
  assert.doesNotMatch(app, /f-draft"\)\.addEventListener\('change'/);
  assert.match(app, /bindSourceToTask/);
  assert.match(app, /pickerRows[\s\S]{0,400}click/);
});

test('the online product path does not call loadDraft', () => {
  assert.match(app, /bindOnlineProduct/);
  assert.match(app, /kind:\s*'product'/);
  const loadDraftCallSites = [...app.matchAll(/api\.loadDraft/g)];
  assert.ok(loadDraftCallSites.length >= 1);
  for (const match of loadDraftCallSites) {
    const around = app.slice(Math.max(0, match.index - 240), match.index + 80);
    assert.doesNotMatch(around, /bindOnlineProduct|openProductPicker|listProducts/);
  }
  const start = app.indexOf('async function bindOnlineProduct');
  assert.ok(start >= 0, 'bindOnlineProduct is defined');
  const end = app.indexOf('\nasync function', start + 10);
  const fn = app.slice(start, end > start ? end : start + 2000);
  assert.doesNotMatch(fn, /loadDraft\(/);
});

test('picker rows show a thumbnail, full title, shop and price, and allow wrapping the title', () => {
  assert.match(app, /picker-title/);
  assert.match(css, /\.picker-title[^{]*\{[^}]*white-space:\s*normal/);
  assert.doesNotMatch(css, /#f-draft\s*\{/);
  assert.match(html, /img-src[^"]*https:/);
});

test('firstDisplayImage uses a real image URL when the list item has one, otherwise stays empty', () => {
  assert.equal(firstDisplayImage({ thumbnail: 'https://cdn.example.com/a.jpg' }), 'https://cdn.example.com/a.jpg');
  assert.equal(firstDisplayImage({ imgUrl: 'https://cdn.example.com/a.jpg|https://cdn.example.com/b.jpg' }), 'https://cdn.example.com/a.jpg');
  assert.equal(firstDisplayImage({ image: { url: 'https://cdn.example.com/obj.jpg' } }), 'https://cdn.example.com/obj.jpg');
  assert.equal(firstDisplayImage({ images: ['//cdn.example.com/proto.jpg'] }), 'https://cdn.example.com/proto.jpg');
  assert.equal(firstDisplayImage({ title: 'No photo' }), '');
});

test('picker thumbnails render an img when a URL exists and the placeholder only when it does not', () => {
  assert.match(pickerThumbHtml({ thumbnail: 'https://cdn.example.com/a.jpg' }), /<img class="thumb" src="https:\/\/cdn\.example\.com\/a\.jpg"/);
  assert.match(pickerThumbHtml({ title: 'No photo' }), /<div class="thumb ph">图<\/div>/);
  assert.doesNotMatch(pickerThumbHtml({ title: 'No photo' }), /<img /);
  assert.match(app, /pickerThumbHtml|firstDisplayImage/);
});
