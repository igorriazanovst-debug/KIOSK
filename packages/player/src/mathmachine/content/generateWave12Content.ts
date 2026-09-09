// Offline-генератор контента Этапа 2b, волна 12 — ШЕСТАЯ И ПОСЛЕДНЯЯ
// УКРУПНЁННАЯ количественная волна (по решению пользователя: доводит
// каталог до/за 2800+ заданий ТЗ FR-020 — цель, после которой дальнейшее
// количественное расширение не запланировано без отдельного решения).
// Продолжает прогрессии всех предыдущих волн без единого нового
// TaskTypeId. «Доли целого» по-прежнему не включена (см. волну 11).
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

// ─── Вычитание: числа до 1000 (30 заданий: 10 + 10 + 10) ─────────────────
// Волна 11 покрыла минуенд 301-500. Здесь — впервые минуенд 501-1000.

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionWide6Topic(): TopicSpec {
  const g1 = buildGroup(
    'sub7_501_510',
    'Вычитание: числа 501-510',
    Array.from({ length: 10 }, (_, i) => subtractTask(501 + i, 2 + (i % 8))),
  );
  const g2 = buildGroup(
    'sub7_751_760',
    'Вычитание: числа 751-760',
    Array.from({ length: 10 }, (_, i) => subtractTask(751 + i, 3 + (i % 8))),
  );
  const g3 = buildGroup(
    'sub7_991_1000',
    'Вычитание: числа 991-1000',
    Array.from({ length: 10 }, (_, i) => subtractTask(991 + i, 4 + (i % 8))),
  );
  return { id: 'top_subtraction_wide7', name: 'Вычитание: числа до 1000', groups: [g1, g2, g3] };
}

// ─── Сложение: числа до 1000 (30 заданий: 10 + 10 + 10) ──────────────────
// Волна 11 покрыла суммы до 500. Здесь — суммы 501-1000.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

function buildAdditionWide7Topic(): TopicSpec {
  const g1 = buildGroup(
    'add9_501_512',
    'Сложение: суммы 501-512',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(251 + i, 250 + (i % 3))),
  );
  const g2 = buildGroup(
    'add9_741_752',
    'Сложение: суммы 741-752',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(376 + i, 365 + (i % 3))),
  );
  const g3 = buildGroup(
    'add9_981_992',
    'Сложение: суммы 981-992',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(496 + i, 485 + (i % 3))),
  );
  return { id: 'top_addition_wide7', name: 'Сложение: числа до 1000', groups: [g1, g2, g3] };
}

// ─── Состав числа: числа 161-190 (60 заданий: 20 + 20 + 20) ──────────────
// Волна 11 покрыла 131-160. Тот же приём (края + середина) здесь.

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

function buildCompositionWide8Topic(): TopicSpec {
  const g1 = buildCompositionRangeGroup('comp9_170', 'Состав чисел 161-170', 161, 170);
  const g2 = buildCompositionRangeGroup('comp9_180', 'Состав чисел 171-180', 171, 180);
  const g3 = buildCompositionRangeGroup('comp9_190', 'Состав чисел 181-190', 181, 190);
  return { id: 'top_composition_9', name: 'Состав числа: числа 161-190', groups: [g1, g2, g3] };
}

// ─── Сравнение: числа до 5000 (24 задания: 8 + 8 + 8) ────────────────────
// Волна 11 покрыла 1500-2000. Здесь впервые числа до 5000.

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w12-cmp-text-order-5', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w12-cmp-position-804', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonWide7Topic(): TopicSpec {
  const g1 = buildGroup(
    'cmp8_next',
    'Сравнение соседних чисел (3500-3515)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(3500 + i, 3501 + i, 0)),
  );
  const g2 = buildGroup(
    'cmp8_gap',
    'Сравнение чисел вразброс (3800-4900)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(3800 + i * 150, 3850 + i * 150, 1)),
  );
  const g3 = buildGroup(
    'cmp8_fivethousand',
    'Сравнение чисел рядом с 5000',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(4985 + i, 4988 + i, i % 2 === 0 ? 0 : 1)),
  );
  return { id: 'top_comparison_8', name: 'Сравнение: числа до 5000', groups: [g1, g2, g3] };
}

// ─── Порядок чисел: десять чисел (20 заданий: 10 + 10) ───────────────────
// Волна 11 сравнивала девятки. Здесь впервые десятки.

