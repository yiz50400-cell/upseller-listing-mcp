import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusLabel, statusBadge, statusAfterSuccessfulAction } from '../lib/status-badge.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(root, '../renderer/app.js'), 'utf8');

test('after a successful publish request the status text is 已提交, not 待发布', () => {
  assert.equal(statusAfterSuccessfulAction('publish', 'draft'), 'submitted');
  const task = { status: statusAfterSuccessfulAction('publish', 'draft') };
  assert.equal(statusLabel(task), '已提交');
  assert.equal(statusBadge(task).includes('已提交'), true);
  assert.equal(statusBadge(task).includes('待发布'), false);
  assert.match(statusBadge(task), /badge wait/);
});

test('a historical post-publish wait row also shows 已提交 and not 待发布', () => {
  assert.equal(statusLabel({ status: 'wait' }), '已提交');
  assert.doesNotMatch(statusBadge({ status: 'wait' }), /待发布/);
  assert.match(statusBadge({ status: 'wait' }), /已提交/);
});

test('draft, live, and demo statuses are not relabeled as 已提交', () => {
  assert.equal(statusLabel({ status: 'draft' }), '草稿');
  assert.equal(statusLabel({ status: 'draft', draftId: '14926559893399425' }), '草稿');
  assert.equal(statusAfterSuccessfulAction('save-draft', 'draft'), 'draft');
  assert.equal(statusAfterSuccessfulAction('preview', 'draft'), 'draft');
  assert.equal(statusLabel({ status: statusAfterSuccessfulAction('save-draft', 'draft') }), '草稿');
  assert.equal(statusLabel({ status: 'live' }), '已发布');
  assert.equal(statusLabel({ demo: true, status: 'wait' }), '示例');
  assert.equal(statusLabel({ demo: true, status: 'submitted' }), '示例');
  assert.doesNotMatch(statusBadge({ status: 'draft' }), /已提交/);
  assert.doesNotMatch(statusBadge({ status: 'live' }), /已提交/);
  assert.doesNotMatch(statusBadge({ demo: true, status: 'wait' }), /已提交/);
});

test('the renderer uses the shared status helper and stores submitted after a successful publish', () => {
  assert.match(app, /statusAfterSuccessfulAction/);
  assert.match(app, /statusBadge/);
  assert.match(app, /from '\.\.\/lib\/status-badge\.mjs'/);
  assert.doesNotMatch(app, /mode === 'publish'\) saved\.status = 'wait'/);
});
