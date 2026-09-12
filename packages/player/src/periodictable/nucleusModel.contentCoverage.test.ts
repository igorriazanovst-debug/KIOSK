// packages/player/src/periodictable/nucleusModel.contentCoverage.test.ts
// Инвариант против РЕАЛЬНЫХ 118 элементов: оценка числа нейтронов не
// должна уходить в отрицательную область или давать абсурдные значения
// ни для одного реального (atomicNumber, atomicMass) — если бы формула
// сломалась на каком-то диапазоне масс, это всплыло бы здесь, а не в
// первый раз при живом просмотре конкретного тяжёлого/лёгкого элемента.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNucleusComposition } from './nucleusModel.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

test('every element has a non-negative, plausible neutron estimate', () => {
  const failures: string[] = [];
  for (const el of (elementsJson as { elements: { atomicNumber: number; symbol: string; atomicMass: number }[] }).elements) {
    const comp = computeNucleusComposition(el.atomicNumber, el.atomicMass);
    if (comp.neutronCount < 0 || comp.totalNucleons <= 0) {
      failures.push(`${el.atomicNumber} ${el.symbol}: neutrons=${comp.neutronCount}, total=${comp.totalNucleons}`);
    }
    // Реальные ядра тяжелее водорода никогда не бывают "почти без
    // нейтронов" (протонов настолько больше нейтронов не бывает ни у
    // одного реального элемента) — грубая, но полезная защита от того,
    // что формула сложила/вычла что-то не то для конкретного элемента.
    if (el.atomicNumber > 2 && comp.neutronCount < comp.protonCount * 0.7) {
      failures.push(`${el.atomicNumber} ${el.symbol}: implausibly low neutron count ${comp.neutronCount} vs ${comp.protonCount} protons`);
    }
  }
  assert.deepEqual(failures, [], `problem elements:\n${failures.join('\n')}`);
});
