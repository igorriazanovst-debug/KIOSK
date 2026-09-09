// Offline-генератор контента Этапа 2b, волна 4 — количественное
// расширение (утверждено с пользователем: углубление уже покрытых
// категорий вместо новых типов заданий — все 13 категорий ТЗ FR-022 уже
// закрыты волнами 1-3). Не вводит НИ ОДНОГО нового TaskTypeId — только
// новые диапазоны/темы для уже существующих типов, поэтому schema.ts/
// taskEngine.ts/TaskVisual.tsx/TaskRunner.tsx не трогаются вовсе.
//
// Как и волна 3 углубляла «Умножение» отдельными НОВЫМИ темами
// (top_multiplication_6 и т.п.), а не дописыванием групп в тему волны 2
// (mergeWaveIntoContent сознательно не поддерживает дозапись групп в уже
// существующую тему — только добавление новых тем целиком), эта волна
// углубляет «Вычитание», «Сложение», «Кратные», «Порядковые
// числительные», «Оценки», «Доли целого» тем же способом — отдельными
// новыми темами.

import type { MathMachineContent, Task } from '@kiosk/shared';
import { buildGroup, rotate, contentHash, mergeWaveIntoContent, type GroupSpec, type TopicSpec } from './generatorShared.ts';

export type { GroupSpec, TopicSpec };

// ─── Вычитание: переход через десяток (16 заданий: 8 + 8) ───────────────
// Волна 1 покрыла вычесть 1/2 (уменьшаемое ≤10), волна 3 — уменьшаемое до
// 20/вычитаемое 3-9 (частично уже включает переход через десяток
// случайно). Эта тема — целенаправленно уменьшаемое 11-18, вычитаемое
// такое, что результат однозначный (перех через десяток вниз), пары не
// пересекаются с уже использованными в волне 3.

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

const SUBTRACT_CARRY_LOW: [number, number][] = [
  [11, 2], [11, 4], [11, 6], [12, 5], [12, 7], [13, 6], [13, 8], [14, 7],
];
const SUBTRACT_CARRY_HIGH: [number, number][] = [
  [15, 6], [15, 8], [16, 7], [16, 9], [17, 8], [17, 9], [18, 9], [14, 9],
];

function buildSubtractionCarryTopic(): TopicSpec {
  const low = buildGroup('sub_carry_low', 'Вычитание через десяток: числа до 14', SUBTRACT_CARRY_LOW.map(([a, b]) => subtractTask(a, b)));
  const high = buildGroup('sub_carry_high', 'Вычитание через десяток: числа до 18', SUBTRACT_CARRY_HIGH.map(([a, b]) => subtractTask(a, b)));
  return { id: 'top_subtraction_carry', name: 'Вычитание: переход через десяток', groups: [low, high] };
}

// ─── Сложение: числа до 20 (16 заданий: 8 + 8) ───────────────────────────
// Волна 1/Этап 1 покрыли суммы ≤10, волна 3 — переход через десяток с
// фиксированным вторым слагаемым 9. Эта тема расширяет диапазон: сначала
// суммы 11-14 однозначными слагаемыми (пары не пересекаются с волной 3),
// затем впервые — двузначное первое слагаемое (10-12), сумма до 18.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

const ADDITION_WIDE_LOW: [number, number][] = [
  [5, 7], [7, 5], [6, 6], [4, 8], [8, 4], [5, 8], [8, 5], [6, 8],
];
const ADDITION_WIDE_TWO_DIGIT: [number, number][] = [
  [10, 5], [10, 6], [10, 7], [10, 8], [11, 5], [11, 6], [11, 7], [12, 5],
];

function buildAdditionWideTopic(): TopicSpec {
  const low = buildGroup('add3_low', 'Сложение: суммы 11-14', ADDITION_WIDE_LOW.map(([a, b]) => sumTwoTask(a, b)));
  const twoDigit = buildGroup('add3_two_digit', 'Сложение с двузначным слагаемым', ADDITION_WIDE_TWO_DIGIT.map(([a, b]) => sumTwoTask(a, b)));
  return { id: 'top_addition_wide', name: 'Сложение: числа до 20', groups: [low, twoDigit] };
}

// ─── Кратные 6, 7, 8, 9, 10 (20 заданий: 8 + 12) ─────────────────────────
// Волна 2 покрыла только 2-5. Тот же приём выбора дистракторов, что и в
// волне 2 (хэш из пула смещений ±1..±3, отфильтрованных от кратных n) —
// для n≥6 ни один из этих смещений сам не кратен n, поэтому фильтрация
// никогда не сужает пул до <6 кандидатов (в отличие от n=2 в волне 2,
// где ±2 сами оказывались кратны 2).

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w4-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w4-mult-d2-8', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w4-mult-position-9', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWideTopic(): TopicSpec {
  const tasks67: Omit<Task, 'id'>[] = [];
  [6, 7].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks67.push(multipleTask(n, k));
  });
  const group67 = buildGroup('kratn2_67', 'Кратные 6 и 7', tasks67);

  const tasks8910: Omit<Task, 'id'>[] = [];
  [8, 9, 10].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks8910.push(multipleTask(n, k));
  });
  const group8910 = buildGroup('kratn2_8910', 'Кратные 8, 9 и 10', tasks8910);

  return { id: 'top_multiples_2', name: 'Кратные: 6-10', groups: [group67, group8910] };
}

