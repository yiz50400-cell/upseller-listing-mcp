import test from 'node:test';
import assert from 'node:assert/strict';
import { buildListingTasks, buildImageList, selectedShops } from '../lib/task-builder.mjs';

test('requires product or draft id and at least one shop', () => {
  assert.throws(() => buildListingTasks({}, []), /产品ID或草稿ID/);
  assert.throws(() => buildListingTasks({ productId: 'P1' }, []), /目标店铺/);
});

test('builds one task per selected shop and omits video', () => {
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
  assert.equal(out.tasks.length, 2);
  assert.equal(out.tasks[0].taskId, 'ui-1-1');
  assert.equal(out.tasks[0].targetShopId, 's1');
  assert.equal(out.tasks[1].targetShopName, '店铺乙');
  assert.equal(out.tasks[0].publish, false);
  assert.equal(out.tasks[0].productPrice, 19.9);
  assert.deepEqual(out.tasks[0].images[0], { path: '/tmp/main.jpg', role: 'main' });
  assert.equal(out.videoIgnored, true);
  assert.ok(out.warnings.some((w) => /视频/.test(w)));
  assert.ok(!('video' in out.tasks[0]));
});

test('publish flag is explicit and main image is unique', () => {
  const shops = [{ name: '目标店铺 A' }];
  const published = buildListingTasks({ draftId: 'D1', copyToShopCount: 1 }, shops, { publish: true });
  assert.equal(published.tasks[0].publish, true);
  assert.throws(() => buildImageList({ mainImages: ['a.jpg', 'b.jpg'] }), /主图只能选一张/);
});

test('selectedShops caps at requested count', () => {
  const { wanted, used } = selectedShops([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 2);
  assert.equal(wanted, 2);
  assert.equal(used.length, 2);
});
