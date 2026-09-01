import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftMoment, shiftInterval } from './shiftMoment';
import { toAxisYears } from './axis';
import { civilDayToCalendarDateTime, calendarDateTimeToCivilDay } from './calendar/civilDay';
import type { CalendarMoment, EpochMoment } from './chronoMoment';
import type { ChronoInterval } from './chronoInterval';

function calendarMoment(year: number, month = 1, day = 1, precision: CalendarMoment['precision'] = 'day'): CalendarMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month, day }, 'gregorian'),
    precision,
    calendar: 'gregorian',
    approximate: false,
  };
}

function epochMoment(yearsBeforeEpoch: number, precision: EpochMoment['precision'] = 'millionYears'): EpochMoment {
  return { kind: 'epoch', yearsBeforeEpoch, precision, approximate: true };
}

test('shiftMoment on a calendar moment by +1 axis year moves the axis position forward by ~1 year', () => {
  // Deliberately checked via toAxisYears, not exact calendar fields: the
  // shift is DAYS_PER_YEAR=365.25 days rounded to a whole day, so landing
  // exactly on "the same month/day next year" isn't guaranteed across a
  // leap year - that's expected approximation, not a bug.
  const moment = calendarMoment(2000, 1, 1);
  const shifted = shiftMoment(moment, 1);

  assert.ok(Math.abs(toAxisYears(shifted) - (toAxisYears(moment) + 1)) < 0.01);
});

test('shiftMoment by 0 leaves the moment unchanged', () => {
  const moment = calendarMoment(2000, 6, 15);
  assert.deepEqual(shiftMoment(moment, 0), moment);
});

test('shiftMoment preserves kind, precision, calendar and approximate - only the position moves', () => {
  const moment = calendarMoment(1941, 6, 22, 'month');
  const shifted = shiftMoment(moment, 5) as CalendarMoment;

  assert.equal(shifted.kind, 'calendar');
  assert.equal(shifted.precision, 'month');
  assert.equal(shifted.calendar, moment.calendar);
  assert.equal(shifted.approximate, moment.approximate);
});

test('shiftMoment crosses a month/year boundary correctly (delegates to civilDay integer math)', () => {
  const moment = calendarMoment(1999, 12, 20);
  // ~20 days forward should land in January 2000
  const shifted = shiftMoment(moment, 20 / 365.25) as CalendarMoment;
  const dt = civilDayToCalendarDateTime(shifted.civilDay, 'gregorian');

  assert.equal(dt.year, 2000);
  assert.equal(dt.month, 1);
});

test('shiftMoment on an epoch moment: moving toward the present decreases yearsBeforeEpoch', () => {
  const moment = epochMoment(65_000_000);
  const shifted = shiftMoment(moment, 1_000_000) as EpochMoment;

  assert.equal(shifted.kind, 'epoch');
  assert.equal(shifted.yearsBeforeEpoch, 64_000_000);
  assert.equal(shifted.precision, moment.precision);
});

test('shiftMoment on an epoch moment: moving into the past increases yearsBeforeEpoch', () => {
  const moment = epochMoment(65_000_000);
  const shifted = shiftMoment(moment, -1_000_000) as EpochMoment;
  assert.equal(shifted.yearsBeforeEpoch, 66_000_000);
});

test('shiftInterval shifts both ends by the same delta, preserving the duration', () => {
  const start = calendarMoment(1941, 6, 22);
  const end = calendarMoment(1945, 5, 9);
  const interval: ChronoInterval = { start, end };

  const durationBefore = toAxisYears(end) - toAxisYears(start);
  const shifted = shiftInterval(interval, 10);
  const durationAfter = toAxisYears(shifted.end!) - toAxisYears(shifted.start);

  assert.ok(Math.abs(durationAfter - durationBefore) < 0.01, 'duration must be preserved (within rounding to whole days)');
  assert.ok(Math.abs(toAxisYears(shifted.start) - (toAxisYears(start) + 10)) < 0.01);
});

test('shiftInterval leaves an open end (null, "to the present") untouched', () => {
  const start = calendarMoment(1991, 1, 1);
  const interval: ChronoInterval = { start, end: null };
  const shifted = shiftInterval(interval, 5);

  assert.equal(shifted.end, null);
});
