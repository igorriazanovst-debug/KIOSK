// Offline-генератор контента Этапа 2b, волна 10 — ЧЕТВЁРТАЯ УКРУПНЁННАЯ
// волна количественного расширения (тот же темп, что волны 7-9: ~14
// тем/~350-400 заданий за один заход). Продолжает прогрессии всех
// предыдущих волн без единого нового TaskTypeId. Завершает школьный
// набор знаменателей «Долей целого» (2-12).
//
// Из 14 тем только 4 — choice-режима (Сравнение, Порядок чисел,
// Деление, Кратные) и нуждаются в батарее инвариантов позиции кнопки;
// остальные 10 — numeric-режим.

import type { MathMachineContent, Task } from '@kiosk/shared';
import {
  buildGroup,
  rotate,
  contentHash,
  mergeWaveIntoContent,
  divideTask as sharedDivideTask,
  type GroupSpec,
  type TopicSpec,
} from './generatorShared.ts';

export type { GroupSpec, TopicSpec };

// ─── Вычитание: числа до 300 (30 заданий: 10 + 10 + 10) ──────────────────
// Волна 9 покрыла минуенд 101-200. Здесь — впервые минуенд 201-300.

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionWide4Topic(): TopicSpec {
  const g1 = buildGroup(
    'sub5_201_210',
    'Вычитание: числа 201-210',
    Array.from({ length: 10 }, (_, i) => subtractTask(201 + i, 2 + (i % 8))),
  );
  const g2 = buildGroup(
    'sub5_241_250',
    'Вычитание: числа 241-250',
    Array.from({ length: 10 }, (_, i) => subtractTask(241 + i, 3 + (i % 8))),
  );
  const g3 = buildGroup(
    'sub5_291_300',
    'Вычитание: числа 291-300',
    Array.from({ length: 10 }, (_, i) => subtractTask(291 + i, 4 + (i % 8))),
  );
  return { id: 'top_subtraction_wide5', name: 'Вычитание: числа до 300', groups: [g1, g2, g3] };
}

// ─── Сложение: числа до 300 (30 заданий: 10 + 10 + 10) ───────────────────
// Волна 9 покрыла суммы до 200. Здесь — суммы 201-300.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

function buildAdditionWide5Topic(): TopicSpec {
  const g1 = buildGroup(
    'add7_201_210',
    'Сложение: суммы 201-210',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(101 + i, 100 + (i % 3))),
  );
  const g2 = buildGroup(
    'add7_246_255',
    'Сложение: суммы 246-255',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(131 + i, 115 + (i % 3))),
  );
  const g3 = buildGroup(
    'add7_286_295',
    'Сложение: суммы 286-295',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(151 + i, 135 + (i % 3))),
  );
  return { id: 'top_addition_wide5', name: 'Сложение: числа до 300', groups: [g1, g2, g3] };
}

// ─── Состав числа: числа 101-130 (60 заданий: 20 + 20 + 20) ──────────────
// Волна 9 покрыла 71-100. Тот же приём (края + середина) здесь.

function compositionTask(whole: number, knownPart: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_composition',
    text: `${whole} = ${knownPart} + ?`,
    params: { whole, knownPart },
    correctAnswer: whole - knownPart,
  };
}

function buildCompositionRangeGroup(idPrefix: string, name: string, fromWhole: number, toWhole: number): GroupSpec {
  const tasks: Omit<Task, 'id'>[] = [];
  for (let whole = fromWhole; whole <= toWhole; whole++) {
    tasks.push(compositionTask(whole, 1));
    tasks.push(compositionTask(whole, Math.floor(whole / 2)));
  }
  return buildGroup(idPrefix, name, tasks);
}

function buildCompositionWide6Topic(): TopicSpec {
  const g1 = buildCompositionRangeGroup('comp7_110', 'Состав чисел 101-110', 101, 110);
  const g2 = buildCompositionRangeGroup('comp7_120', 'Состав чисел 111-120', 111, 120);
  const g3 = buildCompositionRangeGroup('comp7_130', 'Состав чисел 121-130', 121, 130);
  return { id: 'top_composition_7', name: 'Состав числа: числа 101-130', groups: [g1, g2, g3] };
}

