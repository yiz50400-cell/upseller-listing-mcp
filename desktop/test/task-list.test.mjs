import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureTaskList,
  deleteTasks,
  createProduct,
  nextSelectedId,
  visibleTasks,
} from '../renderer/task-list.mjs';
import { buildLoginWindowOptions } from '../lib/login-window-options.mjs';

const demos = [
  { id: 't-demo-1', title: '无线降噪耳机 Pro', demo: true },
  { id: 't-demo-2', title: '智能手表 Lite', demo: true },
];

test('empty list seeds demo products once, then keeps deletions', () => {
  const first = ensureTaskList({ tasks: [], settings: {} }, demos);
  assert.equal(first.seeded, true);
  assert.equal(first.tasks.length, 2);
  assert.equal(first.settings.taskListInitialized, true);
  assert.equal(first.tasks[0].title, '无线降噪耳机 Pro');

  const afterDelete = deleteTasks(first.tasks, ['t-demo-1', 't-demo-2']);
  assert.deepEqual(afterDelete, []);
  const again = ensureTaskList({ tasks: afterDelete, settings: first.settings }, demos);
  assert.equal(again.seeded, false);
  assert.deepEqual(again.tasks, []);
});

test('demo rows can be deleted one at a time and add product keeps the rest', () => {
  const seeded = ensureTaskList({ tasks: [], settings: {} }, demos);
  const left = deleteTasks(seeded.tasks, ['t-demo-1']);
  assert.equal(left.length, 1);
  assert.equal(left[0].id, 't-demo-2');
  const added = createProduct(1);
  const next = [added, ...left];
  assert.equal(next[0].title, '新任务');
  assert.equal(next[0].demo, false);
  assert.equal(next[1].id, 't-demo-2');
  assert.equal(visibleTasks(next, '手表')[0].id, 't-demo-2');
  assert.equal(nextSelectedId(next, ['t-demo-1'], 't-demo-1'), added.id);
});

test('login window is independent and does not attach to the main window', () => {
  const options = buildLoginWindowOptions(undefined);
  assert.equal('parent' in options, false);
  assert.equal(options.show, true);
  assert.equal(options.title, '登录 Upseller');
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.sandbox, true);
});
