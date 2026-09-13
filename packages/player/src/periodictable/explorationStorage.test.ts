// packages/player/src/periodictable/explorationStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadExploredSet, saveExploredSet, withExplored } from './explorationStorage.ts';

test('loadExploredSet returns an empty set when window/localStorage is unavailable (Node test environment)', () => {
  assert.deepEqual(loadExploredSet(), new Set());
});

test('saveExploredSet does not throw when window/localStorage is unavailable', () => {
  assert.doesNotThrow(() => saveExploredSet(new Set([1, 2, 3])));
});

test('withExplored adds a new atomic number without mutating the original set', () => {
  const original = new Set([1, 2]);
  const result = withExplored(original, 3);
  assert.deepEqual(original, new Set([1, 2]));
  assert.deepEqual(result, new Set([1, 2, 3]));
});

test('withExplored returns the same set reference when the number is already present', () => {
  const original = new Set([1, 2]);
  const result = withExplored(original, 2);
  assert.equal(result, original);
});
