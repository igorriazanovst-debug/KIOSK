import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventPixelBounds, isEventVisible } from './eventPosition.ts';
import { calendarDateTimeToCivilDay, toRange, axisYearsToPx, type ChronoInterval, type Viewport } from '@kiosk/shared';

const VIEWPORT: Viewport = { centerAxisYears: 1950, spanAxisYears: 100, widthPx: 1000 };

function dayMoment(year: number, month: number, day: number) {
  return {
    kind: 'calendar' as const,
    civilDay: calendarDateTimeToCivilDay({ year, month, day }, 'gregorian' as const),
    precision: 'day' as const,
    calendar: 'gregorian' as const,
    approximate: false,
  };
}

function yearMoment(year: number) {
  return {
    kind: 'calendar' as const,
    civilDay: calendarDateTimeToCivilDay({ year, month: 1, day: 1 }, 'gregorian' as const),
    precision: 'year' as const,
    calendar: 'gregorian' as const,
    approximate: false,
  };
}

test('a closed interval spans from the start of its start-range to the end of its end-range', () => {
  const startMoment = yearMoment(1941);
  const endMoment = yearMoment(1945);
  const interval: ChronoInterval = { start: startMoment, end: endMoment };
  const bounds = eventPixelBounds(interval, VIEWPORT);

  const expectedLeft = axisYearsToPx(toRange(startMoment).start, VIEWPORT);
  const expectedRight = axisYearsToPx(toRange(endMoment).end, VIEWPORT);

  assert.ok(Math.abs(bounds.left - expectedLeft) < 1e-9);
  assert.ok(Math.abs(bounds.left + bounds.width - expectedRight) < 1e-9);
});

test('a single-moment event (start === end) occupies exactly the width of its own precision quantum, not zero', () => {
  const moment = yearMoment(1941);
  const interval: ChronoInterval = { start: moment, end: moment };
  const bounds = eventPixelBounds(interval, VIEWPORT);
  assert.ok(bounds.width > 0, 'a single year-precision event must have nonzero width (spans the whole year)');

  const range = toRange(moment);
  const expectedWidth = axisYearsToPx(range.end, VIEWPORT) - axisYearsToPx(range.start, VIEWPORT);
  assert.ok(Math.abs(bounds.width - expectedWidth) < 1e-9);
});

test('a day-precision single moment is much narrower than a year-precision one at the same viewport', () => {
  const dayInterval: ChronoInterval = { start: dayMoment(1941, 6, 22), end: dayMoment(1941, 6, 22) };
  const yearInterval: ChronoInterval = { start: yearMoment(1941), end: yearMoment(1941) };
  const dayBounds = eventPixelBounds(dayInterval, VIEWPORT);
  const yearBounds = eventPixelBounds(yearInterval, VIEWPORT);
  assert.ok(dayBounds.width < yearBounds.width);
});

test('an open-ended interval (end: null) stretches to the right edge of the viewport, not beyond it', () => {
  const interval: ChronoInterval = { start: yearMoment(1980), end: null };
  const bounds = eventPixelBounds(interval, VIEWPORT);
  assert.equal(bounds.left + bounds.width, VIEWPORT.widthPx);
});

test('bounds are never negative width even for a degenerate/reversed interval', () => {
  // start after end shouldn't happen in well-formed data, but the function
  // must not produce a negative width if it ever does (defensive - garbage
  // in, sane geometry out, not garbage geometry).
  const interval: ChronoInterval = { start: yearMoment(1990), end: yearMoment(1980) };
  const bounds = eventPixelBounds(interval, VIEWPORT);
  assert.ok(bounds.width >= 0);
});

// ─── isEventVisible ──────────────────────────────────────────────────────

test('isEventVisible is true for an event fully inside the viewport', () => {
  const interval: ChronoInterval = { start: yearMoment(1940), end: yearMoment(1945) };
  assert.equal(isEventVisible(interval, VIEWPORT), true);
});

test('isEventVisible is true for an event only partially overlapping the viewport edge', () => {
  const interval: ChronoInterval = { start: yearMoment(1895), end: yearMoment(1905) }; // straddles the left edge (1900)
  assert.equal(isEventVisible(interval, VIEWPORT), true);
});

test('isEventVisible is false for an event entirely outside the viewport', () => {
  const interval: ChronoInterval = { start: yearMoment(1500), end: yearMoment(1510) };
  assert.equal(isEventVisible(interval, VIEWPORT), false);
});

test('isEventVisible is true for an open-ended event whose start is before the viewport', () => {
  const interval: ChronoInterval = { start: yearMoment(1000), end: null };
  assert.equal(isEventVisible(interval, VIEWPORT), true);
});