// ─── Сравнение: числа до 1000 (24 задания: 8 + 8 + 8) ────────────────────
// Волна 9 покрыла 200-499. Здесь впервые числа до 1000.

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w10-cmp-text-order-1', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w10-cmp-position-215', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonWide5Topic(): TopicSpec {
  const g1 = buildGroup(
    'cmp6_next',
    'Сравнение соседних чисел (700-715)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(700 + i, 701 + i, 0)),
  );
  const g2 = buildGroup(
    'cmp6_gap',
    'Сравнение чисел вразброс (750-970)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(750 + i * 30, 760 + i * 30, 1)),
  );
  const g3 = buildGroup(
    'cmp6_thousand',
    'Сравнение чисел рядом с 1000',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(985 + i, 988 + i, i % 2 === 0 ? 0 : 1)),
  );
  return { id: 'top_comparison_6', name: 'Сравнение: числа до 1000', groups: [g1, g2, g3] };
}

// ─── Порядок чисел: восемь чисел (20 заданий: 10 + 10) ───────────────────
// Волна 9 сравнивала семёрки. Здесь впервые восьмёрки.

function orderingTask8(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w10-order8-position-1', [...baseSeries, direction]);
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

function buildOrderingWide5Topic(): TopicSpec {
  const findMin = buildGroup(
    'order8_min',
    'Найди наименьшее среди восьми',
    Array.from({ length: 10 }, (_, i) => orderingTask8([i + 1, i + 4, i + 8, i + 11, i + 14, i + 17, i + 20, i + 23], 1)),
  );
  const findMax = buildGroup(
    'order8_max',
    'Найди наибольшее среди восьми',
    Array.from({ length: 10 }, (_, i) => orderingTask8([i + 1, i + 3, i + 6, i + 9, i + 12, i + 15, i + 18, i + 21], 0)),
  );
  return { id: 'top_ordering_6', name: 'Порядок чисел: восемь чисел', groups: [findMin, findMax] };
}

// ─── Порядковые числительные: ряды по 17-18 (24 задания: 12 + 12) ────────
// Волна 9 покрыла 15-16. Та же формула `base + (j·step) mod N` для
// step, взаимно простого с N (17 — простое, все 1-16 подходят).

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const COPRIME_STEPS_17 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const COPRIME_STEPS_18 = [1, 5, 7, 11, 13, 17];

function buildFormulaSeries(length: number, coprimeSteps: number[], i: number): number[] {
  const base = 1 + i * 2;
  const step = coprimeSteps[i % coprimeSteps.length];
  return Array.from({ length }, (_, j) => base + ((j * step) % length));
}

function buildOrdinalWide7Topic(): TopicSpec {
  const group17 = buildGroup(
    'ordpos8_17',
    'Ряд из 17 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(17, COPRIME_STEPS_17, i), (i % 17) + 1)),
  );
  const group18 = buildGroup(
    'ordpos8_18',
    'Ряд из 18 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(18, COPRIME_STEPS_18, i), (i % 18) + 1)),
  );
  return { id: 'top_ordinal_8', name: 'Порядковые числительные: ряды по 17-18', groups: [group17, group18] };
}

// ─── Умножение: на 15 (10 заданий) ────────────────────────────────────────
// Волна 9 покрыла ×13, ×14. Numeric-режим.

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

function buildMultiplicationWide3Topic(): TopicSpec {
  const group = buildGroup(
    'mult_by15',
    'Умножение на 15',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 15)),
  );
  return { id: 'top_multiplication_15', name: 'Умножение: на 15', groups: [group] };
}

// ─── Деление: делители 26-30 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 9 покрыла 21-25. Все пары — частное ≥2.

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w10-div-scheme-0', 'w10-div-position-13');
}

