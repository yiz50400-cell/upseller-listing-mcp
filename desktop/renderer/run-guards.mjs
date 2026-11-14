function clean(value) {
  return String(value ?? '').trim();
}

export function isPlaceholderShopName(name) {
  return /^目标店铺\s*[ABC]$/.test(clean(name));
}

export function isDemoShop(shop) {
  if (!shop) return true;
  if (shop.demo) return true;
  if (isPlaceholderShopName(shop.name)) return true;
  return !(clean(shop.id) || clean(shop.name));
}

export function realShops(shops) {
  return (Array.isArray(shops) ? shops : []).filter((shop) => !isDemoShop(shop) && !shop.expired);
}

export function runBlockReason({ form = {}, shops, demo } = {}) {
  const isDemo = demo === true || form.demo === true;
  if (isDemo) return '示意商品不能预览或上架，请先添加真实产品并填写产品ID。';
  if (!clean(form.productId) && !clean(form.draftId)) return '请填写产品ID。';
  if (realShops(shops).length < 1) {
    const leftover = (Array.isArray(shops) ? shops : []).filter((shop) => shop && !isDemoShop(shop));
    if (leftover.length) return '这家店对不上账号里的店。请改选登录后列出的店铺。';
    return '请先添加店铺。';
  }
  return '';
}

export function demoStatusLabel() {
  return '示例';
}
