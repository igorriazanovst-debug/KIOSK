import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOIQ_THEMATIC_IMAGES, bioiqThematicImageUrl } from './thematicImages.ts';

test('BIOIQ_THEMATIC_IMAGES has at least 4 entries (FR-020)', () => {
  assert.ok(BIOIQ_THEMATIC_IMAGES.length >= 4);
});

test('BIOIQ_THEMATIC_IMAGES covers the mandatory FR-020 topics', () => {
  const titles = BIOIQ_THEMATIC_IMAGES.map((i) => i.title.toLowerCase()).join(' | ');
  assert.match(titles, /периодическая таблица/i);
  assert.match(titles, /строение атома/i);
  assert.match(titles, /эксперимент/i);
});

test('every thematic image has a non-empty fileName, title and caption', () => {
  for (const img of BIOIQ_THEMATIC_IMAGES) {
    assert.ok(img.fileName.length > 0);
    assert.ok(img.title.length > 0);
    assert.ok(img.caption.length > 0);
  }
});

test('thematic image ids are unique', () => {
  const ids = BIOIQ_THEMATIC_IMAGES.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('bioiqThematicImageUrl builds a relative path under bioiq/thematic', () => {
  assert.equal(bioiqThematicImageUrl('molecule.png'), './bioiq/thematic/molecule.png');
});
