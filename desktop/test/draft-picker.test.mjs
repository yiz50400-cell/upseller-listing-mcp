import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterDrafts } from '../lib/draft-list.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, '../renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, '../renderer/app.js'), 'utf8');

test('the form lists drafts as the primary path and keeps a quiet manual id fallback', () => {
  assert.match(html, /id="f-draft"/);
  assert.match(html, /id="f-draftShop"/);
  assert.match(html, /id="loadDraftBtn"/);
  assert.match(html, /id="f-productId"/);
  assert.doesNotMatch(html, /field-hint/);
  assert.doesNotMatch(html, /会拉取 Upseller 里已有的草稿，请填写那边的草稿编号/);
  assert.doesNotMatch(html, /登录后会自动列出账号里的店，请从列表里点选。手填名称或编号只是备用办法/);
  assert.match(app, /listDrafts/);
  assert.match(app, /applyDraftFields/);
  assert.match(app, /findShopOption/);
});

test('filterDrafts can narrow the account draft list by shop', () => {
  const drafts = [
    { draftId: '1', shopId: '1088498', title: 'MX' },
    { draftId: '2', shopId: '653107', title: 'BR' },
  ];
  assert.deepEqual(filterDrafts(drafts, '').map((row) => row.draftId), ['1', '2']);
  assert.deepEqual(filterDrafts(drafts, '1088498').map((row) => row.draftId), ['1']);
});
