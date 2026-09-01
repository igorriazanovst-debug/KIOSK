import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from './range';
import { civilDayToCalendarDateTime } from '../../calendar/civilDay';
import type { ChronoMoment } from '../../chronoMoment';
import type { ParseContext } from '../types';

const CTX: ParseContext = { referenceDate: { year: 2026, month: 9, day: 1 } };

function ymd(m: ChronoMoment) {
  if (m.kind !== 'calendar') throw new Error('expected calendar moment');
  const dt = civilDayToCalendarDateTime(m.civilDay, m.calendar);
  return { year: dt.year, month: dt.month, day: dt.day, precision: m.precision };
}

test('"с 1900 по 2000" - the reference app\'s own canonical working example', () => {
  const r = parseRange('с 1900 по 2000', CTX);
  assert.ok(r);
  assert.deepEqual(ymd(r.start), { year: 1900, month: 1, day: 1, precision: 'year' });
  assert.deepEqual(ymd(r.end), { year: 2000, month: 1, day: 1, precision: 'year' });
});

test('"1900-2000" (dash, no preposition) works here - unlike the reference app (разбор строка 33: "не разобрано")', () => {
  const r = parseRange('1900-2000', CTX);
  assert.ok(r);
  assert.deepEqual(ymd(r.start), { year: 1900, month: 1, day: 1, precision: 'year' });
  assert.deepEqual(ymd(r.end), { year: 2000, month: 1, day: 1, precision: 'year' });
});

test('dash range with spaces: "1900 - 2000"', () => {
  const r = parseRange('1900 - 2000', CTX);
  assert.ok(r);
  assert.deepEqual(ymd(r.start), { year: 1900, month: 1, day: 1, precision: 'year' });
  assert.deepEqual(ymd(r.end), { year: 2000, month: 1, day: 1, precision: 'year' });
});

test('range with full dates on both ends: "с 1 января 2020 по 5 марта 2021"', () => {
  const r = parseRange('с 1 января 2020 по 5 марта 2021', CTX);
  assert.ok(r);
  assert.deepEqual(ymd(r.start), { year: 2020, month: 1, day: 1, precision: 'day' });
  assert.deepEqual(ymd(r.end), { year: 2021, month: 3, day: 5, precision: 'day' });
});

test('rejects a non-range plain year', () => {
  assert.equal(parseRange('1941', CTX), null);
});

test('rejects a range where one side does not parse as a date', () => {
  assert.equal(parseRange('с 1900 по невесть что', CTX), null);
  assert.equal(parseRange('невесть что - 2000', CTX), null);
});
