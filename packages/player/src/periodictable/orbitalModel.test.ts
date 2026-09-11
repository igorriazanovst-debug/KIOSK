// packages/player/src/periodictable/orbitalModel.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseElectronConfiguration } from './orbitalModel.ts';

test('parses a no-core configuration (hydrogen)', () => {
  const result = parseElectronConfiguration('1s1');
  assert.equal(result.coreLabel, null);
  assert.deepEqual(result.valenceGroups, [{ n: 1, subshell: 's', electronCount: 1 }]);
});

test('parses a simple noble-gas-core configuration (carbon)', () => {
  const result = parseElectronConfiguration('[He] 2s2 2p2');
  assert.equal(result.coreLabel, 'He');
  assert.deepEqual(result.valenceGroups, [
    { n: 2, subshell: 's', electronCount: 2 },
    { n: 2, subshell: 'p', electronCount: 2 },
  ]);
});

test('parses an anomalous-filling configuration exactly as given (chromium)', () => {
  // Cr — известное исключение (3d5 4s1, а не 3d4 4s2): парсер не пытается
  // "исправить" данные по общему правилу заполнения, просто читает строку.
  const result = parseElectronConfiguration('[Ar] 3d5 4s1');
  assert.equal(result.coreLabel, 'Ar');
  assert.deepEqual(result.valenceGroups, [
    { n: 3, subshell: 'd', electronCount: 5 },
    { n: 4, subshell: 's', electronCount: 1 },
  ]);
});

test('parses a configuration with no s-electrons in valence part (palladium)', () => {
  const result = parseElectronConfiguration('[Kr] 4d10');
  assert.equal(result.coreLabel, 'Kr');
  assert.deepEqual(result.valenceGroups, [{ n: 4, subshell: 'd', electronCount: 10 }]);
});

test('parses an f-block configuration with three valence groups (cerium)', () => {
  const result = parseElectronConfiguration('[Xe] 4f1 5d1 6s2');
  assert.equal(result.coreLabel, 'Xe');
  assert.deepEqual(result.valenceGroups, [
    { n: 4, subshell: 'f', electronCount: 1 },
    { n: 5, subshell: 'd', electronCount: 1 },
    { n: 6, subshell: 's', electronCount: 2 },
  ]);
});

test('strips a trailing "(расчётная)" annotation without touching the core bracket', () => {
  const result = parseElectronConfiguration('[Rn] 5f14 6d10 7s2 7p6 (расчётная)');
  assert.equal(result.coreLabel, 'Rn');
  assert.deepEqual(result.valenceGroups, [
    { n: 5, subshell: 'f', electronCount: 14 },
    { n: 6, subshell: 'd', electronCount: 10 },
    { n: 7, subshell: 's', electronCount: 2 },
    { n: 7, subshell: 'p', electronCount: 6 },
  ]);
});

test('returns an empty valence list for an unparseable string rather than throwing', () => {
  const result = parseElectronConfiguration('???');
  assert.deepEqual(result.valenceGroups, []);
});
