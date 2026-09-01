import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisYearsToPx, pxToAxisYears, type Viewport } from './projection';

const BASIC_VIEWPORT: Viewport = { centerAxisYears: 1950, spanAxisYears: 100, widthPx: 1000 };

test('the center of the viewport maps to the horizontal center of the pixel area', () => {
  assert.equal(axisYearsToPx(1950, BASIC_VIEWPORT), 500);
});

test('the left/right edges of the span map to pixel 0 / widthPx', () => {
  assert.equal(axisYearsToPx(1900, BASIC_VIEWPORT), 0); // center - span/2
  assert.equal(axisYearsToPx(2000, BASIC_VIEWPORT), 1000); // center + span/2
});

test('axisYearsToPx and pxToAxisYears are exact inverses', () => {
  for (const year of [1900, 1941.5, 1950, 1975, 2000]) {
    const px = axisYearsToPx(year, BASIC_VIEWPORT);
    const back = pxToAxisYears(px, BASIC_VIEWPORT);
    assert.ok(Math.abs(back - year) < 1e-9, `round-trip failed for ${year}: got ${back}`);
  }
});

test('rejects a non-positive span', () => {
  const bad: Viewport = { ...BASIC_VIEWPORT, spanAxisYears: 0 };
  assert.throws(() => axisYearsToPx(1950, bad), RangeError);
});

test('rejects a non-positive width', () => {
  const bad: Viewport = { ...BASIC_VIEWPORT, widthPx: -100 };
  assert.throws(() => axisYearsToPx(1950, bad), RangeError);
});

// ─── The specific risk the architect review flagged: catastrophic
// cancellation when the viewport is anchored deep in the past (billions of
// years) while zoomed in to a small span (e.g. individual years). If the
// math subtracted the anchor AFTER dividing by span instead of before, this
// would lose precision exactly here. ──────────────────────────────────────

test('deep-time anchor: viewport centered 4.5 billion years in the past, zoomed to a 10-year span, still resolves the center to pixel widthPx/2 exactly', () => {
  const deepViewport: Viewport = { centerAxisYears: 1950 - 4_500_000_000, spanAxisYears: 10, widthPx: 1000 };
  assert.equal(axisYearsToPx(deepViewport.centerAxisYears, deepViewport), 500);
});

test('deep-time anchor: round-trip precision survives at a large anchor with a narrow span', () => {
  const deepViewport: Viewport = { centerAxisYears: 1950 - 4_500_000_000, spanAxisYears: 10, widthPx: 1000 };
  const target = deepViewport.centerAxisYears + 2.5; // 2.5 years off-center
  const px = axisYearsToPx(target, deepViewport);
  const back = pxToAxisYears(px, deepViewport);
  // Tolerance: a few ULPs at this magnitude (~1e-6 relative), not 1e-9 -
  // the point of this test is "still usably precise", not "as precise as
  // a small-anchor viewport".
  assert.ok(Math.abs(back - target) < 1e-4, `round-trip drifted by ${Math.abs(back - target)} at a 4.5B-year anchor`);
});

test('deep-time anchor: a target 25% of the span from center lands at the correct pixel, not just "close"', () => {
  const deepViewport: Viewport = { centerAxisYears: 1950 - 4_500_000_000, spanAxisYears: 10, widthPx: 1000 };
  const target = deepViewport.centerAxisYears + 2.5; // +25% of the 10-year span
  assert.equal(axisYearsToPx(target, deepViewport), 750);
});