function orderingTask10(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w12-order10-position-1', [...baseSeries, direction]);
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

function buildOrderingWide7Topic(): TopicSpec {
  const findMin = buildGroup(
    'order10_min',
    'Найди наименьшее среди десяти',
    Array.from({ length: 10 }, (_, i) =>
      orderingTask10([i + 1, i + 4, i + 8, i + 11, i + 14, i + 17, i + 20, i + 23, i + 26, i + 29], 1),
    ),
  );
  const findMax = buildGroup(
    'order10_max',
    'Найди наибольшее среди десяти',
    Array.from({ length: 10 }, (_, i) =>
      orderingTask10([i + 1, i + 3, i + 6, i + 9, i + 12, i + 15, i + 18, i + 21, i + 24, i + 27], 0),
    ),
  );
  return { id: 'top_ordering_8', name: 'Порядок чисел: десять чисел', groups: [findMin, findMax] };
}

// ─── Порядковые числительные: ряды по 21-22 (24 задания: 12 + 12) ────────
// Волна 11 покрыла 19-20. Та же формула `base + (j·step) mod N` для
// step, взаимно простого с N (21=3·7, 22=2·11 — оба составные).

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const COPRIME_STEPS_21 = [1, 2, 4, 5, 8, 10, 11, 13, 16, 17, 19, 20];
const COPRIME_STEPS_22 = [1, 3, 5, 7, 9, 13, 15, 17, 19, 21];

function buildFormulaSeries(length: number, coprimeSteps: number[], i: number): number[] {
  const base = 1 + i * 2;
  const step = coprimeSteps[i % coprimeSteps.length];
  return Array.from({ length }, (_, j) => base + ((j * step) % length));
}

function buildOrdinalWide9Topic(): TopicSpec {
  const group21 = buildGroup(
    'ordpos10_21',
    'Ряд из 21 числа',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(21, COPRIME_STEPS_21, i), (i % 21) + 1)),
  );
  const group22 = buildGroup(
    'ordpos10_22',
    'Ряд из 22 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(22, COPRIME_STEPS_22, i), (i % 22) + 1)),
  );
  return { id: 'top_ordinal_10', name: 'Порядковые числительные: ряды по 21-22', groups: [group21, group22] };
}

// ─── Умножение: двузначное (21-30) на однозначное (30 заданий) ───────────
// Волна 11 покрыла множимое 11-20. Здесь — 21-30.

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

function buildMultiplicationTwoDigit2Topic(): TopicSpec {
  const g1 = buildGroup(
    'mult2d2_23',
    'Двузначное на 2 и 3',
    Array.from({ length: 10 }, (_, i) => multiplyTask(21 + i, i % 2 === 0 ? 2 : 3)),
  );
  const g2 = buildGroup(
    'mult2d2_456',
    'Двузначное на 4, 5 и 6',
    Array.from({ length: 10 }, (_, i) => multiplyTask(21 + i, [4, 5, 6][i % 3])),
  );
  const g3 = buildGroup(
    'mult2d2_789',
    'Двузначное на 7, 8 и 9',
    Array.from({ length: 10 }, (_, i) => multiplyTask(21 + i, [7, 8, 9][i % 3])),
  );
  return { id: 'top_multiplication_two_digit_2', name: 'Умножение: двузначное (21-30) на однозначное', groups: [g1, g2, g3] };
}

// ─── Деление: делители 36-40 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 11 покрыла 31-35. Все пары — частное ≥2.

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w12-div-scheme-2', 'w12-div-position-23');
}

const DIVISION_PAIRS_36: [number, number][] = [
  [74, 36], [80, 36], [110, 36], [119, 36], [146, 36], [155, 36], [182, 36], [191, 36],
];
const DIVISION_PAIRS_3738: [number, number][] = [
  [76, 37], [85, 37], [113, 37], [122, 37],
  [78, 38], [87, 38], [116, 38], [125, 38],
];
const DIVISION_PAIRS_3940: [number, number][] = [
  [80, 39], [89, 39], [119, 39], [128, 39],
  [82, 40], [91, 40], [122, 40], [131, 40],
];

function buildDivisionWide7Topic(): TopicSpec {
  const g36 = buildGroup('div9_36', 'Деление на 36', DIVISION_PAIRS_36.map(([a, b]) => divideTask(a, b)));
  const g3738 = buildGroup('div9_3738', 'Деление на 37 и 38', DIVISION_PAIRS_3738.map(([a, b]) => divideTask(a, b)));
  const g3940 = buildGroup('div9_3940', 'Деление на 39 и 40', DIVISION_PAIRS_3940.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division_36_40', name: 'Деление: делители 36-40', groups: [g36, g3738, g3940] };
}

// ─── Кратные: 41-45 (30 заданий: 18 + 12) ────────────────────────────────
// Волна 11 покрыла 36-40. Для n≥41 ни один из смещений ±1..±3 сам не
// кратен n.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w12-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w12-mult-d2-16', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w12-mult-position-1', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWide8Topic(): TopicSpec {
  const tasksLow: Omit<Task, 'id'>[] = [];
  [41, 42, 43].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksLow.push(multipleTask(n, k));
  });
  const groupLow = buildGroup('kratn9_414243', 'Кратные 41, 42 и 43', tasksLow);

  const tasksHigh: Omit<Task, 'id'>[] = [];
  [44, 45].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksHigh.push(multipleTask(n, k));
  });
  const groupHigh = buildGroup('kratn9_4445', 'Кратные 44 и 45', tasksHigh);

  return { id: 'top_multiples_9', name: 'Кратные: 41-45', groups: [groupLow, groupHigh] };
}

