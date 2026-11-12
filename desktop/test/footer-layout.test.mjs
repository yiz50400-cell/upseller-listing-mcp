import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../renderer/styles.css'),
  'utf8',
);

function block(name) {
  const match = css.match(new RegExp(String.raw`(?:^|\n)` + name.replace(/[.*+?^${}()|[\]\\]/g, r => '\\' + r) + String.raw`[^{]*\{([^}]*)\}`));
  assert.ok(match, `missing CSS rule ${name}`);
  return match[1].replace(/\s+/g, ' ');
}

test('footer long titles ellipsize and do not cover the action buttons', () => {
  const footId = block('.foot-id');
  assert.match(footId, /min-width:\s*0/);
  assert.match(footId, /flex:\s*1/);
  const title = block('.foot-title, .foot-sub');
  assert.match(title, /overflow:\s*hidden/);
  assert.match(title, /text-overflow:\s*ellipsis/);
  assert.match(title, /white-space:\s*nowrap/);
  const actions = block('.actions');
  assert.match(actions, /flex-shrink:\s*0/);
});
