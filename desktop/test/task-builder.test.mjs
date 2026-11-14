import test from 'node:test';
import assert from 'node:assert/strict';
import { buildListingTasks, buildImageList, selectedShops, matchFormShop } from '../lib/task-builder.mjs';

test('requires product or draft id and at least one shop', () => {
  assert.throws(() => buildListingTasks({}, []), /请填写产品ID/);
  assert.throws(() => buildListingTasks({ productId: 'P1' }, []), /请先添加店铺/);
});

test('blocks demo rows and placeholder shops', () => {
  assert.throws(
    () => buildListingTasks({ productId: 'P1', demo: true }, [{ name: '店铺甲' }]),
    /示意商品不能预览或上架/,
  );
  assert.throws(
    () => buildListingTasks({ productId: 'P1' }, [{ name: '目标店铺 A' }, { name: '目标店铺 B', demo: true }]),
    /请先添加店铺/,
  );
  const { used } = selectedShops([{ name: '目标店铺 A' }, { name: '店铺甲' }, { name: '目标店铺 C' }], 3);
  assert.equal(used.length, 1);
  assert.equal(used[0].name, '店铺甲');
});

test('builds one task for the selected shop and omits video', () => {
  const shops = [
    { id: 's1', name: '店铺甲' },
    { id: 's2', name: '店铺乙' },
    { id: 's3', name: '店铺丙' },
  ];
  const form = {
    productId: 'P-100',
    title: '示意商品',
    price: '19.9',
    copyToShopCount: 2,
    mainImages: ['/tmp/main.jpg'],
    galleryImages: ['/tmp/g1.jpg'],
    skuImages: [{ path: '/tmp/sku.jpg', skuName: '蓝色' }],
    video: '/tmp/clip.mp4',
    taskId: 'ui-1',
  };
  const out = buildListingTasks(form, shops, { publish: false });
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].taskId, 'ui-1');
  assert.equal(out.tasks[0].targetShopId, 's1');
  assert.equal(out.tasks[0].targetShopName, '店铺甲');
  assert.equal(out.tasks[0].publish, false);
  assert.equal(out.tasks[0].productPrice, 19.9);
  assert.deepEqual(out.tasks[0].images[0], { path: '/tmp/main.jpg', role: 'main' });
  assert.equal(out.videoIgnored, true);
  assert.ok(out.warnings.some((w) => /视频/.test(w)));
  assert.equal(out.warnings.some((w) => /复制到/.test(w)), false);
  assert.ok(!('video' in out.tasks[0]));
});

test('publish flag is explicit and main image is unique', () => {
  const shops = [{ name: '店铺甲' }];
  const published = buildListingTasks({ draftId: 'D1', copyToShopCount: 1 }, shops, { publish: true });
  assert.equal(published.tasks[0].publish, true);
  assert.throws(() => buildImageList({ mainImages: ['a.jpg', 'b.jpg'] }), /主图只能选一张/);
});

test('selectedShops ignores leftover copyToShopCount and only uses the form shop', () => {
  const shops = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const ignored = selectedShops(shops, 2);
  assert.equal(ignored.wanted, 1);
  assert.equal(ignored.used.length, 1);
  assert.equal(ignored.used[0].name, 'A');
  const picked = selectedShops(shops, { shopName: 'C', copyToShopCount: 3 });
  assert.equal(picked.wanted, 1);
  assert.equal(picked.used.length, 1);
  assert.equal(picked.used[0].name, 'C');
});

test('editing an existing draft builds one task even if copyToShopCount is higher', () => {
  const shops = [
    { id: 's-manual', name: '22', source: 'manual' },
    { id: 's-br', name: 'Tiktok-巴西2店（张佳）', source: 'account' },
    { id: 's-other', name: '另一家店', source: 'account' },
  ];
  const form = {
    productId: '1492655893399425',
    draftId: '1492655893399425',
    title: 'Funda de celular',
    price: '228',
    copyToShopCount: 3,
    shopId: 's-br',
    shopName: 'Tiktok-巴西2店（张佳）',
    taskId: 'ui-draft',
  };
  const saved = buildListingTasks(form, shops, { publish: false });
  assert.equal(saved.tasks.length, 1);
  assert.equal(saved.tasks[0].draftId, '1492655893399425');
  assert.equal(saved.tasks[0].targetShopId, 's-br');
  assert.equal(saved.tasks[0].targetShopName, 'Tiktok-巴西2店（张佳）');
  assert.equal(saved.tasks[0].productPrice, 228);
  const published = buildListingTasks(form, shops, { publish: true });
  assert.equal(published.tasks.length, 1);
  assert.equal(published.tasks[0].draftId, '1492655893399425');
  assert.equal(published.tasks[0].targetShopId, 's-br');
  const draftIds = published.tasks.map((t) => t.draftId);
  assert.equal(new Set(draftIds).size, draftIds.length);
});

test('dropdown shop is used instead of the first shops in the list', () => {
  const shops = [
    { id: 's-manual', name: '22', source: 'manual' },
    { id: 's-br', name: 'Tiktok-巴西2店（张佳）', source: 'account' },
  ];
  const form = {
    productId: 'P-200',
    copyToShopCount: 1,
    shopId: 's-br',
    shopName: 'Tiktok-巴西2店（张佳）',
  };
  const { used } = selectedShops(shops, form.copyToShopCount, form);
  assert.equal(used.length, 1);
  assert.equal(used[0].id, 's-br');
  const out = buildListingTasks(form, shops, { publish: false });
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].targetShopId, 's-br');
  assert.notEqual(out.tasks[0].targetShopName, '22');
});

test('copying a product uses only the dropdown shop even if a leftover copyToShopCount is higher', () => {
  const shops = [
    { id: 's-manual', name: '22', source: 'manual' },
    { id: 's-a', name: '店铺甲', source: 'account' },
    { id: 's-b', name: '店铺乙', source: 'account' },
  ];
  const form = {
    productId: 'P-300',
    copyToShopCount: 2,
    shopId: 's-b',
    shopName: '店铺乙',
  };
  const out = buildListingTasks(form, shops, { publish: false });
  assert.equal(out.tasks.length, 1);
  assert.equal(out.tasks[0].targetShopId, 's-b');
  assert.equal(out.tasks[0].targetShopName, '店铺乙');
  assert.ok(!out.tasks[0].draftId);
  const picked = matchFormShop(shops, form);
  assert.equal(picked.id, 's-b');
  const { used } = selectedShops(shops, form.copyToShopCount, form);
  assert.equal(used.length, 1);
  assert.equal(used[0].id, 's-b');
});
