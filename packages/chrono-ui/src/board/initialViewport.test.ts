import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInitialViewport } from './initialViewport.js';
import { calendarDateTimeToCivilDay, toAxisYears, type ChronoProject, type ChronoTimeline, type ChronoMoment } from '@kiosk/shared';

function yearMoment(year: number): ChronoMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month: 1, day: 1 }, 'gregorian'),
    precision: 'year',
    calendar: 'gregorian',
    approximate: false,
  };
}

function epochMoment(yearsBeforeEpoch: number): ChronoMoment {
  return { kind: 'epoch', yearsBeforeEpoch, precision: 'millionYears', approximate: false };
}

function projectWithTimelines(timelines: ChronoTimeline[]): ChronoProject {
  return {
    schemaVersion: 1,
    id: 'p1',
    name: 'Проект',
    timelines,
    media: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function timelineWithEvent(interval: { start: ChronoMoment; end: ChronoMoment | null }): ChronoTimeline {
  return {
    id: 'tl-1',
    name: 'Линия',
    events: [
      {
        id: 'ev-1',
        interval,
        name: 'Событие',
        mediaIds: [],
        attributeValues: {},
        view: 'compact',
        verticalPriority: 1000,
      },
    ],
    attributes: [],
    collapsed: false,
  };
}

test('an empty project (no timelines) centers on the given "now" year with the default span', () => {
  const project = projectWithTimelines([]);
  const viewport = computeInitialViewport(project, 1000, new Date('2026-06-15T00:00:00.000Z'));

  assert.equal(viewport.centerAxisYears, 2026);
  assert.equal(viewport.spanAxisYears, 100);
  assert.equal(viewport.widthPx, 1000);
});

test('a project with timelines but zero events also falls back to the "now" default', () => {
  const project = projectWithTimelines([{ id: 'tl-1', name: 'Пустая линия', events: [], attributes: [], collapsed: false }]);
  const viewport = computeInitialViewport(project, 800, new Date('2026-01-01T00:00:00.000Z'));

  assert.equal(viewport.centerAxisYears, 2026);
});

test('a single event fits the viewport around it with nonzero padding, not a zero-width span', () => {
  const moment = yearMoment(1941);
  const project = projectWithTimelines([timelineWithEvent({ start: moment, end: moment })]);
  const viewport = computeInitialViewport(project, 1000);

  assert.ok(viewport.spanAxisYears >= 10, 'span must not collapse to zero for a single point event');
  assert.ok(Math.abs(viewport.centerAxisYears - toAxisYears(moment)) < 5);
});

test('a wide-range event (1941-1945) is centered with the range fully inside the viewport, plus padding', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const project = projectWithTimelines([timelineWithEvent({ start, end })]);
  const viewport = computeInitialViewport(project, 1000);

  const half = viewport.spanAxisYears / 2;
  const visibleStart = viewport.centerAxisYears - half;
  const visibleEnd = viewport.centerAxisYears + half;

  assert.ok(visibleStart <= toAxisYears(start));
  assert.ok(visibleEnd >= toAxisYears(end));
  assert.ok(viewport.spanAxisYears > toAxisYears(end) - toAxisYears(start), 'must add padding, not fit exactly');
});

test('an open-ended event ("to the present", end === null) does not blow up the span with Infinity', () => {
  const start = yearMoment(1991);
  const project = projectWithTimelines([timelineWithEvent({ start, end: null })]);
  const viewport = computeInitialViewport(project, 1000);

  assert.ok(Number.isFinite(viewport.spanAxisYears));
  assert.ok(Number.isFinite(viewport.centerAxisYears));
});

test('deep-time (epoch) events across multiple timelines widen the span to cover the whole spread', () => {
  const recent = yearMoment(2000);
  const deep = epochMoment(65_000_000);
  const project = projectWithTimelines([
    timelineWithEvent({ start: recent, end: recent }),
    timelineWithEvent({ start: deep, end: deep }),
  ]);
  const viewport = computeInitialViewport(project, 1000);

  const half = viewport.spanAxisYears / 2;
  assert.ok(viewport.centerAxisYears - half <= toAxisYears(deep));
  assert.ok(viewport.centerAxisYears + half >= toAxisYears(recent));
});
