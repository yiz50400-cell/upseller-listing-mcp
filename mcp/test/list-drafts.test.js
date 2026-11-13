import test from 'node:test';
import assert from 'node:assert/strict';
import { listAccountDrafts, sanitizeDraftListItem } from '../src/tools/list_drafts.js';

test('sanitizeDraftListItem keeps only safe display fields and a stable draftId', () => {
  const item = sanitizeDraftListItem({
    id: 14926559893399425,
    idStr: '14926559893399425',
    itemTitle: 'iPhone Case Extra Long Title',
    shopId: 1088498,
    shopName: '墨西哥-14',
    site: 'MX',
    price: 228,
    currency: 'MXN',
    state: 'draft',
    updateTime: '2026-11-12 18:08:00',
    cookie: 'SECRET',
    description: '<p>huge html should not be listed</p>',
  }, { id: '1088498', name: '墨西哥-14', site: 'MX' });
  assert.equal(item.draftId, '14926559893399425');
  assert.equal(item.title, 'iPhone Case Extra Long Title');
  assert.equal(item.shopId, '1088498');
  assert.equal(item.shopName, '墨西哥-14');
  assert.equal(item.site, 'MX');
  assert.equal(item.price, 228);
  assert.equal(item.currency, 'MXN');
  assert.equal(item.state, 'draft');
  assert.equal(item.cookie, undefined);
  assert.equal(item.description, undefined);
});

test('listAccountDrafts pages each shop and can filter to one shop', async () => {
  const shops = [
    { id: '1088498', name: '墨西哥-14', site: 'MX' },
    { id: '653107', name: 'Tiktok-巴西2店（张佳）', site: 'BR' },
  ];
  const seen = [];
  const client = {
    postForm: async (url, fields) => {
      assert.match(String(url), /product\/index/);
      assert.equal(fields.state, 'draft');
      seen.push(String(fields.shopIds));
      if (String(fields.shopIds) === '1088498') {
        return { ok: true, status: 200, json: { code: 0, data: { total: 1, list: [{ idStr: '14926559893399425', itemTitle: 'MX Case', shopId: 1088498, shopName: '墨西哥-14', site: 'MX', price: 228, currency: 'MXN', state: 'draft' }] } } };
      }
      return { ok: true, status: 200, json: { code: 0, data: { total: 1, list: [{ idStr: '111', itemTitle: 'BR Case', shopId: 653107, shopName: 'Tiktok-巴西2店（张佳）', site: 'BR', price: 10, currency: 'BRL', state: 'draft' }] } } };
    },
  };

  const all = await listAccountDrafts(client, { shops });
  assert.deepEqual(all.map((row) => row.draftId), ['14926559893399425', '111']);
  assert.deepEqual(seen, ['1088498', '653107']);

  seen.length = 0;
  const onlyMx = await listAccountDrafts(client, { shops, shopId: '1088498' });
  assert.equal(onlyMx.length, 1);
  assert.equal(onlyMx[0].shopId, '1088498');
  assert.deepEqual(seen, ['1088498']);
});
