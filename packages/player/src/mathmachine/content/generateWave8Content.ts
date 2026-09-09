// Offline-генератор контента Этапа 2b, волна 8 — ВТОРАЯ УКРУПНЁННАЯ
// волна количественного расширения (по решению пользователя: тот же
// темп, что и волна 7 — ~14 тем/~350-400 заданий за один заход).
// Продолжает прогрессии предыдущих волн (Вычитание/Сложение/Сравнение/
// Состав числа/Счёт/Сумма трёх чисел/Пропущенное число/Порядковые
// числительные/Кратные/Деление/Доли целого) и ВПЕРВЫЕ с волны 2
// расширяет «Умножение» (×11, ×12) и впервые вводит порядок величины
// «тысячи» для «Оценок» (решение пользователя — предыдущие волны
// сознательно останавливались на сотнях). Ни одного нового TaskTypeId
// — только новые диапазоны/темы для уже существующих типов.
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

// ─── Вычитание: числа до 100 (30 заданий: 10 + 10 + 10) ──────────────────
// Волна 7 покрыла минуенд 21-50. Здесь — впервые минуенд 51-100.

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionWide2Topic(): TopicSpec {
  const g1 = buildGroup(
    'sub3_51_60',
    'Вычитание: числа 51-60',
    Array.from({ length: 10 }, (_, i) => subtractTask(51 + i, 2 + (i % 8))),
  );
  const g2 = buildGroup(
    'sub3_71_80',
    'Вычитание: числа 71-80',
    Array.from({ length: 10 }, (_, i) => subtractTask(71 + i, 3 + (i % 8))),
  );
  const g3 = buildGroup(
    'sub3_91_100',
    'Вычитание: числа 91-100',
    Array.from({ length: 10 }, (_, i) => subtractTask(91 + i, 4 + (i % 8))),
  );
  return { id: 'top_subtraction_wide3', name: 'Вычитание: числа до 100', groups: [g1, g2, g3] };
}

// ─── Сложение: числа до 100 (30 заданий: 10 + 10 + 10) ───────────────────
// Волна 7 покрыла суммы до 50. Здесь — суммы 51-100.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

function buildAdditionWide3Topic(): TopicSpec {
  const g1 = buildGroup(
    'add5_51_60',
    'Сложение: суммы 51-62',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(26 + i, 25 + (i % 3))),
  );
  const g2 = buildGroup(
    'add5_66_77',
    'Сложение: суммы 66-77',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(36 + i, 30 + (i % 3))),
  );
  const g3 = buildGroup(
    'add5_86_97',
    'Сложение: суммы 86-97',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(46 + i, 40 + (i % 3))),
  );
  return { id: 'top_addition_wide3', name: 'Сложение: числа до 100', groups: [g1, g2, g3] };
}

// ─── Состав числа: числа 51-70 (40 заданий: 20 + 20) ─────────────────────
// Волна 7 покрыла 31-50 (края + середина). Тот же приём здесь.

function compositionTask(whole: number, knownPart: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_composition',
    text: `${whole} = ${knownPart} + ?`,
    params: { whole, knownPart },
    correctAnswer: whole - knownPart,
  };
}

function buildCompositionWide4Topic(): TopicSpec {
  const low: Omit<Task, 'id'>[] = [];
  for (let whole = 51; whole <= 60; whole++) {
    low.push(compositionTask(whole, 1));
    low.push(compositionTask(whole, Math.floor(whole / 2)));
  }
  const g1 = buildGroup('comp5_60', 'Состав чисел 51-60', low);

  const high: Omit<Task, 'id'>[] = [];
  for (let whole = 61; whole <= 70; whole++) {
    high.push(compositionTask(whole, 1));
    high.push(compositionTask(whole, Math.floor(whole / 2)));
  }
  const g2 = buildGroup('comp5_70', 'Состав чисел 61-70', high);

  return { id: 'top_composition_5', name: 'Состав числа: числа 51-70', groups: [g1, g2] };
}

// ─── Сравнение: числа до 200 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 7 покрыла 50-99. Здесь впервые числа до 200.

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w8-cmp-text-order-1', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w8-cmp-position-151', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonWide3Topic(): TopicSpec {
  const g1 = buildGroup(
    'cmp4_next',
    'Сравнение соседних чисел (100-115)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(100 + i, 101 + i, 0)),
  );
  const g2 = buildGroup(
    'cmp4_gap',
    'Сравнение чисел вразброс (120-180)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(120 + i * 8, 124 + i * 8, 1)),
  );
  const g3 = buildGroup(
    'cmp4_twohundred',
    'Сравнение чисел рядом со 200',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(185 + i, 188 + i, i % 2 === 0 ? 0 : 1)),
  );
  return { id: 'top_comparison_4', name: 'Сравнение: числа до 200', groups: [g1, g2, g3] };
}

// ─── Порядок чисел: шесть чисел (20 заданий: 10 + 10) ────────────────────
// Волна 7 сравнивала пятёрки. Здесь впервые шестёрки.

