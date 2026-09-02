// packages/shared/src/chrono/parse/index.ts
// Собственный парсер дат на русском языке по правилам — не библиотека.
// Решение принято по итогам спайка 0.3 (см. Хронолайнер_план_реализации.md,
// Фаза 0): chrono-node эмпирически не распознаёт голый год и интервал
// годами — самый частый ввод для хронолинии — ни в одной локали и ни в
// одной проверенной формулировке, а на непонятном вводе иногда молча
// возвращает бессмысленную дату вместо честного отказа. Домен «дата на
// школьной хронолинии» — узкий и предсказуемый набор паттернов, поэтому
// правила по категориям (как у эталона — 12 файлов правил) оказываются
// надёжнее общей NLP-библиотеки, не более дешёвым обходным путём.
//
// Правила пробуются в порядке: интервал → точные даты (от специфичного к
// общему) → относительные. Это порядок частотности, не приоритет —
// интервал проверяется первым просто потому, что его структурный маркер
// ("с … по …" / дефис) достаточно узнаваем, чтобы не путаться с
// одиночными датами.

import { normalizeRu } from './normalizeRu';
import type { ParseContext, ParseResult } from './types';
import { EXACT_DATE_RULES } from './rules/exactDate';
import { RELATIVE_RULES } from './rules/relative';
import { EPOCH_RELATIVE_RULES } from './rules/epochRelative';
import { parseRange } from './rules/range';

export type { ParseContext, ParseResult } from './types';

export function parseChronoInput(input: string, ctx: ParseContext): ParseResult {
  const normalized = normalizeRu(input);
  if (!normalized) return { type: 'none' };

  const range = parseRange(normalized, ctx);
  if (range) {
    return { type: 'range', start: range.start, end: range.end };
  }

  for (const rule of EXACT_DATE_RULES) {
    const moment = rule(normalized);
    if (moment) return { type: 'moment', moment };
  }

  for (const rule of RELATIVE_RULES) {
    const moment = rule(normalized, ctx);
    if (moment) return { type: 'moment', moment };
  }

  for (const rule of EPOCH_RELATIVE_RULES) {
    const moment = rule(normalized);
    if (moment) return { type: 'moment', moment };
  }

  return { type: 'none' };
}
