// packages/player/src/periodictable/trendColor.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrendRange, trendColorFor, TREND_MISSING_COLOR } from './trendColor.ts';
import type { PeriodicElement } from './model/schema.ts';

function fakeElement(overrides: Partial<PeriodicElement>): PeriodicElement {
  return {
    atomicNumber: 1,
    symbol: 'X',
    nameRu: 'Тест',
    nameLatin: 'Test',
    atomicMass: 1,
    period: 1,
    groupIupac: 1,
    isLanthanide: false,
    isActinide: false,
    elementClass: 'nonmetal',
    electronType: 's',
    electronConfiguration: '1s1',
    naturalOccurrence: '',
    physicalStateNormal: '',
    crystalLattice: '',
    allotropes: '',
    stableIsotopes: '',
    electrochemicalSeriesPosition: null,
    density: null,
    meltingPointK: null,
    boilingPointK: null,
    oxideCharacter: 'none',
    electronegativityPauling: null,
    oxidationStates: '',
    photo: null,
    ...overrides,
  } as PeriodicElement;
}

test('computeTrendRange returns min/max across non-null values only', () => {
  const elements = [
    fakeElement({ atomicNumber: 1, density: 1 }),
    fakeElement({ atomicNumber: 2, density: null }),
    fakeElement({ atomicNumber: 3, density: 10 }),
    fakeElement({ atomicNumber: 4, density: 5 }),
  ];
  const range = computeTrendRange(elements, 'density');
  assert.deepEqual(range, { min: 1, max: 10 });
});

test('computeTrendRange handles an all-null property without throwing', () => {
  const elements = [fakeElement({ atomicNumber: 1, density: null })];
  const range = computeTrendRange(elements, 'density');
  assert.deepEqual(range, { min: 0, max: 0 });
});

test('trendColorFor returns the neutral color for a null value', () => {
  assert.equal(trendColorFor(null, { min: 0, max: 10 }), TREND_MISSING_COLOR);
});

test('trendColorFor returns the low-end color at the minimum', () => {
  assert.equal(trendColorFor(0, { min: 0, max: 10 }), '#42a5f5');
});

test('trendColorFor returns the high-end color at the maximum', () => {
  assert.equal(trendColorFor(10, { min: 0, max: 10 }), '#ef5350');
});

test('trendColorFor returns the mid-point color at the midpoint', () => {
  assert.equal(trendColorFor(5, { min: 0, max: 10 }), '#ffee58');
});

test('trendColorFor clamps out-of-range values instead of extrapolating', () => {
  assert.equal(trendColorFor(-5, { min: 0, max: 10 }), '#42a5f5');
  assert.equal(trendColorFor(15, { min: 0, max: 10 }), '#ef5350');
});

test('trendColorFor does not divide by zero when min === max', () => {
  assert.doesNotThrow(() => trendColorFor(7, { min: 7, max: 7 }));
});
