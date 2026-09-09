import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateConstructionPuzzle, checkConstructionAnswer } from './constructionLogic.ts';

function fixedRng(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

test('generateConstructionPuzzle is deterministic given a fixed rng', () => {
  const a = generateConstructionPuzzle(fixedRng([0.1, 0.4, 0.7, 0.2]));
  const b = generateConstructionPuzzle(fixedRng([0.1, 0.4, 0.7, 0.2]));
  assert.deepEqual(a, b);
});

test('generateConstructionPuzzle always produces exactly 4 pieces', () => {
  const puzzle = generateConstructionPuzzle();
  assert.equal(puzzle.pieces.length, 4);
  assert.equal(puzzle.initialStates.length, 4);
});

test('generateConstructionPuzzle never scatters a piece already at its correct rotation (0)', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let s = seed;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const puzzle = generateConstructionPuzzle(rng);
    for (const state of puzzle.initialStates) {
      assert.notEqual(state.rotationDeg % 360, 0, 'a piece scattered at rotation 0 would already be correctly oriented — no rotation interaction required');
    }
  }
});

test('checkConstructionAnswer accepts every piece placed exactly at its target', () => {
  const puzzle = generateConstructionPuzzle();
  const states = puzzle.pieces.map((p) => ({ x: p.targetX, y: p.targetY, rotationDeg: 0 }));
  assert.equal(checkConstructionAnswer(puzzle, states), true);
});

test('checkConstructionAnswer accepts a small position/rotation tolerance', () => {
  const puzzle = generateConstructionPuzzle();
  const states = puzzle.pieces.map((p) => ({ x: p.targetX + 5, y: p.targetY - 5, rotationDeg: 360 }));
  assert.equal(checkConstructionAnswer(puzzle, states), true);
});

test('checkConstructionAnswer rejects a piece left at its scattered (non-zero) rotation', () => {
  const puzzle = generateConstructionPuzzle();
  const states = puzzle.pieces.map((p) => ({ x: p.targetX, y: p.targetY, rotationDeg: 90 }));
  assert.equal(checkConstructionAnswer(puzzle, states), false);
});

test('checkConstructionAnswer rejects a piece far from its target position', () => {
  const puzzle = generateConstructionPuzzle();
  const states = puzzle.pieces.map((p) => ({ x: p.targetX, y: p.targetY, rotationDeg: 0 }));
  states[0] = { ...states[0], x: states[0].x + 200 };
  assert.equal(checkConstructionAnswer(puzzle, states), false);
});
