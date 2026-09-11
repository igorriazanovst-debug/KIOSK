// packages/player/src/periodictable/search.ts
// Поиск по названию/номеру/символу/массе (вкладка «Поиск», раздел 2 спеки).
// Без защиты PIN — справочная функция, не требует блокировки (спека, разд. 5).

import type { PeriodicElement } from './model/schema.ts';

export function searchElements(elements: PeriodicElement[], query: string): PeriodicElement[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return elements.filter((el) =>
    el.nameRu.toLowerCase().includes(q) ||
    el.nameLatin.toLowerCase().includes(q) ||
    el.symbol.toLowerCase() === q ||
    String(el.atomicNumber) === q ||
    String(el.atomicMass).startsWith(q)
  );
}
