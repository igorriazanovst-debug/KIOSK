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

test('natcomLibraryAssetUrl encodes the filename into a natcomlib:/// URL', () => {
  assert.equal(natcomLibraryAssetUrl('medved.svg'), 'natcomlib:///medved.svg');
  assert.equal(natcomLibraryAssetUrl('a b.svg'), 'natcomlib:///a%20b.svg');
});

test('resolveMediaUrl resolves a known media id to its asset URL', () => {
  assert.equal(resolveMediaUrl(LIBRARY, 'media-1'), 'natcomlib:///medved.svg');
});

test('resolveMediaUrl returns null for a missing or unknown media id', () => {
  assert.equal(resolveMediaUrl(LIBRARY, null), null);
  assert.equal(resolveMediaUrl(LIBRARY, undefined), null);
  assert.equal(resolveMediaUrl(LIBRARY, 'does-not-exist'), null);
});
