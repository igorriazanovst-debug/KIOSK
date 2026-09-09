import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalance } from './weightsLogic.ts';

test('computeBalance sums placed weights per pan and ignores unplaced ones', () => {
  const result = computeBalance([
    { value: 3, pan: 'left' },
    { value: 5, pan: 'right' },
    { value: 9, pan: null },
  ]);
  assert.equal(result.leftMass, 3);
  assert.equal(result.rightMass, 5);
});

test('computeBalance tilts toward the heavier side and clamps at 20 degrees', () => {
  const balanced = computeBalance([{ value: 4, pan: 'left' }, { value: 4, pan: 'right' }]);
  assert.equal(balanced.tiltDegrees, 0);

  const rightHeavy = computeBalance([{ value: 1, pan: 'left' }, { value: 9, pan: 'right' }]);
  assert.ok(rightHeavy.tiltDegrees > 0);
  assert.equal(rightHeavy.tiltDegrees, 20);

  const leftHeavy = computeBalance([{ value: 9, pan: 'left' }, { value: 1, pan: 'right' }]);
  assert.ok(leftHeavy.tiltDegrees < 0);
});

test('computeBalance with no weights placed reports zero mass and zero tilt', () => {
  const result = computeBalance([{ value: 5, pan: null }]);
  assert.equal(result.leftMass, 0);
  assert.equal(result.rightMass, 0);
  assert.equal(result.tiltDegrees, 0);
});
