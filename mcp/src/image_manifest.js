import assert from 'node:assert/strict';
import path from 'node:path';

/** Resolve product slots in main, numbered-gallery, then SKU order. */
export function buildProductImages(images, uploads) {
  const uploadForAsset = asset => {
    assert.ok(asset.path, `missing asset path for ${asset.fileName}`);
    // Several gallery files share role=gallery and skuName=null; use file identity.
    const matches = uploads.filter(upload => upload.filePath &&
      path.resolve(upload.filePath) === path.resolve(asset.path) &&
      upload.role === asset.role && (upload.skuName ?? null) === (asset.skuName ?? null));
    assert.ok(matches.length, `missing upload for ${asset.fileName}`);
    assert.equal(matches.length, 1, `ambiguous uploads for ${asset.fileName}`);
    assert.ok(matches[0].fileUrl, `missing upload URL for ${asset.fileName}`);
    return matches[0];
  };
  const mainAssets = images.filter(asset => asset.role === 'main');
  assert.equal(mainAssets.length, 1, 'exactly one main image is required');
  const main = uploadForAsset(mainAssets[0]);
  const gallery = images.filter(asset => asset.role === 'gallery')
    .sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh', { numeric: true }))
    .map(uploadForAsset);
  const sku = images.filter(asset => asset.role === 'sku')
    .map(uploadForAsset);
  return [main, ...gallery, ...sku];
}
