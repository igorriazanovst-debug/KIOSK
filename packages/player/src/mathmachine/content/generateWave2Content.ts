// Offline-генератор контента Этапа 2b, волна 2 (спека
// docs/superpowers/specs/2026-09-08-mathmachine-content-wave2-design.md).
// Тот же принцип, что и в волне 1 (generateWave1Content.ts) — чистые
// функции, детерминированное перечисление без RNG, файловый ввод-вывод
// вынесен в отдельный runGenerateWave2.ts.
//
// Переделка Эпика 12 (2026-09-09, реставрация): positionIndex-based
// ротация (пришла из волны 1, скопирована сюда) заменена на хэш
// содержания задания — иначе позиция образует тривиальный цикл. Тем же
// проходом устранены две находки этой волны: (1) «Деление» — оба
// дистрактора держали ЛИБО то же частное, ЛИБО тот же остаток, что и
// верный ответ, поэтому «большинство по частному» + «большинство по
// остатку» по отдельности решали задание на 100% без единого деления
// (класс дефекта F2); (2) «Кратные» — дистракторы всегда были correct±1,
// поэтому верный ответ всегда оказывался медианой трёх показанных чисел.
//
// Рефакторинг дублирования (2026-09-09): buildGroup/rotate/contentHash/
// DIVISION_DECOY_SCHEMES/formatDivision/divideTask/mergeIntoContent
// раньше дублировались по себе в каждой волне (осознанное решение спеки
// волны 2, разд. 3 — «каждый скрипт волны самодостаточен» — но при
// переделке Эпика 12 правки приходилось вносить в 2-3 местах
// одновременно, см. Тип6_бэклог.md). Вынесены в generatorShared.ts —
// только чистая инфраструктура, сама волна остаётся здесь.

import type { MathMachineContent, Task } from '@kiosk/shared';
import {
  buildGroup,
  rotate,
  contentHash,
  divideTask as sharedDivideTask,
  mergeWaveIntoContent,
  type GroupSpec,
  type TopicSpec,
} from './generatorShared.ts';

export type { GroupSpec, TopicSpec };

// ─── Умножение (20 заданий: 10 + 10) ───────────────────────────────────

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

function buildMultiplicationTopic(): TopicSpec {
  const by2 = buildGroup(
    'mult_by2',
    'Таблица умножения на 2',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 2)),
  );
  const by5 = buildGroup(
    'mult_by5',
    'Таблица умножения на 5',
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, 5)),
  );
  return { id: 'top_multiplication', name: 'Умножение', groups: [by2, by5] };
}

// ─── Деление с остатком (16 заданий: 8 + 8) ────────────────────────────
// correctAnswer — строка "частное ост. остаток", не число. Раньше оба
// дистрактора держали ЛИБО то же частное, ЛИБО тот же остаток, что верный
// ответ — «большинство по частному» и «большинство по остатку» по
// отдельности решали задание без единого деления (F2). Теперь схема
// дистракторов циклически меняет ОБА смещения одновременно (частично
// совпадающие, частично нет), выбор схемы и позиции — хэш содержания.

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w2-div-scheme-0', 'w2-div-position-0');
}

const DIVISION_PAIRS_23: [number, number][] = [
  [5, 2], [7, 2], [9, 2], [11, 2],
  [7, 3], [8, 3], [10, 3], [11, 3],
];
// 7:5 и 8:5 (частное=1) заменены на 11:5/14:5 — все decoy-схемы Эпика 12
// требуют частное ≥2 (иначе dq=-1 давал бы частное 0), не только 7:5/8:5.
const DIVISION_PAIRS_45: [number, number][] = [
  [9, 4], [11, 4], [13, 4], [14, 4],
  [11, 5], [12, 5], [13, 5], [14, 5],
];

function buildDivisionTopic(): TopicSpec {
  const div23 = buildGroup('div_23', 'Деление на 2 и 3', DIVISION_PAIRS_23.map(([a, b]) => divideTask(a, b)));
  const div45 = buildGroup('div_45', 'Деление на 4 и 5', DIVISION_PAIRS_45.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division', name: 'Деление', groups: [div23, div45] };
}

// ─── Кратные (16 заданий: 8 + 8) ────────────────────────────────────────
// Дистракторы больше не всегда correct±1 (что делало correct медианой
// трёх показанных чисел) — выбираются хэшем из более широкого пула
// смещений, отфильтрованных от значений, которые сами оказались бы
// кратны n.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w2-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w2-mult-d2-0', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w2-mult-position-0', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesTopic(): TopicSpec {
  const tasks23: Omit<Task, 'id'>[] = [];
  [2, 3].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks23.push(multipleTask(n, k));
  });
  const group23 = buildGroup('kratn_23', 'Кратные 2 и 3', tasks23);

  const tasks45: Omit<Task, 'id'>[] = [];
  [4, 5].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks45.push(multipleTask(n, k));
  });
  const group45 = buildGroup('kratn_45', 'Кратные 4 и 5', tasks45);

  return { id: 'top_multiples', name: 'Кратные', groups: [group23, group45] };
}

// ─── Оценки: округление до десятков (16 заданий: 8 + 8) ────────────────
// Числа подобраны вручную, чтобы избежать ровно половины (…5) — этой
// волной не проверяется конвенция округления половины, только
// однозначные случаи.

function roundTask(n: number): Omit<Task, 'id'> {
  return {
    typeId: 'round_to_ten',
    text: `Округли ${n} до десятков`,
    params: { n },
    correctAnswer: Math.round(n / 10) * 10,
  };
}

const ROUND_GROUP_A = [12, 17, 23, 28, 34, 41, 47, 53];
const ROUND_GROUP_B = [58, 62, 69, 74, 81, 86, 93, 97];

function buildRoundingTopic(): TopicSpec {
  const groupA = buildGroup('round_a', 'Округление до 60', ROUND_GROUP_A.map((n) => roundTask(n)));
  const groupB = buildGroup('round_b', 'Округление от 60', ROUND_GROUP_B.map((n) => roundTask(n)));
  return { id: 'top_rounding', name: 'Оценки', groups: [groupA, groupB] };
}

// ─── Порядковые числительные (8 заданий) ────────────────────────────────
// Режим ответа — numeric (клавиатура), у него физически нет "позиции
// кнопки" для эксплуатации, поэтому вариация позиции здесь не нужна.
// Позиция ЗАПРОСА (какое место по счёту спрашиваем) циклически меняется
// 1..5 просто ради разнообразия покрытия.

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

const ORDINAL_SERIES: number[][] = [
  [3, 7, 2, 9, 15],
  [5, 12, 1, 8, 17],
  [6, 14, 3, 11, 19],
  [2, 9, 16, 4, 13],
  [7, 1, 18, 10, 5],
  [11, 3, 15, 8, 20],
  [4, 17, 9, 2, 14],
  [13, 6, 19, 1, 10],
];

function buildOrdinalTopic(): TopicSpec {
  const group = buildGroup(
    'ordpos',
    'Найди число по номеру',
    ORDINAL_SERIES.map((series, i) => ordinalTask(series, (i % 5) + 1)),
  );
  return { id: 'top_ordinal', name: 'Порядковые числительные', groups: [group] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE2_TOPICS: TopicSpec[] = [
  buildMultiplicationTopic(),
  buildDivisionTopic(),
  buildMultiplesTopic(),
  buildRoundingTopic(),
  buildOrdinalTopic(),
];

export function countWave2Tasks(): number {
  return WAVE2_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE2_TOPICS, ARITHMETIC_SECTION_ID);
}
