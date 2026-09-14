import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIMIQ_THEMATIC_IMAGES, chimiqThematicImageUrl } from './thematicImages.ts';

test('CHIMIQ_THEMATIC_IMAGES has at least 4 entries (FR-020)', () => {
  assert.ok(CHIMIQ_THEMATIC_IMAGES.length >= 4);
});

test('CHIMIQ_THEMATIC_IMAGES covers the mandatory FR-020 topics', () => {
  const titles = CHIMIQ_THEMATIC_IMAGES.map((i) => i.title.toLowerCase()).join(' | ');
  assert.match(titles, /периодическая таблица/i);
  assert.match(titles, /строение атома/i);
  assert.match(titles, /эксперимент/i);
});

test('every thematic image has a non-empty fileName, title and caption', () => {
  for (const img of CHIMIQ_THEMATIC_IMAGES) {
    assert.ok(img.fileName.length > 0);
    assert.ok(img.title.length > 0);
    assert.ok(img.caption.length > 0);
  }
});

test('thematic image ids are unique', () => {
  const ids = CHIMIQ_THEMATIC_IMAGES.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('chimiqThematicImageUrl builds a relative path under chimiq/thematic', () => {
  assert.equal(chimiqThematicImageUrl('molecule.png'), './chimiq/thematic/molecule.png');
});
