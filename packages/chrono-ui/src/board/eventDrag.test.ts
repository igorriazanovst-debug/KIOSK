import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pxDeltaToAxisYearsDelta, previewDraggedInterval, previewResizedInterval } from './eventDrag.js';
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

// ─── previewResizedInterval ────────────────────────────────────────────────

test('resizing the "start" edge forward shrinks the interval, "end" stays exactly put', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const interval: ChronoInterval = { start, end };

  const resized = previewResizedInterval(interval, 'start', 100, VIEWPORT);

  assert.ok(toAxisYears(resized.start) > toAxisYears(start));
  assert.deepEqual(resized.end, end);
});

test('resizing the "start" edge backward extends the interval into the past', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const interval: ChronoInterval = { start, end };

  const resized = previewResizedInterval(interval, 'start', -100, VIEWPORT);

  assert.ok(toAxisYears(resized.start) < toAxisYears(start));
});

test('resizing "start" past "end" clamps to a zero-width interval, never inverts', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const interval: ChronoInterval = { start, end };

  // huge forward delta - would push start well past 1945 without clamping
  const resized = previewResizedInterval(interval, 'start', 10000, VIEWPORT);

  assert.ok(toAxisYears(resized.start) <= toAxisYears(resized.end!));
  assert.equal(toAxisYears(resized.start), toAxisYears(resized.end!));
});

test('resizing the "end" edge forward extends the interval into the future, "start" stays put', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const interval: ChronoInterval = { start, end };

  const resized = previewResizedInterval(interval, 'end', 100, VIEWPORT);

  assert.ok(toAxisYears(resized.end!) > toAxisYears(end));
  assert.deepEqual(resized.start, start);
});

test('resizing "end" past "start" clamps to a zero-width interval, never inverts', () => {
  const start = yearMoment(1941);
  const end = yearMoment(1945);
  const interval: ChronoInterval = { start, end };

  const resized = previewResizedInterval(interval, 'end', -10000, VIEWPORT);

  assert.ok(toAxisYears(resized.start) <= toAxisYears(resized.end!));
  assert.equal(toAxisYears(resized.start), toAxisYears(resized.end!));
});

test('resizing the "end" edge of an open-ended interval (null, "to the present") is a no-op', () => {
  const start = yearMoment(1991);
  const interval: ChronoInterval = { start, end: null };

  const resized = previewResizedInterval(interval, 'end', 500, VIEWPORT);

  assert.equal(resized.end, null);
  assert.deepEqual(resized.start, start);
});
