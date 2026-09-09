// Чистая математика/логика инструмента-лаборатории «Цепочка» (ТЗ FR-024,
// Этап 2a). Оригинальная механика недоступна для восстановления (в
// распакованных ресурсах — только графика `lab_chain.xml/png`, правила
// закономерности были зашиты в недоступный .swf) — это собственная
// закономерность с той же дидактической целью, см. спеку разд. 1/4.

export type ChainCategory = 'number' | 'shape' | 'letter' | 'toy';

// Найдено вживую при ручном тестировании: раньше здесь были английские
// слова ('circle'/'ball' и т.д.), отображавшиеся как текст в детском
// приложении на русском языке. Значки — универсальный визуальный язык,
// не требующий перевода вообще.
export const SHAPE_POOL = ['●', '■', '▲'] as const;
export const LETTER_POOL = ['А', 'Б', 'В'] as const;
export const TOY_POOL = ['⚽', '🚗', '🌼'] as const;

const CHAIN_LENGTH_MIN = 5;
const CHAIN_LENGTH_MAX = 7;
const NUMBER_RANGE_MIN = 0;
const NUMBER_RANGE_MAX = 30;
const NUMBER_STEPS = [-3, -2, -1, 1, 2, 3];

export interface ChainPuzzle {
  category: ChainCategory;
  values: string[];
  blankIndices: number[];
}

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[pickInt(rng, 0, items.length - 1)];
}

function generateNumberValues(rng: () => number, length: number): string[] {
  const step = pickOne(rng, NUMBER_STEPS);
  const span = (length - 1) * step;
  const minStart = step > 0 ? NUMBER_RANGE_MIN : NUMBER_RANGE_MIN - span;
  const maxStart = step > 0 ? NUMBER_RANGE_MAX - span : NUMBER_RANGE_MAX;
  const start = pickInt(rng, minStart, maxStart);
  return Array.from({ length }, (_, i) => String(start + i * step));
}

function poolForCategory(category: Exclude<ChainCategory, 'number'>): readonly string[] {
  if (category === 'shape') return SHAPE_POOL;
  if (category === 'letter') return LETTER_POOL;
  return TOY_POOL;
}

function generatePatternValues(rng: () => number, category: Exclude<ChainCategory, 'number'>, length: number): string[] {
  const pool = poolForCategory(category);
  const period = pickInt(rng, 2, Math.min(3, pool.length));
  return Array.from({ length }, (_, i) => pool[i % period]);
}

function pickBlankIndices(rng: () => number, length: number): number[] {
  const interior = Array.from({ length: length - 2 }, (_, i) => i + 1); // 1..length-2, никогда не первая/последняя
  const count = pickInt(rng, 1, 2);
  const shuffled = [...interior];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pickInt(rng, 0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).sort((a, b) => a - b);
}

// forcedCategory: найдено вживую — раньше вкладка (Числа/Фигуры/Буквы/
// Игрушки) в ChainTool.tsx была полностью независима от того, какую
// категорию на самом деле выбрал generateChainPuzzle() внутри себя
// случайно. Переключение вкладки меняло только палитру снизу, а сама
// цепочка сверху оставалась от старой категории — пользователь мог
// вставлять буквы в цепочку из чисел и не получать ни одного верного
// ответа. Теперь ChainTool явно передаёт нужную категорию при смене
// вкладки/генерации новой цепочки, а не полагается на случайный выбор.
export function generateChainPuzzle(rng: () => number = Math.random, forcedCategory?: ChainCategory): ChainPuzzle {
  const category = forcedCategory ?? pickOne<ChainCategory>(rng, ['number', 'shape', 'letter', 'toy']);
  const length = pickInt(rng, CHAIN_LENGTH_MIN, CHAIN_LENGTH_MAX);
  const values = category === 'number' ? generateNumberValues(rng, length) : generatePatternValues(rng, category, length);
  const blankIndices = pickBlankIndices(rng, length);
  return { category, values, blankIndices };
}

export function checkChainAnswers(puzzle: ChainPuzzle, placedByIndex: Record<number, string>): Record<number, boolean> {
  const result: Record<number, boolean> = {};
  for (const index of puzzle.blankIndices) {
    result[index] = placedByIndex[index] === puzzle.values[index];
  }
  return result;
}

const BASE_DIGIT_TILES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function buildNumberPaletteValues(puzzle: ChainPuzzle): string[] {
  if (puzzle.category !== 'number') return [...BASE_DIGIT_TILES];
  const extras = puzzle.blankIndices.map((i) => puzzle.values[i]).filter((v) => !BASE_DIGIT_TILES.includes(v));
  return [...BASE_DIGIT_TILES, ...extras];
}
