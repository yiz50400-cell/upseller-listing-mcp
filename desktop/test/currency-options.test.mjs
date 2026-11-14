import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOnlineProductFields, bindSourceToTask } from '../lib/task-bind.mjs';
import { applyDraftFields } from '../lib/draft-form.mjs';
import { currencyOptions, selectedCurrency, DEFAULT_CURRENCIES } from '../lib/currency-options.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(root, '../renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, '../renderer/app.js'), 'utf8');

test('the currency dropdown includes BRL among the default codes', () => {
  assert.deepEqual(DEFAULT_CURRENCIES, ['USD', 'EUR', 'GBP', 'MXN', 'BRL']);
  assert.ok(currencyOptions().includes('BRL'));
  for (const code of DEFAULT_CURRENCIES) {
    assert.match(html, new RegExp(`<option>${code}</option>`));
    assert.ok(currencyOptions().includes(code));
  }
  assert.match(app, /currencyOptions/);
  assert.match(app, /fillCurrencySelect\(task\.currency\)/);
});

test('loading a Brazilian product keeps BRL and does not become USD or empty', () => {
  const product = {
    productId: '1737515268040591253',
    title: 'Sérum Facial SADOER com Niacinamida',
    price: '88',
    currency: 'BRL',
    site: 'BR',
  };
  const bound = applyOnlineProductFields({ id: 'ui-1', status: 'draft', currency: 'USD' }, product);
  assert.equal(bound.currency, 'BRL');
  assert.notEqual(bound.currency, 'USD');
  assert.ok(bound.currency);
  const viaBind = bindSourceToTask({ id: 'ui-1', status: 'draft', currency: 'USD' }, { kind: 'product', product });
  assert.equal(viaBind.task.currency, 'BRL');
  const draft = applyDraftFields({ id: 'ui-2', currency: 'USD' }, {
    itemTitle: product.title,
    price: '88',
    currency: 'BRL',
    site: 'BR',
  }, 'draft-1');
  assert.equal(draft.currency, 'BRL');
  const codes = currencyOptions(bound.currency);
  assert.ok(codes.includes('BRL'));
  assert.equal(selectedCurrency(bound.currency), 'BRL');
});

test('a currency outside the default list such as THB still appears', () => {
  const codes = currencyOptions('THB');
  assert.ok(codes.includes('THB'));
  assert.ok(codes.includes('BRL'));
  assert.equal(selectedCurrency('thb'), 'THB');
  const bound = applyOnlineProductFields({ id: 'ui-3', status: 'draft' }, {
    productId: 'P-TH',
    title: 'Thai Case',
    price: '199',
    currency: 'THB',
    site: 'TH',
  });
  assert.equal(bound.currency, 'THB');
  assert.ok(currencyOptions(bound.currency).includes('THB'));
  assert.equal(selectedCurrency(''), 'USD');
});
