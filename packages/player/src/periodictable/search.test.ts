// packages/player/src/periodictable/search.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchElements } from './search.ts';
import { PeriodicTableContentSchema } from './model/schema.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

test('empty query returns no results', () => {
  assert.deepEqual(searchElements(elements, ''), []);
  assert.deepEqual(searchElements(elements, '   '), []);
});

test('search by Russian name is case-insensitive and matches substrings', () => {
  const results = searchElements(elements, 'желез');
  assert.ok(results.some((e) => e.symbol === 'Fe'));
});

test('search by exact symbol matches, but does not substring-match unrelated names', () => {
  const results = searchElements(elements, 'Fe');
  assert.ok(results.some((e) => e.symbol === 'Fe'));
});

test('search by atomic number matches exactly', () => {
  const results = searchElements(elements, '26');
  assert.ok(results.some((e) => e.atomicNumber === 26));
  assert.ok(results.every((e) => String(e.atomicNumber) === '26' || String(e.atomicMass).startsWith('26')));
});

test('search by Latin name works', () => {
  const results = searchElements(elements, 'ferrum');
  assert.ok(results.some((e) => e.symbol === 'Fe'));
});
