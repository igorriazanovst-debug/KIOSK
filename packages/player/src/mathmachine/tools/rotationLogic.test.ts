import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleDelta, accumulateRotation, checkFullTurn, generateRotationPuzzle, ROTATION_SHAPE_COUNT } from './rotationLogic.ts';

test('angleDelta computes the shortest signed difference', () => {
  assert.equal(angleDelta(10, 20), 10);
  assert.equal(angleDelta(350, 10), 20); // wraps forward through 0
  assert.equal(angleDelta(10, 350), -20); // wraps backward through 0
  assert.equal(angleDelta(0, 180), 180);
});

test('accumulateRotation sums signed deltas across a continuous one-direction sweep', () => {
  let acc = 0;
  let angle = 0;
  // simulate a clockwise sweep in 20-degree steps up to 360
  for (let i = 1; i <= 18; i++) {
    const next = i * 20;
    acc = accumulateRotation(acc, angle, next % 360);
    angle = next % 360;
  }
  assert.equal(Math.abs(acc), 360);
});

test('accumulateRotation is NOT fooled by back-and-forth jitter near the start angle', () => {
  let acc = 0;
  let angle = 0;
  // wiggle +30/-30 repeatedly — never actually completes a turn
  for (let i = 0; i < 50; i++) {
    const target = i % 2 === 0 ? 30 : 0;
    acc = accumulateRotation(acc, angle, target);
    angle = target;
  }
  assert.equal(checkFullTurn(acc), false, 'jittering back and forth must not count as a full turn');
});

test('checkFullTurn requires at least the threshold, allowing a small tolerance below 360', () => {
  assert.equal(checkFullTurn(339), false);
  assert.equal(checkFullTurn(340), true);
  assert.equal(checkFullTurn(360), true);
  assert.equal(checkFullTurn(-350), true, 'direction (sign) does not matter, only magnitude');
});

test('generateRotationPuzzle always picks a valid shapeId', () => {
  for (let i = 0; i < 50; i++) {
    const puzzle = generateRotationPuzzle(() => i / 50);
    assert.ok(puzzle.shapeId >= 0 && puzzle.shapeId < ROTATION_SHAPE_COUNT);
  }
});
