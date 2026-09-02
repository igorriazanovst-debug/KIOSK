import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelativeDay, parseYearsAgo, parseInYears } from './relative';
import { civilDayToCalendarDateTime } from '../../calendar/civilDay';
import type { ChronoMoment } from '../../chronoMoment';
import type { ParseContext } from '../types';

const CTX: ParseContext = { referenceDate: { year: 2026, month: 9, day: 1 } };

function ymd(m: ChronoMoment | null) {
  if (!m || m.kind !== 'calendar') return null;
  const dt = civilDayToCalendarDateTime(m.civilDay, m.calendar);
  return { year: dt.year, month: dt.month, day: dt.day, precision: m.precision };
}

test('parseRelativeDay: сегодня/сейчас -> the reference date', () => {
  assert.deepEqual(ymd(parseRelativeDay('сегодня', CTX)), { year: 2026, month: 9, day: 1, precision: 'day' });
  assert.deepEqual(ymd(parseRelativeDay('сейчас', CTX)), { year: 2026, month: 9, day: 1, precision: 'day' });
});

test('parseRelativeDay: вчера/позавчера', () => {
  assert.deepEqual(ymd(parseRelativeDay('вчера', CTX)), { year: 2026, month: 8, day: 31, precision: 'day' });
  assert.deepEqual(ymd(parseRelativeDay('позавчера', CTX)), { year: 2026, month: 8, day: 30, precision: 'day' });
});

test('parseRelativeDay: завтра/послезавтра', () => {
  assert.deepEqual(ymd(parseRelativeDay('завтра', CTX)), { year: 2026, month: 9, day: 2, precision: 'day' });
  assert.deepEqual(ymd(parseRelativeDay('послезавтра', CTX)), { year: 2026, month: 9, day: 3, precision: 'day' });
});

test('parseRelativeDay: month boundary (вчера from Sep 1 lands correctly in August)', () => {
  const ctx: ParseContext = { referenceDate: { year: 2026, month: 3, day: 1 } };
  // March 1 - 1 day = Feb 28 (2026 is not a leap year)
  assert.deepEqual(ymd(parseRelativeDay('вчера', ctx)), { year: 2026, month: 2, day: 28, precision: 'day' });
});

test('parseRelativeDay rejects unrelated text', () => {
  assert.equal(parseRelativeDay('1941', CTX), null);
});

test('parseYearsAgo: "10 лет назад"', () => {
  assert.deepEqual(ymd(parseYearsAgo('10 лет назад', CTX)), { year: 2016, month: 1, day: 1, precision: 'year' });
});

test('parseYearsAgo: singular "1 год назад" and few-form "3 года назад"', () => {
  assert.deepEqual(ymd(parseYearsAgo('1 год назад', CTX)), { year: 2025, month: 1, day: 1, precision: 'year' });
  assert.deepEqual(ymd(parseYearsAgo('3 года назад', CTX)), { year: 2023, month: 1, day: 1, precision: 'year' });
});

test('parseInYears: "через 3 года"', () => {
  assert.deepEqual(ymd(parseInYears('через 3 года', CTX)), { year: 2029, month: 1, day: 1, precision: 'year' });
});

test('parseInYears rejects "N лет назад" (wrong direction, that is parseYearsAgo\'s job)', () => {
  assert.equal(parseInYears('10 лет назад', CTX), null);
});
