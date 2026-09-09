// Offline-генератор контента Этапа 2b, волна 5 — количественное
// расширение (согласовано с пользователем: 6 новых тем в 5 самых
// «тонких» категориях каталога — на момент планирования у каждой из них
// было ровно по 1 теме, тогда как «Умножение» уже насчитывало 8 тем/90
// заданий; цель волны — выровнять каталог, а не наращивать уже
// насыщенные категории). Не вводит НИ ОДНОГО нового TaskTypeId — только
// новые диапазоны/темы для уже существующих типов, поэтому schema.ts/
// taskEngine.ts/TaskVisual.tsx/TaskRunner.tsx не трогаются вовсе (тот же
// принцип, что и в волне 4).
//
// Из 6 тем только 2 — choice-режима (Сравнение, Порядок чисел) и поэтому
// нуждаются в батарее инвариантов позиции кнопки (см. .test.ts);
// остальные 4 — numeric-режим (Состав числа, Счёт, Пропущенное число,
// Порядковые числительные), для них экплойт через позицию кнопки
// структурно невозможен — ответ вводится с клавиатуры/ленты цифр, а не
// выбирается кликом по варианту.

import type { MathMachineContent, Task } from '@kiosk/shared';
import { buildGroup, rotate, contentHash, mergeWaveIntoContent, type GroupSpec, type TopicSpec } from './generatorShared.ts';

export type { GroupSpec, TopicSpec };

// ─── Сравнение: числа до 50 (16 заданий: 8 + 8) ──────────────────────────
// Волна 1 покрыла диапазон 1-10. Тот же приём (независимые соли для
// позиции кнопки и для порядка называния чисел в тексте вопроса — чтобы
// одна ось не выводилась из другой), новый диапазон 15-49, свои соли.

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w5-cmp-text-order-1', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w5-cmp-position-150', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonWideTopic(): TopicSpec {
  const askBigger = buildGroup(
    'cmp2_next',
    'Сравнение соседних чисел (30-40)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(30 + i, 31 + i, 0)),
  );
  const askSmaller = buildGroup(
    'cmp2_gap',
    'Сравнение чисел вразброс (15-46)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(15 + i * 4, 18 + i * 4, 1)),
  );
  return { id: 'top_comparison_2', name: 'Сравнение: числа до 50', groups: [askBigger, askSmaller] };
}

// ─── Состав числа: числа 11-20 (20 заданий: 10 + 10) ─────────────────────
// Волна 1 покрыла диапазон до 10. Та же структура (крайние разложения
// «1 и остальное» / «остальное и 1»), масштабированная на 11-20.

function compositionTask(whole: number, knownPart: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_composition',
    text: `${whole} = ${knownPart} + ?`,
    params: { whole, knownPart },
    correctAnswer: whole - knownPart,
  };
}

function buildCompositionWideTopic(): TopicSpec {
  const low: Omit<Task, 'id'>[] = [];
  for (let whole = 11; whole <= 15; whole++) {
    low.push(compositionTask(whole, 1));
    low.push(compositionTask(whole, whole - 1));
  }
  const upTo15 = buildGroup('comp2_15', 'Состав чисел 11-15', low);

  const high: Omit<Task, 'id'>[] = [];
  for (let whole = 16; whole <= 20; whole++) {
    high.push(compositionTask(whole, 1));
    high.push(compositionTask(whole, whole - 1));
  }
  const upTo20 = buildGroup('comp2_20', 'Состав чисел 16-20', high);

  return { id: 'top_composition_2', name: 'Состав числа: числа 11-20', groups: [upTo15, upTo20] };
}

// ─── Порядок чисел: четыре числа (16 заданий: 8 + 8) ─────────────────────
// Волна 1 сравнивала тройки. Здесь — четвёрки: та же защита (показываемый
// порядок ряда поворачивается хэшем содержания, независимо от того,
// какой из элементов правильный — иначе минимум/максимум снова осел бы
// на одном и том же месте, как в изначальном дефекте волны 1).

function orderingTask4(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w5-order4-position-1', [...baseSeries, direction]);
  const series = rotate(baseSeries, posShift);
  const correct = direction === 1 ? Math.min(...series) : Math.max(...series);
  return {
    typeId: 'number_ordering',
    text: `Какое число ${question}?`,
    params: { series, direction },
    correctAnswer: correct,
    choices: [...series],
  };
}

function buildOrderingWideTopic(): TopicSpec {
  const findMin = buildGroup(
    'order4_min',
    'Найди наименьшее среди четырёх',
    Array.from({ length: 8 }, (_, i) => orderingTask4([i + 1, i + 4, i + 8, i + 11], 1)),
  );
  const findMax = buildGroup(
    'order4_max',
    'Найди наибольшее среди четырёх',
    Array.from({ length: 8 }, (_, i) => orderingTask4([i + 1, i + 3, i + 6, i + 9], 0)),
  );
  return { id: 'top_ordering_2', name: 'Порядок чисел: четыре числа', groups: [findMin, findMax] };
}

