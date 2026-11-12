function clean(value) {
  return String(value ?? '').trim();
}

export function normalizeAccountShop(row) {
  return {
    id: clean(row?.id),
    name: clean(row?.name),
    site: row?.site ? String(row.site) : '',
    expired: Boolean(row?.expired),
    source: 'account',
  };
}

/** Account shops first; keep unmatched manual shops as a fallback only. */
export function mergeShops(existing, accountRows) {
  const account = (Array.isArray(accountRows) ? accountRows : [])
    .map(normalizeAccountShop)
    .filter((shop) => shop.id || shop.name);
  const accountIds = new Set(account.map((shop) => shop.id).filter(Boolean));
  const accountNames = new Set(account.map((shop) => shop.name).filter(Boolean));
  const accountKeys = new Set(account.map((shop) => `${shop.id}::${shop.name}`));
  const manual = (Array.isArray(existing) ? existing : [])
    .filter((shop) => {
      if (!shop || shop.source === 'account' || shop.demo) return false;
      const id = clean(shop.id);
      const name = clean(shop.name);
      if (!id && !name) return false;
      if (accountKeys.has(`${id}::${name}`)) return false;
      if (id && accountIds.has(id)) return false;
      if (!id && name && accountNames.has(name)) return false;
      return true;
    })
    .map((shop) => ({
      id: clean(shop.id),
      name: clean(shop.name),
      site: shop.site ? String(shop.site) : '',
      expired: Boolean(shop.expired),
      source: 'manual',
    }));
  return [...account, ...manual];
}