// ─── Порядковые числительные: длинные ряды (16 заданий: 8 + 8) ──────────
// Волна 2 покрыла только ряды по 5 элементов. Эта тема — ряды по 6 и по
// 7 элементов (позиция запроса циклически меняется, как и в волне 2 —
// у numeric-режима физически нет позиции кнопки для эксплуатации).

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const ORDINAL_SERIES_6: number[][] = [
  [3, 9, 1, 7, 14, 5],
  [8, 2, 11, 6, 15, 4],
  [10, 1, 8, 3, 12, 7],
  [5, 13, 2, 9, 6, 11],
  [14, 3, 8, 1, 10, 6],
  [7, 12, 4, 9, 2, 13],
  [6, 1, 11, 5, 14, 8],
  [9, 4, 13, 2, 7, 10],
];
const ORDINAL_SERIES_7: number[][] = [
  [4, 11, 2, 8, 15, 6, 1],
  [9, 3, 12, 5, 14, 7, 2],
  [6, 13, 1, 10, 4, 9, 3],
  [11, 2, 8, 14, 5, 12, 7],
  [3, 9, 15, 1, 7, 13, 6],
  [8, 4, 11, 2, 10, 5, 14],
  [12, 1, 7, 3, 9, 15, 2],
  [5, 10, 3, 8, 14, 1, 11],
];

function buildOrdinalWideTopic(): TopicSpec {
  const group6 = buildGroup(
    'ordpos2_6',
    'Ряд из 6 чисел',
    ORDINAL_SERIES_6.map((series, i) => ordinalTask(series, (i % 6) + 1)),
  );
  const group7 = buildGroup(
    'ordpos2_7',
    'Ряд из 7 чисел',
    ORDINAL_SERIES_7.map((series, i) => ordinalTask(series, (i % 7) + 1)),
  );
  return { id: 'top_ordinal_2', name: 'Порядковые числительные: длинные ряды', groups: [group6, group7] };
}

// ─── Оценки: округление до сотен (16 заданий: 8 + 8) ────────────────────
// Волна 2 покрыла округление единиц до десятков (12-97). Эта тема —
// тот же приём, масштабированный ×10: округление до сотен (120-970),
// числа подобраны так же, чтобы избежать ровно половины (…50).

function roundHundredTask(n: number): Omit<Task, 'id'> {
  return {
    typeId: 'round_to_ten',
    text: `Округли ${n} до сотен`,
    params: { n },
    correctAnswer: Math.round(n / 100) * 100,
  };
}

const ROUND_HUNDRED_A = [120, 170, 230, 280, 340, 410, 470, 530];
const ROUND_HUNDRED_B = [580, 620, 690, 740, 810, 860, 930, 970];

function buildRoundingHundredsTopic(): TopicSpec {
  const groupA = buildGroup('round_h_a', 'Округление до 550', ROUND_HUNDRED_A.map((n) => roundHundredTask(n)));
  const groupB = buildGroup('round_h_b', 'Округление от 550', ROUND_HUNDRED_B.map((n) => roundHundredTask(n)));
  return { id: 'top_rounding_hundreds', name: 'Оценки: округление до сотен', groups: [groupA, groupB] };
}

// ─── Доли целого: треть (8 заданий) ──────────────────────────────────────
// Волна 3 покрыла половину и четверть (parts 2 или 4). Эта тема — треть
// (parts=3) для чисел, делящихся на 3 нацело.

function shareThirdTask(total: number): Omit<Task, 'id'> {
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну на три части — сколько досталось на одну часть?`,
    params: { total, parts: 3 },
    correctAnswer: total / 3,
  };
}

const SHARE_THIRD_TOTALS = [6, 9, 12, 15, 18, 21, 24, 27];

function buildShareThirdTopic(): TopicSpec {
  const group = buildGroup('share_third', 'Треть', SHARE_THIRD_TOTALS.map((total) => shareThirdTask(total)));
  return { id: 'top_shares_third', name: 'Доли целого: треть', groups: [group] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE4_TOPICS: TopicSpec[] = [
  buildSubtractionCarryTopic(),
  buildAdditionWideTopic(),
  buildMultiplesWideTopic(),
  buildOrdinalWideTopic(),
  buildRoundingHundredsTopic(),
  buildShareThirdTopic(),
];

export function countWave4Tasks(): number {
  return WAVE4_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE4_TOPICS, ARITHMETIC_SECTION_ID);
}