const DIVISION_PAIRS_26: [number, number][] = [
  [54, 26], [60, 26], [80, 26], [89, 26], [107, 26], [115, 26], [133, 26], [141, 26],
];
const DIVISION_PAIRS_2728: [number, number][] = [
  [56, 27], [65, 27], [83, 27], [92, 27],
  [58, 28], [67, 28], [86, 28], [95, 28],
];
const DIVISION_PAIRS_2930: [number, number][] = [
  [60, 29], [69, 29], [89, 29], [98, 29],
  [62, 30], [71, 30], [92, 30], [101, 30],
];

function buildDivisionWide5Topic(): TopicSpec {
  const g26 = buildGroup('div7_26', 'Деление на 26', DIVISION_PAIRS_26.map(([a, b]) => divideTask(a, b)));
  const g2728 = buildGroup('div7_2728', 'Деление на 27 и 28', DIVISION_PAIRS_2728.map(([a, b]) => divideTask(a, b)));
  const g2930 = buildGroup('div7_2930', 'Деление на 29 и 30', DIVISION_PAIRS_2930.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division_26_30', name: 'Деление: делители 26-30', groups: [g26, g2728, g2930] };
}

// ─── Кратные: 31-35 (30 заданий: 18 + 12) ────────────────────────────────
// Волна 9 покрыла 26-30. Для n≥31 ни один из смещений ±1..±3 сам не
// кратен n.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w10-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w10-mult-d2-45', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w10-mult-position-0', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWide6Topic(): TopicSpec {
  const tasksLow: Omit<Task, 'id'>[] = [];
  [31, 32, 33].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksLow.push(multipleTask(n, k));
  });
  const groupLow = buildGroup('kratn7_313233', 'Кратные 31, 32 и 33', tasksLow);

  const tasksHigh: Omit<Task, 'id'>[] = [];
  [34, 35].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksHigh.push(multipleTask(n, k));
  });
  const groupHigh = buildGroup('kratn7_3435', 'Кратные 34 и 35', tasksHigh);

  return { id: 'top_multiples_7', name: 'Кратные: 31-35', groups: [groupLow, groupHigh] };
}

// ─── Доли целого: одиннадцатая и двенадцатая части (24 задания: 12 + 12) ─
// Волна 9 покрыла седьмую/девятую. Здесь parts=11 и parts=12 —
// завершает школьный набор знаменателей 2-12.

