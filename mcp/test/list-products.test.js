import test from 'node:test';
import assert from 'node:assert/strict';
import { listAccountProducts, sanitizeProductListItem } from '../src/tools/list_products.js';

test('sanitizeProductListItem keeps only safe display fields and a stable productId', () => {
  const item = sanitizeProductListItem({
    itemId: 887766,
    itemTitle: 'Funda de celular con diseño',
    shopId: 1088498,
    shopName: '墨西哥-14',
    site: 'MX',
    price: 228,
    currency: 'MXN',
    state: 'online',
    updateTime: '2026-11-12 10:08:50',
    imgUrl: 'https://cdn.example.com/a.jpg|https://cdn.example.com/b.jpg',
    cookie: 'SECRET',
    description: '<p>huge html should not be listed</p>',
    skuNum: 243,
  }, { id: '1088498', name: '墨西哥-14', site: 'MX' });
  assert.equal(item.productId, '887766');
  assert.equal(item.title, 'Funda de celular con diseño');
  assert.equal(item.shopId, '1088498');
  assert.equal(item.shopName, '墨西哥-14');
  assert.equal(item.site, 'MX');
  assert.equal(item.price, 228);
  assert.equal(item.currency, 'MXN');
  assert.equal(item.state, 'online');
  assert.equal(item.thumbnail, 'https://cdn.example.com/a.jpg');
  assert.equal(item.skuCount, 243);
  assert.equal(item.cookie, undefined);
  assert.equal(item.description, undefined);
  assert.equal(item.imgUrl, undefined);
  assert.equal(item.draftId, undefined);
});

test('listAccountProducts pages each shop with a non-draft state and can filter to one shop', async () => {
  const shops = [
    { id: '1088498', name: '墨西哥-14', site: 'MX' },
    { id: '653107', name: 'Tiktok-巴西2店（张佳）', site: 'BR' },
  ];
  const seen = [];
  const client = {
    postForm: async (url, fields) => {
      assert.match(String(url), /product\/index/);
      assert.notEqual(fields.state, 'draft');
      assert.equal(fields.state, 'online');
      seen.push(String(fields.shopIds));
      if (String(fields.shopIds) === '1088498') {
        return { ok: true, status: 200, json: { code: 0, data: { total: 1, list: [{ itemId: '887766', itemTitle: 'MX Case', shopId: 1088498, shopName: '墨西哥-14', site: 'MX', price: 228, currency: 'MXN', state: 'online', imgUrl: 'https://cdn.example.com/m.jpg' }] } } };
      }
      return { ok: true, status: 200, json: { code: 0, data: { total: 1, list: [{ itemId: '111', itemTitle: 'BR Case', shopId: 653107, shopName: 'Tiktok-巴西2店（张佳）', site: 'BR', price: 10, currency: 'BRL', state: 'online' }] } } };
    },
  };

  const all = await listAccountProducts(client, { shops });
  assert.deepEqual(all.map((row) => row.productId), ['887766', '111']);
  assert.equal(all[0].thumbnail, 'https://cdn.example.com/m.jpg');
  assert.deepEqual(seen, ['1088498', '653107']);

  seen.length = 0;
  const onlyMx = await listAccountProducts(client, { shops, shopId: '1088498' });
  assert.equal(onlyMx.length, 1);
  assert.equal(onlyMx[0].shopId, '1088498');
  assert.deepEqual(seen, ['1088498']);
});
