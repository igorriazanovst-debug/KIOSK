// Offline-генератор контента Этапа 2b, волна 9 — ТРЕТЬЯ УКРУПНЁННАЯ
// волна количественного расширения (тот же темп, что волны 7-8: ~14
// тем/~350-400 заданий за один заход). Продолжает прогрессии всех
// предыдущих волн без единого нового TaskTypeId.
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

// ─── Вычитание: числа до 200 (30 заданий: 10 + 10 + 10) ──────────────────
// Волна 8 покрыла минуенд 51-100. Здесь — впервые минуенд 101-200.

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionWide3Topic(): TopicSpec {
  const g1 = buildGroup(
    'sub4_101_110',
    'Вычитание: числа 101-110',
    Array.from({ length: 10 }, (_, i) => subtractTask(101 + i, 2 + (i % 8))),
  );
  const g2 = buildGroup(
    'sub4_141_150',
    'Вычитание: числа 141-150',
    Array.from({ length: 10 }, (_, i) => subtractTask(141 + i, 3 + (i % 8))),
  );
  const g3 = buildGroup(
    'sub4_191_200',
    'Вычитание: числа 191-200',
    Array.from({ length: 10 }, (_, i) => subtractTask(191 + i, 4 + (i % 8))),
  );
  return { id: 'top_subtraction_wide4', name: 'Вычитание: числа до 200', groups: [g1, g2, g3] };
}

// ─── Сложение: числа до 200 (30 заданий: 10 + 10 + 10) ───────────────────
// Волна 8 покрыла суммы до 100. Здесь — суммы 101-200.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

function buildAdditionWide4Topic(): TopicSpec {
  const g1 = buildGroup(
    'add6_101_112',
    'Сложение: суммы 101-112',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(51 + i, 50 + (i % 3))),
  );
  const g2 = buildGroup(
    'add6_136_147',
    'Сложение: суммы 136-147',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(71 + i, 65 + (i % 3))),
  );
  const g3 = buildGroup(
    'add6_176_187',
    'Сложение: суммы 176-187',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(91 + i, 85 + (i % 3))),
  );
  return { id: 'top_addition_wide4', name: 'Сложение: числа до 200', groups: [g1, g2, g3] };
}

// ─── Состав числа: числа 71-100 (60 заданий: 20 + 20 + 20) ───────────────
// Волна 8 покрыла 51-70. Тот же приём (края + середина) здесь.

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

function buildCompositionWide5Topic(): TopicSpec {
  const g1 = buildCompositionRangeGroup('comp6_80', 'Состав чисел 71-80', 71, 80);
  const g2 = buildCompositionRangeGroup('comp6_90', 'Состав чисел 81-90', 81, 90);
  const g3 = buildCompositionRangeGroup('comp6_100', 'Состав чисел 91-100', 91, 100);
  return { id: 'top_composition_6', name: 'Состав числа: числа 71-100', groups: [g1, g2, g3] };
}

// ─── Сравнение: числа до 500 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 8 покрыла 100-199. Здесь впервые числа до 500.

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w9-cmp-text-order-1', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w9-cmp-position-354', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonWide4Topic(): TopicSpec {
  const g1 = buildGroup(
    'cmp5_next',
    'Сравнение соседних чисел (200-215)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(200 + i, 201 + i, 0)),
  );
  const g2 = buildGroup(
    'cmp5_gap',
    'Сравнение чисел вразброс (250-398)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(250 + i * 20, 258 + i * 20, 1)),
  );
  const g3 = buildGroup(
    'cmp5_fivehundred',
    'Сравнение чисел рядом с 500',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(485 + i, 488 + i, i % 2 === 0 ? 0 : 1)),
  );
  return { id: 'top_comparison_5', name: 'Сравнение: числа до 500', groups: [g1, g2, g3] };
}

// ─── Порядок чисел: семь чисел (20 заданий: 10 + 10) ─────────────────────
// Волна 8 сравнивала шестёрки. Здесь впервые семёрки.

