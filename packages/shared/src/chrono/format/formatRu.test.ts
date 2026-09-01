import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRoman, formatCalendarMoment, formatEpochMoment, formatMoment, formatInterval, formatDuration } from './formatRu';
import { calendarDateTimeToCivilDay } from '../calendar/civilDay';
import type { CalendarMoment, EpochMoment } from '../chronoMoment';
import type { ChronoInterval } from '../chronoInterval';
import type { ChronoDuration } from '../chronoDuration';

function calMoment(
  precision: CalendarMoment['precision'],
  year: number,
  opts: { month?: number; day?: number; hour?: number; minute?: number; second?: number; approximate?: boolean; calendar?: CalendarMoment['calendar'] } = {}
): CalendarMoment {
  const { month = 1, day = 1, hour = 0, minute = 0, second = 0, approximate = false, calendar = 'gregorian' } = opts;
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month, day, hour, minute, second }, calendar),
    precision,
    calendar,
    approximate,
  };
}

// ─── toRoman ─────────────────────────────────────────────────────────────

test('toRoman handles well-known values', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(20), 'XX');
  assert.equal(toRoman(1941), 'MCMXLI');
  assert.equal(toRoman(2026), 'MMXXVI');
});

test('toRoman rejects out-of-range input', () => {
  assert.throws(() => toRoman(0), RangeError);
  assert.throws(() => toRoman(4000), RangeError);
  assert.throws(() => toRoman(1.5), RangeError);
});

// ─── formatCalendarMoment: precision levels ─────────────────────────────

test('year precision formats as a bare year', () => {
  assert.equal(formatCalendarMoment(calMoment('year', 1941)), '1941');
});

test('month precision formats as "месяц год" (nominative)', () => {
  assert.equal(formatCalendarMoment(calMoment('month', 1941, { month: 6 })), 'июнь 1941');
});

test('day precision formats as "день месяца год" (genitive month)', () => {
  assert.equal(formatCalendarMoment(calMoment('day', 1941, { month: 6, day: 22 })), '22 июня 1941');
});

test('hour precision includes HH:00', () => {
  assert.equal(
    formatCalendarMoment(calMoment('hour', 1941, { month: 6, day: 22, hour: 4 })),
    '22 июня 1941, 04:00'
  );
});

test('second precision includes HH:MM:SS', () => {
  assert.equal(
    formatCalendarMoment(calMoment('second', 1941, { month: 6, day: 22, hour: 4, minute: 5, second: 9 })),
    '22 июня 1941, 04:05:09'
  );
});

test('decade precision formats as "19N0-е"', () => {
  assert.equal(formatCalendarMoment(calMoment('decade', 1944)), '1940-е');
});

test('century precision formats with Roman numerals: 1941 is the XX century', () => {
  assert.equal(formatCalendarMoment(calMoment('century', 1941)), 'XX век');
});

test('century boundary: year 2000 is still the XX century, year 2001 is the XXI', () => {
  assert.equal(formatCalendarMoment(calMoment('century', 2000)), 'XX век');
  assert.equal(formatCalendarMoment(calMoment('century', 2001)), 'XXI век');
});

test('millennium precision formats with Roman numerals', () => {
  assert.equal(formatCalendarMoment(calMoment('millennium', 1941)), 'II тысячелетие');
  assert.equal(formatCalendarMoment(calMoment('millennium', 2026)), 'III тысячелетие');
});

// ─── BCE (до н.э.) ───────────────────────────────────────────────────────

test('year 0 (astronomical) is "1 до н.э." (historical numbering, no year zero)', () => {
  assert.equal(formatCalendarMoment(calMoment('year', 0)), '1 до н.э.');
});

test('year -99 (astronomical) is "100 до н.э."', () => {
  assert.equal(formatCalendarMoment(calMoment('year', -99)), '100 до н.э.');
});

test('BCE day precision carries the "до н.э." suffix on the year', () => {
  assert.equal(formatCalendarMoment(calMoment('day', -43, { month: 3, day: 15 })), '15 марта 44 до н.э.');
});

// ─── approximate / calendar system modifiers ────────────────────────────

test('approximate flag adds a "приблизительно" prefix', () => {
  assert.equal(formatCalendarMoment(calMoment('year', 1941, { approximate: true })), 'приблизительно 1941');
});

