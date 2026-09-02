// packages/shared/src/chrono/parse/types.ts
import type { ChronoMoment } from '../chronoMoment';

/**
 * "Сегодня" и календарно-относительные выражения ("10 лет назад", "через
 * 3 года") считаются от этой даты. НЕ используется опорной эпохой геологии
 * (EPOCH_REFERENCE_YEAR=1950, фиксирована) — это разные вещи: "10 лет
 * назад" сказанное сегодня учителем означает конкретный недавний
 * календарный год, а не геологическое время (см. rules/epochRelative.ts
 * про то, где проходит граница).
 */
export interface ParseContext {
  referenceDate: { year: number; month: number; day: number };
}

export type ParseResult =
  | { type: 'moment'; moment: ChronoMoment }
  | { type: 'range'; start: ChronoMoment; end: ChronoMoment }
  | { type: 'none' };

/** Одно правило: строка (уже нормализованная) → момент, либо null если не подошло */
export type MomentRule = (normalized: string, ctx: ParseContext) => ChronoMoment | null;
