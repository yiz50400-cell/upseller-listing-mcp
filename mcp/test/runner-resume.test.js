import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runListing } from '../src/pipeline/runner.js';
import { decideListingResume, listingFingerprint } from '../src/pipeline/resume.js';
import { hash } from '../src/pipeline/storage.js';

const DRAFT_ID = '14926559893399425';
const SHOP_ID = '1088498';
const MISMATCH = /任务 ID 已用于不同内容/;

function sampleDraft(overrides = {}) {
  return {
    id: DRAFT_ID,
    idStr: DRAFT_ID,
    shopId: SHOP_ID,
    shopName: '墨西哥-14',
    site: 'MX',
    state: 'draft',
    itemId: null,
    itemTitle: 'iPhone Case',
    price: 228,
    currency: 'MXN',
    puid: 1001,
    description: '<p>desc</p>',
    categoryId: '100001',
    categoryVersion: 'v1',
    sourceUrl: '',
    brandInfo: {},
    attributes: [],
    hasVariation: true,
    auction: false,
    variationTheme: 'color',
    certifications: [],
    imgUrl: 'https://example.com/a.jpg',
    mainImage: 'https://example.com/a.jpg',
    variationListStr: [
      { id: 'v1', price: 228, stock: 10, salesAttributesJson: JSON.stringify([{ name: 'Color', valueName: 'Black' }]) },
    ],
    ...overrides,
  };
}

function ok(data) {
  return { ok: true, status: 200, json: { code: 0, data } };
}

function makeClient(draft = sampleDraft()) {
  const current = structuredClone(draft);
  const calls = { get: 0, post: 0, add: 0, ops: [] };
  const client = {
    accountKey: () => 'test-account-key',
    get: async (_url, params = {}) => {
      calls.get += 1;
      const id = String(params.id ?? current.idStr);
      if (id !== String(current.idStr) && id !== String(current.id)) {
        return ok({
          ...current,
          id: Number(id) || id,
          idStr: id,
          itemTitle: 'Other draft',
          state: 'draft',
        });
      }
      return ok(current);
    },
    postForm: async (url, fields = {}) => {
      calls.post += 1;
      const pathName = String(url);
      if (pathName.includes('check-edit-price')) return ok([]);
      if (pathName.includes('product/add')) {
        calls.add += 1;
        calls.ops.push(String(fields.op));
        if (fields.itemTitle != null) current.itemTitle = fields.itemTitle;
        if (fields.description != null) current.description = fields.description;
        if (fields.imgUrl != null) current.imgUrl = fields.imgUrl;
        if (fields.variationListStr != null) {
          current.variationListStr = typeof fields.variationListStr === 'string'
            ? JSON.parse(fields.variationListStr)
            : fields.variationListStr;
        }
        if (String(fields.op) === '2') {
          current.state = 'online';
          current.productStatus = 'online';
          current.itemId = `online-${DRAFT_ID}`;
        } else {
          current.state = 'draft';
        }
        return ok({});
      }
      if (pathName.includes('product/index')) return ok({ list: [], total: 0 });
      throw new Error(`unexpected post ${pathName}`);
    },
    postJson: async (url) => {
      throw new Error(`unexpected json ${url}`);
    },
  };
  return { client, current, calls };
}

function baseTask(overrides = {}) {
  return {
    taskId: 'ui-mwcys2kc',
    draftId: DRAFT_ID,
    targetShopId: SHOP_ID,
    targetShopName: '墨西哥-14',
    targetSite: 'MX',
    title: 'iPhone Case',
    productPrice: 228,
    publish: false,
    ...overrides,
  };
}

async function run(client, task, dataDir, extra = {}) {
  return runListing(client, task, {
    dataDir,
    dryRun: false,
    confirmPublish: extra.confirmPublish === true || task.publish === true,
    timeoutMs: 20000,
    ...extra,
  });
}

test('listing fingerprint ignores the publish flag so save-then-publish is not a content mismatch', () => {
  const files = [];
  const saveFp = listingFingerprint(baseTask({ publish: false }), files, hash);
  const publishFp = listingFingerprint(baseTask({ publish: true }), files, hash);
  assert.equal(saveFp, publishFp);
  const priced = listingFingerprint(baseTask({ productPrice: 230 }), files, hash);
  assert.notEqual(priced, saveFp);
});

test('decideListingResume lets a verified save-draft continue into publish on the same unpublished draft', () => {
  const fingerprint = listingFingerprint(baseTask(), [], hash);
  const decision = decideListingResume({
    state: {
      taskId: 'ui-mwcys2kc',
      fingerprint,
      draftId: DRAFT_ID,
      submission: { stage: 'verified', op: '1' },
      completedResult: { ok: true, publishRequested: false, platformStatus: 'draft', stage: 'verified' },
    },
    fingerprint,
    task: baseTask({ publish: true }),
    platform: sampleDraft(),
  });
  assert.equal(decision.type, 'continue');
  assert.equal(decision.skipSubmissionShortCircuit, true);
});

