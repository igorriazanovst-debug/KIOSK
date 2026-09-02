import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompareStripLabel } from './compareStripLabel.js';

test('formatCompareStripLabel shows a plain calendar year within the historical threshold', () => {
  assert.equal(formatCompareStripLabel(1941), '1941');
  assert.equal(formatCompareStripLabel(2026), '2026');
});

test('formatCompareStripLabel shows "до н.э." for a BCE year (axisYears <= 0)', () => {
  assert.equal(formatCompareStripLabel(0), '1 до н.э.');
  assert.equal(formatCompareStripLabel(-99), '100 до н.э.');
});

test('formatCompareStripLabel switches to "лет назад" past the deep-time threshold', () => {
  const label = formatCompareStripLabel(1950 - 65_000_000);
  // toLocaleString uses a locale-specific thousands separator (non-breaking
  // space for ru-RU, not a plain space) - build the expectation the same
  // way rather than hardcoding the exact separator character.
  assert.equal(label, `${(65_000_000).toLocaleString('ru-RU')} лет назад`);
});

test('formatCompareStripLabel rounds to the nearest whole year', () => {
  assert.equal(formatCompareStripLabel(1941.6), '1942');
});

test('formatCompareStripLabel stays on the calendar (BCE) side exactly at the threshold boundary (inclusive <=)', () => {
  // |axisYears - 1950| === DEEP_TIME_THRESHOLD_YEARS exactly -> still calendar branch
  assert.equal(formatCompareStripLabel(1950 - 10_000), '8051 до н.э.');
});
