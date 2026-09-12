// packages/player/src/periodictable/compareSelection.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToCompare, removeFromCompare, MAX_COMPARE } from './compareSelection.ts';
import type { PeriodicElement } from './model/schema.ts';

function fakeElement(atomicNumber: number): PeriodicElement {
  return {
    atomicNumber,
    symbol: `E${atomicNumber}`,
    nameRu: `Элемент${atomicNumber}`,
    nameLatin: `Element${atomicNumber}`,
    atomicMass: atomicNumber,
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
  } as PeriodicElement;
}

test('addToCompare appends a new element', () => {
  const result = addToCompare([fakeElement(1)], fakeElement(2));
  assert.deepEqual(result.map((e) => e.atomicNumber), [1, 2]);
});

test('addToCompare does not add a duplicate atomic number', () => {
  const result = addToCompare([fakeElement(1)], fakeElement(1));
  assert.equal(result.length, 1);
});

test(`addToCompare refuses beyond ${MAX_COMPARE} elements`, () => {
  const selection = Array.from({ length: MAX_COMPARE }, (_, i) => fakeElement(i + 1));
  const result = addToCompare(selection, fakeElement(99));
  assert.equal(result.length, MAX_COMPARE);
  assert.ok(!result.some((e) => e.atomicNumber === 99));
});

test('removeFromCompare removes only the matching atomic number', () => {
  const selection = [fakeElement(1), fakeElement(2), fakeElement(3)];
  const result = removeFromCompare(selection, 2);
  assert.deepEqual(result.map((e) => e.atomicNumber), [1, 3]);
});

test('removeFromCompare on a non-present atomic number is a no-op', () => {
  const selection = [fakeElement(1)];
  const result = removeFromCompare(selection, 99);
  assert.deepEqual(result.map((e) => e.atomicNumber), [1]);
});
