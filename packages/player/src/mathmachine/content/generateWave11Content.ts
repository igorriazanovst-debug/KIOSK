// Offline-генератор контента Этапа 2b, волна 11 — ПЯТАЯ УКРУПНЁННАЯ
// волна количественного расширения (тот же темп, что волны 7-10: ~13-14
// тем/~350-400 заданий за один заход). Продолжает прогрессии всех
// предыдущих волн без единого нового TaskTypeId. «Доли целого» СОЗНАТЕЛЬНО
// НЕ включена — волна 10 завершила школьный набор знаменателей 2-12,
// дальнейшее увеличение parts (13+) не имеет педагогического смысла.
// Впервые вводит новую ОСЬ для «Умножения» — двузначный множитель
// (11-20) вместо дальнейшего роста однозначного множителя.
//
// Из 13 тем только 4 — choice-режима (Сравнение, Порядок чисел,
// Деление, Кратные) и нуждаются в батарее инвариантов позиции кнопки;
// остальные 9 — numeric-режим.

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

// ─── Вычитание: числа до 500 (30 заданий: 10 + 10 + 10) ──────────────────
// Волна 10 покрыла минуенд 201-300. Здесь — впервые минуенд 301-500.

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionWide5Topic(): TopicSpec {
  const g1 = buildGroup(
    'sub6_301_310',
    'Вычитание: числа 301-310',
    Array.from({ length: 10 }, (_, i) => subtractTask(301 + i, 2 + (i % 8))),
  );
  const g2 = buildGroup(
    'sub6_391_400',
    'Вычитание: числа 391-400',
    Array.from({ length: 10 }, (_, i) => subtractTask(391 + i, 3 + (i % 8))),
  );
  const g3 = buildGroup(
    'sub6_491_500',
    'Вычитание: числа 491-500',
    Array.from({ length: 10 }, (_, i) => subtractTask(491 + i, 4 + (i % 8))),
  );
  return { id: 'top_subtraction_wide6', name: 'Вычитание: числа до 500', groups: [g1, g2, g3] };
}

// ─── Сложение: числа до 500 (30 заданий: 10 + 10 + 10) ───────────────────
// Волна 10 покрыла суммы до 300. Здесь — суммы 301-500.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

function buildAdditionWide6Topic(): TopicSpec {
  const g1 = buildGroup(
    'add8_301_312',
    'Сложение: суммы 301-312',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(151 + i, 150 + (i % 3))),
  );
  const g2 = buildGroup(
    'add8_391_402',
    'Сложение: суммы 391-402',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(201 + i, 190 + (i % 3))),
  );
  const g3 = buildGroup(
    'add8_486_495',
    'Сложение: суммы 486-495',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(246 + i, 240 + (i % 3))),
  );
  return { id: 'top_addition_wide6', name: 'Сложение: числа до 500', groups: [g1, g2, g3] };
}

// ─── Состав числа: числа 131-160 (60 заданий: 20 + 20 + 20) ──────────────
// Волна 10 покрыла 101-130. Тот же приём (края + середина) здесь.

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

function buildCompositionWide7Topic(): TopicSpec {
  const g1 = buildCompositionRangeGroup('comp8_140', 'Состав чисел 131-140', 131, 140);
  const g2 = buildCompositionRangeGroup('comp8_150', 'Состав чисел 141-150', 141, 150);
  const g3 = buildCompositionRangeGroup('comp8_160', 'Состав чисел 151-160', 151, 160);
  return { id: 'top_composition_8', name: 'Состав числа: числа 131-160', groups: [g1, g2, g3] };
}

// ─── Сравнение: числа до 2000 (24 задания: 8 + 8 + 8) ────────────────────
// Волна 10 покрыла 700-1000. Здесь впервые числа до 2000.

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w11-cmp-text-order-1', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w11-cmp-position-69', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonWide6Topic(): TopicSpec {
  const g1 = buildGroup(
    'cmp7_next',
    'Сравнение соседних чисел (1500-1515)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(1500 + i, 1501 + i, 0)),
  );
  const g2 = buildGroup(
    'cmp7_gap',
    'Сравнение чисел вразброс (1600-1970)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(1600 + i * 50, 1620 + i * 50, 1)),
  );
  const g3 = buildGroup(
    'cmp7_twothousand',
    'Сравнение чисел рядом с 2000',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(1985 + i, 1988 + i, i % 2 === 0 ? 0 : 1)),
  );
  return { id: 'top_comparison_7', name: 'Сравнение: числа до 2000', groups: [g1, g2, g3] };
}

// ─── Порядок чисел: девять чисел (20 заданий: 10 + 10) ───────────────────
// Волна 10 сравнивала восьмёрки. Здесь впервые девятки.

