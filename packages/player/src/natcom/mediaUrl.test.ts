// packages/player/src/natcom/mediaUrl.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NatComLibrary } from '@kiosk/shared';
import { natcomLibraryAssetUrl, resolveMediaUrl } from './mediaUrl.ts';

const LIBRARY: NatComLibrary = {
  schemaVersion: 1,
  backgrounds: [],
  categories: [],
  objects: [],
  media: [
    { id: 'media-1', fileName: 'medved.svg', mimeType: 'image/svg+xml', fileSize: 100, sha256: 'a'.repeat(64) },
  ],
};

test('natcomLibraryAssetUrl encodes the filename into a natcomlib://asset/ URL', () => {
  assert.equal(natcomLibraryAssetUrl('medved.svg'), 'natcomlib://asset/medved.svg');
  assert.equal(natcomLibraryAssetUrl('a b.svg'), 'natcomlib://asset/a%20b.svg');
});

test('the URL host is non-empty - a standard-scheme URL with an empty host reparses with the filename swallowed into the host (found live, Эпик 8)', () => {
  const url = new URL(natcomLibraryAssetUrl('medved.svg'));
  assert.equal(url.hostname, 'asset');
  assert.equal(url.pathname, '/medved.svg');
});

test('resolveMediaUrl resolves a known media id to its asset URL', () => {
  assert.equal(resolveMediaUrl(LIBRARY, 'media-1'), 'natcomlib://asset/medved.svg');
});

test('resolveMediaUrl returns null for a missing or unknown media id', () => {
  assert.equal(resolveMediaUrl(LIBRARY, null), null);
  assert.equal(resolveMediaUrl(LIBRARY, undefined), null);
  assert.equal(resolveMediaUrl(LIBRARY, 'does-not-exist'), null);
});
