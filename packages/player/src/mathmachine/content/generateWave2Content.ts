// Offline-генератор контента Этапа 2b, волна 2 (спека
// docs/superpowers/specs/2026-09-08-mathmachine-content-wave2-design.md).
// Тот же принцип, что и в волне 1 (generateWave1Content.ts) — чистые
// функции, детерминированное перечисление без RNG, файловый ввод-вывод
// вынесен в отдельный runGenerateWave2.ts. В отличие от волны 1, вариация
// позиции правильного ответа в группах с выбором заложена с первого
// коммита (финальное ревью волны 1 нашло, что фиксированная позиция
// позволяла решать задания без чтения условия — там это чинилось
// отдельным фикс-раундом постфактум). Хелперы buildGroup/rotate
// продублированы, а не импортированы из generateWave1Content.ts — каждый
// скрипт волны самодостаточен.

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
// correctAnswer — строка "частное ост. остаток", не число (составной
// ответ не укладывается в единственное числовое поле ввода). Позиция
// правильного варианта среди трёх вариантов-строк варьируется по
// positionIndex С ПЕРВОГО КОММИТА. Пары (a,b) подобраны так, чтобы
// частное было >= 1 (иначе вариант "частное-1" выглядел бы отрицательным)
// и остаток был ненулевым (эта волна учит именно наличию остатка).

function formatDivision(quotient: number, remainder: number): string {
  return `${quotient} ост. ${remainder}`;
}

function divideTask(a: number, b: number, positionIndex: number): Omit<Task, 'id'> {
  const quotient = Math.floor(a / b);
  const remainder = a % b;
  const correct = formatDivision(quotient, remainder);
  const decoyRemainder = formatDivision(quotient, (remainder + 1) % b);
  const decoyQuotient = formatDivision(quotient - 1, remainder);
  const options = [correct, decoyRemainder, decoyQuotient];
  const choices = rotate(options, positionIndex);
  return {
    typeId: 'number_divide_remainder',
    text: `Сколько будет ${a} разделить на ${b}?`,
    params: { a, b },
    correctAnswer: correct,
    choices,
  };
}

const DIVISION_PAIRS_23: [number, number][] = [
  [5, 2], [7, 2], [9, 2], [11, 2],
  [7, 3], [8, 3], [10, 3], [11, 3],
];
const DIVISION_PAIRS_45: [number, number][] = [
  [9, 4], [11, 4], [13, 4], [14, 4],
  [7, 5], [8, 5], [12, 5], [13, 5],
];

function buildDivisionTopic(): TopicSpec {
  const div23 = buildGroup(
    'div_23',
    'Деление на 2 и 3',
    DIVISION_PAIRS_23.map(([a, b], i) => divideTask(a, b, i)),
  );
  const div45 = buildGroup(
    'div_45',
    'Деление на 4 и 5',
    DIVISION_PAIRS_45.map(([a, b], i) => divideTask(a, b, i)),
  );
  return { id: 'top_division', name: 'Деление', groups: [div23, div45] };
}

// ─── Кратные (16 заданий: 8 + 8) ────────────────────────────────────────
// Дистракторы — correct±1: два соседних целых не могут оба делиться на
// n>=2, поэтому дистракторы всегда корректны без отдельной проверки на
// генерацию (но проверяются тестом всё равно — дешёвая перепроверка).
// Позиция правильного варианта варьируется по positionIndex С ПЕРВОГО
// КОММИТА.

function multipleTask(n: number, k: number, positionIndex: number): Omit<Task, 'id'> {
  const correct = n * k;
  const options = [correct, correct + 1, correct - 1];
  const choices = rotate(options, positionIndex);
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
    for (let k = 2; k <= 5; k++) tasks23.push(multipleTask(n, k, tasks23.length));
  });
  const group23 = buildGroup('kratn_23', 'Кратные 2 и 3', tasks23);

  const tasks45: Omit<Task, 'id'>[] = [];
  [4, 5].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks45.push(multipleTask(n, k, tasks45.length));
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
  const newTopics: Record<string, Topic> = { ...content.topics };
  const newGroups: Record<string, Group> = { ...content.groups };
  const newTasks: Record<string, Task> = { ...content.tasks };
  const newTopicIds: string[] = [];

  for (const topic of WAVE2_TOPICS) {
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
    throw new Error(`Section ${ARITHMETIC_SECTION_ID} not found — cannot attach wave 2 topics`);
  }
  const newSections = content.sections.map((section) =>
    section.id === ARITHMETIC_SECTION_ID
      ? { ...section, topicIds: [...section.topicIds, ...newTopicIds] }
      : section,
  );

  return { ...content, sections: newSections, topics: newTopics, groups: newGroups, tasks: newTasks };
}
