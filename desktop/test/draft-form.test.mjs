import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDraftFields, findShopOption } from '../lib/draft-form.mjs';

const brazil = { id: '653107', name: 'Tiktok-巴西2店（张佳）', value: '0' };
const mexico = { id: '1088498', name: '墨西哥-14', value: '1' };
const options = [
  { value: brazil.value, dataset: { id: brazil.id, name: brazil.name } },
  { value: mexico.value, dataset: { id: mexico.id, name: mexico.name } },
];

test('loading a draft writes both shopId and shopName from the draft, not the previous shop', () => {
  const task = applyDraftFields({
    shopId: '653107',
    shopName: 'Tiktok-巴西2店（张佳）',
    title: '旧标题',
    price: '226',
    currency: 'MXN',
  }, {
    shopId: 1088498,
    shopName: '墨西哥-14',
    itemId: '1492655893399425',
    itemTitle: 'iPhone Case Extra Long Title',
    price: '226',
    currency: 'MXN',
    site: 'MX',
  }, '1492655893399425');

  assert.equal(task.shopId, '1088498');
  assert.equal(task.shopName, '墨西哥-14');
  assert.equal(task.site, 'MX');
  assert.equal(task.draftId, '1492655893399425');
  assert.equal(task.productId, '1492655893399425');
  assert.equal(task.title, 'iPhone Case Extra Long Title');
});

test('applyForm shop matching selects the draft shop by shopId, not the previously selected shop', () => {
  const task = applyDraftFields({
    shopId: '653107',
    shopName: 'Tiktok-巴西2店（张佳）',
  }, {
    shopId: '1088498',
    shopName: '墨西哥-14',
  });
  const match = findShopOption(options, task);
  assert.equal(match?.value, '1');
  assert.equal(match?.dataset.id, '1088498');
});

test('if a draft only has shopName, stale shopId is cleared so the dropdown follows the draft shop', () => {
  const task = applyDraftFields({
    shopId: '653107',
    shopName: 'Tiktok-巴西2店（张佳）',
  }, {
    shopName: '墨西哥-14',
  });
  assert.equal(task.shopId, '');
  assert.equal(task.shopName, '墨西哥-14');
  const match = findShopOption(options, task);
  assert.equal(match?.dataset.id, '1088498');
});
