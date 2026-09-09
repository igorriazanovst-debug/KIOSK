import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTwoSegmentsPuzzle,
  checkSegmentAnswer,
  targetLength,
  RULER_MIN_CM,
  RULER_MAX_CM,
  type TwoSegmentsPuzzle,
} from './twoSegmentsLogic.ts';

test('generateTwoSegmentsPuzzle is deterministic given a fixed rng', () => {
  const puzzle = generateTwoSegmentsPuzzle(() => 0);
  assert.deepEqual(puzzle, { referenceLength: 4, delta: 1, direction: 'longer' });
  assert.equal(targetLength(puzzle), 5);
});

test('generateTwoSegmentsPuzzle always keeps the target length within the ruler range', () => {
  for (let i = 0; i < 200; i++) {
    const puzzle = generateTwoSegmentsPuzzle(Math.random);
    assert.ok(puzzle.referenceLength >= 4 && puzzle.referenceLength <= 20);
    assert.ok(puzzle.delta >= 1 && puzzle.delta <= 10);
    const target = targetLength(puzzle);
    assert.ok(target >= RULER_MIN_CM && target <= RULER_MAX_CM);
  }
});

test('checkSegmentAnswer accepts only the exact target length (longer direction)', () => {
  const puzzle: TwoSegmentsPuzzle = { referenceLength: 10, delta: 3, direction: 'longer' };
  assert.equal(checkSegmentAnswer(puzzle, 13), true);
  assert.equal(checkSegmentAnswer(puzzle, 12), false);
  assert.equal(checkSegmentAnswer(puzzle, 14), false);
});

test('checkSegmentAnswer accepts only the exact target length (shorter direction)', () => {
  const puzzle: TwoSegmentsPuzzle = { referenceLength: 10, delta: 3, direction: 'shorter' };
  assert.equal(checkSegmentAnswer(puzzle, 7), true);
  assert.equal(checkSegmentAnswer(puzzle, 8), false);
});
