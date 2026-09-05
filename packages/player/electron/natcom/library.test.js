// packages/player/electron/natcom/library.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadLibrarySync, findLibraryIndexPathSync } = require('./library');

test('findLibraryIndexPathSync finds the dev-mode natcom-library/index.json', () => {
  const found = findLibraryIndexPathSync();
  assert.ok(found, 'expected to find packages/natcom-library/index.json in dev mode');
  assert.equal(path.basename(found), 'index.json');
});

test('loadLibrarySync loads and validates the stub library', () => {
  const loaded = loadLibrarySync();
  assert.ok(loaded, 'expected loadLibrarySync to find the dev-mode library');
  assert.equal(loaded.library.schemaVersion, 1);
  assert.ok(Array.isArray(loaded.library.backgrounds));
  assert.ok(loaded.library.backgrounds.length >= 1);
  assert.ok(Array.isArray(loaded.library.objects));
  assert.ok(loaded.library.objects.length >= 1);
  assert.ok(loaded.assetsDir.endsWith('assets'));
});
