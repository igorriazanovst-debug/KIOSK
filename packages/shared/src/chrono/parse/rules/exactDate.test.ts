import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotDate, parseDayMonthYear, parseMonthYear, parseYearOnly } from './exactDate';
import { civilDayToCalendarDateTime } from '../../calendar/civilDay';
import type { ChronoMoment } from '../../chronoMoment';

function ymd(m: ChronoMoment | null) {
  if (!m || m.kind !== 'calendar') return null;
  const dt = civilDayToCalendarDateTime(m.civilDay, m.calendar);
  return { year: dt.year, month: dt.month, day: dt.day, precision: m.precision };
}

// ─── parseDotDate ────────────────────────────────────────────────────────

test('parseDotDate: 22.06.1941', () => {
  assert.deepEqual(ymd(parseDotDate('22.06.1941')), { year: 1941, month: 6, day: 22, precision: 'day' });
});

test('parseDotDate: single-digit day/month (22.6.1941)', () => {
  assert.deepEqual(ymd(parseDotDate('22.6.1941')), { year: 1941, month: 6, day: 22, precision: 'day' });
});

test('parseDotDate rejects an impossible date (day 32)', () => {
  assert.equal(parseDotDate('32.06.1941'), null);
});

test('parseDotDate rejects an impossible month (13)', () => {
  assert.equal(parseDotDate('22.13.1941'), null);
});

test('parseDotDate rejects non-dotted input', () => {
  assert.equal(parseDotDate('22 июня 1941'), null);
});

// ─── parseDayMonthYear — THE canonical case chrono-node could not handle
// as a bare year, but this rule targets the fuller "D month YYYY" form ────

test('parseDayMonthYear: "22 июня 1941"', () => {
  assert.deepEqual(ymd(parseDayMonthYear('22 июня 1941')), { year: 1941, month: 6, day: 22, precision: 'day' });
});

test('parseDayMonthYear: trailing "года"', () => {
  assert.deepEqual(ymd(parseDayMonthYear('22 июня 1941 года')), { year: 1941, month: 6, day: 22, precision: 'day' });
});

test('parseDayMonthYear: trailing "г."', () => {
  assert.deepEqual(ymd(parseDayMonthYear('22 июня 1941 г.')), { year: 1941, month: 6, day: 22, precision: 'day' });
});

test('parseDayMonthYear: "1 сентября 2026"', () => {
  assert.deepEqual(ymd(parseDayMonthYear('1 сентября 2026')), { year: 2026, month: 9, day: 1, precision: 'day' });
});

test('parseDayMonthYear: BCE - "15 марта 44 до н.э." (the Ides of March)', () => {
  assert.deepEqual(ymd(parseDayMonthYear('15 марта 44 до н.э.')), { year: -43, month: 3, day: 15, precision: 'day' });
});

test('parseDayMonthYear rejects an unknown month word', () => {
  assert.equal(parseDayMonthYear('22 июный 1941'), null);
});

test('parseDayMonthYear rejects a day with no year', () => {
  assert.equal(parseDayMonthYear('22 июня'), null);
});

test('parseDayMonthYear rejects a February 30th', () => {
  assert.equal(parseDayMonthYear('30 февраля 2000'), null);
});

// ─── parseMonthYear ──────────────────────────────────────────────────────

test('parseMonthYear: "июнь 1941"', () => {
  assert.deepEqual(ymd(parseMonthYear('июнь 1941')), { year: 1941, month: 6, day: 1, precision: 'month' });
});

test('parseMonthYear: genitive form also accepted ("июня 1941")', () => {
  assert.deepEqual(ymd(parseMonthYear('июня 1941')), { year: 1941, month: 6, day: 1, precision: 'month' });
});

test('parseMonthYear: "сентябрь 2026 года"', () => {
  assert.deepEqual(ymd(parseMonthYear('сентябрь 2026 года')), { year: 2026, month: 9, day: 1, precision: 'month' });
});

test('parseMonthYear rejects a bare month with no year', () => {
  assert.equal(parseMonthYear('июнь'), null);
});

// ─── parseYearOnly — the case the spike proved chrono-node cannot do AT ALL ──

test('parseYearOnly: "1941"', () => {
  assert.deepEqual(ymd(parseYearOnly('1941')), { year: 1941, month: 1, day: 1, precision: 'year' });
});

test('parseYearOnly: "2026"', () => {
  assert.deepEqual(ymd(parseYearOnly('2026')), { year: 2026, month: 1, day: 1, precision: 'year' });
});

test('parseYearOnly: "1941 год"', () => {
  assert.deepEqual(ymd(parseYearOnly('1941 год')), { year: 1941, month: 1, day: 1, precision: 'year' });
});

test('parseYearOnly: "1941 года"', () => {
  assert.deepEqual(ymd(parseYearOnly('1941 года')), { year: 1941, month: 1, day: 1, precision: 'year' });
});

test('parseYearOnly: "1941 г."', () => {
  assert.deepEqual(ymd(parseYearOnly('1941 г.')), { year: 1941, month: 1, day: 1, precision: 'year' });
});

test('parseYearOnly: "100 до н.э." -> astronomical year -99', () => {
  assert.deepEqual(ymd(parseYearOnly('100 до н.э.')), { year: -99, month: 1, day: 1, precision: 'year' });
});

test('parseYearOnly: "1 до нашей эры" -> astronomical year 0', () => {
  assert.deepEqual(ymd(parseYearOnly('1 до нашей эры')), { year: 0, month: 1, day: 1, precision: 'year' });
});

test('parseYearOnly rejects non-numeric garbage', () => {
  assert.equal(parseYearOnly('не число'), null);
});

test('parseYearOnly rejects a range expression (that belongs to the range rule, not here)', () => {
  assert.equal(parseYearOnly('с 1900 по 2000'), null);
  assert.equal(parseYearOnly('1900-2000'), null);
});
