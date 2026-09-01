import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseTickStep, generateTicks } from './ticks';

// ─── chooseTickStep: exact matches (ideal step lands exactly on a nice unit) ──

test('100 years span, target 10 ticks -> ideal step 10 years -> decade x1 (exact)', () => {
  const step = chooseTickStep(100, 10);
  assert.equal(step.unit, 'decade');
  assert.equal(step.multiplier, 1);
  assert.equal(step.stepYears, 10);
});

test('1000 years span, target 10 ticks -> ideal step 100 years -> century x1 (exact)', () => {
  const step = chooseTickStep(1000, 10);
  assert.equal(step.unit, 'century');
  assert.equal(step.multiplier, 1);
  assert.equal(step.stepYears, 100);
});

test('100 million years span, target 10 ticks -> ideal step 10M years -> tenMillionYears x1 (exact)', () => {
  const step = chooseTickStep(100_000_000, 10);
  assert.equal(step.unit, 'tenMillionYears');
  assert.equal(step.multiplier, 1);
  assert.equal(step.stepYears, 10_000_000);
});

test('4.5 billion year span, target 9 -> ideal step 500M years -> hundredMillionYears x5 (exact, and it is a deep-time unit, not seconds/days)', () => {
  const step = chooseTickStep(4_500_000_000, 9);
  assert.equal(step.unit, 'hundredMillionYears');
  assert.equal(step.multiplier, 5);
  assert.equal(step.stepYears, 500_000_000);
});

test('a very short span (1 hour) picks a fine-grained step, not years', () => {
  const oneHourInYears = 1 / (365.25 * 24);
  const step = chooseTickStep(oneHourInYears, 6);
  assert.ok(['second', 'minute'].includes(step.unit), `expected second/minute, got ${step.unit}`);
});

test('chooseTickStep always returns a step within roughly 2x-5x of the ideal (no wildly-off candidate wins)', () => {
  const spans = [1, 5, 50, 500, 5000, 50_000, 5_000_000, 500_000_000];
  for (const span of spans) {
    const step = chooseTickStep(span, 8);
    const idealStep = span / 8;
    const ratio = step.stepYears / idealStep;
    assert.ok(ratio > 0.1 && ratio < 10, `span=${span}: step ${step.stepYears} is too far from ideal ${idealStep} (ratio ${ratio})`);
  }
});

test('chooseTickStep rejects non-positive or non-finite span', () => {
  assert.throws(() => chooseTickStep(0), RangeError);
  assert.throws(() => chooseTickStep(-10), RangeError);
  assert.throws(() => chooseTickStep(NaN), RangeError);
  assert.throws(() => chooseTickStep(Infinity), RangeError);
});

// ─── generateTicks ─────────────────────────────────────────────────────────

test('generateTicks over [0, 100] with target 10 produces ticks at every decade, inclusive of both ends', () => {
  const ticks = generateTicks(0, 100, 10);
  const positions = ticks.map((t) => t.axisYears);
  assert.deepEqual(positions, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
});

test('generateTicks aligns to step multiples, not to the raw start of the range - the alignment grid includes 1930, but ticks before the visible start are excluded, so the first VISIBLE tick is 1940', () => {
  // span 40 -> ideal 10 -> decade x1. The grid is ...1920, 1930, 1940...;
  // 1930 < 1935 (the visible start) so it's correctly excluded, not shown
  // off-screen - what proves alignment-to-the-grid (not to the arbitrary
  // start) is that 1940 is a clean multiple of 10, not 1935+10=1945.
  const ticks = generateTicks(1935, 1975, 4);
  assert.equal(ticks[0].axisYears, 1940);
  assert.equal(ticks[0].axisYears % 10, 0);
});

test('generateTicks all share the same unit/multiplier (the step chosen for the whole range)', () => {
  const ticks = generateTicks(0, 1000, 10);
  const units = new Set(ticks.map((t) => t.unit));
  const multipliers = new Set(ticks.map((t) => t.multiplier));
  assert.equal(units.size, 1);
  assert.equal(multipliers.size, 1);
});

test('generateTicks rejects a non-positive range', () => {
  assert.throws(() => generateTicks(100, 100), RangeError);
  assert.throws(() => generateTicks(100, 50), RangeError);
});

test('generateTicks works across the BCE/CE boundary without an off-by-one at zero', () => {
  const ticks = generateTicks(-25, 25, 5); // span 50 -> ideal 10 -> decade x1
  const positions = ticks.map((t) => t.axisYears);
  assert.deepEqual(positions, [-20, -10, 0, 10, 20]);
});

test('generateTicks handles a deep-time range (millions of years) without producing an absurd number of ticks', () => {
  const ticks = generateTicks(0, 4_500_000_000, 9);
  assert.ok(ticks.length >= 5 && ticks.length <= 60, `expected a reasonable tick count, got ${ticks.length}`);
});
