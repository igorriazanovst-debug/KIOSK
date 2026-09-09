// Offline-генератор контента Этапа 2b, волна 7 — УКРУПНЁННАЯ волна
// количественного расширения (согласовано с пользователем: вместо ~6
// тем/~100 заданий за волну — 13 тем/~350 заданий за один заход, чтобы
// быстрее приблизиться к целевым 2800+ заданиям ТЗ FR-020; количество
// тем FR-021 (40+) уже перекрыто волной 6 — эта волна не гонится за
// новыми ТЕМАМИ ради темы, а расширяет числовой охват уже существующих
// 13 категорий). Ни одного нового TaskTypeId — только новые диапазоны/
// темы для уже существующих типов, поэтому schema.ts/taskEngine.ts/
// TaskVisual.tsx/TaskRunner.tsx не трогаются вовсе (тот же принцип, что
// и в волнах 4-6).
//
// Из 13 тем только 4 — choice-режима (Сравнение, Порядок чисел,
// Кратные, Деление) и поэтому нуждаются в батарее инвариантов позиции
// кнопки; остальные 9 — numeric-режим, для них экплойт через позицию
// кнопки структурно невозможен.

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

// ─── Вычитание: числа до 50 (30 заданий: 10 + 10 + 10) ───────────────────
// Волна 4 покрыла минуенд 11-18. Здесь — впервые минуенд 21-50.

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionWideTopic(): TopicSpec {
  const g1 = buildGroup(
    'sub2_21_30',
    'Вычитание: числа 21-30',
    Array.from({ length: 10 }, (_, i) => subtractTask(21 + i, 2 + (i % 8))),
  );
  const g2 = buildGroup(
    'sub2_31_40',
    'Вычитание: числа 31-40',
    Array.from({ length: 10 }, (_, i) => subtractTask(31 + i, 3 + (i % 8))),
  );
  const g3 = buildGroup(
    'sub2_41_50',
    'Вычитание: числа 41-50',
    Array.from({ length: 10 }, (_, i) => subtractTask(41 + i, 4 + (i % 8))),
  );
  return { id: 'top_subtraction_wide2', name: 'Вычитание: числа до 50', groups: [g1, g2, g3] };
}

// ─── Сложение: числа до 50 (30 заданий: 10 + 10 + 10) ────────────────────
// Волна 4 покрыла суммы до 18. Здесь — суммы 21-50.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

function buildAdditionWide2Topic(): TopicSpec {
  const g1 = buildGroup(
    'add4_21_30',
    'Сложение: суммы 21-30',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(11 + i, 10 + (i % 3))),
  );
  const g2 = buildGroup(
    'add4_31_40',
    'Сложение: суммы 31-40',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(16 + i, 15 + (i % 3))),
  );
  const g3 = buildGroup(
    'add4_41_50',
    'Сложение: суммы 41-50',
    Array.from({ length: 10 }, (_, i) => sumTwoTask(21 + i, 20 + (i % 3))),
  );
  return { id: 'top_addition_wide2', name: 'Сложение: числа до 50', groups: [g1, g2, g3] };
}

// ─── Состав числа: числа 31-50 (40 заданий: 20 + 20) ─────────────────────
// Волна 6 покрыла 21-30 (только крайние разложения «1 и остальное»).
// Здесь диапазон шире (31-50) И набор разложений шире — вместо только
// краёв (knownPart=1/whole-1) добавлена середина (knownPart=floor(whole/2)).

function compositionTask(whole: number, knownPart: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_composition',
    text: `${whole} = ${knownPart} + ?`,
    params: { whole, knownPart },
    correctAnswer: whole - knownPart,
  };
}

function buildCompositionWide3Topic(): TopicSpec {
  const low: Omit<Task, 'id'>[] = [];
  for (let whole = 31; whole <= 40; whole++) {
    low.push(compositionTask(whole, 1));
    low.push(compositionTask(whole, Math.floor(whole / 2)));
  }
  const g1 = buildGroup('comp4_40', 'Состав чисел 31-40', low);

  const high: Omit<Task, 'id'>[] = [];
  for (let whole = 41; whole <= 50; whole++) {
    high.push(compositionTask(whole, 1));
    high.push(compositionTask(whole, Math.floor(whole / 2)));
  }
  const g2 = buildGroup('comp4_50', 'Состав чисел 41-50', high);

  return { id: 'top_composition_4', name: 'Состав числа: числа 31-50', groups: [g1, g2] };
}