// ─── Счёт: до 20 (16 заданий: 8 + 8) ─────────────────────────────────────
// Этап 1 покрыл счёт предметов до 7. Numeric-режим — визуал (`TaskVisual`,
// ряд точек с `flexWrap`) не имеет фиксированного холста, безопасно
// масштабируется до 20 точек без правок кода.

function countingTask(count: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_counting',
    text: 'Сколько предметов ты видишь?',
    params: { count },
    correctAnswer: count,
  };
}

function buildCountingWideTopic(): TopicSpec {
  const low = buildGroup(
    'count2_15',
    'Считаем предметы: 11-15',
    Array.from({ length: 8 }, (_, i) => countingTask(11 + (i % 5))),
  );
  const high = buildGroup(
    'count2_20',
    'Считаем предметы: 16-20',
    Array.from({ length: 8 }, (_, i) => countingTask(16 + (i % 5))),
  );
  return { id: 'top_counting_2', name: 'Счёт: до 20', groups: [low, high] };
}

// ─── Пропущенное число: длинные ряды (16 заданий: 8 + 8) ─────────────────
// Этап 1 покрыл ряды длиной 5 с шагом 1. Здесь — ряды длиной 6 с шагом 2
// и 3. Numeric-режим, тот же класс защиты не требуется.

function missingNumberTask(series: number[], missingIndex: number): Omit<Task, 'id'> {
  const rendered = series.map((n, i) => (i === missingIndex ? '?' : n)).join(', ');
  return {
    typeId: 'number_missing',
    text: `Какое число пропущено в ряду ${rendered}?`,
    params: { series, missingIndex },
    correctAnswer: series[missingIndex],
  };
}

function buildStepSeries(start: number, step: number, length: number): number[] {
  return Array.from({ length }, (_, i) => start + i * step);
}

function buildMissingWideTopic(): TopicSpec {
  const step2 = buildGroup(
    'missing2_step2',
    'Ряды с шагом 2',
    Array.from({ length: 8 }, (_, i) => missingNumberTask(buildStepSeries(20 + i * 2, 2, 6), i % 6)),
  );
  const step3 = buildGroup(
    'missing2_step3',
    'Ряды с шагом 3',
    Array.from({ length: 8 }, (_, i) => missingNumberTask(buildStepSeries(10 + i * 3, 3, 6), i % 6)),
  );
  return { id: 'top_missing_2', name: 'Пропущенное число: длинные ряды', groups: [step2, step3] };
}

// ─── Порядковые числительные: ряды по 8-9 (16 заданий: 8 + 8) ────────────
// Волна 4 углубила до длины 6-7. Здесь — 8 и 9. Numeric-режим (как в
// волне 2/4), позиция запроса циклически меняется по индексу задания.

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const ORDINAL_SERIES_8: number[][] = [
  [5, 12, 1, 9, 16, 3, 11, 7],
  [8, 2, 14, 6, 1, 10, 4, 13],
  [11, 3, 9, 15, 2, 7, 13, 5],
  [6, 14, 1, 8, 12, 4, 10, 2],
  [13, 4, 9, 1, 7, 15, 3, 11],
  [2, 10, 5, 14, 8, 1, 12, 6],
  [9, 1, 13, 4, 10, 6, 15, 3],
  [7, 12, 2, 9, 5, 14, 1, 8],
];
const ORDINAL_SERIES_9: number[][] = [
  [3, 10, 1, 8, 15, 6, 12, 4, 9],
  [7, 1, 13, 5, 10, 2, 14, 8, 3],
  [11, 4, 8, 1, 9, 15, 2, 12, 6],
  [5, 13, 2, 9, 1, 11, 7, 14, 3],
  [9, 2, 11, 4, 14, 7, 1, 10, 5],
  [6, 15, 3, 10, 1, 8, 13, 4, 11],
  [12, 1, 7, 3, 11, 5, 9, 2, 14],
  [4, 9, 14, 2, 7, 12, 1, 10, 6],
];

function buildOrdinalWide2Topic(): TopicSpec {
  const group8 = buildGroup(
    'ordpos3_8',
    'Ряд из 8 чисел',
    ORDINAL_SERIES_8.map((series, i) => ordinalTask(series, (i % 8) + 1)),
  );
  const group9 = buildGroup(
    'ordpos3_9',
    'Ряд из 9 чисел',
    ORDINAL_SERIES_9.map((series, i) => ordinalTask(series, (i % 9) + 1)),
  );
  return { id: 'top_ordinal_3', name: 'Порядковые числительные: ряды по 8-9', groups: [group8, group9] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE5_TOPICS: TopicSpec[] = [
  buildComparisonWideTopic(),
  buildCompositionWideTopic(),
  buildOrderingWideTopic(),
  buildCountingWideTopic(),
  buildMissingWideTopic(),
  buildOrdinalWide2Topic(),
];

export function countWave5Tasks(): number {
  return WAVE5_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE5_TOPICS, ARITHMETIC_SECTION_ID);
}
