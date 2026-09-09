import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSeriationPuzzle, checkSeriationAnswer } from './seriationLogic.ts';

function fixedRng(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

test('generateSeriationPuzzle is deterministic given a fixed rng', () => {
  const a = generateSeriationPuzzle(fixedRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  const b = generateSeriationPuzzle(fixedRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  assert.deepEqual(a, b);
});

test('generateSeriationPuzzle always produces 3 to 5 distinct sizes', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let s = seed;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const puzzle = generateSeriationPuzzle(rng);
    assert.ok(puzzle.sizes.length >= 3 && puzzle.sizes.length <= 5);
    assert.equal(new Set(puzzle.sizes).size, puzzle.sizes.length, 'sizes must be distinct — equal sizes make the order ambiguous');
  }
});

test('checkSeriationAnswer accepts the correct ascending order', () => {
  const puzzle = { sizes: [50, 20, 70], direction: 'ascending' as const };
  // sizes sorted ascending are 20(idx1),50(idx0),70(idx2)
  assert.equal(checkSeriationAnswer(puzzle, [1, 0, 2]), true);
});

test('checkSeriationAnswer accepts the correct descending order', () => {
  const puzzle = { sizes: [50, 20, 70], direction: 'descending' as const };
  assert.equal(checkSeriationAnswer(puzzle, [2, 0, 1]), true);
});

test('checkSeriationAnswer rejects a wrong order', () => {
  const puzzle = { sizes: [50, 20, 70], direction: 'ascending' as const };
  assert.equal(checkSeriationAnswer(puzzle, [0, 1, 2]), false);
});

test('checkSeriationAnswer rejects incomplete placement (nulls)', () => {
  const puzzle = { sizes: [50, 20, 70], direction: 'ascending' as const };
  assert.equal(checkSeriationAnswer(puzzle, [1, null, 2]), false);
});

test('checkSeriationAnswer rejects duplicate slot assignment (same tray item used twice)', () => {
  const puzzle = { sizes: [50, 20, 70], direction: 'ascending' as const };
  assert.equal(checkSeriationAnswer(puzzle, [1, 1, 2]), false);
});

test('checkSeriationAnswer rejects a length mismatch', () => {
  const puzzle = { sizes: [50, 20, 70], direction: 'ascending' as const };
  assert.equal(checkSeriationAnswer(puzzle, [1, 0]), false);
});
