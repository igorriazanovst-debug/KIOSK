// packages/player/src/periodictable/explorationStorage.ts
// Какие элементы ученик уже открывал (сводная или подробная карточка) —
// чистое per-device UI-удобство/геймификация, не пользовательский прогресс
// с оценками (тот же принцип, что viewSettingsStorage.ts: localStorage без
// IPC, guard по typeof window — см. комментарий там).

const STORAGE_KEY = 'periodictable.explored.v1';

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadExploredSet(): Set<number> {
  if (!hasLocalStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is number => typeof v === 'number'));
  } catch {
    return new Set();
  }
}

export function saveExploredSet(explored: Set<number>): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...explored]));
  } catch {
    // Приватный режим/квота — не критично, следующая попытка запишет снова.
  }
}

/** Возвращает НОВЫЙ Set с добавленным номером (иммутабельно — вызывающий
 *  код сам решает, вызывать ли setState с результатом). */
export function withExplored(explored: Set<number>, atomicNumber: number): Set<number> {
  if (explored.has(atomicNumber)) return explored;
  return new Set(explored).add(atomicNumber);
}
