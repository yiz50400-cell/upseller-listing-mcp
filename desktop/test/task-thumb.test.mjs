import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstDisplayImage } from '../lib/picker-view.mjs';
import {
  applyDisplayImage,
  taskListImageSrc,
  taskListThumbHtml,
} from '../lib/task-thumb.mjs';
import { bindSourceToTask } from '../lib/task-bind.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, '../renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, '../renderer/app.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, '../lib/task-builder.mjs'), 'utf8');

test('loading a pictured draft or product exposes a list display URL without writing mainImages', () => {
  const draftBound = bindSourceToTask({ id: 'ui-1', status: 'draft', mainImages: [] }, {
    kind: 'draft',
    draftId: 'D-1',
    draft: { itemTitle: 'Serum', thumbnail: 'https://cdn.example.com/serum.jpg' },
  }, 1);
  assert.equal(firstDisplayImage(draftBound.task), '');
  assert.equal(draftBound.task.displayImageUrl, 'https://cdn.example.com/serum.jpg');
  assert.deepEqual(draftBound.task.mainImages, []);
  assert.equal(taskListImageSrc(draftBound.task), 'https://cdn.example.com/serum.jpg');
  assert.match(taskListThumbHtml(draftBound.task), /<img class="thumb" src="https:\/\/cdn\.example\.com\/serum\.jpg"/);

  const productBound = bindSourceToTask({ id: 'ui-2', status: 'draft', mainImages: [] }, {
    kind: 'product',
    product: { productId: 'P-1', title: 'Paste', imageUrl: 'https://cdn.example.com/paste.jpg' },
  }, 2);
  assert.equal(productBound.task.displayImageUrl, 'https://cdn.example.com/paste.jpg');
  assert.deepEqual(productBound.task.mainImages, []);
  assert.equal(taskListImageSrc(productBound.task), 'https://cdn.example.com/paste.jpg');
});

test('applyDisplayImage does not copy a remote URL into mainImages', () => {
  const next = applyDisplayImage({ id: 'ui-3', mainImages: [] }, { coverUrl: 'https://cdn.example.com/cover.jpg' });
  assert.equal(next.displayImageUrl, 'https://cdn.example.com/cover.jpg');
  assert.deepEqual(next.mainImages, []);
  assert.notEqual(next.mainImages[0], next.displayImageUrl);
});

test('a row without a usable image still uses the 图 placeholder', () => {
  const bound = bindSourceToTask({ id: 'ui-4', status: 'draft', mainImages: [] }, {
    kind: 'draft',
    draftId: 'D-empty',
    draft: { itemTitle: 'No photo' },
  }, 3);
  assert.equal(bound.task.displayImageUrl, '');
  assert.equal(taskListImageSrc(bound.task), '');
  assert.equal(taskListThumbHtml(bound.task), '<div class="thumb ph">图</div>');
  assert.equal(taskListThumbHtml({ title: 'also empty' }), '<div class="thumb ph">图</div>');
});

test('a locally uploaded main image is used in the list and remote display URLs stay out of mainImages', () => {
  const task = {
    displayImageUrl: 'https://cdn.example.com/remote.jpg',
    mainImages: ['/tmp/local-main.jpg'],
  };
  assert.equal(taskListImageSrc(task), '/tmp/local-main.jpg');
  assert.match(taskListThumbHtml(task, (file) => 'file://' + file), /src="file:\/\/\/tmp\/local-main\.jpg"/);
  assert.equal(task.mainImages[0].startsWith('https://'), false);
});

test('the copy-to-N-shops number field is gone and leftover counts cannot copy to extra shops', () => {
  assert.doesNotMatch(html, /复制到几店/);
  assert.doesNotMatch(html, /f-copyCount/);
  assert.doesNotMatch(app, /f-copyCount/);
  assert.doesNotMatch(app, /copyToShopCount/);
  assert.match(builder, /Leftover copyToShopCount/);
  assert.doesNotMatch(builder, /Math\.max\(1, Number\(copyToShopCount\)/);
});
