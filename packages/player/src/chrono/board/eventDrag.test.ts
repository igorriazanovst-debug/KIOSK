import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pxDeltaToAxisYearsDelta, previewDraggedInterval } from './eventDrag.ts';
import { calendarDateTimeToCivilDay, toAxisYears, type ChronoInterval, type Viewport } from '@kiosk/shared';

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

test('pxDeltaToAxisYearsDelta scales linearly with the viewport span-per-pixel density', () => {
  // 100 years across 1000px = 0.1 year/px
  assert.equal(pxDeltaToAxisYearsDelta(100, VIEWPORT), 10);
  assert.equal(pxDeltaToAxisYearsDelta(0, VIEWPORT), 0);
  assert.equal(pxDeltaToAxisYearsDelta(-100, VIEWPORT), -10);
});

test('pxDeltaToAxisYearsDelta halves when the same pixel delta is spread over half the years (more zoomed in)', () => {
  const zoomedIn: Viewport = { ...VIEWPORT, spanAxisYears: 50 };
  assert.equal(pxDeltaToAxisYearsDelta(100, zoomedIn), 5);
});

test('previewDraggedInterval dragging right (positive deltaPx) moves the event forward in time', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const interval: ChronoInterval = { start, end };

  const dragged = previewDraggedInterval(interval, 100, VIEWPORT);

  assert.ok(toAxisYears(dragged.start) > toAxisYears(start));
  assert.ok(toAxisYears(dragged.end!) > toAxisYears(end));
});

test('previewDraggedInterval dragging left (negative deltaPx) moves the event backward in time', () => {
  const start = yearMoment(1941);
  const interval: ChronoInterval = { start, end: start };

  const dragged = previewDraggedInterval(interval, -50, VIEWPORT);

  assert.ok(toAxisYears(dragged.start) < toAxisYears(start));
});

test('previewDraggedInterval preserves the duration between start and end', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const interval: ChronoInterval = { start, end };
  const durationBefore = toAxisYears(end) - toAxisYears(start);

  const dragged = previewDraggedInterval(interval, 37, VIEWPORT);
  const durationAfter = toAxisYears(dragged.end!) - toAxisYears(dragged.start);

  assert.ok(Math.abs(durationAfter - durationBefore) < 0.01);
});

test('previewDraggedInterval leaves an open end (null) untouched', () => {
  const start = yearMoment(1991);
  const interval: ChronoInterval = { start, end: null };

  const dragged = previewDraggedInterval(interval, 200, VIEWPORT);

  assert.equal(dragged.end, null);
});

test('previewDraggedInterval with deltaPx=0 returns an interval at the same axis position', () => {
  const start = yearMoment(1941);
  const interval: ChronoInterval = { start, end: start };

  const dragged = previewDraggedInterval(interval, 0, VIEWPORT);

  assert.ok(Math.abs(toAxisYears(dragged.start) - toAxisYears(start)) < 0.01);
});