test('julian calendar adds a "(по старому стилю)" suffix', () => {
  assert.equal(
    formatCalendarMoment(calMoment('day', 1917, { month: 10, day: 25, calendar: 'julian' })),
    '25 октября 1917 (по старому стилю)'
  );
});

// ─── EpochMoment ─────────────────────────────────────────────────────────

test('epoch moment formats as "N unit назад"', () => {
  const m: EpochMoment = { kind: 'epoch', yearsBeforeEpoch: 65_000_000, precision: 'millionYears', approximate: false };
  assert.equal(formatEpochMoment(m), '65 млн лет назад');
});

test('epoch moment with a fractional-unit value (billions)', () => {
  const m: EpochMoment = { kind: 'epoch', yearsBeforeEpoch: 4_500_000_000, precision: 'billionYears', approximate: true };
  assert.equal(formatEpochMoment(m), '~4.5 млрд лет назад');
});

test('epoch moment: approximate adds a "~" prefix, not a word (short, fits the compact scale label)', () => {
  const m: EpochMoment = { kind: 'epoch', yearsBeforeEpoch: 10_000, precision: 'tenThousandYears', approximate: true };
  assert.equal(formatEpochMoment(m), '~10 тыс. лет назад');
});

// ─── formatMoment dispatch + formatInterval ──────────────────────────────

test('formatMoment dispatches to the correct branch formatter', () => {
  assert.equal(formatMoment(calMoment('year', 1941)), '1941');
  assert.equal(
    formatMoment({ kind: 'epoch', yearsBeforeEpoch: 1_000_000, precision: 'millionYears', approximate: false }),
    '1 млн лет назад'
  );
});

test('formatInterval with a closed end: "с X по Y"', () => {
  const interval: ChronoInterval = { start: calMoment('year', 1941), end: calMoment('year', 1945) };
  assert.equal(formatInterval(interval), 'с 1941 по 1945');
});

test('formatInterval with a symbolic open end: "X — по настоящее время", never a materialized date', () => {
  const interval: ChronoInterval = { start: calMoment('year', 2020), end: null };
  assert.equal(formatInterval(interval), '2020 — по настоящее время');
});

// ─── formatDuration ────────────────────────────────────────────────────

test('formatDuration shows short calendar durations in days, with correct Russian pluralization', () => {
  assert.equal(formatDuration({ kind: 'calendar', days: 1 }), '1 день');
  assert.equal(formatDuration({ kind: 'calendar', days: 3 }), '3 дня');
  assert.equal(formatDuration({ kind: 'calendar', days: 11 }), '11 дней');
  assert.equal(formatDuration({ kind: 'calendar', days: 21 }), '21 день');
});

test('formatDuration switches from days to years once a calendar duration reaches a year', () => {
  const oneYear: ChronoDuration = { kind: 'calendar', days: 365 };
  assert.equal(formatDuration(oneYear), '1 год');
});

test('formatDuration pluralizes years correctly (1 год / 2-4 года / 5+ лет, with the 11-14 exception)', () => {
  assert.equal(formatDuration({ kind: 'epoch', years: 1 }), '1 год');
  assert.equal(formatDuration({ kind: 'epoch', years: 3 }), '3 года');
  assert.equal(formatDuration({ kind: 'epoch', years: 5 }), '5 лет');
  assert.equal(formatDuration({ kind: 'epoch', years: 11 }), '11 лет');
  assert.equal(formatDuration({ kind: 'epoch', years: 21 }), '21 год');
});

test('formatDuration scales to тыс./млн/млрд лет for large durations, matching EPOCH_UNIT_WORD terminology', () => {
  assert.equal(formatDuration({ kind: 'epoch', years: 5_000 }), '5 тыс. лет');
  assert.equal(formatDuration({ kind: 'epoch', years: 65_000_000 }), '65 млн лет');
  assert.equal(formatDuration({ kind: 'epoch', years: 4_500_000_000 }), '4.5 млрд лет');
});

test('formatDuration on a degraded axisYears duration (cross-branch measurement) uses the same year-based formatting', () => {
  assert.equal(formatDuration({ kind: 'axisYears', years: 65_000_100 }), '65 млн лет');
});