function orderingTask6(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w8-order6-position-1', [...baseSeries, direction]);
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

function buildOrderingWide3Topic(): TopicSpec {
  const findMin = buildGroup(
    'order6_min',
    'Найди наименьшее среди шести',
    Array.from({ length: 10 }, (_, i) => orderingTask6([i + 1, i + 4, i + 8, i + 11, i + 14, i + 17], 1)),
  );
  const findMax = buildGroup(
    'order6_max',
    'Найди наибольшее среди шести',
    Array.from({ length: 10 }, (_, i) => orderingTask6([i + 1, i + 3, i + 6, i + 9, i + 12, i + 15], 0)),
  );
  return { id: 'top_ordering_4', name: 'Порядок чисел: шесть чисел', groups: [findMin, findMax] };
}

// ─── Порядковые числительные: ряды по 13-14 (24 задания: 12 + 12) ────────
// Волна 7 ввела ряды 11-12. Та же формула масштабируется без ручного
// набора: `base + (j·step) mod N` для step, взаимно простого с N.

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const COPRIME_STEPS_13 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COPRIME_STEPS_14 = [1, 3, 5, 9, 11, 13];

function buildFormulaSeries(length: number, coprimeSteps: number[], i: number): number[] {
  const base = 1 + i * 2;
  const step = coprimeSteps[i % coprimeSteps.length];
  return Array.from({ length }, (_, j) => base + ((j * step) % length));
}

function buildOrdinalWide5Topic(): TopicSpec {
  const group13 = buildGroup(
    'ordpos6_13',
    'Ряд из 13 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(13, COPRIME_STEPS_13, i), (i % 13) + 1)),
  );
  const group14 = buildGroup(
    'ordpos6_14',
    'Ряд из 14 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(14, COPRIME_STEPS_14, i), (i % 14) + 1)),
  );
  return { id: 'top_ordinal_6', name: 'Порядковые числительные: ряды по 13-14', groups: [group13, group14] };
}

// ─── Умножение: на 11 и 12 (20 заданий: 10 + 10) ─────────────────────────
// Волна 2/3 покрыли множитель 2-10. Впервые с волны 2 — 11 и 12.
// Numeric-режим, экплойт через позицию кнопки структурно невозможен.

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

function buildMultiplicationWideTopic(): TopicSpec {
  const g1 = buildGroup(
    'mult_by11',
    'Умножение на 11',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 11)),
  );
  const g2 = buildGroup(
    'mult_by12',
    'Умножение на 12',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 12)),
  );
  return { id: 'top_multiplication_11_12', name: 'Умножение: на 11 и 12', groups: [g1, g2] };
}

// ─── Деление: делители 16-20 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 7 покрыла 13-15. Все пары — частное ≥2.

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w8-div-scheme-0', 'w8-div-position-81');
}

const DIVISION_PAIRS_16: [number, number][] = [
  [35, 16], [41, 16], [50, 16], [59, 16], [68, 16], [77, 16], [83, 16], [92, 16],
];
const DIVISION_PAIRS_1718: [number, number][] = [
  [37, 17], [48, 17], [56, 17], [65, 17],
  [40, 18], [51, 18], [58, 18], [69, 18],
];
const DIVISION_PAIRS_1920: [number, number][] = [
  [42, 19], [54, 19], [61, 19], [73, 19],
  [45, 20], [58, 20], [63, 20], [75, 20],
];

function buildDivisionWide3Topic(): TopicSpec {
  const g16 = buildGroup('div5_16', 'Деление на 16', DIVISION_PAIRS_16.map(([a, b]) => divideTask(a, b)));
  const g1718 = buildGroup('div5_1718', 'Деление на 17 и 18', DIVISION_PAIRS_1718.map(([a, b]) => divideTask(a, b)));
  const g1920 = buildGroup('div5_1920', 'Деление на 19 и 20', DIVISION_PAIRS_1920.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division_16_20', name: 'Деление: делители 16-20', groups: [g16, g1718, g1920] };
}

// ─── Кратные: 21-25 (30 заданий: 18 + 12) ────────────────────────────────
// Волна 7 покрыла 16-20. Для n≥21 ни один из смещений ±1..±3 сам не
// кратен n.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w8-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w8-mult-d2-2', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w8-mult-position-4', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWide4Topic(): TopicSpec {
  const tasksLow: Omit<Task, 'id'>[] = [];
  [21, 22, 23].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksLow.push(multipleTask(n, k));
  });
  const groupLow = buildGroup('kratn5_212223', 'Кратные 21, 22 и 23', tasksLow);

  const tasksHigh: Omit<Task, 'id'>[] = [];
  [24, 25].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksHigh.push(multipleTask(n, k));
  });
  const groupHigh = buildGroup('kratn5_2425', 'Кратные 24 и 25', tasksHigh);

  return { id: 'top_multiples_5', name: 'Кратные: 21-25', groups: [groupLow, groupHigh] };
}

// ─── Доли целого: шестая и восьмая части (24 задания: 12 + 12) ───────────
// Волна 7 покрыла пятую/десятую. Здесь впервые parts=6 и parts=8.

