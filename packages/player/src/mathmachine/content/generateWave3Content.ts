// Offline-генератор контента Этапа 2b, волна 3 (спека
// docs/superpowers/specs/2026-09-08-mathmachine-content-wave3-design.md).
// Тот же принцип, что и в волнах 1-2 — чистые функции, детерминированное
// перечисление без RNG, файловый ввод-вывод вынесен в отдельный
// runGenerateWave3.ts. Единственная choice-группа этой волны — углубление
// «Деления» (3 новые темы) — с первого коммита проходит оба
// теста-инварианта волны 2 (позиция правильного ответа не константна;
// ни одна структурная эвристика не решает всю группу) — те же схемы
// дистракторов, что уже доказали себя в волне 2, скопированы без
// изменений. Хелперы buildGroup/rotate/DIVISION_DECOY_SCHEMES/
// formatDivision продублированы из generateWave2Content.ts, а не
// импортированы — каждый скрипт волны самодостаточен (решение спеки
// волны 2, разд. 3, подтверждено и здесь; пересмотр этого дублирования
// вынесен за рамки волны 3).

import type { MathMachineContent, Task, Group, Topic } from '@kiosk/shared';

export interface GroupSpec {
  id: string;
  name: string;
  tasks: Task[];
}

export interface TopicSpec {
  id: string;
  name: string;
  groups: GroupSpec[];
}

function buildGroup(idPrefix: string, name: string, tasks: Omit<Task, 'id'>[]): GroupSpec {
  const builtTasks: Task[] = tasks.map((t, i) => ({
    ...t,
    id: i === 0 ? `${idPrefix}_intro` : `${idPrefix}_${i}`,
  }));
  return { id: `grp_${idPrefix}`, name, tasks: builtTasks };
}

