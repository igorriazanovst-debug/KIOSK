import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalance } from './weightsLogic.ts';

test('computeBalance sums each side independently', () => {
  const result = computeBalance([3], [5]);
  assert.equal(result.leftMass, 3);
  assert.equal(result.rightMass, 5);
});

test('computeBalance allows the same value on both sides simultaneously', () => {
  const result = computeBalance([5], [5]);
  assert.equal(result.leftMass, 5);
  assert.equal(result.rightMass, 5);
  assert.equal(result.tiltDegrees, 0);
});

test('computeBalance sums multiple values placed on the same side', () => {
  const result = computeBalance([2, 3, 4], [1]);
  assert.equal(result.leftMass, 9);
  assert.equal(result.rightMass, 1);
});

test('computeBalance tilts toward the heavier side and clamps at 20 degrees', () => {
  const balanced = computeBalance([4], [4]);
  assert.equal(balanced.tiltDegrees, 0);

  const rightHeavy = computeBalance([1], [9]);
  assert.ok(rightHeavy.tiltDegrees > 0);
  assert.equal(rightHeavy.tiltDegrees, 20);

  const leftHeavy = computeBalance([9], [1]);
  assert.ok(leftHeavy.tiltDegrees < 0);
});

test('computeBalance with nothing placed reports zero mass and zero tilt', () => {
  const result = computeBalance([], []);
  assert.equal(result.leftMass, 0);
  assert.equal(result.rightMass, 0);
  assert.equal(result.tiltDegrees, 0);
});
