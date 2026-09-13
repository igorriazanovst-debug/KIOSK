// packages/player/src/periodictable/shellModel.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeShellOccupancy } from './shellModel.ts';

test('hydrogen has no core, one shell with one electron', () => {
  assert.deepEqual(computeShellOccupancy('1s1'), [{ n: 1, electronCount: 1 }]);
});

test('carbon combines a He core with its own valence subshells', () => {
  // [He] 2s2 2p2 -> core: 1s2 (n1=2); valence: 2s2+2p2 (n2=4)
  assert.deepEqual(computeShellOccupancy('[He] 2s2 2p2'), [
    { n: 1, electronCount: 2 },
    { n: 2, electronCount: 4 },
  ]);
});

test('sodium expands a Ne core (two shells) plus its own valence electron', () => {
  // [Ne] 3s1 -> core: 1s2 2s2 2p6 (n1=2, n2=8); valence: 3s1 (n3=1)
  assert.deepEqual(computeShellOccupancy('[Ne] 3s1'), [
    { n: 1, electronCount: 2 },
    { n: 2, electronCount: 8 },
    { n: 3, electronCount: 1 },
  ]);
});

test('iron sums a d-subshell into the same principal shell as its s-subshell core contribution', () => {
  // [Ar] 3d6 4s2 -> core: 1s2 2s2 2p6 3s2 3p6 (n1=2,n2=8,n3=8); valence: 3d6 (n3+=6) + 4s2 (n4=2)
  assert.deepEqual(computeShellOccupancy('[Ar] 3d6 4s2'), [
    { n: 1, electronCount: 2 },
    { n: 2, electronCount: 8 },
    { n: 3, electronCount: 14 },
    { n: 4, electronCount: 2 },
  ]);
});

test('strips a trailing annotation like "(расчётная)" the same way the underlying parser does', () => {
  const result = computeShellOccupancy('[Rn] 5f14 6d10 7s2 7p6 (расчётная)');
  const total = result.reduce((sum, s) => sum + s.electronCount, 0);
  // Og (118): full Rn core (86) + 5f14+6d10+7s2+7p6 (32) = 118
  assert.equal(total, 118);
});
