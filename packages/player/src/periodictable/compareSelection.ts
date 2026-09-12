// packages/player/src/periodictable/compareSelection.ts
// Чистая логика набора элементов для сравнения — не более MAX_COMPARE,
// без дублей, иммутабельно (та же причина, что withExplored в
// explorationStorage.ts: вызывающий React-код сам решает, когда звать
// setState результатом).

import type { PeriodicElement } from './model/schema.ts';

export const MAX_COMPARE = 3;

export function addToCompare(selection: PeriodicElement[], el: PeriodicElement): PeriodicElement[] {
  if (selection.some((s) => s.atomicNumber === el.atomicNumber)) return selection;
  if (selection.length >= MAX_COMPARE) return selection;
  return [...selection, el];
}

export function removeFromCompare(selection: PeriodicElement[], atomicNumber: number): PeriodicElement[] {
  return selection.filter((s) => s.atomicNumber !== atomicNumber);
}
