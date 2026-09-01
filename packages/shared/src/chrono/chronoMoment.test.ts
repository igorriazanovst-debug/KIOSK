import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCalendarMoment,
  isEpochMoment,
  assertFiniteMoment,
  EPOCH_REFERENCE_YEAR,
  type ChronoMoment,
} from './chronoMoment';

const CALENDAR: ChronoMoment = {
  kind: 'calendar',
  civilDay: { day: 2429000, secondOfDay: 16200 },
  precision: 'day',
  calendar: 'gregorian',
  approximate: false,
};

const EPOCH: ChronoMoment = {
  kind: 'epoch',
  yearsBeforeEpoch: 65_000_000,
  precision: 'millionYears',
  approximate: true,
};

test('EPOCH_REFERENCE_YEAR is fixed at 1950 (the BP convention)', () => {
  assert.equal(EPOCH_REFERENCE_YEAR, 1950);
});

test('isCalendarMoment/isEpochMoment discriminate correctly', () => {
  assert.equal(isCalendarMoment(CALENDAR), true);
  assert.equal(isEpochMoment(CALENDAR), false);
  assert.equal(isCalendarMoment(EPOCH), false);
  assert.equal(isEpochMoment(EPOCH), true);
});

test('assertFiniteMoment does not throw for well-formed moments of either kind', () => {
  assert.doesNotThrow(() => assertFiniteMoment(CALENDAR));
  assert.doesNotThrow(() => assertFiniteMoment(EPOCH));
});

test('assertFiniteMoment rejects NaN in a calendar moment civilDay', () => {
  const bad: ChronoMoment = { ...CALENDAR, civilDay: { day: NaN, secondOfDay: 0 } };
  assert.throws(() => assertFiniteMoment(bad), RangeError);
});

test('assertFiniteMoment rejects Infinity in a calendar moment civilDay', () => {
  const bad: ChronoMoment = { ...CALENDAR, civilDay: { day: 100, secondOfDay: Infinity } };
  assert.throws(() => assertFiniteMoment(bad), RangeError);
});

test('assertFiniteMoment rejects NaN/Infinity in an epoch moment', () => {
  assert.throws(() => assertFiniteMoment({ ...EPOCH, yearsBeforeEpoch: NaN }), RangeError);
  assert.throws(() => assertFiniteMoment({ ...EPOCH, yearsBeforeEpoch: -Infinity }), RangeError);
});

test('ChronoMoment values are plain JSON-serializable objects (no classes, no lost data on round-trip)', () => {
  const roundTripped = JSON.parse(JSON.stringify(CALENDAR));
  assert.deepEqual(roundTripped, CALENDAR);
});
