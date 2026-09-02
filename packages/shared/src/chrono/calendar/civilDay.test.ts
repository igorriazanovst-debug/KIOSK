import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDateTimeToCivilDay,
  civilDayToCalendarDateTime,
  civilDayTimeEquals,
  compareCivilDayTime,
} from './civilDay';
import { calendarToJdn } from './jdn';

test('calendarDateTimeToCivilDay/civilDayToCalendarDateTime round-trip a plain date (midnight)', () => {
  const civil = calendarDateTimeToCivilDay({ year: 1941, month: 6, day: 22 }, 'gregorian');
  const back = civilDayToCalendarDateTime(civil, 'gregorian');
  assert.deepEqual(back, { year: 1941, month: 6, day: 22, hour: 0, minute: 0, second: 0 });
});

test('round-trips an arbitrary time of day exactly', () => {
  const civil = calendarDateTimeToCivilDay(
    { year: 1941, month: 6, day: 22, hour: 4, minute: 30, second: 15 },
    'gregorian'
  );
  const back = civilDayToCalendarDateTime(civil, 'gregorian');
  assert.deepEqual(back, { year: 1941, month: 6, day: 22, hour: 4, minute: 30, second: 15 });
});

test('day and secondOfDay are both plain integers, never fractional', () => {
  const civil = calendarDateTimeToCivilDay(
    { year: 2026, month: 9, day: 1, hour: 13, minute: 45, second: 7 },
    'gregorian'
  );
  assert.equal(Number.isInteger(civil.day), true);
  assert.equal(Number.isInteger(civil.secondOfDay), true);
  assert.ok(civil.secondOfDay >= 0 && civil.secondOfDay < 86400);
});

test('secondOfDay 0 is midnight, 43200 is noon, 86399 is one second before the next midnight', () => {
  const midnight = calendarDateTimeToCivilDay({ year: 2026, month: 9, day: 1, hour: 0, minute: 0, second: 0 }, 'gregorian');
  const noon = calendarDateTimeToCivilDay({ year: 2026, month: 9, day: 1, hour: 12, minute: 0, second: 0 }, 'gregorian');
  const lastSecond = calendarDateTimeToCivilDay({ year: 2026, month: 9, day: 1, hour: 23, minute: 59, second: 59 }, 'gregorian');

  assert.equal(midnight.secondOfDay, 0);
  assert.equal(noon.secondOfDay, 43200);
  assert.equal(lastSecond.secondOfDay, 86399);
  // all three are the SAME civil day
  assert.equal(midnight.day, noon.day);
  assert.equal(midnight.day, lastSecond.day);
});

test('consecutive civil days differ by exactly 1', () => {
  const day1 = calendarDateTimeToCivilDay({ year: 2026, month: 9, day: 1 }, 'gregorian');
  const day2 = calendarDateTimeToCivilDay({ year: 2026, month: 9, day: 2 }, 'gregorian');
  assert.equal(day2.day - day1.day, 1);
});

test('rolling seconds past 86400 during rounding carries into the next civil day (fractional-second input near midnight)', () => {
  const civil = calendarDateTimeToCivilDay(
    { year: 2026, month: 2, day: 28, hour: 23, minute: 59, second: 59.6 },
    'gregorian'
  );
  const nextDay = calendarDateTimeToCivilDay({ year: 2026, month: 3, day: 1, hour: 0, minute: 0, second: 0 }, 'gregorian');

  assert.equal(civil.day, nextDay.day);
  assert.equal(civil.secondOfDay, 0);
});

test('civilDayTimeEquals is true only for the exact same day+secondOfDay pair', () => {
  const a = calendarDateTimeToCivilDay({ year: 2026, month: 1, day: 1, hour: 10 }, 'gregorian');
  const b = calendarDateTimeToCivilDay({ year: 2026, month: 1, day: 1, hour: 10 }, 'gregorian');
  const c = calendarDateTimeToCivilDay({ year: 2026, month: 1, day: 1, hour: 11 }, 'gregorian');

  assert.equal(civilDayTimeEquals(a, b), true);
  assert.equal(civilDayTimeEquals(a, c), false);
});

test('compareCivilDayTime orders by day first, then by secondOfDay', () => {
  const earlierDay = calendarDateTimeToCivilDay({ year: 2026, month: 1, day: 1, hour: 23 }, 'gregorian');
  const laterDaySameTimeEarlierHour = calendarDateTimeToCivilDay({ year: 2026, month: 1, day: 2, hour: 0 }, 'gregorian');
  const sameDayLater = calendarDateTimeToCivilDay({ year: 2026, month: 1, day: 1, hour: 23, minute: 30 }, 'gregorian');

  assert.equal(compareCivilDayTime(earlierDay, laterDaySameTimeEarlierHour), -1);
  assert.equal(compareCivilDayTime(earlierDay, sameDayLater), -1);
  assert.equal(compareCivilDayTime(earlierDay, earlierDay), 0);
  assert.equal(compareCivilDayTime(laterDaySameTimeEarlierHour, earlierDay), 1);
});

test('civil day agrees with the underlying JDN math: day equals floor(jdn + 0.5) for a midnight-aligned date', () => {
  const civil = calendarDateTimeToCivilDay({ year: 1917, month: 10, day: 25 }, 'julian');
  const jdn = calendarToJdn({ year: 1917, month: 10, day: 25 }, 'julian');
  assert.equal(civil.day, Math.floor(jdn + 0.5));
});

test('negative time of day input is rejected rather than silently misinterpreted', () => {
  assert.throws(() => calendarDateTimeToCivilDay({ year: 2026, month: 1, day: 1, hour: -1 }, 'gregorian'), RangeError);
});
