import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDeformationPuzzle, checkDeformationAnswer, BASE_SIZE } from './deformationLogic.ts';

test('generateDeformationPuzzle is deterministic given a fixed rng', () => {
  const seq = [0.1, 0.9];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  let j = 0;
  const rng2 = () => seq[j++ % seq.length];
  assert.deepEqual(generateDeformationPuzzle(rng), generateDeformationPuzzle(rng2));
});

test('generateDeformationPuzzle never targets a ratio too close to 1 (no-op deformation)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    let s = seed;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const puzzle = generateDeformationPuzzle(rng);
    assert.ok(Math.abs(puzzle.targetRatio - 1) >= 0.3, `targetRatio ${puzzle.targetRatio} is too close to 1 — would pass without any real deformation`);
    assert.ok(puzzle.targetRatio > 0);
  }
});

test('checkDeformationAnswer accepts a width matching the target ratio exactly', () => {
  const puzzle = { targetRatio: 2, isEllipse: false };
  assert.equal(checkDeformationAnswer(puzzle, BASE_SIZE * 2, BASE_SIZE), true);
});

test('checkDeformationAnswer accepts within tolerance and rejects outside it', () => {
  const puzzle = { targetRatio: 2, isEllipse: false };
  assert.equal(checkDeformationAnswer(puzzle, BASE_SIZE * 2 * 1.1, BASE_SIZE), true); // 10% off, within 15% tolerance
  assert.equal(checkDeformationAnswer(puzzle, BASE_SIZE * 2 * 1.3, BASE_SIZE), false); // 30% off
});

test('checkDeformationAnswer rejects leaving the shape at its starting 1:1 ratio', () => {
  const puzzle = { targetRatio: 2, isEllipse: false };
  assert.equal(checkDeformationAnswer(puzzle, BASE_SIZE, BASE_SIZE), false);
});
