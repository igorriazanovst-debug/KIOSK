// packages/shared/src/chrono/chronoDuration.ts
// Длительность — третья часть трио (правка Б4 архитектурного ревью,
// Хронолайнер_план_реализации.md, Фаза 2). Ветвление ЗЕРКАЛИТ ChronoMoment,
// с явным правилом деградации при смешивании веток — выражается в годах
// через общую ось (axis.ts). Это прямо нужно для измерения промежутка между
// событиями, в т.ч. из разных линий (строка 35 ТЗ) — то, что эталон
// (ОС3 Хронолайнер) не осилил (см. Хронолайнер_3.6.27_разбор.md, строка 35:
// расчёт живёт только внутри активной линии). Спроектировав ветвление
// длительности сразу вместе с моментом, а не после, стыковка в Фазе 6
// получается бесплатно, а не переделкой.
//
// Значения ChronoDuration — вычисляемые/отображаемые (статус-бар, "Среднее",
// "Сумма"), не хранятся в документе проекта — поэтому, в отличие от
// ChronoMoment, дробные значения здесь нормальны (у момента дробность в
// хранилище запрещена ради точного round-trip, у производной длительности
// такого требования нет).

import { toAxisYears } from './axis';
import type { ChronoMoment } from './chronoMoment';

export type ChronoDuration =
  | { kind: 'calendar'; days: number }
  | { kind: 'epoch'; years: number }
  /** Деградированное значение — момента разных веток либо агрегат смешанного набора */
  | { kind: 'axisYears'; years: number };

const DAYS_PER_YEAR = 365.25;

export function durationToYears(d: ChronoDuration): number {
  if (d.kind === 'calendar') return d.days / DAYS_PER_YEAR;
  return d.years;
}

/**
 * Длительность между двумя моментами (всегда неотрицательная — порядок
 * аргументов не важен, как "Продолжительность:" у эталона). Внутри одной
 * ветки — точное значение; между ветками — деградирует до axisYears.
 */
export function durationBetween(a: ChronoMoment, b: ChronoMoment): ChronoDuration {
  if (a.kind === 'calendar' && b.kind === 'calendar') {
    return { kind: 'calendar', days: Math.abs(a.civilDay.day - b.civilDay.day) };
  }
  if (a.kind === 'epoch' && b.kind === 'epoch') {
    return { kind: 'epoch', years: Math.abs(a.yearsBeforeEpoch - b.yearsBeforeEpoch) };
  }
  return { kind: 'axisYears', years: Math.abs(toAxisYears(a) - toAxisYears(b)) };
}

/**
 * Сумма набора длительностей. Если все одной ветки — остаётся точной в её
 * единицах; иначе деградирует до axisYears (правило смешивания).
 */
export function sumDurations(durations: readonly ChronoDuration[]): ChronoDuration {
  if (durations.length === 0) return { kind: 'axisYears', years: 0 };

  if (durations.every((d) => d.kind === 'calendar')) {
    const totalDays = durations.reduce((sum, d) => sum + (d as { days: number }).days, 0);
    return { kind: 'calendar', days: totalDays };
  }

  if (durations.every((d) => d.kind === 'epoch')) {
    const totalYears = durations.reduce((sum, d) => sum + (d as { years: number }).years, 0);
    return { kind: 'epoch', years: totalYears };
  }

  const totalYears = durations.reduce((sum, d) => sum + durationToYears(d), 0);
  return { kind: 'axisYears', years: totalYears };
}

/** Среднее набора длительностей — та же логика сохранения/деградации ветки, что и sumDurations */
export function averageDuration(durations: readonly ChronoDuration[]): ChronoDuration {
  if (durations.length === 0) return { kind: 'axisYears', years: 0 };

  const total = sumDurations(durations);
  const n = durations.length;

  if (total.kind === 'calendar') return { kind: 'calendar', days: total.days / n };
  if (total.kind === 'epoch') return { kind: 'epoch', years: total.years / n };
  return { kind: 'axisYears', years: total.years / n };
}
