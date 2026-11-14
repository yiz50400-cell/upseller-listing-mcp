export const GENERIC_SITE_MISMATCH = '这个商品和目标店不在同一个站点，不能直接保存。';

const LEGACY = /源商品与目标店铺站点不同|需单独处理分类\/货币/;

export function rewriteSiteMismatchError(message) {
  const text = String(message == null ? '' : message);
  if (LEGACY.test(text)) return GENERIC_SITE_MISMATCH;
  return text;
}
