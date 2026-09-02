import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCoarserThan,
  isFinerThan,
  coarserOf,
  isValidPrecision,
  isValidForCalendarBranch,
  isValidForEpochBranch,
  PRECISION_LADDER,
  CALENDAR_PRECISIONS,
  EPOCH_PRECISIONS,
  APPROX_YEARS_PER_UNIT,
} from './precision';

test('PRECISION_LADDER is a single ladder ordered from finest to coarsest, spanning seconds to billions of years', () => {
  assert.deepEqual(PRECISION_LADDER, [
    'second', 'minute', 'hour', 'day', 'month', 'year', 'decade', 'century', 'millennium',
    'tenThousandYears', 'hundredThousandYears', 'millionYears', 'tenMillionYears',
    'hundredMillionYears', 'billionYears',
  ]);
});

test('isCoarserThan/isFinerThan work across the whole ladder, not just within one branch', () => {
  assert.equal(isCoarserThan('year', 'day'), true);
  assert.equal(isCoarserThan('day', 'year'), false);
  assert.equal(isCoarserThan('billionYears', 'year'), true);
  assert.equal(isFinerThan('second', 'billionYears'), true);
});

test('isCoarserThan: a value is never coarser than itself', () => {
  assert.equal(isCoarserThan('year', 'year'), false);
});

test('coarserOf picks the coarser of two precisions regardless of argument order', () => {
  assert.equal(coarserOf('day', 'year'), 'year');
  assert.equal(coarserOf('year', 'day'), 'year');
  assert.equal(coarserOf('millennium', 'millionYears'), 'millionYears');
});

test('isValidPrecision accepts every declared ladder entry and rejects unknown values', () => {
  for (const p of PRECISION_LADDER) {
    assert.equal(isValidPrecision(p), true);
  }
  assert.equal(isValidPrecision('fortnight'), false);
  assert.equal(isValidPrecision(null), false);
  assert.equal(isValidPrecision(42), false);
});

// ─── Branch validity and the overlap zone (Б3) ──────────────────────────────

test('CALENDAR_PRECISIONS runs from second up to and including millennium', () => {
  assert.deepEqual(CALENDAR_PRECISIONS, [
    'second', 'minute', 'hour', 'day', 'month', 'year', 'decade', 'century', 'millennium',
  ]);
});

test('EPOCH_PRECISIONS runs from millennium (inclusive) up to billionYears', () => {
  assert.deepEqual(EPOCH_PRECISIONS, [
    'millennium', 'tenThousandYears', 'hundredThousandYears', 'millionYears',
    'tenMillionYears', 'hundredMillionYears', 'billionYears',
  ]);
});

test('millennium is valid for both branches - the overlap zone the review requires', () => {
  assert.equal(isValidForCalendarBranch('millennium'), true);
  assert.equal(isValidForEpochBranch('millennium'), true);
});

test('day is calendar-only, billionYears is epoch-only - no overlap outside the millennium boundary', () => {
  assert.equal(isValidForCalendarBranch('day'), true);
  assert.equal(isValidForEpochBranch('day'), false);

  assert.equal(isValidForEpochBranch('billionYears'), true);
  assert.equal(isValidForCalendarBranch('billionYears'), false);
});

test('every precision belongs to at least one branch (no orphaned ladder entry)', () => {
  for (const p of PRECISION_LADDER) {
    assert.equal(isValidForCalendarBranch(p) || isValidForEpochBranch(p), true, `${p} belongs to neither branch`);
  }
});

// ─── Approx-years table used later by the tick generator (Фаза 3) ──────────

test('APPROX_YEARS_PER_UNIT has an entry for every ladder precision, monotonically increasing', () => {
  let prev = 0;
  for (const p of PRECISION_LADDER) {
    const years = APPROX_YEARS_PER_UNIT[p];
    assert.equal(typeof years, 'number');
    assert.ok(years > prev, `${p} (${years}) is not greater than the previous unit (${prev})`);
    prev = years;
  }
});

test('APPROX_YEARS_PER_UNIT: year is exactly 1, billionYears is exactly 1e9', () => {
  assert.equal(APPROX_YEARS_PER_UNIT.year, 1);
  assert.equal(APPROX_YEARS_PER_UNIT.billionYears, 1_000_000_000);
});