// ─── Пропущенное число: шаг 14 и 15 (24 задания: 12 + 12) ────────────────
// Волна 11 покрыла шаг 12 и 13. Numeric-режим.

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

function buildMissingWide7Topic(): TopicSpec {
  const step14 = buildGroup(
    'missing8_step14',
    'Ряды с шагом 14',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(2 + i * 9, 14, 6), i % 6)),
  );
  const step15 = buildGroup(
    'missing8_step15',
    'Ряды с шагом 15',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(3 + i * 10, 15, 6), i % 6)),
  );
  return { id: 'top_missing_8', name: 'Пропущенное число: шаг 14 и 15', groups: [step14, step15] };
}

// ─── Счёт: до 150 (24 задания: 12 + 12) ──────────────────────────────────
// Волна 11 покрыла 101-120. Numeric-режим — визуал масштабируется свободно.

function countingTask(count: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_counting',
    text: 'Сколько предметов ты видишь?',
    params: { count },
    correctAnswer: count,
  };
}

function buildCountingWide7Topic(): TopicSpec {
  const g1 = buildGroup(
    'count8_121135',
    'Считаем предметы: 121-135',
    Array.from({ length: 12 }, (_, i) => countingTask(121 + (i % 15))),
  );
  const g2 = buildGroup(
    'count8_136150',
    'Считаем предметы: 136-150',
    Array.from({ length: 12 }, (_, i) => countingTask(136 + (i % 15))),
  );
  return { id: 'top_counting_8', name: 'Счёт: до 150', groups: [g1, g2] };
}

// ─── Сумма трёх чисел: числа до 150 (24 задания: 12 + 12) ────────────────
// Волна 11 покрыла сумму до 120. Numeric-режим.

function sumThreeTask(a: number, b: number, c: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_three',
    text: `Сколько будет ${a} плюс ${b} плюс ${c}?`,
    params: { a, b, c },
    correctAnswer: a + b + c,
  };
}

function buildSumThreeWide7Topic(): TopicSpec {
  const g1 = buildGroup(
    'sum3g_low',
    'Сумма трёх чисел: 128-139',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(60 + i, 50, 18)),
  );
  const g2 = buildGroup(
    'sum3g_high',
    'Сумма трёх чисел: 140-151',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(65 + i, 55, 20)),
  );
  return { id: 'top_addition_three_wide7', name: 'Сумма трёх чисел: числа до 150', groups: [g1, g2] };
}

// ─── Оценки: пятый набор примеров округления до тысяч (30 заданий) ───────
// Волны 8-11 ввели 120 чисел в диапазоне 1000-9999. Здесь — ещё 30, ни
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

const ROUND_THOUSAND_I = Array.from({ length: 15 }, (_, i) => safeThousandNumber(4300 + i * 211));
const ROUND_THOUSAND_J = Array.from({ length: 15 }, (_, i) => safeThousandNumber(9000 + i * 61));

function buildRoundingThousands5Topic(): TopicSpec {
  const g1 = buildGroup('round_t5_i', 'Округление до тысяч: набор I', ROUND_THOUSAND_I.map((n) => roundThousandTask(n)));
  const g2 = buildGroup('round_t5_j', 'Округление до тысяч: набор J', ROUND_THOUSAND_J.map((n) => roundThousandTask(n)));
  return { id: 'top_rounding_thousands_5', name: 'Оценки: пятый набор примеров округления до тысяч', groups: [g1, g2] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE12_TOPICS: TopicSpec[] = [
  buildSubtractionWide6Topic(),
  buildAdditionWide7Topic(),
  buildCompositionWide8Topic(),
  buildComparisonWide7Topic(),
  buildOrderingWide7Topic(),
  buildOrdinalWide9Topic(),
  buildMultiplicationTwoDigit2Topic(),
  buildDivisionWide7Topic(),
  buildMultiplesWide8Topic(),
  buildMissingWide7Topic(),
  buildCountingWide7Topic(),
  buildSumThreeWide7Topic(),
  buildRoundingThousands5Topic(),
];

export function countWave12Tasks(): number {
  return WAVE12_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE12_TOPICS, ARITHMETIC_SECTION_ID);
}