function shareTask(total: number, parts: number, word: string): Omit<Task, 'id'> {
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну ${word} — сколько досталось на одну часть?`,
    params: { total, parts },
    correctAnswer: total / parts,
  };
}

const SHARE_SIXTH_TOTALS = [12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78];
const SHARE_EIGHTH_TOTALS = [16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104];

function buildShareWide3Topic(): TopicSpec {
  const sixth = buildGroup(
    'share4_sixth',
    'Шестая часть',
    SHARE_SIXTH_TOTALS.map((total) => shareTask(total, 6, 'на шесть частей')),
  );
  const eighth = buildGroup(
    'share4_eighth',
    'Восьмая часть',
    SHARE_EIGHTH_TOTALS.map((total) => shareTask(total, 8, 'на восемь частей')),
  );
  return { id: 'top_shares_4', name: 'Доли целого: шестая и восьмая части', groups: [sixth, eighth] };
}

// ─── Пропущенное число: шаг 6 и 7 (24 задания: 12 + 12) ──────────────────
// Волна 7 покрыла шаг 4 и 5. Numeric-режим.

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

function buildMissingWide3Topic(): TopicSpec {
  const step6 = buildGroup(
    'missing4_step6',
    'Ряды с шагом 6',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(2 + i * 4, 6, 6), i % 6)),
  );
  const step7 = buildGroup(
    'missing4_step7',
    'Ряды с шагом 7',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(3 + i * 5, 7, 6), i % 6)),
  );
  return { id: 'top_missing_4', name: 'Пропущенное число: шаг 6 и 7', groups: [step6, step7] };
}

// ─── Счёт: до 60 (24 задания: 12 + 12) ───────────────────────────────────
// Волна 7 покрыла 21-40. Numeric-режим — визуал масштабируется свободно.

function countingTask(count: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_counting',
    text: 'Сколько предметов ты видишь?',
    params: { count },
    correctAnswer: count,
  };
}

function buildCountingWide3Topic(): TopicSpec {
  const g1 = buildGroup(
    'count4_4150',
    'Считаем предметы: 41-50',
    Array.from({ length: 12 }, (_, i) => countingTask(41 + (i % 10))),
  );
  const g2 = buildGroup(
    'count4_5160',
    'Считаем предметы: 51-60',
    Array.from({ length: 12 }, (_, i) => countingTask(51 + (i % 10))),
  );
  return { id: 'top_counting_4', name: 'Счёт: до 60', groups: [g1, g2] };
}

// ─── Сумма трёх чисел: числа до 60 (24 задания: 12 + 12) ─────────────────
// Волна 7 покрыла сумму до 40. Numeric-режим.

function sumThreeTask(a: number, b: number, c: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_three',
    text: `Сколько будет ${a} плюс ${b} плюс ${c}?`,
    params: { a, b, c },
    correctAnswer: a + b + c,
  };
}

function buildSumThreeWide3Topic(): TopicSpec {
  const g1 = buildGroup(
    'sum3c_low',
    'Сумма трёх чисел: 41-52',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(20 + i, 15, 6)),
  );
  const g2 = buildGroup(
    'sum3c_high',
    'Сумма трёх чисел: 52-63',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(25 + i, 20, 7)),
  );
  return { id: 'top_addition_three_wide3', name: 'Сумма трёх чисел: числа до 60', groups: [g1, g2] };
}

// ─── Оценки: округление до тысяч (30 заданий: 15 + 15) ───────────────────
// Волна 4 остановилась на сотнях сознательно (аудитория 4-9 лет).
// Пользователь подтвердил включение тысяч. Числа 1000-9999,
// подставлено защитой от ровно половины (…500), как и в предыдущих
// волнах округления.

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

const ROUND_THOUSAND_A = Array.from({ length: 15 }, (_, i) => safeThousandNumber(1150 + i * 287));
const ROUND_THOUSAND_B = Array.from({ length: 15 }, (_, i) => safeThousandNumber(1780 + i * 293));

function buildRoundingThousandsTopic(): TopicSpec {
  const g1 = buildGroup('round_t_a', 'Округление до тысяч: набор A', ROUND_THOUSAND_A.map((n) => roundThousandTask(n)));
  const g2 = buildGroup('round_t_b', 'Округление до тысяч: набор B', ROUND_THOUSAND_B.map((n) => roundThousandTask(n)));
  return { id: 'top_rounding_thousands', name: 'Оценки: округление до тысяч', groups: [g1, g2] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE8_TOPICS: TopicSpec[] = [
  buildSubtractionWide2Topic(),
  buildAdditionWide3Topic(),
  buildCompositionWide4Topic(),
  buildComparisonWide3Topic(),
  buildOrderingWide3Topic(),
  buildOrdinalWide5Topic(),
  buildMultiplicationWideTopic(),
  buildDivisionWide3Topic(),
  buildMultiplesWide4Topic(),
  buildShareWide3Topic(),
  buildMissingWide3Topic(),
  buildCountingWide3Topic(),
  buildSumThreeWide3Topic(),
  buildRoundingThousandsTopic(),
];

export function countWave8Tasks(): number {
  return WAVE8_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE8_TOPICS, ARITHMETIC_SECTION_ID);
}
