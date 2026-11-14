import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyErrorMessage, safeError } from '../lib/sanitize.mjs';
import { toggleId, setAll, allChecked, someChecked } from '../lib/selection.mjs';

test('Playwright missing-browser errors become one plain Chinese sentence', () => {
  const err = new Error(
    "browserType.launch: Executable doesn't exist at /Users/Admin/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium\n"
    + '╔════════════════════════════════════════════════════════════════╗\n'
    + '    at Object.login (/tmp/app/node_modules/playwright/lib/x.js:12:3)\n'
    + 'Please run npx playwright install'
  );
  const msg = friendlyErrorMessage(err);
  assert.match(msg, /打不开登录窗口/);
  assert.equal(msg.includes('npx'), false);
  assert.equal(msg.includes('playwright'), false);
  assert.equal(msg.includes('/Users/'), false);
  assert.equal(msg.includes('chromium-1194'), false);
  const wrapped = safeError(err);
  assert.equal(wrapped.ok, false);
  assert.equal(wrapped.error, msg);
});

test('timeout and missing DeviceId stay short and Chinese', () => {
  assert.equal(
    friendlyErrorMessage(new Error('等待登录超时：请在弹出的浏览器中登录 Upseller 后重试（保持窗口完成登录）')).includes('超时'),
    true
  );
  assert.match(friendlyErrorMessage(new Error('已捕获 Cookie，但仍缺少 DeviceId：请在已打开的页面稍作操作')), /还差一步/);
});

test('task checkbox helpers toggle, select-all, and clear', () => {
  let ids = new Set();
  ids = toggleId(ids, 'a');
  ids = toggleId(ids, 'b');
  assert.deepEqual([...ids].sort(), ['a', 'b']);
  ids = toggleId(ids, 'a');
  assert.deepEqual([...ids], ['b']);
  const visible = ['a', 'b', 'c'];
  ids = setAll(ids, visible, true);
  assert.equal(allChecked(ids, visible), true);
  ids = setAll(ids, visible, false);
  assert.equal(someChecked(ids, visible), false);
});

test('keeps a clear Chinese reason even when a later stack looks technical', () => {
  const err = new Error('请填写产品ID或草稿ID\n    at runFormAction (file:///Users/Admin/app/lib/listing-service.mjs:90:11)');
  assert.equal(friendlyErrorMessage(err), '请填写产品ID。');
  assert.equal(friendlyErrorMessage(new Error('示意商品不能预览或上架，请先添加真实产品并填写产品ID。')), '示意商品不能预览或上架，请先添加真实产品并填写产品ID。');
  assert.equal(friendlyErrorMessage(new Error('请先在「店铺」页添加目标店铺后再预览或上架。')), '请先添加店铺。');
  assert.equal(friendlyErrorMessage(new Error('尚未登录。请先在「设置」中登录 Upseller（成功只回长度，不回显凭证）。')), '还没有登录，请先到「设置」里登录。');
  assert.equal(friendlyErrorMessage(new Error('登录已失效，HTTP 401 at /Users/foo/bar.mjs')), '请重新登录。');
});

test('maps draft lookup and shop mismatch into clear Chinese', () => {
  assert.equal(
    friendlyErrorMessage(new Error('edit response missing data')),
    '找不到这份草稿。请填写 Upseller 里已有草稿的编号。',
  );
  assert.equal(
    friendlyErrorMessage(new Error('API code=400 msg=product not found path=/api/tiktok/product/edit')),
    '找不到这份草稿。请填写 Upseller 里已有草稿的编号。',
  );
  assert.equal(
    friendlyErrorMessage(new Error('HTTP 404 for /api/tiktok/product/edit')),
    '找不到这份草稿。请填写 Upseller 里已有草稿的编号。',
  );
  assert.equal(friendlyErrorMessage(new Error('draftId is required')), '请填写正确的草稿编号。');
  assert.equal(
    friendlyErrorMessage(new Error('目标店铺未授权、已过期或名称不唯一')),
    '这家店对不上账号里的店。请改选登录后列出的店铺。',
  );
  assert.equal(friendlyErrorMessage(new Error('请先添加真实店铺。')), '请先添加店铺。');
  assert.equal(friendlyErrorMessage(new Error('fetch failed')), '网络不通，请检查网络后再试。');
  assert.equal(friendlyErrorMessage(new Error('Invalid JSON API envelope; login may have expired')), '请重新登录。');
  assert.equal(
    friendlyErrorMessage(new Error('源商品未找到或存在多店同 ID，请填写 sourceInternalId/sourceShopHint')),
    '找不到这个产品。请填写正确的产品ID。',
  );
  const chineseApi = friendlyErrorMessage(new Error('API code=1 msg=库存不足 path=/api/tiktok/product/add'));
  assert.equal(chineseApi, '库存不足。');
});

test('a raw task-id mismatch is rewritten so the toast never mentions 任务 ID', () => {
  const msg = friendlyErrorMessage(new Error('任务 ID 已用于不同内容；如需新建商品请使用新的任务 ID'));
  assert.doesNotMatch(msg, /任务 ID/);
  assert.match(msg, /已保存|再选|不同/);
});

test('legacy site-mismatch errors become plain language and drop the old jargon', () => {
  assert.equal(
    friendlyErrorMessage(new Error('源商品与目标店铺站点不同，需单独处理分类/货币')),
    '这个商品和目标店不在同一个站点，不能直接保存。',
  );
  assert.doesNotMatch(
    friendlyErrorMessage(new Error('源商品与目标店铺站点不同，需单独处理分类/货币')),
    /需单独处理分类\/货币/,
  );
  const named = '这个商品是巴西站的，不能直接保存到墨西哥店。';
  assert.equal(friendlyErrorMessage(new Error(named)), named);
  assert.doesNotMatch(named, /需单独处理分类\/货币/);
});
