import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PeriodicTableContentSchema, PERIODICTABLE_CONTENT_SCHEMA_VERSION } from './schema.ts';

const hydrogen = {
  atomicNumber: 1,
  symbol: 'H',
  nameRu: 'Водород',
  nameLatin: 'Hydrogenium',
  atomicMass: 1.008,
  period: 1,
  groupIupac: 1,
  isLanthanide: false,
  isActinide: false,
  electronType: 's',
  elementClass: 'nonmetal',
  oxideCharacter: 'none',
  electronConfiguration: '1s1',
  naturalOccurrence: 'Самый распространённый элемент во Вселенной; на Земле — в составе воды и органических соединений.',
  physicalStateNormal: 'газ',
  crystalLattice: 'не образует (газ при н.у.)',
  allotropes: '',
  stableIsotopes: '1, 2',
  electrochemicalSeriesPosition: null,
  density: 0.00009,
  meltingPointK: 14.01,
  boilingPointK: 20.28,
  oxidationStates: '+1, -1',
  electronegativityPauling: 2.2,
  photo: null,
};

test('a valid element passes PeriodicTableContentSchema', () => {
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [hydrogen] };
  assert.equal(PeriodicTableContentSchema.safeParse(content).success, true);
});

test('duplicate atomicNumber is rejected', () => {
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [hydrogen, { ...hydrogen }] };
  const result = PeriodicTableContentSchema.safeParse(content);
  assert.equal(result.success, false);
});

test('a main-grid element (not lanthanide/actinide footer) missing groupIupac is rejected', () => {
  const broken = { ...hydrogen, groupIupac: null };
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [broken] };
  const result = PeriodicTableContentSchema.safeParse(content);
  assert.equal(result.success, false);
});

test('a footer lanthanide (atomicNumber 58-71, not 57) may have groupIupac null', () => {
  const cerium = { ...hydrogen, atomicNumber: 58, symbol: 'Ce', nameRu: 'Церий', nameLatin: 'Cerium', period: 6, groupIupac: null, isLanthanide: true, elementClass: 'metal' };
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [cerium] };
  assert.equal(PeriodicTableContentSchema.safeParse(content).success, true);
});

test('lanthanum itself (atomicNumber 57) still requires groupIupac even though isLanthanide is true', () => {
  const lanthanum = { ...hydrogen, atomicNumber: 57, symbol: 'La', nameRu: 'Лантан', nameLatin: 'Lanthanum', period: 6, groupIupac: null, isLanthanide: true, elementClass: 'metal' };
  const content = { schemaVersion: PERIODICTABLE_CONTENT_SCHEMA_VERSION, elements: [lanthanum] };
  assert.equal(PeriodicTableContentSchema.safeParse(content).success, false);
});