function rotate<T>(arr: T[], shift: number): T[] {
  const n = arr.length;
  const s = ((shift % n) + n) % n;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

// ─── Доли целого (16 заданий: 8 + 8) — закрывает последнюю категорию ТЗ
// FR-022 («проценты»), переосмысленную под возраст 4-9 лет как деление
// целого на равные доли (решение пользователя). Numeric-режим — у
// заданий этого типа физически нет choices, поэтому класс дефекта
// «структурная решаемость по форме вариантов» (уроки волн 1-2) к нему
// неприменим; это явно проверяется тестом-негативом, а не подразумевается.

function shareTask(total: number, parts: 2 | 4): Omit<Task, 'id'> {
  const partsWord = parts === 2 ? 'две части' : 'четыре части';
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну на ${partsWord} — сколько досталось на одну часть?`,
    params: { total, parts },
    correctAnswer: total / parts,
  };
}

const SHARE_HALF_TOTALS = [4, 6, 8, 10, 14, 18, 24, 30];
const SHARE_QUARTER_TOTALS = [8, 12, 16, 20, 24, 28, 32, 36];

function buildShareTopic(): TopicSpec {
  const half = buildGroup('share_half', 'Половина', SHARE_HALF_TOTALS.map((total) => shareTask(total, 2)));
  const quarter = buildGroup('share_quarter', 'Четверть', SHARE_QUARTER_TOTALS.map((total) => shareTask(total, 4)));
  return { id: 'top_shares', name: 'Доли целого', groups: [half, quarter] };
}

// ─── Умножение — 7 новых таблиц (70 заданий: 10 × 7) ────────────────────
// Волна 2 материализовала только таблицы ×2 и ×5 из разрешённого спекой
// диапазона a,b∈[1,10] — эта волна добавляет оставшиеся 7 таблиц. Один
// и тот же генераторный паттерн, что уже дал темы ×2/×5.

function multiplyTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_multiply_two',
    text: `Сколько будет ${a} умножить на ${b}?`,
    params: { a, b },
    correctAnswer: a * b,
  };
}

const MULTIPLICATION_TABLES = [3, 4, 6, 7, 8, 9, 10];

function buildMultiplicationTopic(b: number): TopicSpec {
  const group = buildGroup(
    `mult_by${b}`,
    `Таблица умножения на ${b}`,
    Array.from({ length: 10 }, (_, i) => multiplyTask(i + 1, b)),
  );
  return { id: `top_multiplication_${b}`, name: `Умножение на ${b}`, groups: [group] };
}

// ─── Деление — 3 новые темы (24 задания: 8 + 8 + 8) — делители 6-10 ─────
// Волна 2 материализовала только делители 2-5, делимое ≤13. Эта волна
// добавляет делители 6-10, впервые задействуя делимое до 50 (тема
// «Деление на 10»). Схема дистракторов и позиционная логика — БЕЗ
// ИЗМЕНЕНИЙ скопированы из generateWave2Content.ts (там уже независимо
// перепроверены финальным ревью волны 2 — цикл схем период 4, поворот
// кнопок период 3, взаимно просты, поэтому ни позиция, ни структура
// вариантов не выводятся друг из друга и ни одна структурная эвристика
// не решает больше половины группы). Пары (a,b) подобраны так же, как в
// волне 2: частное каждого показанного варианта ≥1 (значит исходное
// частное каждой пары ≥2 — иначе дистрактор "частное-1" ушёл бы в 0),
// остаток ненулевой, делимое в допустимом диапазоне 3-50.

const DIVISION_DECOY_SCHEMES: [number, number][][] = [
  [[0, 1], [-1, 0]],
  [[-1, 1], [-1, 2]],
  [[0, 1], [1, 1]],
  [[-1, 1], [1, 2]],
];

function formatDivision(quotient: number, remainder: number): string {
  return `${quotient} ост. ${remainder}`;
}

function divideTask(a: number, b: number, positionIndex: number): Omit<Task, 'id'> {
  const quotient = Math.floor(a / b);
  const remainder = a % b;
  const correct = formatDivision(quotient, remainder);
  const scheme = DIVISION_DECOY_SCHEMES[positionIndex % DIVISION_DECOY_SCHEMES.length];
  if (scheme.some(([dq]) => quotient + dq < 1)) {
    throw new Error(`Division decoy quotient would fall below 1 for ${a}:${b} — pick a pair with a bigger quotient`);
  }
  const options = [correct, ...scheme.map(([dq, dr]) => formatDivision(quotient + dq, (remainder + dr) % b))];
  if (new Set(options).size !== 3) {
    throw new Error(`Division decoys collided for ${a}:${b} — options: ${options.join(' | ')}`);
  }
  const choices = rotate(options, positionIndex);
  return {
    typeId: 'number_divide_remainder',
    text: `Сколько будет ${a} разделить на ${b}?`,
    params: { a, b },
    correctAnswer: correct,
    choices,
  };
}

// Найдено вживую (R1): исходные пары складывались в арифметическую
// прогрессию с шагом b+1, из-за чего частное-минус-остаток равнялось 1 во
// всех 8 заданиях — эвристика «единственный вариант с q−r=1» решала 6/8.
// Эти пары дают восемь ПОПАРНО РАЗЛИЧНЫХ значений q−r (−2,2,1,4,−4,0,−1,3) —
// доминирующего значения не существует.
const DIVISION_PAIRS_67: [number, number][] = [
  [16, 6], [19, 6], [27, 6], [31, 6],
  [20, 7], [24, 7], [33, 7], [37, 7],
];
const DIVISION_PAIRS_89: [number, number][] = [
  [17, 8], [25, 8], [33, 8], [41, 8],
  [19, 9], [28, 9], [37, 9], [46, 9],
];
const DIVISION_PAIRS_10: [number, number][] = [
  [21, 10], [24, 10], [27, 10], [33, 10],
  [36, 10], [38, 10], [41, 10], [47, 10],
];

function buildDivision67Topic(): TopicSpec {
  const group = buildGroup('div_67', 'Деление на 6 и 7', DIVISION_PAIRS_67.map(([a, b], i) => divideTask(a, b, i)));
  return { id: 'top_division_67', name: 'Деление на 6 и 7', groups: [group] };
}

function buildDivision89Topic(): TopicSpec {
  const group = buildGroup('div_89', 'Деление на 8 и 9', DIVISION_PAIRS_89.map(([a, b], i) => divideTask(a, b, i)));
  return { id: 'top_division_89', name: 'Деление на 8 и 9', groups: [group] };
}

function buildDivision10Topic(): TopicSpec {
  const group = buildGroup('div_10', 'Деление на 10', DIVISION_PAIRS_10.map(([a, b], i) => divideTask(a, b, i)));
  return { id: 'top_division_10', name: 'Деление на 10', groups: [group] };
}

// ─── Сложение — переход через десяток (9 заданий) ───────────────────────
// Волна 1/Этап 1 материализовали только суммы ≤10. Эта тема впервые
// вводит сумму, превышающую 10 (11-18) — переход через десяток.

function sumTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_two',
    text: `Сколько будет ${a} плюс ${b}?`,
    params: { a, b },
    correctAnswer: a + b,
  };
}

const ADDITION_CARRY_PAIRS: [number, number][] = [
  [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [9, 8],
];

function buildAdditionCarryTopic(): TopicSpec {
  const group = buildGroup('add_carry', 'Сложение с переходом через десяток', ADDITION_CARRY_PAIRS.map(([a, b]) => sumTwoTask(a, b)));
  return { id: 'top_addition_carry', name: 'Сложение: переход через десяток', groups: [group] };
}

// ─── Вычитание — числа побольше (16 заданий: 8 + 8) ─────────────────────
// Волна 1 материализовала только вычитаемое 1 или 2, уменьшаемое ≤10.
// Эта тема расширяет уменьшаемое до 20 и вычитаемое до 9.

function subtractTwoTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

const SUBTRACT_WIDE_LOW: [number, number][] = [
  [4, 3], [12, 3], [19, 3], [5, 4], [14, 4], [20, 4], [6, 5], [17, 5],
];
const SUBTRACT_WIDE_HIGH: [number, number][] = [
  [7, 6], [18, 6], [8, 7], [19, 7], [9, 8], [20, 8], [10, 9], [19, 9],
];

function buildSubtractionWideTopic(): TopicSpec {
  const low = buildGroup('sub_wide_low', 'Вычесть 3, 4, 5', SUBTRACT_WIDE_LOW.map(([a, b]) => subtractTwoTask(a, b)));
  const high = buildGroup('sub_wide_high', 'Вычесть 6, 7, 8, 9', SUBTRACT_WIDE_HIGH.map(([a, b]) => subtractTwoTask(a, b)));
  return { id: 'top_subtraction_wide', name: 'Вычитание: числа побольше', groups: [low, high] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE3_TOPICS: TopicSpec[] = [
  buildShareTopic(),
  ...MULTIPLICATION_TABLES.map((b) => buildMultiplicationTopic(b)),
  buildDivision67Topic(),
  buildDivision89Topic(),
  buildDivision10Topic(),
  buildAdditionCarryTopic(),
  buildSubtractionWideTopic(),
];

export function countWave3Tasks(): number {
  return WAVE3_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  const newTopics: Record<string, Topic> = { ...content.topics };
  const newGroups: Record<string, Group> = { ...content.groups };
  const newTasks: Record<string, Task> = { ...content.tasks };
  const newTopicIds: string[] = [];

  for (const topic of WAVE3_TOPICS) {
    if (newTopics[topic.id]) {
      throw new Error(`Topic id already exists, refusing to overwrite: ${topic.id}`);
    }
    const groupIds: string[] = [];
    for (const group of topic.groups) {
      if (newGroups[group.id]) {
        throw new Error(`Group id already exists, refusing to overwrite: ${group.id}`);
      }
      for (const task of group.tasks) {
        if (newTasks[task.id]) {
          throw new Error(`Task id already exists, refusing to overwrite: ${task.id}`);
        }
        newTasks[task.id] = task;
      }
      newGroups[group.id] = { id: group.id, name: group.name, taskIds: group.tasks.map((t) => t.id) };
      groupIds.push(group.id);
    }
    newTopics[topic.id] = { id: topic.id, name: topic.name, groupIds };
    newTopicIds.push(topic.id);
  }

  if (!content.sections.some((s) => s.id === ARITHMETIC_SECTION_ID)) {
    throw new Error(`Section ${ARITHMETIC_SECTION_ID} not found — cannot attach wave 3 topics`);
  }
  const newSections = content.sections.map((section) =>
    section.id === ARITHMETIC_SECTION_ID
      ? { ...section, topicIds: [...section.topicIds, ...newTopicIds] }
      : section,
  );

  return { ...content, sections: newSections, topics: newTopics, groups: newGroups, tasks: newTasks };
}
