import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCoarserThan, isFinerThan, coarserOf, isValidCalendarPrecision, CALENDAR_PRECISIONS } from './precision';

test('CALENDAR_PRECISIONS is ordered from finest to coarsest', () => {
  assert.deepEqual(CALENDAR_PRECISIONS, [
    'second', 'minute', 'hour', 'day', 'month', 'year', 'decade', 'century', 'millennium',
  ]);
});

test('isCoarserThan: year is coarser than day', () => {
  assert.equal(isCoarserThan('year', 'day'), true);
  assert.equal(isCoarserThan('day', 'year'), false);
});

test('isCoarserThan: a value is never coarser than itself', () => {
  assert.equal(isCoarserThan('year', 'year'), false);
});

test('isFinerThan is the exact inverse relation of isCoarserThan for distinct values', () => {
  assert.equal(isFinerThan('day', 'year'), true);
  assert.equal(isFinerThan('year', 'day'), false);
});

test('coarserOf picks the coarser of two precisions regardless of argument order', () => {
  assert.equal(coarserOf('day', 'year'), 'year');
  assert.equal(coarserOf('year', 'day'), 'year');
});

test('coarserOf returns the same value when both precisions match', () => {
  assert.equal(coarserOf('month', 'month'), 'month');
});

test('isValidCalendarPrecision accepts every declared precision', () => {
  for (const p of CALENDAR_PRECISIONS) {
    assert.equal(isValidCalendarPrecision(p), true);
  }
});

test('isValidCalendarPrecision rejects unknown strings and non-strings', () => {
  assert.equal(isValidCalendarPrecision('fortnight'), false);
  assert.equal(isValidCalendarPrecision(''), false);
  assert.equal(isValidCalendarPrecision(null), false);
  assert.equal(isValidCalendarPrecision(42), false);
  assert.equal(isValidCalendarPrecision(undefined), false);
});