// ─── Сравнение: числа до 100 (24 задания: 8 + 8 + 8) ─────────────────────
// Волна 5 покрыла 15-46. Здесь впервые числа до 100. Choice-режим — та
// же независимая пара солей (позиция кнопки / порядок называния чисел
// в тексте), что и во всех предыдущих волнах «Сравнения».

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w7-cmp-text-order-1', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w7-cmp-position-630', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonWide2Topic(): TopicSpec {
  const g1 = buildGroup(
    'cmp3_next',
    'Сравнение соседних чисел (50-65)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(50 + i, 51 + i, 0)),
  );
  const g2 = buildGroup(
    'cmp3_gap',
    'Сравнение чисел вразброс (55-92)',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(55 + i * 5, 58 + i * 5, 1)),
  );
  const g3 = buildGroup(
    'cmp3_hundred',
    'Сравнение чисел рядом со 100',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(90 + i, 92 + i, i % 2 === 0 ? 0 : 1)),
  );
  return { id: 'top_comparison_3', name: 'Сравнение: числа до 100', groups: [g1, g2, g3] };
}

// ─── Порядок чисел: пять чисел (20 заданий: 10 + 10) ─────────────────────
// Волна 5 сравнивала четвёрки. Здесь впервые пятёрки — тот же приём
// (показываемый порядок ряда поворачивается хэшем содержания).

function orderingTask5(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w7-order5-position-1', [...baseSeries, direction]);
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

function buildOrderingWide2Topic(): TopicSpec {
  const findMin = buildGroup(
    'order5_min',
    'Найди наименьшее среди пяти',
    Array.from({ length: 10 }, (_, i) => orderingTask5([i + 1, i + 4, i + 8, i + 11, i + 14], 1)),
  );
  const findMax = buildGroup(
    'order5_max',
    'Найди наибольшее среди пяти',
    Array.from({ length: 10 }, (_, i) => orderingTask5([i + 1, i + 3, i + 6, i + 9, i + 12], 0)),
  );
  return { id: 'top_ordering_3', name: 'Порядок чисел: пять чисел', groups: [findMin, findMax] };
}

// ─── Порядковые числительные: ряды по 11-12 (24 задания: 12 + 12) ────────
// Волна 6 ввела формульное построение серий (`base + (j·step) mod N`
// для step, взаимно простого с N) — здесь масштабируется без риска
// опечатки при ручном наборе, просто увеличением длины ряда.

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const COPRIME_STEPS_11 = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const COPRIME_STEPS_12 = [1, 5, 7, 11];

function buildFormulaSeries(length: number, coprimeSteps: number[], i: number): number[] {
  const base = 1 + i * 2;
  const step = coprimeSteps[i % coprimeSteps.length];
  return Array.from({ length }, (_, j) => base + ((j * step) % length));
}

function buildOrdinalWide4Topic(): TopicSpec {
  const group11 = buildGroup(
    'ordpos5_11',
    'Ряд из 11 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(11, COPRIME_STEPS_11, i), (i % 11) + 1)),
  );
  const group12 = buildGroup(
    'ordpos5_12',
    'Ряд из 12 чисел',
    Array.from({ length: 12 }, (_, i) => ordinalTask(buildFormulaSeries(12, COPRIME_STEPS_12, i), (i % 12) + 1)),
  );
  return { id: 'top_ordinal_5', name: 'Порядковые числительные: ряды по 11-12', groups: [group11, group12] };
}

// ─── Кратные: 16-20 (30 заданий: 18 + 12) ────────────────────────────────
// Волна 6 покрыла 11-15. Для n≥16 ни один из смещений ±1..±3 сам не
// кратен n, поэтому фильтрация дистракторов никогда не сужает пул.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w7-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w7-mult-d2-4', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w7-mult-position-7', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWide3Topic(): TopicSpec {
  const tasksLow: Omit<Task, 'id'>[] = [];
  [16, 17, 18].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksLow.push(multipleTask(n, k));
  });
  const groupLow = buildGroup('kratn4_161718', 'Кратные 16, 17 и 18', tasksLow);

  const tasksHigh: Omit<Task, 'id'>[] = [];
  [19, 20].forEach((n) => {
    for (let k = 2; k <= 7; k++) tasksHigh.push(multipleTask(n, k));
  });
  const groupHigh = buildGroup('kratn4_1920', 'Кратные 19 и 20', tasksHigh);

  return { id: 'top_multiples_4', name: 'Кратные: 16-20', groups: [groupLow, groupHigh] };
}

