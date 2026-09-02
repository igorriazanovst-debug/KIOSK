import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTodayMarkerPx } from './todayMarker.js';
import type { Viewport } from '@kiosk/shared';

function viewportCenteredOn(year: number, spanYears: number, widthPx = 1000): Viewport {
  return { centerAxisYears: year, spanAxisYears: spanYears, widthPx };
}

test('computeTodayMarkerPx: returns a pixel position when today falls inside the visible range', () => {
  const now = new Date(2026, 0, 15);
  const viewport = viewportCenteredOn(2026, 10);
  const px = computeTodayMarkerPx(viewport, now);
  assert.notEqual(px, null);
  assert.ok(px! >= 0 && px! <= viewport.widthPx, 'marker should land within the visible track width');
});

test('computeTodayMarkerPx: null when today is outside the visible range (viewport centered far in the past)', () => {
  const now = new Date(2026, 0, 15);
  const viewport = viewportCenteredOn(1941, 5);
  assert.equal(computeTodayMarkerPx(viewport, now), null);
});

test('computeTodayMarkerPx: null when today is just past the right edge of the viewport', () => {
  const now = new Date(2026, 0, 15);
  // Центр в 2020, span 5 - видимый диапазон примерно [2017.5, 2022.5], 2026 вне его.
  const viewport = viewportCenteredOn(2020, 5);
  assert.equal(computeTodayMarkerPx(viewport, now), null);
});

test('computeTodayMarkerPx: lands near the horizontal center when today is exactly the viewport center', () => {
  const now = new Date(2026, 5, 15);
  const viewport = viewportCenteredOn(2026, 10, 1000);
  const px = computeTodayMarkerPx(viewport, now);
  assert.notEqual(px, null);
  // Год не круглый (середина 2026), поэтому центр оси примерно совпадает с серединой трека.
  assert.ok(Math.abs(px! - 500) < 50, `expected near-center position, got ${px}`);
});
