import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOverviewRange, windowBoundsPx } from './overviewMath.js';
import { calendarDateTimeToCivilDay, type ChronoTimeline, type Viewport } from '@kiosk/shared';

const VIEWPORT: Viewport = { centerAxisYears: 1950, spanAxisYears: 100, widthPx: 1000 };

function yearMoment(year: number) {
  return {
    kind: 'calendar' as const,
    civilDay: calendarDateTimeToCivilDay({ year, month: 1, day: 1 }, 'gregorian' as const),
    precision: 'year' as const,
    calendar: 'gregorian' as const,
    approximate: false,
  };
}

function timelineWithEvent(year: number): ChronoTimeline {
  const m = yearMoment(year);
  return {
    id: 'tl-1',
    name: 'Линия',
    events: [
      { id: 'ev-1', interval: { start: m, end: m }, name: 'Событие', mediaIds: [], attributeValues: {}, view: 'compact', verticalPriority: 1000 },
    ],
    attributes: [],
    collapsed: false,
  };
}

test('computeOverviewRange with no timelines still covers the current viewport (not empty/degenerate)', () => {
  const overview = computeOverviewRange([], 1200, VIEWPORT);
  assert.ok(overview.spanAxisYears >= VIEWPORT.spanAxisYears, 'overview must be at least as wide as the current view');
  assert.ok(overview.centerAxisYears - overview.spanAxisYears / 2 <= 1900);
  assert.ok(overview.centerAxisYears + overview.spanAxisYears / 2 >= 2000);
});

test('computeOverviewRange widens to cover an event far outside the current viewport', () => {
  const overview = computeOverviewRange([timelineWithEvent(1200)], 1200, VIEWPORT);
  assert.ok(overview.centerAxisYears - overview.spanAxisYears / 2 <= 1200, 'must include the 1200 event, far before the current view');
});

test('computeOverviewRange when everything fits inside the current viewport is still at least the viewport size', () => {
  const overview = computeOverviewRange([timelineWithEvent(1950)], 1200, VIEWPORT);
  assert.ok(overview.spanAxisYears >= VIEWPORT.spanAxisYears);
});

test('windowBoundsPx places the window in the middle of the overview when the viewport is centered on the overview range', () => {
  const overview: Viewport = { centerAxisYears: 1950, spanAxisYears: 1000, widthPx: 1000 };
  const bounds = windowBoundsPx(VIEWPORT, overview); // VIEWPORT span=100 inside overview span=1000

  // VIEWPORT covers [1900,2000], overview covers [1450,2450] over 1000px -> 1px/year
  assert.ok(Math.abs(bounds.left - (1900 - 1450)) < 1e-6);
  assert.ok(Math.abs(bounds.width - 100) < 1e-6);
});

test('windowBoundsPx window covers the full overview width when the viewport matches the overview range exactly', () => {
  const overview: Viewport = { centerAxisYears: 1950, spanAxisYears: 100, widthPx: 1000 };
  const bounds = windowBoundsPx(VIEWPORT, overview);

  assert.ok(Math.abs(bounds.left - 0) < 1e-6);
  assert.ok(Math.abs(bounds.width - 1000) < 1e-6);
});

test('windowBoundsPx never returns a zero/negative width even for a degenerate zero-span viewport', () => {
  const overview: Viewport = { centerAxisYears: 1950, spanAxisYears: 1000, widthPx: 1000 };
  const degenerate: Viewport = { centerAxisYears: 1950, spanAxisYears: 0, widthPx: 1000 };
  const bounds = windowBoundsPx(degenerate, overview);

  assert.ok(bounds.width >= 1);
});