test('decideListingResume updates the fingerprint when an unpublished draft changes price or title', () => {
  const previous = listingFingerprint(baseTask({ productPrice: 228 }), [], hash);
  const next = listingFingerprint(baseTask({ productPrice: 230 }), [], hash);
  const decision = decideListingResume({
    state: {
      taskId: 'ui-mwcys2kc',
      fingerprint: previous,
      draftId: DRAFT_ID,
      submission: { stage: 'verified', op: '1' },
      completedResult: { ok: true, publishRequested: false, platformStatus: 'draft', stage: 'verified' },
    },
    fingerprint: next,
    task: baseTask({ productPrice: 230, publish: false }),
    platform: sampleDraft(),
  });
  assert.equal(decision.type, 'continue');
  assert.equal(decision.updateFingerprint, true);
  assert.equal(decision.skipSubmissionShortCircuit, true);
});

test('decideListingResume forbids another write after a successful publish / online listing', () => {
  const fingerprint = listingFingerprint(baseTask({ publish: true }), [], hash);
  const decision = decideListingResume({
    state: {
      taskId: 'ui-mwcys2kc',
      fingerprint,
      draftId: DRAFT_ID,
      submission: { stage: 'verified', op: '2' },
      completedResult: { ok: true, publishRequested: true, platformStatus: 'online', stage: 'verified' },
    },
    fingerprint,
    task: baseTask({ publish: true }),
    platform: sampleDraft({ state: 'online', productStatus: 'online', itemId: 'online-1' }),
  });
  assert.equal(decision.type, 'already-completed');
});

test('same taskId can save a draft and then publish without treating publish as different content', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-resume-'));
  const { client, current, calls } = makeClient();
  const saved = await run(client, baseTask({ publish: false }), dataDir);
  assert.equal(saved.ok, true);
  assert.equal(saved.stage, 'verified');
  assert.equal(saved.publishRequested, false);
  assert.equal(calls.add, 1);
  assert.deepEqual(calls.ops, ['1']);
  assert.equal(current.state, 'draft');

  const published = await run(client, baseTask({ publish: true }), dataDir);
  assert.notEqual(published.stage, 'already-completed');
  assert.doesNotMatch(String(published.error || ''), MISMATCH);
  assert.equal(published.ok, true);
  assert.equal(published.stage, 'verified');
  assert.equal(published.publishRequested, true);
  assert.equal(calls.add, 2);
  assert.deepEqual(calls.ops, ['1', '2']);
  assert.equal(current.state, 'online');
});

test('an unpublished draft can be saved or published again after a price or title change', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-resume-'));
  const { client, current, calls } = makeClient();
  const first = await run(client, baseTask({ publish: false, productPrice: 228, title: 'iPhone Case' }), dataDir);
  assert.equal(first.ok, true);
  assert.equal(first.stage, 'verified');

  const second = await run(client, baseTask({ publish: false, productPrice: 230, title: 'iPhone Case MX' }), dataDir);
  assert.doesNotMatch(String(second.error || ''), MISMATCH);
  assert.notEqual(second.stage, 'already-completed');
  assert.equal(second.ok, true);
  assert.equal(second.stage, 'verified');
  assert.equal(calls.add, 2);
  assert.deepEqual(calls.ops, ['1', '1']);
  assert.equal(current.itemTitle, 'iPhone Case MX');
  assert.equal(current.state, 'draft');
});

test('a successfully published / online listing is not blindly submitted again', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-resume-'));
  const { client, calls } = makeClient();
  const first = await run(client, baseTask({ publish: true }), dataDir);
  assert.equal(first.ok, true);
  assert.equal(first.stage, 'verified');
  assert.equal(calls.add, 1);

  const second = await run(client, baseTask({ publish: true }), dataDir);
  assert.equal(second.ok, true);
  assert.equal(second.stage, 'already-completed');
  assert.equal(second.reused, true);
  assert.equal(calls.add, 1);
});

test('a different draft on the same taskId is still a content mismatch', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-resume-'));
  const { client, calls } = makeClient();
  const first = await run(client, baseTask({ publish: false }), dataDir);
  assert.equal(first.ok, true);
  const adds = calls.add;
  let message = '';
  try {
    const second = await run(client, baseTask({ draftId: '999', publish: false }), dataDir);
    message = String(second.error || '');
    assert.equal(second.ok, false);
  } catch (err) {
    message = String(err && err.message ? err.message : err);
  }
  assert.match(message, MISMATCH);
  assert.equal(calls.add, adds);
});