function shareTask(total: number, parts: number, word: string): Omit<Task, 'id'> {
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну ${word} — сколько досталось на одну часть?`,
    params: { total, parts },
    correctAnswer: total / parts,
  };
}

const SHARE_ELEVENTH_TOTALS = [22, 33, 44, 55, 66, 77, 88, 99, 110, 121, 132, 143];
const SHARE_TWELFTH_TOTALS = [24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156];

function buildShareWide5Topic(): TopicSpec {
  const eleventh = buildGroup(
    'share6_eleventh',
    'Одиннадцатая часть',
    SHARE_ELEVENTH_TOTALS.map((total) => shareTask(total, 11, 'на одиннадцать частей')),
  );
  const twelfth = buildGroup(
    'share6_twelfth',
    'Двенадцатая часть',
    SHARE_TWELFTH_TOTALS.map((total) => shareTask(total, 12, 'на двенадцать частей')),
  );
  return { id: 'top_shares_6', name: 'Доли целого: одиннадцатая и двенадцатая части', groups: [eleventh, twelfth] };
}

// ─── Пропущенное число: шаг 10 и 11 (24 задания: 12 + 12) ────────────────
// Волна 9 покрыла шаг 8 и 9. Numeric-режим.

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

function buildMissingWide5Topic(): TopicSpec {
  const step10 = buildGroup(
    'missing6_step10',
    'Ряды с шагом 10',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(2 + i * 6, 10, 6), i % 6)),
  );
  const step11 = buildGroup(
    'missing6_step11',
    'Ряды с шагом 11',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(3 + i * 7, 11, 6), i % 6)),
  );
  return { id: 'top_missing_6', name: 'Пропущенное число: шаг 10 и 11', groups: [step10, step11] };
}

// ─── Счёт: до 100 (24 задания: 12 + 12) ──────────────────────────────────
// Волна 9 покрыла 61-80. Numeric-режим — визуал масштабируется свободно.

function countingTask(count: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_counting',
    text: 'Сколько предметов ты видишь?',
    params: { count },
    correctAnswer: count,
  };
}

function buildCountingWide5Topic(): TopicSpec {
  const g1 = buildGroup(
    'count6_8190',
    'Считаем предметы: 81-90',
    Array.from({ length: 12 }, (_, i) => countingTask(81 + (i % 10))),
  );
  const g2 = buildGroup(
    'count6_91100',
    'Считаем предметы: 91-100',
    Array.from({ length: 12 }, (_, i) => countingTask(91 + (i % 10))),
  );
  return { id: 'top_counting_6', name: 'Счёт: до 100', groups: [g1, g2] };
}

// ─── Сумма трёх чисел: числа до 100 (24 задания: 12 + 12) ────────────────
// Волна 9 покрыла сумму до 80. Numeric-режим.

function sumThreeTask(a: number, b: number, c: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_three',
    text: `Сколько будет ${a} плюс ${b} плюс ${c}?`,
    params: { a, b, c },
    correctAnswer: a + b + c,
  };
}

function buildSumThreeWide5Topic(): TopicSpec {
  const g1 = buildGroup(
    'sum3e_low',
    'Сумма трёх чисел: 82-93',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(40 + i, 30, 12)),
  );
  const g2 = buildGroup(
    'sum3e_high',
    'Сумма трёх чисел: 93-104',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(45 + i, 35, 13)),
  );
  return { id: 'top_addition_three_wide5', name: 'Сумма трёх чисел: числа до 100', groups: [g1, g2] };
}

// ─── Оценки: третий набор примеров округления до тысяч (30 заданий) ──────
// Волны 8 и 9 ввели 60 чисел в диапазоне 1000-9999. Здесь — ещё 30, ни
// одно не совпадает с уже использованными, ни одно не оканчивается на
// ровно 500.

function roundThousandTask(n: number): Omit<Task, 'id'> {
  return {
    typeId: 'round_to_ten',
    text: `Округли ${n} до тысяч`,
    params: { n },
    correctAnswer: Math.round(n / 1000) * 1000,
  };
}

function safeThousandNumber(n: number): number {
  return n % 1000 === 500 ? n + 50 : n;
}

const ROUND_THOUSAND_E = Array.from({ length: 15 }, (_, i) => safeThousandNumber(2500 + i * 281));
const ROUND_THOUSAND_F = Array.from({ length: 15 }, (_, i) => safeThousandNumber(7200 + i * 167));

function buildRoundingThousands3Topic(): TopicSpec {
  const g1 = buildGroup('round_t3_e', 'Округление до тысяч: набор E', ROUND_THOUSAND_E.map((n) => roundThousandTask(n)));
  const g2 = buildGroup('round_t3_f', 'Округление до тысяч: набор F', ROUND_THOUSAND_F.map((n) => roundThousandTask(n)));
  return { id: 'top_rounding_thousands_3', name: 'Оценки: третий набор примеров округления до тысяч', groups: [g1, g2] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE10_TOPICS: TopicSpec[] = [
  buildSubtractionWide4Topic(),
  buildAdditionWide5Topic(),
  buildCompositionWide6Topic(),
  buildComparisonWide5Topic(),
  buildOrderingWide5Topic(),
  buildOrdinalWide7Topic(),
  buildMultiplicationWide3Topic(),
  buildDivisionWide5Topic(),
  buildMultiplesWide6Topic(),
  buildShareWide5Topic(),
  buildMissingWide5Topic(),
  buildCountingWide5Topic(),
  buildSumThreeWide5Topic(),
  buildRoundingThousands3Topic(),
];

export function countWave10Tasks(): number {
  return WAVE10_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE10_TOPICS, ARITHMETIC_SECTION_ID);
}
