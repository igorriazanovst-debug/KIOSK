import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChronoProject, assertProjectSerializable, ChronoProjectParseError, CHRONO_PROJECT_SCHEMA_VERSION } from './project';
import { calendarDateTimeToCivilDay } from '../calendar/civilDay';
import type { ChronoProject } from './schema';

function sampleCalendarMoment() {
  return {
    kind: 'calendar' as const,
    civilDay: calendarDateTimeToCivilDay({ year: 1941, month: 6, day: 22 }, 'gregorian'),
    precision: 'day' as const,
    calendar: 'gregorian' as const,
    approximate: false,
  };
}

function validDoc(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CHRONO_PROJECT_SCHEMA_VERSION,
    id: 'p1',
    name: 'Проект',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('parseChronoProject accepts a well-formed current-version document', () => {
  const project = parseChronoProject(validDoc());
  assert.equal(project.id, 'p1');
  assert.equal(project.schemaVersion, CHRONO_PROJECT_SCHEMA_VERSION);
});

test('parseChronoProject survives a full JSON round-trip (the real-world path: save to disk, load back)', () => {
  const original = validDoc({
    timelines: [
      {
        id: 't1',
        name: 'Линия',
        events: [
          {
            id: 'e1',
            interval: { start: sampleCalendarMoment(), end: null },
            name: 'Событие',
            view: 'card',
          },
        ],
      },
    ],
  });
  const roundTripped = JSON.parse(JSON.stringify(original));
  const project = parseChronoProject(roundTripped);
  assert.equal(project.timelines[0].events[0].name, 'Событие');
  assert.equal(project.timelines[0].events[0].interval.end, null);
});

test('parseChronoProject throws ChronoProjectParseError for a document with no schemaVersion at all', () => {
  const { schemaVersion, ...withoutVersion } = validDoc();
  assert.throws(() => parseChronoProject(withoutVersion), ChronoProjectParseError);
});

test('parseChronoProject throws for a document from a NEWER, unsupported schema version', () => {
  assert.throws(
    () => parseChronoProject(validDoc({ schemaVersion: CHRONO_PROJECT_SCHEMA_VERSION + 1 })),
    (err: unknown) => err instanceof ChronoProjectParseError && /более новой версией/.test(err.message)
  );
});

test('parseChronoProject throws ChronoProjectParseError (not a raw zod error) for a version-less document', () => {
  assert.throws(() => parseChronoProject({ garbage: true }), ChronoProjectParseError);
});

test('parseChronoProject throws ChronoProjectParseError for a document that has a valid schemaVersion but is otherwise structurally invalid', () => {
  assert.throws(
    () => parseChronoProject({ schemaVersion: CHRONO_PROJECT_SCHEMA_VERSION, garbage: true }),
    ChronoProjectParseError
  );
});

test('parseChronoProject error carries the underlying zod issue as `cause` for debugging, when the failure is a real schema mismatch (not just a missing version)', () => {
  try {
    parseChronoProject({ schemaVersion: CHRONO_PROJECT_SCHEMA_VERSION, garbage: true });
    assert.fail('expected parseChronoProject to throw');
  } catch (err) {
    assert.ok(err instanceof ChronoProjectParseError);
    assert.ok(err.cause);
  }
});

// ─── assertProjectSerializable ─────────────────────────────────────────

test('assertProjectSerializable does not throw for a normal valid project', () => {
  const project = parseChronoProject(
    validDoc({
      timelines: [
        {
          id: 't1',
          name: 'Линия',
          events: [
            { id: 'e1', interval: { start: sampleCalendarMoment(), end: null }, name: 'X', view: 'card' },
          ],
        },
      ],
    })
  );
  assert.doesNotThrow(() => assertProjectSerializable(project));
});

test('assertProjectSerializable throws when an event start moment has a non-finite civilDay.day', () => {
  const project: ChronoProject = parseChronoProject(
    validDoc({
      timelines: [
        {
          id: 't1',
          name: 'Линия',
          events: [
            { id: 'e1', interval: { start: sampleCalendarMoment(), end: null }, name: 'X', view: 'card' },
          ],
        },
      ],
    })
  );
  // Simulate an arithmetic error upstream that produced NaN - this must be
  // caught here, before it gets JSON.stringify'd into a silent `null`.
  const start = project.timelines[0].events[0].interval.start;
  assert.equal(start.kind, 'calendar');
  if (start.kind === 'calendar') start.civilDay.day = NaN;
  assert.throws(() => assertProjectSerializable(project), RangeError);
});

test('assertProjectSerializable checks the end moment too, not just start', () => {
  const project: ChronoProject = parseChronoProject(
    validDoc({
      timelines: [
        {
          id: 't1',
          name: 'Линия',
          events: [
            {
              id: 'e1',
              interval: { start: sampleCalendarMoment(), end: sampleCalendarMoment() },
              name: 'X',
              view: 'card',
            },
          ],
        },
      ],
    })
  );
  const end = project.timelines[0].events[0].interval.end;
  assert.ok(end && end.kind === 'calendar');
  if (end && end.kind === 'calendar') end.civilDay.secondOfDay = Infinity;
  assert.throws(() => assertProjectSerializable(project), RangeError);
});
