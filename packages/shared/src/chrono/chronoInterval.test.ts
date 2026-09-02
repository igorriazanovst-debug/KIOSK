import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRange, rangesOverlap, isOpenEnded, intervalRange, type ChronoInterval } from './chronoInterval';
import { toAxisYears } from './axis';
import { calendarDateTimeToCivilDay } from './calendar/civilDay';
import type { CalendarMoment, EpochMoment, ChronoMoment } from './chronoMoment';

function calMoment(
  precision: CalendarMoment['precision'],
  year: number,
  month = 1,
  day = 1
): CalendarMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month, day }, 'gregorian'),
    precision,
    calendar: 'gregorian',
    approximate: false,
  };
}

function epochMoment(yearsBeforeEpoch: number, precision: EpochMoment['precision']): EpochMoment {
  return { kind: 'epoch', yearsBeforeEpoch, precision, approximate: false };
}

// ─── The scenario the architect review specifically called out: a moment
// with year precision must be a RANGE covering that whole year, so the
// compare strip / search on a specific day inside that year actually hits it.

test('a year-precision moment ("1941") overlaps a day-precision moment inside that year ("22 June 1941")', () => {
  const wholeYear = toRange(calMoment('year', 1941));
  const specificDay = toRange(calMoment('day', 1941, 6, 22));
  assert.equal(rangesOverlap(wholeYear, specificDay), true);
});

test('a year-precision moment does NOT overlap a day in the adjacent year', () => {
  const year1941 = toRange(calMoment('year', 1941));
  const dayIn1942 = toRange(calMoment('day', 1942, 1, 2));
  assert.equal(rangesOverlap(year1941, dayIn1942), false);
});

test('year range width is approximately 1 year', () => {
  const r = toRange(calMoment('year', 2026));
  assert.ok(Math.abs(r.end - r.start - 1) < 0.01, `expected width ~1, got ${r.end - r.start}`);
});

test('year range starts exactly at the axis position of Jan 1 and ends at the axis position of the following Jan 1', () => {
  const r = toRange(calMoment('year', 1941));
  const jan1_1941 = toAxisYears(calMoment('day', 1941, 1, 1));
  const jan1_1942 = toAxisYears(calMoment('day', 1942, 1, 1));
  assert.ok(Math.abs(r.start - jan1_1941) < 1e-9);
  assert.ok(Math.abs(r.end - jan1_1942) < 1e-9);
});

test('month range handles the December -> January year rollover', () => {
  const dec = toRange(calMoment('month', 2026, 12, 15));
  const jan1_2027 = toAxisYears(calMoment('day', 2027, 1, 1));
  assert.ok(Math.abs(dec.end - jan1_2027) < 1e-9);
});

test('day range width is approximately 1/365.25 years and contains its own moment', () => {
  const day = calMoment('day', 2026, 9, 1);
  const r = toRange(day);
  const point = toAxisYears(day);
  assert.ok(r.start <= point && point <= r.end);
  assert.ok(Math.abs(r.end - r.start - 1 / 365.25) < 1e-6);
});

test('decade/century/millennium ranges floor correctly, including BCE (negative astronomical years)', () => {
  const decade = toRange(calMoment('decade', 1944)); // 1944 falls in the 1940s
  const jan1_1940 = toAxisYears(calMoment('day', 1940, 1, 1));
  const jan1_1950 = toAxisYears(calMoment('day', 1950, 1, 1));
  assert.ok(Math.abs(decade.start - jan1_1940) < 1e-9);
  assert.ok(Math.abs(decade.end - jan1_1950) < 1e-9);

  // -99 (100 BCE) falls in the century bucket [-100, 0)
  const century = toRange(calMoment('century', -99));
  const jan1_minus100 = toAxisYears(calMoment('day', -100, 1, 1));
  const jan1_0 = toAxisYears(calMoment('day', 0, 1, 1));
  assert.ok(Math.abs(century.start - jan1_minus100) < 1e-9);
  assert.ok(Math.abs(century.end - jan1_0) < 1e-9);
});

// ─── Epoch branch ────────────────────────────────────────────────────────

test('an epoch moment range is bucketed by its precision unit (floor), not centered on the value', () => {
  // 65_400_000 years before epoch, precision millionYears -> bucket [65M, 66M)
  const r = toRange(epochMoment(65_400_000, 'millionYears'));
  const expectedNewerBound = 1950 - 65_000_000; // axis value at "exactly 65,000,000 years before epoch"
  const expectedOlderBound = 1950 - 66_000_000;
  assert.ok(Math.abs(r.end - expectedNewerBound) < 1e-6);
  assert.ok(Math.abs(r.start - expectedOlderBound) < 1e-6);
});

test('two epoch moments in the same million-year bucket produce overlapping ranges', () => {
  const a = toRange(epochMoment(65_100_000, 'millionYears'));
  const b = toRange(epochMoment(65_900_000, 'millionYears'));
  assert.equal(rangesOverlap(a, b), true);
});

test('two epoch moments in different million-year buckets do not overlap', () => {
  const a = toRange(epochMoment(65_100_000, 'millionYears'));
  const b = toRange(epochMoment(67_100_000, 'millionYears'));
  assert.equal(rangesOverlap(a, b), false);
});

// ─── rangesOverlap edge cases ────────────────────────────────────────────

test('rangesOverlap treats touching boundaries as overlapping (inclusive)', () => {
  assert.equal(rangesOverlap({ start: 0, end: 10 }, { start: 10, end: 20 }), true);
});

test('rangesOverlap is false for clearly disjoint ranges', () => {
  assert.equal(rangesOverlap({ start: 0, end: 10 }, { start: 20, end: 30 }), false);
});

// ─── Symbolic open end (Б4) ──────────────────────────────────────────────

test('isOpenEnded is true only when end is null', () => {
  const open: ChronoInterval = { start: calMoment('year', 2020), end: null };
  const closed: ChronoInterval = { start: calMoment('year', 2020), end: calMoment('year', 2025) };
  assert.equal(isOpenEnded(open), true);
  assert.equal(isOpenEnded(closed), false);
});

test('intervalRange of an open-ended interval extends to +Infinity, not to a materialized "today"', () => {
  const open: ChronoInterval = { start: calMoment('year', 2020), end: null };
  const range = intervalRange(open);
  assert.equal(range.end, Infinity);
});

test('intervalRange of a closed interval spans from the start of the first moment to the end of the last', () => {
  const closed: ChronoInterval = { start: calMoment('year', 2020), end: calMoment('year', 2022) };
  const range = intervalRange(closed);
  const jan1_2020 = toAxisYears(calMoment('day', 2020, 1, 1));
  const jan1_2023 = toAxisYears(calMoment('day', 2023, 1, 1));
  assert.ok(Math.abs(range.start - jan1_2020) < 1e-9);
  assert.ok(Math.abs(range.end - jan1_2023) < 1e-9);
});
