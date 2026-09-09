// Общие чистые хелперы offline-генераторов контента Этапа 2b
// (generateWave1/2/3Content.ts). Раньше каждый генератор дублировал эти
// функции по себе (осознанное решение спеки волны 2, разд. 3 — «каждый
// скрипт волны самодостаточен») — при переделке Эпика 12 (2026-09-09)
// правки приходилось вносить в 2-3 местах одновременно (см.
// Тип6_бэклог.md, «Не сделано/открыто по Этапу 2b волна 3»: «пересмотр
// по-прежнему нужен ПЕРЕД волной 4»). Волны сами по себе (какие задания,
// какие темы, какие числовые диапазоны) остаются в generateWaveNContent.ts
// каждой волны — здесь только чистая инфраструктура, идентичная во всех.

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

export function buildGroup(idPrefix: string, name: string, tasks: Omit<Task, 'id'>[]): GroupSpec {
  const builtTasks: Task[] = tasks.map((t, i) => ({
    ...t,
    id: i === 0 ? `${idPrefix}_intro` : `${idPrefix}_${i}`,
  }));
  return { id: `grp_${idPrefix}`, name, tasks: builtTasks };
}

export function rotate<T>(arr: T[], shift: number): T[] {
  const n = arr.length;
  const s = ((shift % n) + n) % n;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

// ─── Хэш содержания задания (FNV-1a + avalanche-перемешивание) ──────────
// Не криптографический — единственная цель: разные (соль, params) должны
// давать разные, невыводимые из номера-задания-в-группе значения. Соль
// разделяет назначение хэша (позиция кнопки / порядок слов в тексте /
// выбор дистрактора / схема дистракторов), чтобы эти оси не совпадали
// друг с другом.

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function avalanche(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function contentHash(salt: string, parts: (number | string)[]): number {
  return avalanche(fnv1a(salt + '|' + parts.join(',')));
}

// ─── Деление с остатком — общая схема дистракторов ──────────────────────
// Используется волнами 2 и 3 (волна 1 не содержит деления). Оба
// дистрактора раньше держали ЛИБО то же частное, ЛИБО тот же остаток, что
// верный ответ — «большинство по частному»+«большинство по остатку» по
// отдельности решали задание без единого деления (класс дефекта F2,
// Эпик 12). Эта схема (4 циклических варианта смещений) проверена против
// полной батареи структурных эвристик в обеих волнах.

export const DIVISION_DECOY_SCHEMES: [number, number][][] = [
  [[0, 1], [-1, 0]],
  [[-1, 1], [-1, 2]],
  [[0, 1], [1, 1]],
  [[-1, 1], [1, 2]],
];

export function formatDivision(quotient: number, remainder: number): string {
  return `${quotient} ост. ${remainder}`;
}

// ─── Категориальные параметры Этапа 4 ───────────────────────────────────
// TaskParamsSchema допускает только number | number[] (не строки) — общие
// упорядоченные списки, чтобы generateFR022Group2Content.ts и
// TaskVisual.tsx кодировали/декодировали один и тот же индекс одинаково.

export const SHAPE_IDS = ['circle', 'square', 'triangle', 'rectangle', 'pentagon', 'hexagon'] as const;
export const SOLID_IDS = ['cube', 'sphere', 'cone', 'cylinder', 'pyramid'] as const;
export const POSITION_RELATION_IDS = ['left', 'right', 'above', 'below'] as const;
export const DIRECTION_IDS = ['up', 'down', 'left', 'right'] as const;

/**
 * Соли передаются явно вызывающей волной (не берутся из общего дефолта) —
 * так подобранная и проверенная для конкретной волны соль остаётся видна
 * и неизменна на месте вызова, а не спрятана в общем модуле, где её было
 * бы легко случайно сделать общей для нескольких волн сразу.
 */
export function divideTask(a: number, b: number, schemeSalt: string, positionSalt: string): Omit<Task, 'id'> {
  const quotient = Math.floor(a / b);
  const remainder = a % b;
  const correct = formatDivision(quotient, remainder);
  const schemeIdx = contentHash(schemeSalt, [a, b]) % DIVISION_DECOY_SCHEMES.length;
  const scheme = DIVISION_DECOY_SCHEMES[schemeIdx];
  if (scheme.some(([dq]) => quotient + dq < 1)) {
    throw new Error(`Division decoy quotient would fall below 1 for ${a}:${b} — pick a pair with a bigger quotient`);
  }
  const options = [correct, ...scheme.map(([dq, dr]) => formatDivision(quotient + dq, ((remainder + dr) % b + b) % b))];
  if (new Set(options).size !== 3) {
    throw new Error(`Division decoys collided for ${a}:${b} — options: ${options.join(' | ')}`);
  }
  const posShift = contentHash(positionSalt, [a, b]);
  const choices = rotate(options, posShift);
  return {
    typeId: 'number_divide_remainder',
    text: `Сколько будет ${a} разделить на ${b}?`,
    params: { a, b },
    correctAnswer: correct,
    choices,
  };
}

// ─── Слияние тем волны в общий MathMachineContent ───────────────────────
// Идентичная во всех волнах логика: добавить новые темы/группы/задания,
// отказавшись вместо тихой перезаписи при коллизии id, дописать topicIds
// в существующую секцию.

export function mergeWaveIntoContent(
  content: MathMachineContent,
  waveTopics: TopicSpec[],
  sectionId: string,
): MathMachineContent {
  const newTopics: Record<string, Topic> = { ...content.topics };
  const newGroups: Record<string, Group> = { ...content.groups };
  const newTasks: Record<string, Task> = { ...content.tasks };
  const newTopicIds: string[] = [];

  for (const topic of waveTopics) {
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

  if (!content.sections.some((s) => s.id === sectionId)) {
    throw new Error(`Section ${sectionId} not found — cannot attach wave topics`);
  }
  const newSections = content.sections.map((section) =>
    section.id === sectionId ? { ...section, topicIds: [...section.topicIds, ...newTopicIds] } : section,
  );

  return { ...content, sections: newSections, topics: newTopics, groups: newGroups, tasks: newTasks };
}
