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

// Найдено живой проверкой пользователя (2026-09-10): все 4 куска —
// конгруэнтные треугольники (силуэт без цветовой разметки по
// четвертям, ребёнку неоткуда узнать "какой кусок для какого слота"),
// поэтому верно собранный квадрат с ПЕРЕСТАВЛЕННЫМИ между слотами
// кусками должен приниматься наравне с "исходным" порядком — раньше
// принимался только порядок piece[i] → target[i] по индексу.
// ВАЖНО: перестановка визуально дорисовывает силуэт без дыр только если
// кусок довёрнут на (targetIndex - pieceId) * 90° — а не оставлен на 0,
// иначе его контур просто не совпадёт с чужим слотом (см.
// requiredRotationDeg в constructionLogic.ts).
test('checkConstructionAnswer accepts pieces permuted among the 4 (congruent) target slots, each with its compensating rotation', () => {
  const puzzle = generateConstructionPuzzle();
  const targets = puzzle.pieces.map((p) => ({ x: p.targetX, y: p.targetY }));
  // piece 0 -> target 1, piece 1 -> target 0, piece 2 -> target 3, piece 3 -> target 2
  const permutedTargetOrder = [1, 0, 3, 2];
  const states = permutedTargetOrder.map((targetIndex, pieceId) => ({
    x: targets[targetIndex].x,
    y: targets[targetIndex].y,
    rotationDeg: (((targetIndex - pieceId) % 4) + 4) % 4 * 90,
  }));
  assert.equal(checkConstructionAnswer(puzzle, states), true);
});

test('checkConstructionAnswer rejects a permuted placement left at rotation 0 (does not actually tile the silhouette)', () => {
  const puzzle = generateConstructionPuzzle();
  const targets = puzzle.pieces.map((p) => ({ x: p.targetX, y: p.targetY }));
  const permutedTargetOrder = [1, 0, 3, 2];
  const states = permutedTargetOrder.map((targetIndex) => ({
    x: targets[targetIndex].x,
    y: targets[targetIndex].y,
    rotationDeg: 0,
  }));
  assert.equal(checkConstructionAnswer(puzzle, states), false);
});

test('checkConstructionAnswer still rejects when two pieces pile onto the same slot, leaving another empty', () => {
  const puzzle = generateConstructionPuzzle();
  const states = puzzle.pieces.map(() => ({ x: puzzle.pieces[0].targetX, y: puzzle.pieces[0].targetY, rotationDeg: 0 }));
  assert.equal(checkConstructionAnswer(puzzle, states), false);
});
