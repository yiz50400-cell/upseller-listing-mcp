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
