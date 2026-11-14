const SITE_NAMES = {
  US: '美国',
  MX: '墨西哥',
  BR: '巴西',
  GB: '英国',
  UK: '英国',
  DE: '德国',
  FR: '法国',
  IT: '意大利',
  ES: '西班牙',
  TH: '泰国',
  VN: '越南',
  PH: '菲律宾',
  MY: '马来西亚',
  SG: '新加坡',
  JP: '日本',
  ID: '印尼',
  TW: '台湾',
};

export const GENERIC_SITE_MISMATCH = '这个商品和目标店不在同一个站点，不能直接保存。';
export const LEGACY_SITE_MISMATCH = '源商品与目标店铺站点不同，需单独处理分类/货币';

export function siteLabel(site) {
  const code = String(site || '').trim().toUpperCase();
  return SITE_NAMES[code] || '';
}

export function siteMismatchMessage(sourceSite, targetSite) {
  const source = siteLabel(sourceSite);
  const target = siteLabel(targetSite);
  if (source && target) {
    return `这个商品是${source}站的，不能直接保存到${target}店。`;
  }
  return GENERIC_SITE_MISMATCH;
}

export function rewriteSiteMismatchError(message) {
  const text = String(message == null ? '' : message);
  if (text.includes('需单独处理分类/货币') || /源商品与目标店铺站点不同/.test(text)) {
    return GENERIC_SITE_MISMATCH;
  }
  return text;
}