// ─── Деление: делители 13, 14, 15 (24 задания: 8 + 8 + 8) ────────────────
// Волна 6 покрыла 11-12. Все пары — частное ≥2 (требование decoy-схемы).

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w7-div-scheme-1', 'w7-div-position-3');
}

const DIVISION_PAIRS_13: [number, number][] = [
  [27, 13], [30, 13], [35, 13], [42, 13], [48, 13], [55, 13], [61, 13], [68, 13],
];
const DIVISION_PAIRS_14: [number, number][] = [
  [29, 14], [33, 14], [38, 14], [45, 14], [51, 14], [58, 14], [64, 14], [71, 14],
];
const DIVISION_PAIRS_15: [number, number][] = [
  [31, 15], [34, 15], [41, 15], [47, 15], [53, 15], [59, 15], [64, 15], [73, 15],
];

function buildDivisionWide2Topic(): TopicSpec {
  const g13 = buildGroup('div4_13', 'Деление на 13', DIVISION_PAIRS_13.map(([a, b]) => divideTask(a, b)));
  const g14 = buildGroup('div4_14', 'Деление на 14', DIVISION_PAIRS_14.map(([a, b]) => divideTask(a, b)));
  const g15 = buildGroup('div4_15', 'Деление на 15', DIVISION_PAIRS_15.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division_131415', name: 'Деление: делители 13, 14, 15', groups: [g13, g14, g15] };
}

// ─── Доли целого: пятая и десятая части (24 задания: 12 + 12) ────────────
// Волна 3 покрыла половину/четверть, волна 5 — треть. Здесь впервые
// parts=5 и parts=10. Numeric-режим.

function shareTask(total: number, parts: number, word: string): Omit<Task, 'id'> {
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну ${word} — сколько досталось на одну часть?`,
    params: { total, parts },
    correctAnswer: total / parts,
  };
}

const SHARE_FIFTH_TOTALS = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
const SHARE_TENTH_TOTALS = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130];

function buildShareWide2Topic(): TopicSpec {
  const fifth = buildGroup(
    'share3_fifth',
    'Пятая часть',
    SHARE_FIFTH_TOTALS.map((total) => shareTask(total, 5, 'на пять частей')),
  );
  const tenth = buildGroup(
    'share3_tenth',
    'Десятая часть',
    SHARE_TENTH_TOTALS.map((total) => shareTask(total, 10, 'на десять частей')),
  );
  return { id: 'top_shares_3', name: 'Доли целого: пятая и десятая части', groups: [fifth, tenth] };
}

// ─── Пропущенное число: шаг 4 и 5 (24 задания: 12 + 12) ──────────────────
// Волна 5 покрыла шаг 2 и 3. Numeric-режим.

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

function buildMissingWide2Topic(): TopicSpec {
  const step4 = buildGroup(
    'missing3_step4',
    'Ряды с шагом 4',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(2 + i * 3, 4, 6), i % 6)),
  );
  const step5 = buildGroup(
    'missing3_step5',
    'Ряды с шагом 5',
    Array.from({ length: 12 }, (_, i) => missingNumberTask(buildStepSeries(3 + i * 4, 5, 6), i % 6)),
  );
  return { id: 'top_missing_3', name: 'Пропущенное число: шаг 4 и 5', groups: [step4, step5] };
}

// ─── Счёт: до 40 (24 задания: 12 + 12) ───────────────────────────────────
// Волна 5 покрыла 11-20. Numeric-режим — визуал с `flexWrap` масштабируется
// без правок кода.

function countingTask(count: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_counting',
    text: 'Сколько предметов ты видишь?',
    params: { count },
    correctAnswer: count,
  };
}

function buildCountingWide2Topic(): TopicSpec {
  const g1 = buildGroup(
    'count3_2130',
    'Считаем предметы: 21-30',
    Array.from({ length: 12 }, (_, i) => countingTask(21 + (i % 10))),
  );
  const g2 = buildGroup(
    'count3_3140',
    'Считаем предметы: 31-40',
    Array.from({ length: 12 }, (_, i) => countingTask(31 + (i % 10))),
  );
  return { id: 'top_counting_3', name: 'Счёт: до 40', groups: [g1, g2] };
}

// ─── Сумма трёх чисел: числа до 40 (24 задания: 12 + 12) ─────────────────
// Волна 6 покрыла сумму до 20. Numeric-режим.

function sumThreeTask(a: number, b: number, c: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_three',
    text: `Сколько будет ${a} плюс ${b} плюс ${c}?`,
    params: { a, b, c },
    correctAnswer: a + b + c,
  };
}

function buildSumThreeWide2Topic(): TopicSpec {
  const g1 = buildGroup(
    'sum3b_low',
    'Сумма трёх чисел: 21-30',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(10 + i, 8, 3)),
  );
  const g2 = buildGroup(
    'sum3b_high',
    'Сумма трёх чисел: 29-40',
    Array.from({ length: 12 }, (_, i) => sumThreeTask(14 + i, 10, 5)),
  );
  return { id: 'top_addition_three_wide2', name: 'Сумма трёх чисел: числа до 40', groups: [g1, g2] };
}

// ─── Оценки: больше примеров округления до сотен (30 заданий: 15 + 15) ───
// Волна 4 покрыла 16 чисел в диапазоне 100-999. Здесь — ещё 30 ЧИСЕЛ В
// ТОМ ЖЕ диапазоне (не новый порядок величины — для аудитории 4-9 лет
// округление до тысяч уже не оправдано), ни одно не совпадает с уже
// использованными в волне 4 и ни одно не оканчивается на 50 (та же
// защита от неоднозначного округления).

function roundHundredTask(n: number): Omit<Task, 'id'> {
  return {
    typeId: 'round_to_ten',
    text: `Округли ${n} до сотен`,
    params: { n },
    correctAnswer: Math.round(n / 100) * 100,
  };
}

const ROUND_HUNDRED_C = [110, 160, 220, 270, 330, 390, 440, 495, 505, 560, 610, 660, 715, 770, 820];
const ROUND_HUNDRED_D = [875, 915, 965, 145, 195, 245, 295, 345, 395, 445, 745, 795, 845, 895, 945];

function buildRoundingHundreds2Topic(): TopicSpec {
  const g1 = buildGroup('round_h2_c', 'Округление до сотен: набор A', ROUND_HUNDRED_C.map((n) => roundHundredTask(n)));
  const g2 = buildGroup('round_h2_d', 'Округление до сотен: набор B', ROUND_HUNDRED_D.map((n) => roundHundredTask(n)));
  return { id: 'top_rounding_hundreds_2', name: 'Оценки: больше примеров округления до сотен', groups: [g1, g2] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE7_TOPICS: TopicSpec[] = [
  buildSubtractionWideTopic(),
  buildAdditionWide2Topic(),
  buildCompositionWide3Topic(),
  buildComparisonWide2Topic(),
  buildOrderingWide2Topic(),
  buildOrdinalWide4Topic(),
  buildMultiplesWide3Topic(),
  buildDivisionWide2Topic(),
  buildShareWide2Topic(),
  buildMissingWide2Topic(),
  buildCountingWide2Topic(),
  buildSumThreeWide2Topic(),
  buildRoundingHundreds2Topic(),
];

export function countWave7Tasks(): number {
  return WAVE7_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE7_TOPICS, ARITHMETIC_SECTION_ID);
}
