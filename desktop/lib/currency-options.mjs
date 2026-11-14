export const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'BRL'];

export function currencyOptions(current) {
  const seen = new Set();
  const list = [];
  for (const item of [...DEFAULT_CURRENCIES, current]) {
    const code = String(item || '').trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    list.push(code);
  }
  return list;
}

export function selectedCurrency(current) {
  const code = String(current || '').trim().toUpperCase();
  return code || 'USD';
}
