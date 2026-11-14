import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { successActionToast } from '../lib/action-toast.mjs';
import { wrapFormActionResult } from '../lib/listing-service.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(root, '../renderer/app.js'), 'utf8');

const DISCLAIMER = /试用版|不宣称|平台正在处理|真机刊登/;

test('successful publish toast is exactly 已提交发布请求', () => {
  assert.equal(successActionToast('publish'), '已提交发布请求');
  assert.doesNotMatch(successActionToast('publish'), DISCLAIMER);
  assert.doesNotMatch(successActionToast('publish', { videoIgnored: true }), DISCLAIMER);
  assert.match(successActionToast('publish', { videoIgnored: true }), /^已提交发布请求/);
});

test('preview and save-draft success copy stays clear and has no disclaimer', () => {
  assert.equal(successActionToast('preview'), '预览完成，没有写入草稿，也没有发布');
  assert.equal(successActionToast('save-draft'), '已请求保存草稿，不会发布');
  for (const mode of ['preview', 'save-draft', 'publish']) {
    assert.doesNotMatch(successActionToast(mode), DISCLAIMER);
    assert.doesNotMatch(successActionToast(mode, { videoIgnored: true }), DISCLAIMER);
  }
});

test('the renderer uses the shared success toast helper and has no disclaimer copy', () => {
  assert.match(app, /successActionToast/);
  assert.doesNotMatch(app, DISCLAIMER);
  assert.doesNotMatch(app, /试用版不宣称已在真机刊登通过/);
});

test('failed actions still expose the specific reason on result.error', () => {
  const out = wrapFormActionResult({
    ok: false,
    result: { error: '源商品与目标店铺站点不同，需单独处理分类/货币' },
  }, { mode: 'publish' });
  assert.equal(out.ok, false);
  assert.equal(out.error, '这个商品和目标店不在同一个站点，不能直接保存。');
  assert.doesNotMatch(out.error, /需单独处理分类\/货币/);
});
