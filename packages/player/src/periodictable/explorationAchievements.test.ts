// packages/player/src/periodictable/explorationAchievements.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAchievements } from './explorationAchievements.ts';
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

test('an achievement is not completed until every matching element is explored', () => {
  const elements = [
    fakeElement({ atomicNumber: 1, elementClass: 'metal' }),
    fakeElement({ atomicNumber: 2, elementClass: 'metal' }),
    fakeElement({ atomicNumber: 3, elementClass: 'nonmetal' }),
  ];
  const achievements = computeAchievements(elements, new Set([1]));
  const metalAchievement = achievements.find((a) => a.id === 'class-metal')!;
  assert.equal(metalAchievement.total, 2);
  assert.equal(metalAchievement.exploredCount, 1);
  assert.equal(metalAchievement.completed, false);
});

test('an achievement completes once every matching element has been explored', () => {
  const elements = [
    fakeElement({ atomicNumber: 1, elementClass: 'metal' }),
    fakeElement({ atomicNumber: 2, elementClass: 'metal' }),
  ];
  const achievements = computeAchievements(elements, new Set([1, 2]));
  const metalAchievement = achievements.find((a) => a.id === 'class-metal')!;
  assert.equal(metalAchievement.completed, true);
});

test('an achievement with zero matching elements is never marked completed', () => {
  const elements: PeriodicElement[] = [];
  const achievements = computeAchievements(elements, new Set());
  for (const a of achievements) {
    assert.equal(a.total, 0);
    assert.equal(a.completed, false);
  }
});
