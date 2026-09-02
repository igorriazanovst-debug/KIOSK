import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationBetween, durationToYears, sumDurations, averageDuration } from './chronoDuration';
import { toAxisYears } from './axis';
import { calendarDateTimeToCivilDay } from './calendar/civilDay';
import type { CalendarMoment, EpochMoment } from './chronoMoment';

function calMoment(year: number, month = 1, day = 1): CalendarMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month, day }, 'gregorian'),
    precision: 'day',
    calendar: 'gregorian',
    approximate: false,
  };
}

function epochMoment(yearsBeforeEpoch: number): EpochMoment {
  return { kind: 'epoch', yearsBeforeEpoch, precision: 'millionYears', approximate: false };
}

// ─── Same-branch: exact ──────────────────────────────────────────────────

test('durationBetween two calendar moments is exact (integer days), regardless of argument order', () => {
  const a = calMoment(2020, 1, 1);
  const b = calMoment(2020, 1, 11);
  const d1 = durationBetween(a, b);
  const d2 = durationBetween(b, a);
  assert.deepEqual(d1, { kind: 'calendar', days: 10 });
  assert.deepEqual(d2, { kind: 'calendar', days: 10 });
});

test('durationBetween two epoch moments is exact (years), regardless of argument order', () => {
  const a = epochMoment(65_000_000);
  const b = epochMoment(66_000_000);
  assert.deepEqual(durationBetween(a, b), { kind: 'epoch', years: 1_000_000 });
  assert.deepEqual(durationBetween(b, a), { kind: 'epoch', years: 1_000_000 });
});

test('durationBetween a moment and itself is zero', () => {
  const a = calMoment(1941, 6, 22);
  assert.deepEqual(durationBetween(a, a), { kind: 'calendar', days: 0 });
});

// ─── Cross-branch: degrades to axisYears (this is the case the reference
// app never handled correctly - разбор строка 35) ───────────────────────

test('durationBetween a calendar moment and an epoch moment degrades to axisYears', () => {
  const wwii = calMoment(1941, 6, 22);
  const dinosaurs = epochMoment(65_000_000);
  const d = durationBetween(wwii, dinosaurs);
  assert.equal(d.kind, 'axisYears');
});

test('the degraded cross-branch duration matches |toAxisYears(a) - toAxisYears(b)| exactly', () => {
  const wwii = calMoment(1941, 6, 22);
  const dinosaurs = epochMoment(65_000_000);
  const d = durationBetween(wwii, dinosaurs);
  const expected = Math.abs(toAxisYears(wwii) - toAxisYears(dinosaurs));
  assert.equal((d as { years: number }).years, expected);
});

// ─── durationToYears ─────────────────────────────────────────────────────

test('durationToYears converts calendar days using the same 365.25 convention as the axis', () => {
  assert.equal(durationToYears({ kind: 'calendar', days: 365.25 }), 1);
});

test('durationToYears passes epoch/axisYears through unchanged', () => {
  assert.equal(durationToYears({ kind: 'epoch', years: 42 }), 42);
  assert.equal(durationToYears({ kind: 'axisYears', years: 7.5 }), 7.5);
});

// ─── sumDurations / averageDuration: branch preservation vs degradation ──

test('sumDurations of all-calendar durations stays in the calendar branch, exact', () => {
  const sum = sumDurations([
    { kind: 'calendar', days: 10 },
    { kind: 'calendar', days: 20 },
    { kind: 'calendar', days: 5 },
  ]);
  assert.deepEqual(sum, { kind: 'calendar', days: 35 });
});

test('sumDurations of all-epoch durations stays in the epoch branch, exact', () => {
  const sum = sumDurations([
    { kind: 'epoch', years: 1_000_000 },
    { kind: 'epoch', years: 2_000_000 },
  ]);
  assert.deepEqual(sum, { kind: 'epoch', years: 3_000_000 });
});

test('sumDurations of mixed-branch durations degrades to axisYears', () => {
  const sum = sumDurations([
    { kind: 'calendar', days: 365.25 }, // 1 year
    { kind: 'epoch', years: 1 },
  ]);
  assert.equal(sum.kind, 'axisYears');
  assert.equal((sum as { years: number }).years, 2);
});

test('sumDurations of an empty list is a zero axisYears duration', () => {
  assert.deepEqual(sumDurations([]), { kind: 'axisYears', years: 0 });
});

test('averageDuration matches the reference app\'s "Среднее"/"Сумма" scenario: 2 same-line events, 4 and 8 years apart -> average 6 years', () => {
  const durations = [
    { kind: 'calendar' as const, days: 4 * 365.25 },
    { kind: 'calendar' as const, days: 8 * 365.25 },
  ];
  const avg = averageDuration(durations);
  assert.equal(avg.kind, 'calendar');
  assert.ok(Math.abs(durationToYears(avg) - 6) < 1e-9);
});

test('averageDuration of an empty list is a zero axisYears duration', () => {
  assert.deepEqual(averageDuration([]), { kind: 'axisYears', years: 0 });
});

test('averageDuration of mixed-branch durations degrades to axisYears, correctly divided', () => {
  const avg = averageDuration([
    { kind: 'calendar', days: 365.25 }, // 1 year
    { kind: 'epoch', years: 3 },
  ]);
  assert.equal(avg.kind, 'axisYears');
  assert.ok(Math.abs((avg as { years: number }).years - 2) < 1e-9); // (1 + 3) / 2
});
