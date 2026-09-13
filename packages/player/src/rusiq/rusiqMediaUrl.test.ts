// packages/player/src/rusiq/rusiqMediaUrl.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rusiqBackgroundMediaUrl } from './rusiqMediaUrl.ts';

test('rusiqBackgroundMediaUrl encodes the filename into a rusiqmedia://bg/ URL', () => {
  assert.equal(rusiqBackgroundMediaUrl('abc-background.png'), 'rusiqmedia://bg/abc-background.png');
  assert.equal(rusiqBackgroundMediaUrl('a b.png'), 'rusiqmedia://bg/a%20b.png');
});

test('the URL host is non-empty - a standard-scheme URL with an empty host reparses with the filename swallowed into the host (found live, 2026-09-12)', () => {
  const url = new URL(rusiqBackgroundMediaUrl('abc-background.png'));
  assert.equal(url.hostname, 'bg');
  assert.equal(url.pathname, '/abc-background.png');
});
