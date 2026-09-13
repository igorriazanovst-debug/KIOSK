// packages/shared/src/alphabet/game/statistics.ts
// Статистика по буквам: две пары показателей на букву у каждого пользователя —
// последняя сессия и накопленный итог.
//
// Так устроено у эталона, и это правильнее, чем одна ступень достижения на
// тему в «Я знаю много слов»: педагогу нужно и то и другое — общий итог
// показывает прогресс за месяцы, последняя сессия — сегодняшнее занятие.
//
// ГЛАВНОЕ ПРАВИЛО СЛИЯНИЯ: «последняя сессия» ЗАМЕЩАЕТСЯ, «итог»
// НАКАПЛИВАЕТСЯ. Перепутать легко, а последствия неприятны в обе стороны:
// накапливаемая «последняя сессия» перестаёт отвечать на вопрос «как прошло
// занятие», а замещаемый итог теряет историю безвозвратно.
//
// Буквы, которых в партии не было, из «последней сессии» ОБНУЛЯЮТСЯ, а не
// сохраняются с прошлого раза: иначе на графике сегодняшнего занятия висят
// вчерашние столбики, и объяснить родителю такой график нечем.

import type { LetterScore, Statistics } from '../model/schema';
import type { LetterAnswer } from './session';

/** Пустой результат — пара «верно / всего» */
const ZERO: LetterScore = { lastSession: [0, 0], total: [0, 0] };

/** Свод ответов одной партии в пары «верно / всего» по буквам */
export function tallyAnswers(answers: readonly LetterAnswer[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const { letterNumber, correct } of answers) {
    const key = String(letterNumber);
    const pair = out[key] ?? [0, 0];
    out[key] = [pair[0] + (correct ? 1 : 0), pair[1] + 1];
  }
  return out;
}

/**
 * Вписывает результаты партии одного игрока в общую статистику.
 * Возвращает НОВЫЙ объект: исходный не меняется.
 */
export function mergeSessionStatistics(
  statistics: Statistics,
  userId: string,
  answers: readonly LetterAnswer[]
): Statistics {
  const session = tallyAnswers(answers);
  const previous = statistics[userId] ?? {};
  const merged: Record<string, LetterScore> = {};

  // Буквы, встречавшиеся когда-либо: старые сохраняют итог, но теряют сессию
  for (const [key, score] of Object.entries(previous)) {
    merged[key] = { lastSession: [0, 0], total: score.total };
  }

  for (const [key, pair] of Object.entries(session)) {
    const before = merged[key] ?? ZERO;
    merged[key] = {
      lastSession: pair,
      total: [before.total[0] + pair[0], before.total[1] + pair[1]],
    };
  }

  return { ...statistics, [userId]: merged };
}

/** Забыть результаты одного пользователя — действие педагога, не автоматика */
export function clearUserStatistics(statistics: Statistics, userId: string): Statistics {
  const out = { ...statistics };
  delete out[userId];
  return out;
}

export interface LetterChartRow {
  letterNumber: number;
  /** Доля верных за последнюю сессию, 0..1; null — за сессию буква не встречалась */
  lastSession: number | null;
  /** Доля верных за всё время; null — буква не встречалась никогда */
  total: number | null;
  lastSessionAnswers: number;
  totalAnswers: number;
}

/**
 * Строки для столбчатой диаграммы: все 33 буквы в алфавитном порядке, включая
 * те, которых у ребёнка ещё не было.
 *
 * Пустая буква даёт null, а НЕ ноль. Ноль на графике читается как «отвечал и
 * всё неверно» — ровно противоположно правде «ещё не отвечал», и педагог по
 * такому графику примет неверное решение о том, что повторять.
 */
export function letterChartRows(
  statistics: Statistics,
  userId: string,
  letterNumbers: readonly number[]
): LetterChartRow[] {
  const scores = statistics[userId] ?? {};
  return letterNumbers.map((letterNumber) => {
    const score = scores[String(letterNumber)];
    const last = score?.lastSession ?? [0, 0];
    const total = score?.total ?? [0, 0];
    return {
      letterNumber,
      lastSession: last[1] > 0 ? last[0] / last[1] : null,
      total: total[1] > 0 ? total[0] / total[1] : null,
      lastSessionAnswers: last[1],
      totalAnswers: total[1],
    };
  });
}