function orderingTask9(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w11-order9-position-1', [...baseSeries, direction]);
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

function buildOrderingWide6Topic(): TopicSpec {
  const findMin = buildGroup(
    'order9_min',
    'Найди наименьшее среди девяти',
    Array.from({ length: 10 }, (_, i) =>
      orderingTask9([i + 1, i + 4, i + 8, i + 11, i + 14, i + 17, i + 20, i + 23, i + 26], 1),
    ),
  );
  const findMax = buildGroup(
    'order9_max',
    'Найди наибольшее среди девяти',
    Array.from({ length: 10 }, (_, i) =>
      orderingTask9([i + 1, i + 3, i + 6, i + 9, i + 12, i + 15, i + 18, i + 21, i + 24], 0),
    ),
  );
  return { id: 'top_ordering_7', name: 'Порядок чисел: девять чисел', groups: [findMin, findMax] };
}

// ─── Порядковые числительные: ряды по 19-20 (24 задания: 12 + 12) ────────
// Волна 10 покрыла 17-18. Та же формула `base + (j·step) mod N` для
// step, взаимно простого с N (19 — простое, все 1-18 подходят).

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const COPRIME_STEPS_19 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const COPRIME_STEPS_20 = [1, 3, 7, 9, 11, 13, 17, 19];

function buildFormulaSeries(length: number, coprimeSteps: number[], i: number): number[] {
  const base = 1 + i * 2;
  const step = coprimeSteps[i % coprimeSteps.length];
  return Array.from({ length }, (_, j) => base + ((j * step) % length));
}

function buildOrdinalWide8Topic(): TopicSpec {
  const group19 = buildGroup(
    'ordpos9_19',
    'Ряд из 19 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(19, COPRIME_STEPS_19, i), (i % 19) + 1)),
  );
  const group20 = buildGroup(
    'ordpos9_20',
    'Ряд из 20 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(20, COPRIME_STEPS_20, i), (i % 20) + 1)),
  );
  return { id: 'top_ordinal_9', name: 'Порядковые числительные: ряды по 19-20', groups: [group19, group20] };
}

// ─── Умножение: двузначное на однозначное (30 заданий: 10 + 10 + 10) ─────
// Волны 2-3 и 8-10 покрыли множитель 2-15 при однозначном множимом.
// Здесь впервые множимое двузначное (11-20) — новая ось, а не рост
// множителя.

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

function buildMultiplicationTwoDigitTopic(): TopicSpec {
  const g1 = buildGroup(
    'mult2d_23',
    'Двузначное на 2 и 3',
    Array.from({ length: 10 }, (_, i) => multiplyTask(11 + i, i % 2 === 0 ? 2 : 3)),
  );
  const g2 = buildGroup(
    'mult2d_456',
    'Двузначное на 4, 5 и 6',
    Array.from({ length: 10 }, (_, i) => multiplyTask(11 + i, [4, 5, 6][i % 3])),
  );
  const g3 = buildGroup(
    'mult2d_789',
    'Двузначное на 7, 8 и 9',
    Array.from({ length: 10 }, (_, i) => multiplyTask(11 + i, [7, 8, 9][i % 3])),
  );
  return { id: 'top_multiplication_two_digit', name: 'Умножение: двузначное на однозначное', groups: [g1, g2, g3] };
}

// ─── Деление: делители 31-35 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 10 покрыла 26-30. Все пары — частное ≥2.

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w11-div-scheme-1', 'w11-div-position-10');
}

const DIVISION_PAIRS_31: [number, number][] = [
  [64, 31], [70, 31], [96, 31], [105, 31], [127, 31], [135, 31], [158, 31], [166, 31],
];
const DIVISION_PAIRS_3233: [number, number][] = [
  [66, 32], [75, 32], [98, 32], [107, 32],
  [68, 33], [77, 33], [101, 33], [110, 33],
];
const DIVISION_PAIRS_3435: [number, number][] = [
  [70, 34], [79, 34], [104, 34], [113, 34],
  [72, 35], [81, 35], [107, 35], [116, 35],
];

function buildDivisionWide6Topic(): TopicSpec {
  const g31 = buildGroup('div8_31', 'Деление на 31', DIVISION_PAIRS_31.map(([a, b]) => divideTask(a, b)));
  const g3233 = buildGroup('div8_3233', 'Деление на 32 и 33', DIVISION_PAIRS_3233.map(([a, b]) => divideTask(a, b)));
  const g3435 = buildGroup('div8_3435', 'Деление на 34 и 35', DIVISION_PAIRS_3435.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division_31_35', name: 'Деление: делители 31-35', groups: [g31, g3233, g3435] };
}

// ─── Кратные: 36-40 (30 заданий: 18 + 12) ────────────────────────────────
// Волна 10 покрыла 31-35. Для n≥36 ни один из смещений ±1..±3 сам не
// кратен n.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w11-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w11-mult-d2-0', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w11-mult-position-2', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWide7Topic(): TopicSpec {
  const tasksLow: Omit<Task, 'id'>[] = [];
  [36, 37, 38].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksLow.push(multipleTask(n, k));
  });
  const groupLow = buildGroup('kratn8_363738', 'Кратные 36, 37 и 38', tasksLow);

  const tasksHigh: Omit<Task, 'id'>[] = [];
  [39, 40].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksHigh.push(multipleTask(n, k));
  });
  const groupHigh = buildGroup('kratn8_3940', 'Кратные 39 и 40', tasksHigh);

  return { id: 'top_multiples_8', name: 'Кратные: 36-40', groups: [groupLow, groupHigh] };
}

