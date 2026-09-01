import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTimeline, renameTimeline, deleteTimeline, addEvent, updateEvent, deleteEvent, addMedia } from './mutations';
import type { ChronoProject, TimelineEvent, ChronoMedia } from './schema';

function sampleMedia(overrides: Partial<ChronoMedia> = {}): ChronoMedia {
  return { id: 'm1', fileName: 'photo.jpg', mimeType: 'image/jpeg', fileSize: 100, sha256: 'a'.repeat(64), ...overrides };
}

function emptyProject(): ChronoProject {
  return {
    schemaVersion: 1,
    id: 'p1',
    name: 'Проект',
    timelines: [],
    media: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function sampleEvent(id = 'ev-1'): TimelineEvent {
  return {
    id,
    interval: {
      start: { kind: 'epoch', yearsBeforeEpoch: 1000, precision: 'tenThousandYears', approximate: false },
      end: null,
    },
    name: 'Событие',
    mediaIds: [],
    attributeValues: {},
    view: 'compact',
    verticalPriority: 1000,
  };
}

test('addTimeline appends a new empty timeline with the given id/name, does not mutate the original', () => {
  const project = emptyProject();
  const updated = addTimeline(project, 'tl-1', 'Линия');

  assert.equal(project.timelines.length, 0, 'original project must stay untouched');
  assert.equal(updated.timelines.length, 1);
  assert.deepEqual(updated.timelines[0], { id: 'tl-1', name: 'Линия', events: [], attributes: [], collapsed: false });
});

test('renameTimeline updates only the matching timeline', () => {
  let project = addTimeline(emptyProject(), 'tl-1', 'Старое');
  project = addTimeline(project, 'tl-2', 'Другая');

  const renamed = renameTimeline(project, 'tl-1', 'Новое');

  assert.equal(renamed.timelines.find((t) => t.id === 'tl-1')!.name, 'Новое');
  assert.equal(renamed.timelines.find((t) => t.id === 'tl-2')!.name, 'Другая');
});

test('renameTimeline on an unknown id is a no-op (returns an equivalent project, not a throw)', () => {
  const project = addTimeline(emptyProject(), 'tl-1', 'Линия');
  const result = renameTimeline(project, 'does-not-exist', 'X');
  assert.deepEqual(result.timelines, project.timelines);
});

test('deleteTimeline removes only the matching timeline', () => {
  let project = addTimeline(emptyProject(), 'tl-1', 'Первая');
  project = addTimeline(project, 'tl-2', 'Вторая');

  const result = deleteTimeline(project, 'tl-1');

  assert.equal(result.timelines.length, 1);
  assert.equal(result.timelines[0].id, 'tl-2');
});

test('addEvent appends to the correct timeline only, other timelines untouched', () => {
  let project = addTimeline(emptyProject(), 'tl-1', 'A');
  project = addTimeline(project, 'tl-2', 'B');

  const result = addEvent(project, 'tl-1', sampleEvent());

  assert.equal(result.timelines.find((t) => t.id === 'tl-1')!.events.length, 1);
  assert.equal(result.timelines.find((t) => t.id === 'tl-2')!.events.length, 0);
});

test('updateEvent patches only the named field(s), leaving the rest of the event untouched', () => {
  let project = addTimeline(emptyProject(), 'tl-1', 'A');
  project = addEvent(project, 'tl-1', sampleEvent());

  const result = updateEvent(project, 'tl-1', 'ev-1', { name: 'Новое имя' });
  const event = result.timelines[0].events[0];

  assert.equal(event.name, 'Новое имя');
  assert.equal(event.view, 'compact');
});

test('updateEvent can replace the interval (the useEventDrag use case)', () => {
  let project = addTimeline(emptyProject(), 'tl-1', 'A');
  project = addEvent(project, 'tl-1', sampleEvent());

  const newInterval = {
    start: { kind: 'epoch' as const, yearsBeforeEpoch: 500, precision: 'tenThousandYears' as const, approximate: false },
    end: null,
  };
  const result = updateEvent(project, 'tl-1', 'ev-1', { interval: newInterval });

  assert.deepEqual(result.timelines[0].events[0].interval, newInterval);
});

test('deleteEvent removes only the matching event from the matching timeline', () => {
  let project = addTimeline(emptyProject(), 'tl-1', 'A');
  project = addEvent(project, 'tl-1', sampleEvent('ev-1'));
  project = addEvent(project, 'tl-1', sampleEvent('ev-2'));

  const result = deleteEvent(project, 'tl-1', 'ev-1');

  assert.equal(result.timelines[0].events.length, 1);
  assert.equal(result.timelines[0].events[0].id, 'ev-2');
});

// ─── addMedia ───────────────────────────────────────────────────────────

test('addMedia appends a new record and returns it back unchanged when the sha256 is not yet in the catalog', () => {
  const project = emptyProject();
  const media = sampleMedia();

  const result = addMedia(project, media);

  assert.equal(result.project.media.length, 1);
  assert.deepEqual(result.media, media);
  assert.equal(project.media.length, 0, 'original project must stay untouched');
});

test('addMedia with a matching sha256 does not duplicate the catalog entry, and returns the EXISTING record (not the input)', () => {
  const project = addMedia(emptyProject(), sampleMedia({ id: 'original-id' })).project;
  const duplicateImport = sampleMedia({ id: 'freshly-generated-id', fileName: 'renamed.jpg' });

  const result = addMedia(project, duplicateImport);

  assert.equal(result.project.media.length, 1, 'must not add a second catalog entry for the same content');
  assert.equal(result.media.id, 'original-id', 'must return the id already referenced by any event using this file, not a new one');
});

test('addMedia with a different sha256 adds a second, independent entry', () => {
  let project = addMedia(emptyProject(), sampleMedia({ id: 'm1', sha256: 'a'.repeat(64) })).project;
  const result = addMedia(project, sampleMedia({ id: 'm2', sha256: 'b'.repeat(64) }));

  assert.equal(result.project.media.length, 2);
  assert.equal(result.media.id, 'm2');
});
