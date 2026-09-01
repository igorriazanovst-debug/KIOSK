// packages/shared/src/chrono/parse/rules/range.ts
// Интервалы: "с X по Y" (у эталона работает) и "X - Y" через дефис (у
// эталона строка 33 разбора прямо отмечает: "1900 - 2000" НЕ разбирается,
// нужен предлог — это сознательное улучшение, дефис должен работать и у
// нас, дешёвое отличие в пользу продукта).

import type { ChronoMoment } from '../../chronoMoment';
import type { ParseContext } from '../types';
import { EXACT_DATE_RULES } from './exactDate';

function parseRangeEndpoint(input: string): ChronoMoment | null {
  const trimmed = input.trim();
  for (const rule of EXACT_DATE_RULES) {
    const result = rule(trimmed);
    if (result) return result;
  }
  return null;
}

export interface ParsedRange {
  start: ChronoMoment;
  end: ChronoMoment;
}

export function parseRange(input: string, _ctx: ParseContext): ParsedRange | null {
  const withMatch = /^с (.+) по (.+)$/.exec(input);
  if (withMatch) {
    const start = parseRangeEndpoint(withMatch[1]);
    const end = parseRangeEndpoint(withMatch[2]);
    if (start && end) return { start, end };
    return null;
  }

  const dashMatch = /^(.+?)\s*-\s*(.+)$/.exec(input);
  if (dashMatch) {
    const start = parseRangeEndpoint(dashMatch[1]);
    const end = parseRangeEndpoint(dashMatch[2]);
    if (start && end) return { start, end };
  }

  return null;
}
