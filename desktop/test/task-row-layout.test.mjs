import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../renderer/styles.css'),
  'utf8',
);
const htmlSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../renderer/app.js'),
  'utf8',
);

function block(name) {
  const match = css.match(new RegExp(String.raw`(?:^|\n)` + name.replace(/[.*+?^${}()|[\]\\]/g, r => '\\' + r) + String.raw`[^{]*\{([^}]*)\}`));
  assert.ok(match, `missing CSS rule ${name}`);
  return match[1].replace(/\s+/g, ' ');
}

test('task list product titles ellipsize inside the product column and do not cover later columns', () => {
  assert.match(htmlSource, /class="prod-meta"/);
  const cell = block('.product-cell');
  assert.match(cell, /min-width:\s*0/);
  assert.match(cell, /overflow:\s*hidden/);
  const meta = block('.prod-meta');
  assert.match(meta, /min-width:\s*0/);
  assert.match(meta, /overflow:\s*hidden/);
  const name = block('.prod-name');
  assert.match(name, /overflow:\s*hidden/);
  assert.match(name, /text-overflow:\s*ellipsis/);
  assert.match(name, /white-space:\s*nowrap/);
});
