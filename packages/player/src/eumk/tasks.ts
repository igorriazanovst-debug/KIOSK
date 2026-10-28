// Проверка ответов на интерактивные практические задания (7 типов).
// Ответ приходит из UI, поэтому форма ответа не доверяется: любая
// неподходящая форма даёт «неверно», а не исключение.

import type { EumkTask } from './model/schema.ts';

export interface TaskCheck {
  isCorrect: boolean;
  // Доля верной части ответа, 0..1 (для заданий с частичным зачётом).
  share: number;
}

const WRONG: TaskCheck = { isCorrect: false, share: 0 };

function result(share: number): TaskCheck {
  const clamped = Math.max(0, Math.min(1, share));
  return { isCorrect: clamped === 1, share: clamped };
}

export function normalizeAnswerText(value: string, caseSensitive: boolean): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? trimmed : trimmed.toLowerCase().replace(/ё/g, 'е');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isIndexArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => Number.isInteger(v));
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every((v) => typeof v === 'string');
}

function checkChoice(correct: readonly number[], answer: unknown): TaskCheck {
  if (!isIndexArray(answer)) return WRONG;
  const chosen = new Set(answer);
  return result(chosen.size === 1 && chosen.has(correct[0]) ? 1 : 0);
}

function checkMulti(correct: readonly number[], answer: unknown): TaskCheck {
  if (!isIndexArray(answer)) return WRONG;
  const right = new Set(correct);
  const chosen = new Set(answer);
  let hits = 0;
  let misses = 0;
  for (const index of chosen) {
    if (right.has(index)) hits++;
    else misses++;
  }
  return result((hits - misses) / right.size);
}

function checkOrder(items: readonly string[], answer: unknown): TaskCheck {
  if (!isStringArray(answer)) return WRONG;
  if (answer.length !== items.length) return WRONG;
  const inPlace = items.filter((item, index) => answer[index] === item).length;
  return result(inPlace / items.length);
}

function checkSort(items: readonly { text: string; category: string }[], answer: unknown): TaskCheck {
  if (!isStringRecord(answer)) return WRONG;
  const right = items.filter((item) => answer[item.text] === item.category).length;
  return result(right / items.length);
}

function checkMatch(pairs: readonly (readonly [string, string])[], answer: unknown): TaskCheck {
  if (!isStringRecord(answer)) return WRONG;
  const right = pairs.filter(([left, rightText]) => answer[left] === rightText).length;
  return result(right / pairs.length);
}

function checkGaps(answers: readonly string[], answer: unknown): TaskCheck {
  if (!isStringArray(answer)) return WRONG;
  if (answer.length !== answers.length) return WRONG;
  const right = answers.filter((expected, index) => answer[index] === expected).length;
  return result(right / answers.length);
}

function checkInput(accepted: readonly string[], caseSensitive: boolean, answer: unknown): TaskCheck {
  if (typeof answer !== 'string') return WRONG;
  const given = normalizeAnswerText(answer, caseSensitive);
  if (given === '') return WRONG;
  return result(accepted.some((item) => normalizeAnswerText(item, caseSensitive) === given) ? 1 : 0);
}

export function checkTask(task: EumkTask, answer: unknown): TaskCheck {
  switch (task.type) {
    case 'choice': return checkChoice(task.data.correct, answer);
    case 'multi': return checkMulti(task.data.correct, answer);
    case 'order': return checkOrder(task.data.items, answer);
    case 'sort': return checkSort(task.data.items, answer);
    case 'match': return checkMatch(task.data.pairs, answer);
    case 'gaps': return checkGaps(task.data.answers, answer);
    case 'input': return checkInput(task.data.accepted, task.data.caseSensitive, answer);
  }
}
