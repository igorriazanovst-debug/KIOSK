// Чистая логика инструмента-лаборатории «Серпация» (Этап 4, Класс Б —
// плоские фигуры/сериация, ТЗ FR-022). Настоящее взаимодействие
// (перетаскивание), не имитация выбором — по прямому решению
// пользователя, см. docs/superpowers/specs/2026-09-10-mathmachine-fr022-groups23-design.md,
// разд. 3.4.

export type SeriationDirection = 'ascending' | 'descending';

export interface SeriationPuzzle {
  /** Размеры фигур в порядке их отображения в лотке (случайно перемешаны). */
  sizes: number[];
  direction: SeriationDirection;
}

const MIN_COUNT = 3;
const MAX_COUNT = 5;
const MIN_SIZE = 20;
const MAX_SIZE = 70;

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Гарантирует РАЗЛИЧНЫЕ размеры — иначе порядок неоднозначен (два элемента
 * одинакового размера можно поменять местами без нарушения монотонности). */
function distinctSizes(rng: () => number, count: number): number[] {
  const sizes = new Set<number>();
  while (sizes.size < count) {
    sizes.add(pickInt(rng, MIN_SIZE, MAX_SIZE));
  }
  return [...sizes];
}

export function generateSeriationPuzzle(rng: () => number = Math.random): SeriationPuzzle {
  const count = pickInt(rng, MIN_COUNT, MAX_COUNT);
  const sizes = shuffle(rng, distinctSizes(rng, count));
  const direction: SeriationDirection = rng() < 0.5 ? 'ascending' : 'descending';
  return { sizes, direction };
}

/**
 * slotOrder[i] — индекс элемента лотка (puzzle.sizes), помещённого в i-й
 * слот; null — слот пуст. Проверяется СВОЙСТВО получившейся
 * последовательности размеров (строго монотонна в заданном направлении),
 * не сравнение с одним заранее вычисленным "правильным" списком индексов —
 * так как размеры гарантированно различны, ровно один порядок индексов
 * этому свойству удовлетворяет, но сама проверка не завязана на то, как
 * именно генератор перемешал лоток.
 */
export function checkSeriationAnswer(puzzle: SeriationPuzzle, slotOrder: (number | null)[]): boolean {
  if (slotOrder.length !== puzzle.sizes.length) return false;
  if (slotOrder.some((v) => v === null)) return false;
  const indices = slotOrder as number[];
  if (new Set(indices).size !== puzzle.sizes.length) return false;
  const orderedSizes = indices.map((i) => puzzle.sizes[i]);
  for (let i = 1; i < orderedSizes.length; i++) {
    if (puzzle.direction === 'ascending' && orderedSizes[i] <= orderedSizes[i - 1]) return false;
    if (puzzle.direction === 'descending' && orderedSizes[i] >= orderedSizes[i - 1]) return false;
  }
  return true;
}
