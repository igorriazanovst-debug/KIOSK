import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRng, shuffled, pickWithoutRepeat } from './rng.ts';

test('seededRng gives the same sequence for the same seed', () => {
  const a = seededRng(42);
  const b = seededRng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('seededRng stays within [0, 1)', () => {
  const rng = seededRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  }
});

test('shuffled keeps every element and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const copy = [...input];
  const out = shuffled(input, seededRng(1));
  assert.deepEqual(input, copy);
  assert.deepEqual([...out].sort(), copy);
});

test('shuffled actually reorders for some seed', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const moved = [1, 2, 3, 4, 5].some((seed) => shuffled(input, seededRng(seed)).join() !== input.join());
  assert.ok(moved);
});

test('pickWithoutRepeat returns distinct items of the requested size', () => {
  const out = pickWithoutRepeat(['a', 'b', 'c', 'd', 'e'], 3, seededRng(9));
  assert.equal(out.length, 3);
  assert.equal(new Set(out).size, 3);
});

test('pickWithoutRepeat clamps count to the pool size', () => {
  assert.equal(pickWithoutRepeat(['a', 'b'], 10, seededRng(9)).length, 2);
});
