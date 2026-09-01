import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAxisYears, compareMoments } from './axis';
import { EPOCH_REFERENCE_YEAR, type CalendarMoment, type EpochMoment, type ChronoMoment } from './chronoMoment';
import { calendarDateTimeToCivilDay } from './calendar/civilDay';

function calendarMoment(year: number, month = 1, day = 1): CalendarMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month, day }, 'gregorian'),
    precision: 'day',
    calendar: 'gregorian',
    approximate: false,
  };
}

function epochMoment(yearsBeforeEpoch: number, precision: EpochMoment['precision'] = 'millionYears'): EpochMoment {
  return { kind: 'epoch', yearsBeforeEpoch, precision, approximate: true };
}

// ─── toAxisYears sanity ──────────────────────────────────────────────────

test('toAxisYears of a calendar moment near year 2000 is approximately 2000', () => {
  // Tolerance is generous on purpose: the axis uses the Julian mean year
  // (365.25) rather than the more precise Gregorian mean (365.2425), so a
  // couple thousand years of accumulated drift is expected, not a bug - see
  // the comment on DAYS_PER_YEAR in axis.ts.
  const axis = toAxisYears(calendarMoment(2000, 1, 1));
  assert.ok(Math.abs(axis - 2000) < 1, `expected ~2000 (within 1 year), got ${axis}`);
});

test('toAxisYears of "0 years before epoch" equals EPOCH_REFERENCE_YEAR exactly', () => {
  assert.equal(toAxisYears(epochMoment(0)), EPOCH_REFERENCE_YEAR);
});

test('toAxisYears of "100 years before epoch" is EPOCH_REFERENCE_YEAR - 100', () => {
  assert.equal(toAxisYears(epochMoment(100)), EPOCH_REFERENCE_YEAR - 100);
});

test('toAxisYears places a 65-million-year-old epoch moment far in the past relative to any calendar moment', () => {
  const dinosaurs = toAxisYears(epochMoment(65_000_000));
  const wwii = toAxisYears(calendarMoment(1941, 6, 22));
  assert.ok(dinosaurs < wwii);
  assert.ok(wwii - dinosaurs > 64_000_000);
});

// ─── compareMoments: same-branch exactness ──────────────────────────────

test('compareMoments orders two calendar moments correctly', () => {
  assert.equal(compareMoments(calendarMoment(1941, 6, 22), calendarMoment(2026, 9, 1)), -1);
  assert.equal(compareMoments(calendarMoment(2026, 9, 1), calendarMoment(1941, 6, 22)), 1);
  assert.equal(compareMoments(calendarMoment(1941, 6, 22), calendarMoment(1941, 6, 22)), 0);
});

test('compareMoments orders two epoch moments correctly (larger yearsBeforeEpoch = further in the past = earlier)', () => {
  assert.equal(compareMoments(epochMoment(65_000_000), epochMoment(10_000)), -1);
  assert.equal(compareMoments(epochMoment(10_000), epochMoment(65_000_000)), 1);
  assert.equal(compareMoments(epochMoment(1_000_000), epochMoment(1_000_000)), 0);
});

// ─── compareMoments: cross-branch ────────────────────────────────────────

test('compareMoments places a calendar-branch event after an epoch-branch event from deep time', () => {
  assert.equal(compareMoments(epochMoment(65_000_000), calendarMoment(1941, 6, 22)), -1);
  assert.equal(compareMoments(calendarMoment(1941, 6, 22), epochMoment(65_000_000)), 1);
});

// ─── The invariant the architect review explicitly required: within one
// branch, the sign of the exact comparator must always match the sign of
// the axis-based comparator. Checked as a property across many pairs, not
// just the handful of examples above. ─────────────────────────────────────

function randomCalendarMoment(): CalendarMoment {
  const year = Math.floor(Math.random() * 8000) - 4000; // -4000..3999
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28); // stay within all months' range
  return calendarMoment(year, month, day);
}

function randomEpochMoment(): EpochMoment {
  const yearsBeforeEpoch = Math.floor(Math.random() * 4_500_000_000);
  return epochMoment(yearsBeforeEpoch);
}

function axisSign(a: ChronoMoment, b: ChronoMoment): -1 | 0 | 1 {
  const diff = toAxisYears(a) - toAxisYears(b);
  if (diff === 0) return 0;
  return diff < 0 ? -1 : 1;
}

test('property: exact compareMoments and axis-based comparison agree in sign for 2000 random calendar-moment pairs', () => {
  for (let i = 0; i < 2000; i++) {
    const a = randomCalendarMoment();
    const b = randomCalendarMoment();
    const exact = compareMoments(a, b);
    const axis = axisSign(a, b);
    assert.equal(
      exact,
      axis,
      `mismatch for ${JSON.stringify(a)} vs ${JSON.stringify(b)}: exact=${exact}, axis=${axis}`
    );
  }
});

test('property: exact compareMoments and axis-based comparison agree in sign for 2000 random epoch-moment pairs', () => {
  for (let i = 0; i < 2000; i++) {
    const a = randomEpochMoment();
    const b = randomEpochMoment();
    const exact = compareMoments(a, b);
    const axis = axisSign(a, b);
    assert.equal(
      exact,
      axis,
      `mismatch for ${JSON.stringify(a)} vs ${JSON.stringify(b)}: exact=${exact}, axis=${axis}`
    );
  }
});

test('approximate flag has zero effect on ordering (representation-only, per architect review)', () => {
  const precise = calendarMoment(1941, 6, 22);
  const approx: CalendarMoment = { ...precise, approximate: true };
  assert.equal(compareMoments(precise, approx), 0);
  assert.equal(toAxisYears(precise), toAxisYears(approx));
});
