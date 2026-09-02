import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChronoMomentSchema, TimelineEventSchema, ChronoProjectSchema, CHRONO_PROJECT_SCHEMA_VERSION } from './schema';
import { calendarDateTimeToCivilDay } from '../calendar/civilDay';

function sampleCalendarMoment() {
  return {
    kind: 'calendar' as const,
    civilDay: calendarDateTimeToCivilDay({ year: 1941, month: 6, day: 22 }, 'gregorian'),
    precision: 'day' as const,
    calendar: 'gregorian' as const,
    approximate: false,
  };
}

function sampleEpochMoment() {
  return {
    kind: 'epoch' as const,
    yearsBeforeEpoch: 65_000_000,
    precision: 'millionYears' as const,
    approximate: true,
  };
}

// ─── ChronoMomentSchema (discriminated union) ──────────────────────────────

test('ChronoMomentSchema accepts a well-formed calendar moment', () => {
  const result = ChronoMomentSchema.safeParse(sampleCalendarMoment());
  assert.equal(result.success, true);
});

test('ChronoMomentSchema accepts a well-formed epoch moment', () => {
  const result = ChronoMomentSchema.safeParse(sampleEpochMoment());
  assert.equal(result.success, true);
});

test('ChronoMomentSchema rejects an unknown "kind"', () => {
  const result = ChronoMomentSchema.safeParse({ kind: 'relative', foo: 1 });
  assert.equal(result.success, false);
});

test('ChronoMomentSchema rejects a calendar moment with out-of-range secondOfDay', () => {
  const bad = { ...sampleCalendarMoment(), civilDay: { day: 100, secondOfDay: 86400 } };
  assert.equal(ChronoMomentSchema.safeParse(bad).success, false);
});

test('ChronoMomentSchema rejects a calendar moment missing the "calendar" field', () => {
  const { calendar, ...bad } = sampleCalendarMoment();
  assert.equal(ChronoMomentSchema.safeParse(bad).success, false);
});

test('ChronoMomentSchema rejects an epoch moment with a calendar-only precision (branch mismatch)', () => {
  const bad = { ...sampleEpochMoment(), precision: 'day' };
  assert.equal(ChronoMomentSchema.safeParse(bad).success, false);
});

test('ChronoMomentSchema rejects a non-integer yearsBeforeEpoch', () => {
  const bad = { ...sampleEpochMoment(), yearsBeforeEpoch: 65_000_000.5 };
  assert.equal(ChronoMomentSchema.safeParse(bad).success, false);
});

// ─── TimelineEventSchema: defaults ─────────────────────────────────────────

test('TimelineEventSchema fills in defaults for optional collection fields', () => {
  const parsed = TimelineEventSchema.parse({
    id: 'e1',
    interval: { start: sampleCalendarMoment(), end: null },
    name: 'Начало войны',
    view: 'card',
  });
  assert.deepEqual(parsed.mediaIds, []);
  assert.deepEqual(parsed.attributeValues, {});
  assert.equal(parsed.verticalPriority, 1000);
});

test('TimelineEventSchema accepts a symbolic open-ended interval (end: null)', () => {
  const parsed = TimelineEventSchema.parse({
    id: 'e1',
    interval: { start: sampleCalendarMoment(), end: null },
    name: 'Продолжается',
    view: 'compact',
  });
  assert.equal(parsed.interval.end, null);
});

test('TimelineEventSchema rejects an invalid view value', () => {
  const result = TimelineEventSchema.safeParse({
    id: 'e1',
    interval: { start: sampleCalendarMoment(), end: null },
    name: 'X',
    view: 'not-a-real-view',
  });
  assert.equal(result.success, false);
});

// ─── ChronoProjectSchema ────────────────────────────────────────────────

test('ChronoProjectSchema accepts a minimal well-formed project', () => {
  const doc = {
    schemaVersion: CHRONO_PROJECT_SCHEMA_VERSION,
    id: 'p1',
    name: 'Вторая мировая',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const result = ChronoProjectSchema.safeParse(doc);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.timelines, []);
    assert.deepEqual(result.data.media, []);
  }
});

test('ChronoProjectSchema rejects a document with the wrong schemaVersion literal', () => {
  const doc = {
    schemaVersion: 999,
    id: 'p1',
    name: 'X',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(ChronoProjectSchema.safeParse(doc).success, false);
});

test('ChronoProjectSchema validates a full project with nested timeline/event/attribute data', () => {
  const doc = {
    schemaVersion: CHRONO_PROJECT_SCHEMA_VERSION,
    id: 'p1',
    name: 'Вторая мировая',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timelines: [
      {
        id: 't1',
        name: 'Основная линия',
        attributes: [{ id: 'a1', name: 'Регион', type: 'string' as const }],
        events: [
          {
            id: 'e1',
            interval: { start: sampleCalendarMoment(), end: null },
            name: 'Начало ВОВ',
            view: 'card' as const,
            attributeValues: { a1: 'Европа' },
          },
        ],
      },
    ],
  };
  const result = ChronoProjectSchema.safeParse(doc);
  assert.equal(result.success, true);
});