// ─── Пропущенное число: шаг 12 и 13 (24 задания: 12 + 12) ────────────────
// Волна 10 покрыла шаг 10 и 11. Numeric-режим.

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

function buildMissingWide6Topic(): TopicSpec {
  const step12 = buildGroup(
    'missing7_step12',
    'Ряды с шагом 12',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(2 + i * 7, 12, 6), i % 6)),
  );
  const step13 = buildGroup(
    'missing7_step13',
    'Ряды с шагом 13',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(3 + i * 8, 13, 6), i % 6)),
  );
  return { id: 'top_missing_7', name: 'Пропущенное число: шаг 12 и 13', groups: [step12, step13] };
}

// ─── Счёт: до 120 (24 задания: 12 + 12) ──────────────────────────────────
// Волна 10 покрыла 81-100. Numeric-режим — визуал масштабируется свободно.

function countingTask(count: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_counting',
    text: 'Сколько предметов ты видишь?',
    params: { count },
    correctAnswer: count,
  };
}

function buildCountingWide6Topic(): TopicSpec {
  const g1 = buildGroup(
    'count7_101110',
    'Считаем предметы: 101-110',
    Array.from({ length: 12 }, (_, i) => countingTask(101 + (i % 10))),
  );
  const g2 = buildGroup(
    'count7_111120',
    'Считаем предметы: 111-120',
    Array.from({ length: 12 }, (_, i) => countingTask(111 + (i % 10))),
  );
  return { id: 'top_counting_7', name: 'Счёт: до 120', groups: [g1, g2] };
}

// ─── Сумма трёх чисел: числа до 120 (24 задания: 12 + 12) ────────────────
// Волна 10 покрыла сумму до 100. Numeric-режим.

function sumThreeTask(a: number, b: number, c: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_three',
    text: `Сколько будет ${a} плюс ${b} плюс ${c}?`,
    params: { a, b, c },
    correctAnswer: a + b + c,
  };
}

function buildSumThreeWide6Topic(): TopicSpec {
  const g1 = buildGroup(
    'sum3f_low',
    'Сумма трёх чисел: 105-116',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(50 + i, 40, 15)),
  );
  const g2 = buildGroup(
    'sum3f_high',
    'Сумма трёх чисел: 117-128',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(55 + i, 45, 17)),
  );
  return { id: 'top_addition_three_wide6', name: 'Сумма трёх чисел: числа до 120', groups: [g1, g2] };
}

// ─── Оценки: четвёртый набор примеров округления до тысяч (30 заданий) ───
// Волны 8-10 ввели 90 чисел в диапазоне 1000-9999. Здесь — ещё 30, ни
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

const ROUND_THOUSAND_G = Array.from({ length: 15 }, (_, i) => safeThousandNumber(3200 + i * 233));
const ROUND_THOUSAND_H = Array.from({ length: 15 }, (_, i) => safeThousandNumber(8100 + i * 127));

function buildRoundingThousands4Topic(): TopicSpec {
  const g1 = buildGroup('round_t4_g', 'Округление до тысяч: набор G', ROUND_THOUSAND_G.map((n) => roundThousandTask(n)));
  const g2 = buildGroup('round_t4_h', 'Округление до тысяч: набор H', ROUND_THOUSAND_H.map((n) => roundThousandTask(n)));
  return { id: 'top_rounding_thousands_4', name: 'Оценки: четвёртый набор примеров округления до тысяч', groups: [g1, g2] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE11_TOPICS: TopicSpec[] = [
  buildSubtractionWide5Topic(),
  buildAdditionWide6Topic(),
  buildCompositionWide7Topic(),
  buildComparisonWide6Topic(),
  buildOrderingWide6Topic(),
  buildOrdinalWide8Topic(),
  buildMultiplicationTwoDigitTopic(),
  buildDivisionWide6Topic(),
  buildMultiplesWide7Topic(),
  buildMissingWide6Topic(),
  buildCountingWide6Topic(),
  buildSumThreeWide6Topic(),
  buildRoundingThousands4Topic(),
];

export function countWave11Tasks(): number {
  return WAVE11_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE11_TOPICS, ARITHMETIC_SECTION_ID);
}
