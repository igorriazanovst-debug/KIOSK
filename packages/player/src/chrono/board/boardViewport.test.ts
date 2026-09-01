import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisYearsToPx, type Viewport } from '@kiosk/shared';
import { panViewport, zoomViewportAtPoint, visibleAxisRange, MIN_SPAN_YEARS, MAX_SPAN_YEARS } from './boardViewport.ts';

const VIEWPORT: Viewport = { centerAxisYears: 1950, spanAxisYears: 100, widthPx: 1000 };

// ─── panViewport ─────────────────────────────────────────────────────────

test('panViewport with deltaPx=0 leaves the viewport unchanged', () => {
  assert.deepEqual(panViewport(VIEWPORT, 0), VIEWPORT);
});

test('panViewport by half the width shifts the center by half the span, into the past', () => {
  const panned = panViewport(VIEWPORT, 500); // dragging content right by half the screen
  assert.equal(panned.centerAxisYears, 1950 - 50);
  assert.equal(panned.spanAxisYears, VIEWPORT.spanAxisYears); // pan never changes zoom
});

test('panViewport in the opposite direction moves toward the future', () => {
  const panned = panViewport(VIEWPORT, -500);
  assert.equal(panned.centerAxisYears, 1950 + 50);
});

// ─── zoomViewportAtPoint: the core "anchor stays under the same pixel" property ──

test('zooming exactly at the viewport center leaves the center unchanged', () => {
  const zoomed = zoomViewportAtPoint(VIEWPORT, VIEWPORT.widthPx / 2, 2);
  assert.equal(zoomed.centerAxisYears, VIEWPORT.centerAxisYears);
  assert.equal(zoomed.spanAxisYears, 50); // span halved
});

test('zooming in (scaleFactor > 1) shrinks the span; zooming out (< 1) grows it', () => {
  assert.equal(zoomViewportAtPoint(VIEWPORT, 500, 2).spanAxisYears, 50);
  assert.equal(zoomViewportAtPoint(VIEWPORT, 500, 0.5).spanAxisYears, 200);
});

test('the anchor pixel maps to the same axis position before and after zoom, at an off-center point', () => {
  const pxAnchor = 750; // 3/4 across the screen, not the center
  const anchorAxisYearsBefore = 1950 + ((pxAnchor - 500) / 1000) * 100; // = 1975

  const zoomed = zoomViewportAtPoint(VIEWPORT, pxAnchor, 4);
  const anchorPxAfter = axisYearsToPx(anchorAxisYearsBefore, zoomed);

  assert.ok(Math.abs(anchorPxAfter - pxAnchor) < 1e-9, `anchor drifted to px ${anchorPxAfter}, expected ${pxAnchor}`);
});

test('the anchor-stays-fixed property holds across a wide sweep of anchors and scale factors', () => {
  for (const pxAnchor of [0, 100, 333, 500, 750, 999, 1000]) {
    for (const scaleFactor of [1.5, 2, 3, 5, 0.5, 0.25]) {
      const anchorAxisYearsBefore = 1950 + ((pxAnchor - 500) / 1000) * 100;
      const zoomed = zoomViewportAtPoint(VIEWPORT, pxAnchor, scaleFactor);
      const anchorPxAfter = axisYearsToPx(anchorAxisYearsBefore, zoomed);
      assert.ok(
        Math.abs(anchorPxAfter - pxAnchor) < 1e-6,
        `pxAnchor=${pxAnchor}, scaleFactor=${scaleFactor}: drifted to ${anchorPxAfter}`
      );
    }
  }
});

test('zoom span is clamped to MIN_SPAN_YEARS on extreme zoom-in', () => {
  const zoomed = zoomViewportAtPoint(VIEWPORT, 500, 1e12);
  assert.equal(zoomed.spanAxisYears, MIN_SPAN_YEARS);
});

test('zoom span is clamped to MAX_SPAN_YEARS on extreme zoom-out', () => {
  const zoomed = zoomViewportAtPoint(VIEWPORT, 500, 1e-12);
  assert.equal(zoomed.spanAxisYears, MAX_SPAN_YEARS);
});

test('zoomViewportAtPoint rejects a non-positive or non-finite scaleFactor', () => {
  assert.throws(() => zoomViewportAtPoint(VIEWPORT, 500, 0), RangeError);
  assert.throws(() => zoomViewportAtPoint(VIEWPORT, 500, -1), RangeError);
  assert.throws(() => zoomViewportAtPoint(VIEWPORT, 500, NaN), RangeError);
  assert.throws(() => zoomViewportAtPoint(VIEWPORT, 500, Infinity), RangeError);
});

// ─── visibleAxisRange ────────────────────────────────────────────────────

test('visibleAxisRange returns [center - span/2, center + span/2]', () => {
  const range = visibleAxisRange(VIEWPORT);
  assert.equal(range.start, 1900);
  assert.equal(range.end, 2000);
});