function orderingTask7(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w9-order7-position-1', [...baseSeries, direction]);
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

function buildOrderingWide4Topic(): TopicSpec {
  const findMin = buildGroup(
    'order7_min',
    'Найди наименьшее среди семи',
    Array.from({ length: 10 }, (_, i) => orderingTask7([i + 1, i + 4, i + 8, i + 11, i + 14, i + 17, i + 20], 1)),
  );
  const findMax = buildGroup(
    'order7_max',
    'Найди наибольшее среди семи',
    Array.from({ length: 10 }, (_, i) => orderingTask7([i + 1, i + 3, i + 6, i + 9, i + 12, i + 15, i + 18], 0)),
  );
  return { id: 'top_ordering_5', name: 'Порядок чисел: семь чисел', groups: [findMin, findMax] };
}

// ─── Порядковые числительные: ряды по 15-16 (24 задания: 12 + 12) ────────
// Волна 8 покрыла 13-14. Та же формула `base + (j·step) mod N` для
// step, взаимно простого с N, масштабируется дальше.

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const COPRIME_STEPS_15 = [1, 2, 4, 7, 8, 11, 13, 14];
const COPRIME_STEPS_16 = [1, 3, 5, 7, 9, 11, 13, 15];

function buildFormulaSeries(length: number, coprimeSteps: number[], i: number): number[] {
  const base = 1 + i * 2;
  const step = coprimeSteps[i % coprimeSteps.length];
  return Array.from({ length }, (_, j) => base + ((j * step) % length));
}

function buildOrdinalWide6Topic(): TopicSpec {
  const group15 = buildGroup(
    'ordpos7_15',
    'Ряд из 15 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(15, COPRIME_STEPS_15, i), (i % 15) + 1)),
  );
  const group16 = buildGroup(
    'ordpos7_16',
    'Ряд из 16 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(16, COPRIME_STEPS_16, i), (i % 16) + 1)),
  );
  return { id: 'top_ordinal_7', name: 'Порядковые числительные: ряды по 15-16', groups: [group15, group16] };
}

// ─── Умножение: на 13 и 14 (20 заданий: 10 + 10) ─────────────────────────
// Волна 8 покрыла ×11, ×12. Numeric-режим.

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

function buildMultiplicationWide2Topic(): TopicSpec {
  const g1 = buildGroup(
    'mult_by13',
    'Умножение на 13',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 13)),
  );
  const g2 = buildGroup(
    'mult_by14',
    'Умножение на 14',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 14)),
  );
  return { id: 'top_multiplication_13_14', name: 'Умножение: на 13 и 14', groups: [g1, g2] };
}

// ─── Деление: делители 21-25 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 8 покрыла 16-20. Все пары — частное ≥2.

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w9-div-scheme-0', 'w9-div-position-5');
}

const DIVISION_PAIRS_21: [number, number][] = [
  [44, 21], [50, 21], [65, 21], [74, 21], [87, 21], [95, 21], [108, 21], [116, 21],
];
const DIVISION_PAIRS_2223: [number, number][] = [
  [46, 22], [53, 22], [68, 22], [77, 22],
  [48, 23], [56, 23], [70, 23], [80, 23],
];
const DIVISION_PAIRS_2425: [number, number][] = [
  [50, 24], [58, 24], [74, 24], [83, 24],
  [52, 25], [61, 25], [77, 25], [88, 25],
];

function buildDivisionWide4Topic(): TopicSpec {
  const g21 = buildGroup('div6_21', 'Деление на 21', DIVISION_PAIRS_21.map(([a, b]) => divideTask(a, b)));
  const g2223 = buildGroup('div6_2223', 'Деление на 22 и 23', DIVISION_PAIRS_2223.map(([a, b]) => divideTask(a, b)));
  const g2425 = buildGroup('div6_2425', 'Деление на 24 и 25', DIVISION_PAIRS_2425.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division_21_25', name: 'Деление: делители 21-25', groups: [g21, g2223, g2425] };
}

// ─── Кратные: 26-30 (30 заданий: 18 + 12) ────────────────────────────────
// Волна 8 покрыла 21-25. Для n≥26 ни один из смещений ±1..±3 сам не
// кратен n.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w9-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w9-mult-d2-28', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w9-mult-position-0', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWide5Topic(): TopicSpec {
  const tasksLow: Omit<Task, 'id'>[] = [];
  [26, 27, 28].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksLow.push(multipleTask(n, k));
  });
  const groupLow = buildGroup('kratn6_262728', 'Кратные 26, 27 и 28', tasksLow);

  const tasksHigh: Omit<Task, 'id'>[] = [];
  [29, 30].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksHigh.push(multipleTask(n, k));
  });
  const groupHigh = buildGroup('kratn6_2930', 'Кратные 29 и 30', tasksHigh);

  return { id: 'top_multiples_6', name: 'Кратные: 26-30', groups: [groupLow, groupHigh] };
}

// ─── Доли целого: седьмая и девятая части (24 задания: 12 + 12) ──────────
// Волна 8 покрыла шестую/восьмую. Здесь впервые parts=7 и parts=9.

