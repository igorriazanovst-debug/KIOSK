// packages/player/src/periodictable/shellModel.contentCoverage.test.ts
// Инвариант против РЕАЛЬНОГО содержимого elements.json (118 элементов):
// сумма электронов по всем оболочкам обязана равняться атомному номеру
// (= числу электронов в нейтральном атоме) — если бы таблица благородных
// газов в shellModel.ts была неполной/неверной, или разбор ломался на
// каком-то реальном формате строки, эта сумма разошлась бы с номером
// элемента для конкретных элементов, а не осталась незамеченной.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeShellOccupancy } from './shellModel.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

test('every element: sum of shell electron counts equals its atomic number', () => {
  const failures: string[] = [];
  for (const el of (elementsJson as { elements: { atomicNumber: number; symbol: string; electronConfiguration: string }[] }).elements) {
    const shells = computeShellOccupancy(el.electronConfiguration);
    const total = shells.reduce((sum, s) => sum + s.electronCount, 0);
    if (total !== el.atomicNumber) {
      failures.push(`${el.atomicNumber} ${el.symbol}: "${el.electronConfiguration}" -> sum ${total}, expected ${el.atomicNumber}`);
    }
  }
  assert.deepEqual(failures, [], `mismatched elements:\n${failures.join('\n')}`);
});

test('every element has at least one occupied shell', () => {
  const failures: string[] = [];
  for (const el of (elementsJson as { elements: { atomicNumber: number; symbol: string; electronConfiguration: string }[] }).elements) {
    const shells = computeShellOccupancy(el.electronConfiguration);
    if (shells.length === 0) failures.push(`${el.atomicNumber} ${el.symbol}`);
  }
  assert.deepEqual(failures, []);
});
