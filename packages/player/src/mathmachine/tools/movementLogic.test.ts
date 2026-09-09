import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMovementPuzzle, applyMove, checkMovementAnswer } from './movementLogic.ts';

function fixedRng(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

test('generateMovementPuzzle is deterministic given a fixed rng', () => {
  const a = generateMovementPuzzle(fixedRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  const b = generateMovementPuzzle(fixedRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  assert.deepEqual(a, b);
});

test('generateMovementPuzzle never places start and target on the same cell', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let s = seed;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const puzzle = generateMovementPuzzle(rng);
    assert.ok(puzzle.start.row !== puzzle.target.row || puzzle.start.col !== puzzle.target.col);
    if (puzzle.obstacle) {
      assert.ok(puzzle.obstacle.row !== puzzle.start.row || puzzle.obstacle.col !== puzzle.start.col);
      assert.ok(puzzle.obstacle.row !== puzzle.target.row || puzzle.obstacle.col !== puzzle.target.col);
    }
  }
});

test('applyMove moves one cell in the given direction', () => {
  const puzzle = { size: 5, start: { row: 2, col: 2 }, target: { row: 0, col: 0 }, obstacle: null };
  assert.deepEqual(applyMove(puzzle, { row: 2, col: 2 }, 'up'), { row: 1, col: 2 });
  assert.deepEqual(applyMove(puzzle, { row: 2, col: 2 }, 'down'), { row: 3, col: 2 });
  assert.deepEqual(applyMove(puzzle, { row: 2, col: 2 }, 'left'), { row: 2, col: 1 });
  assert.deepEqual(applyMove(puzzle, { row: 2, col: 2 }, 'right'), { row: 2, col: 3 });
});

test('applyMove refuses to move outside the grid bounds', () => {
  const puzzle = { size: 5, start: { row: 0, col: 0 }, target: { row: 4, col: 4 }, obstacle: null };
  assert.deepEqual(applyMove(puzzle, { row: 0, col: 0 }, 'up'), { row: 0, col: 0 });
  assert.deepEqual(applyMove(puzzle, { row: 0, col: 0 }, 'left'), { row: 0, col: 0 });
});

test('applyMove refuses to move onto the obstacle cell', () => {
  const puzzle = { size: 5, start: { row: 2, col: 2 }, target: { row: 0, col: 0 }, obstacle: { row: 1, col: 2 } };
  assert.deepEqual(applyMove(puzzle, { row: 2, col: 2 }, 'up'), { row: 2, col: 2 });
});

test('checkMovementAnswer is true only when current position equals target', () => {
  const puzzle = { size: 5, start: { row: 0, col: 0 }, target: { row: 3, col: 3 }, obstacle: null };
  assert.equal(checkMovementAnswer(puzzle, { row: 3, col: 3 }), true);
  assert.equal(checkMovementAnswer(puzzle, { row: 3, col: 2 }), false);
});