function shareTask(total: number, parts: number, word: string): Omit<Task, 'id'> {
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну ${word} — сколько досталось на одну часть?`,
    params: { total, parts },
    correctAnswer: total / parts,
  };
}

const SHARE_SEVENTH_TOTALS = [14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91];
const SHARE_NINTH_TOTALS = [18, 27, 36, 45, 54, 63, 72, 81, 90, 99, 108, 117];

function buildShareWide4Topic(): TopicSpec {
  const seventh = buildGroup(
    'share5_seventh',
    'Седьмая часть',
    SHARE_SEVENTH_TOTALS.map((total) => shareTask(total, 7, 'на семь частей')),
  );
  const ninth = buildGroup(
    'share5_ninth',
    'Девятая часть',
    SHARE_NINTH_TOTALS.map((total) => shareTask(total, 9, 'на девять частей')),
  );
  return { id: 'top_shares_5', name: 'Доли целого: седьмая и девятая части', groups: [seventh, ninth] };
}

// ─── Пропущенное число: шаг 8 и 9 (24 задания: 12 + 12) ──────────────────
// Волна 8 покрыла шаг 6 и 7. Numeric-режим.

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

function buildMissingWide4Topic(): TopicSpec {
  const step8 = buildGroup(
    'missing5_step8',
    'Ряды с шагом 8',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(2 + i * 5, 8, 6), i % 6)),
  );
  const step9 = buildGroup(
    'missing5_step9',
    'Ряды с шагом 9',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(3 + i * 6, 9, 6), i % 6)),
  );
  return { id: 'top_missing_5', name: 'Пропущенное число: шаг 8 и 9', groups: [step8, step9] };
}

// ─── Счёт: до 80 (24 задания: 12 + 12) ───────────────────────────────────
// Волна 8 покрыла 41-60. Numeric-режим — визуал масштабируется свободно.

function countingTask(count: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_counting',
    text: 'Сколько предметов ты видишь?',
    params: { count },
    correctAnswer: count,
  };
}

function buildCountingWide4Topic(): TopicSpec {
  const g1 = buildGroup(
    'count5_6170',
    'Считаем предметы: 61-70',
    Array.from({ length: 12 }, (_, i) => countingTask(61 + (i % 10))),
  );
  const g2 = buildGroup(
    'count5_7180',
    'Считаем предметы: 71-80',
    Array.from({ length: 12 }, (_, i) => countingTask(71 + (i % 10))),
  );
  return { id: 'top_counting_5', name: 'Счёт: до 80', groups: [g1, g2] };
}

// ─── Сумма трёх чисел: числа до 80 (24 задания: 12 + 12) ─────────────────
// Волна 8 покрыла сумму до 60. Numeric-режим.

function sumThreeTask(a: number, b: number, c: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_three',
    text: `Сколько будет ${a} плюс ${b} плюс ${c}?`,
    params: { a, b, c },
    correctAnswer: a + b + c,
  };
}

function buildSumThreeWide4Topic(): TopicSpec {
  const g1 = buildGroup(
    'sum3d_low',
    'Сумма трёх чисел: 58-69',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(30 + i, 20, 8)),
  );
  const g2 = buildGroup(
    'sum3d_high',
    'Сумма трёх чисел: 70-81',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(35 + i, 25, 10)),
  );
  return { id: 'top_addition_three_wide4', name: 'Сумма трёх чисел: числа до 80', groups: [g1, g2] };
}

// ─── Оценки: ещё примеры округления до тысяч (30 заданий: 15 + 15) ───────
// Волна 8 ввела 30 чисел в диапазоне 1000-9999. Здесь — ещё 30 ЧИСЕЛ В
// ТОМ ЖЕ диапазоне (не новый порядок величины), ни одно не совпадает с
// уже использованными волной 8, ни одно не оканчивается на ровно 500.

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

const ROUND_THOUSAND_C = Array.from({ length: 15 }, (_, i) => safeThousandNumber(6000 + i * 271));
const ROUND_THOUSAND_D = Array.from({ length: 15 }, (_, i) => safeThousandNumber(1300 + i * 233));

function buildRoundingThousands2Topic(): TopicSpec {
  const g1 = buildGroup('round_t2_c', 'Округление до тысяч: набор C', ROUND_THOUSAND_C.map((n) => roundThousandTask(n)));
  const g2 = buildGroup('round_t2_d', 'Округление до тысяч: набор D', ROUND_THOUSAND_D.map((n) => roundThousandTask(n)));
  return { id: 'top_rounding_thousands_2', name: 'Оценки: ещё примеры округления до тысяч', groups: [g1, g2] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE9_TOPICS: TopicSpec[] = [
  buildSubtractionWide3Topic(),
  buildAdditionWide4Topic(),
  buildCompositionWide5Topic(),
  buildComparisonWide4Topic(),
  buildOrderingWide4Topic(),
  buildOrdinalWide6Topic(),
  buildMultiplicationWide2Topic(),
  buildDivisionWide4Topic(),
  buildMultiplesWide5Topic(),
  buildShareWide4Topic(),
  buildMissingWide4Topic(),
  buildCountingWide4Topic(),
  buildSumThreeWide4Topic(),
  buildRoundingThousands2Topic(),
];

export function countWave9Tasks(): number {
  return WAVE9_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE9_TOPICS, ARITHMETIC_SECTION_ID);
}
