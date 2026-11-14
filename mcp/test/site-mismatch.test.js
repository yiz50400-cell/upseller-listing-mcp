import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runListing } from '../src/pipeline/runner.js';
import {
  GENERIC_SITE_MISMATCH,
  LEGACY_SITE_MISMATCH,
  siteMismatchMessage,
  rewriteSiteMismatchError,
} from '../src/site-mismatch.js';

test('known site codes become a plain-language sentence with both names', () => {
  assert.equal(siteMismatchMessage('BR', 'MX'), '这个商品是巴西站的，不能直接保存到墨西哥店。');
  assert.doesNotMatch(siteMismatchMessage('BR', 'MX'), /需单独处理分类\/货币/);
  assert.notEqual(siteMismatchMessage('BR', 'MX'), LEGACY_SITE_MISMATCH);
});

test('unknown or missing site names use the generic sentence', () => {
  assert.equal(siteMismatchMessage('ZZ', 'MX'), GENERIC_SITE_MISMATCH);
  assert.equal(siteMismatchMessage('BR', ''), GENERIC_SITE_MISMATCH);
  assert.equal(siteMismatchMessage('', 'MX'), GENERIC_SITE_MISMATCH);
  assert.equal(rewriteSiteMismatchError(LEGACY_SITE_MISMATCH), GENERIC_SITE_MISMATCH);
  assert.doesNotMatch(rewriteSiteMismatchError(LEGACY_SITE_MISMATCH), /需单独处理分类\/货币/);
});

function sampleProduct(site = 'BR') {
  return {
    id: '1737515268040591253',
    idStr: '1737515268040591253',
    shopId: '653107',
    shopName: 'Tiktok-巴西2店（张佳）',
    site,
    state: 'online',
    itemId: '1737515268040591253',
    itemTitle: 'Sérum Facial SADOER',
    price: 88,
    currency: 'BRL',
    puid: 1001,
    description: '<p>desc</p>',
    categoryId: '100001',
    categoryVersion: 'v1',
    imgUrl: 'https://example.com/a.jpg',
    mainImage: 'https://example.com/a.jpg',
    variationListStr: [],
  };
}

function makeClient(product) {
  const current = structuredClone(product);
  const client = {
    accountKey: () => 'test-account-key',
    get: async () => ({ ok: true, status: 200, json: { code: 0, data: current } }),
    postForm: async (url) => {
      throw new Error(`unexpected post ${url}`);
    },
    postJson: async (url) => {
      throw new Error(`unexpected json ${url}`);
    },
  };
  return { client };
}

test('the runner throws the named message when source and target sites differ', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-site-'));
  const { client } = makeClient(sampleProduct('BR'));
  await assert.rejects(
    () => runListing(client, {
      taskId: 'ui-site-1',
      productId: '1737515268040591253',
      sourceInternalId: '1737515268040591253',
      targetShopId: '1088498',
      targetShopName: '墨西哥-14',
      targetSite: 'MX',
    }, { dataDir, dryRun: true, timeoutMs: 20000 }),
    { message: '这个商品是巴西站的，不能直接保存到墨西哥店。' },
  );
});

test('the runner uses the generic sentence when a site name is unknown', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upseller-site-'));
  const { client } = makeClient(sampleProduct('ZZ'));
  await assert.rejects(
    () => runListing(client, {
      taskId: 'ui-site-2',
      productId: '1737515268040591253',
      sourceInternalId: '1737515268040591253',
      targetShopId: '1088498',
      targetShopName: '墨西哥-14',
      targetSite: 'MX',
    }, { dataDir, dryRun: true, timeoutMs: 20000 }),
    { message: GENERIC_SITE_MISMATCH },
  );
});
