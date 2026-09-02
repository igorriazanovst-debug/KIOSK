import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTickLabel } from './tickLabel.js';
import type { Tick } from '@kiosk/shared';

function tick(axisYears: number, unit: Tick['unit'], multiplier = 1): Tick {
  return { axisYears, unit, multiplier, stepYears: 1 };
}

test('a recent calendar-range tick formats as a plain year', () => {
  assert.equal(formatTickLabel(tick(1941, 'year')), '1941');
});

test('a BCE calendar-range tick formats with "до н.э."', () => {
  assert.equal(formatTickLabel(tick(-99, 'year')), '100 до н.э.');
});

test('a decade tick close to the present rounds to the nearest year and formats as a plain number', () => {
  assert.equal(formatTickLabel(tick(1940, 'decade')), '1940');
});

// ─── The specific case this module exists for: 'millennium' is ambiguous
// between calendar and epoch branches - the label must pick the right
// style from the VALUE, since the unit tag alone can't disambiguate. ──────

test('a millennium-unit tick near the historical era formats as a plain calendar year', () => {
  assert.equal(formatTickLabel(tick(1200, 'millennium')), '1200');
});

test('a millennium-unit tick in deep time (65 million years before present) formats as "N млн лет назад"', () => {
  assert.equal(formatTickLabel(tick(1950 - 65_000_000, 'millennium')), '65000 тыс. лет назад');
});

// ─── Deep time formatting ──────────────────────────────────────────────

test('a tenMillionYears-unit tick formats using the epoch unit word/divisor', () => {
  const label = formatTickLabel(tick(1950 - 30_000_000, 'tenMillionYears'));
  assert.equal(label, '30 млн лет назад');
});

test('a billionYears-unit tick formats in billions', () => {
  const label = formatTickLabel(tick(1950 - 4_500_000_000, 'billionYears'));
  assert.equal(label, '4.5 млрд лет назад');
});

test('deep time in the future direction (positive axis, far beyond present) still uses calendar-year style if the unit is calendar-only', () => {
  // year/decade/century units never appear this far out in practice (ticks.ts
  // would never choose them for such a huge span), but the label function
  // must not crash or produce nonsense if it ever received one.
  assert.equal(formatTickLabel(tick(1950 + 50_000, 'year')), '51950');
});
