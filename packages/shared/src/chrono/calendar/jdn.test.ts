import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarToJdn,
  jdnToCalendar,
  calendarDateTimeToJdn,
  jdnToCalendarDateTime,
} from './jdn';

// ─── One external anchor: J2000.0, the most widely used reference epoch in
// astronomy (2000-01-01 12:00 UTC, Gregorian = JD 2451545.0 exactly). All
// other tests below verify *properties* of the conversion (round-trips,
// continuity, leap years) rather than more memorized magic numbers, which
// are much easier to get subtly wrong from memory than to verify structurally.

test('J2000.0 epoch: 2000-01-01 12:00 Gregorian is exactly JD 2451545.0', () => {
  const jd = calendarDateTimeToJdn({ year: 2000, month: 1, day: 1, hour: 12 }, 'gregorian');
  assert.equal(jd, 2451545.0);
});

test('jdnToCalendarDateTime inverts the J2000.0 anchor exactly', () => {
  const result = jdnToCalendarDateTime(2451545.0, 'gregorian');
  assert.deepEqual(result, { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 });
});

// ─── Round-trip consistency across a wide range, including BCE (negative
// astronomical year numbering) and the year-0/year-1 boundary.

const ROUND_TRIP_DATES: Array<{ year: number; month: number; day: number }> = [
  { year: 2026, month: 9, day: 1 },
  { year: 1941, month: 6, day: 22 },
  { year: 1, month: 1, day: 1 },
  { year: 0, month: 12, day: 31 }, // "1 год до н.э." в астрономической нумерации
  { year: -99, month: 3, day: 15 }, // "100 год до н.э."
  { year: -4712, month: 1, day: 1 },
  { year: 1900, month: 2, day: 28 },
  { year: 2000, month: 2, day: 29 }, // Gregorian leap day
];

for (const calendar of ['gregorian', 'julian'] as const) {
  for (const date of ROUND_TRIP_DATES) {
    test(`round-trip (${calendar}): ${date.year}-${date.month}-${date.day}`, () => {
      const jd = calendarToJdn(date, calendar);
      const back = jdnToCalendar(jd, calendar);
      assert.equal(back.year, date.year);
      assert.equal(back.month, date.month);
      assert.equal(Math.round(back.day), date.day);
    });
  }
}

// ─── Structural properties that must hold regardless of memorized constants

test('consecutive calendar days differ by exactly 1.0 in JDN (Gregorian)', () => {
  const day1 = calendarToJdn({ year: 2026, month: 9, day: 1 }, 'gregorian');
  const day2 = calendarToJdn({ year: 2026, month: 9, day: 2 }, 'gregorian');
  assert.equal(day2 - day1, 1);
});

test('consecutive calendar days differ by exactly 1.0 in JDN (Julian)', () => {
  const day1 = calendarToJdn({ year: 1917, month: 10, day: 25 }, 'julian');
  const day2 = calendarToJdn({ year: 1917, month: 10, day: 26 }, 'julian');
  assert.equal(day2 - day1, 1);
});

test('the Gregorian calendar reform is a continuous 1-day step: Julian 1582-10-04 -> Gregorian 1582-10-15', () => {
  // By definition of the 1582 reform, the day after 4 October (Julian) was
  // declared 15 October (Gregorian) - 10 days (Oct 5-14) never existed.
  // This is the one calendar-history fact this test relies on, not a JDN
  // magic number - and it holds independent of which calendar the caller
  // explicitly requests (this module never auto-switches by date).
  const julianOct4 = calendarToJdn({ year: 1582, month: 10, day: 4 }, 'julian');
  const gregorianOct15 = calendarToJdn({ year: 1582, month: 10, day: 15 }, 'gregorian');
  assert.equal(gregorianOct15 - julianOct4, 1);
});

test('Gregorian leap year rule: 2000 is a leap year (divisible by 400)', () => {
  const feb28 = calendarToJdn({ year: 2000, month: 2, day: 28 }, 'gregorian');
  const mar1 = calendarToJdn({ year: 2000, month: 3, day: 1 }, 'gregorian');
  assert.equal(mar1 - feb28, 2); // Feb 29 exists in between
});

test('Gregorian leap year rule: 1900 is NOT a leap year (divisible by 100, not 400)', () => {
  const feb28 = calendarToJdn({ year: 1900, month: 2, day: 28 }, 'gregorian');
  const mar1 = calendarToJdn({ year: 1900, month: 3, day: 1 }, 'gregorian');
  assert.equal(mar1 - feb28, 1); // no Feb 29
});

test('Julian calendar leap year rule: every 4th year is a leap year, including centuries (unlike Gregorian)', () => {
  // 1900 IS a leap year under the Julian calendar (no century exception).
  const feb28 = calendarToJdn({ year: 1900, month: 2, day: 28 }, 'julian');
  const mar1 = calendarToJdn({ year: 1900, month: 3, day: 1 }, 'julian');
  assert.equal(mar1 - feb28, 2);
});

// ─── Time-of-day handling

test('calendarDateTimeToJdn places noon exactly on the integer+0.5 JDN boundary', () => {
  const midnight = calendarDateTimeToJdn({ year: 2026, month: 9, day: 1, hour: 0 }, 'gregorian');
  const noon = calendarDateTimeToJdn({ year: 2026, month: 9, day: 1, hour: 12 }, 'gregorian');
  assert.equal(noon - midnight, 0.5);
});

test('jdnToCalendarDateTime round-trips an arbitrary time of day', () => {
  const jd = calendarDateTimeToJdn(
    { year: 1941, month: 6, day: 22, hour: 4, minute: 30, second: 15 },
    'gregorian'
  );
  const back = jdnToCalendarDateTime(jd, 'gregorian');
  assert.deepEqual(back, { year: 1941, month: 6, day: 22, hour: 4, minute: 30, second: 15 });
});

test('jdnToCalendarDateTime handles the midnight rollover correctly (does not silently wrap to 00:00:00 on the same day)', () => {
  // 23:59:59.6 rounds to 86400 seconds internally - must carry into the next
  // calendar day, not collapse back to 00:00:00 of the SAME day (the bug
  // this carry-handling exists to prevent).
  const almostMidnight = calendarDateTimeToJdn(
    { year: 2026, month: 2, day: 28, hour: 23, minute: 59, second: 59.6 },
    'gregorian'
  );
  const back = jdnToCalendarDateTime(almostMidnight, 'gregorian');

  assert.equal(back.hour, 0);
  assert.equal(back.minute, 0);
  assert.equal(back.second, 0);
  assert.equal(back.year, 2026);
  assert.equal(back.month, 3);
  assert.equal(back.day, 1); // rolled into March, not stuck on Feb 28
});
