import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChronoInput } from './index';
import { civilDayToCalendarDateTime } from '../calendar/civilDay';
import type { ChronoMoment } from '../chronoMoment';
import type { ParseContext } from './types';

const CTX: ParseContext = { referenceDate: { year: 2026, month: 9, day: 1 } };

function ymd(m: ChronoMoment) {
  if (m.kind !== 'calendar') throw new Error('expected calendar moment');
  const dt = civilDayToCalendarDateTime(m.civilDay, m.calendar);
  return { year: dt.year, month: dt.month, day: dt.day, precision: m.precision };
}

// ─── Cases the reference app itself verifies as working (Хронолайнер_3.6.27_
// разбор.md, строка 33 "Проверка парсера на живом приложении") - ours must
// handle these too, it's the floor, not the ceiling. ──────────────────────

test('"22.06.1941" - разобрано (as in the reference app)', () => {
  const r = parseChronoInput('22.06.1941', CTX);
  assert.equal(r.type, 'moment');
  assert.deepEqual(ymd((r as { moment: ChronoMoment }).moment), { year: 1941, month: 6, day: 22, precision: 'day' });
});

test('"1 сентября 2026" - разобрано (as in the reference app)', () => {
  const r = parseChronoInput('1 сентября 2026', CTX);
  assert.equal(r.type, 'moment');
  assert.deepEqual(ymd((r as { moment: ChronoMoment }).moment), { year: 2026, month: 9, day: 1, precision: 'day' });
});

test('"с 1900 по 2000" - разобрано как интервал (as in the reference app)', () => {
  const r = parseChronoInput('с 1900 по 2000', CTX);
  assert.equal(r.type, 'range');
  const range = r as { start: ChronoMoment; end: ChronoMoment };
  assert.deepEqual(ymd(range.start), { year: 1900, month: 1, day: 1, precision: 'year' });
  assert.deepEqual(ymd(range.end), { year: 2000, month: 1, day: 1, precision: 'year' });
});

// ─── The two cases the empirical chrono-node spike proved broken - the
// entire reason a custom parser was written instead of a library. ────────

test('"1941" (bare year) parses - chrono-node returns FAIL on this in every locale/phrasing tested', () => {
  const r = parseChronoInput('1941', CTX);
  assert.equal(r.type, 'moment');
  assert.deepEqual(ymd((r as { moment: ChronoMoment }).moment), { year: 1941, month: 1, day: 1, precision: 'year' });
});

test('"с 1900 по 2000" as a bare-year range parses - chrono-node FAILs this exact reference-app example', () => {
  // (duplicate of the above reference-app test, called out explicitly here
  // because this is precisely the string the parser spike found chrono-node
  // could not handle, despite it being the reference app's own canonical
  // working example)
  const r = parseChronoInput('с 1900 по 2000', CTX);
  assert.equal(r.type, 'range');
});

// ─── The deliberate improvement over the reference app ────────────────────

test('"1900 - 2000" (dash, no preposition) parses - the reference app explicitly does not support this', () => {
  const r = parseChronoInput('1900 - 2000', CTX);
  assert.equal(r.type, 'range');
  const range = r as { start: ChronoMoment; end: ChronoMoment };
  assert.deepEqual(ymd(range.start), { year: 1900, month: 1, day: 1, precision: 'year' });
  assert.deepEqual(ymd(range.end), { year: 2000, month: 1, day: 1, precision: 'year' });
});

// ─── Relative words, case-insensitivity, whitespace tolerance ────────────

test('relative words work through the full pipeline, case-insensitively', () => {
  const r1 = parseChronoInput('Сегодня', CTX);
  assert.equal(r1.type, 'moment');
  assert.deepEqual(ymd((r1 as { moment: ChronoMoment }).moment), { year: 2026, month: 9, day: 1, precision: 'day' });

  const r2 = parseChronoInput('  вчера  ', CTX);
  assert.equal(r2.type, 'moment');
});

test('"10 лет назад" resolves through the full pipeline', () => {
  const r = parseChronoInput('10 лет назад', CTX);
  assert.equal(r.type, 'moment');
  assert.deepEqual(ymd((r as { moment: ChronoMoment }).moment), { year: 2016, month: 1, day: 1, precision: 'year' });
});

// ─── Honest failure: unrecognized input returns {type: 'none'}, never a
// silently wrong guess (this is the property chrono-node's spike showed it
// LACKS - it returned a plausible-looking but nonsensical date for garbled
// input instead of failing cleanly). ───────────────────────────────────────

test('unrecognized garbage returns {type: "none"}, not a guess', () => {
  assert.deepEqual(parseChronoInput('бла-бла-бла не дата', CTX), { type: 'none' });
});

test('empty/whitespace-only input returns {type: "none"}', () => {
  assert.deepEqual(parseChronoInput('', CTX), { type: 'none' });
  assert.deepEqual(parseChronoInput('   ', CTX), { type: 'none' });
});

test('"1900 год - 2000 год" (the malformed input that made chrono-node silently return year 26) parses correctly here', () => {
  const r = parseChronoInput('1900 год - 2000 год', CTX);
  assert.equal(r.type, 'range');
  const range = r as { start: ChronoMoment; end: ChronoMoment };
  assert.deepEqual(ymd(range.start), { year: 1900, month: 1, day: 1, precision: 'year' });
  assert.deepEqual(ymd(range.end), { year: 2000, month: 1, day: 1, precision: 'year' });
});
