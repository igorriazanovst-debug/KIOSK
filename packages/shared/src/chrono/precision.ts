// packages/shared/src/chrono/precision.ts
// Точность (детализация) момента времени в календарной ветке — до какого
// разряда дата значима. У эталона (ОС3 Хронолайнер) это поле называется
// detalization: указав только "1941", пользователь получает событие с
// точностью до года, а не 1 января (см. Хронолайнер_3.6.27_разбор.md, §4.1).
//
// Единицы упорядочены от мелкой к крупной. Геологическая ветка (миллионы/
// миллиарды лет) использует отдельный, гораздо более грубый набор единиц —
// см. epochPrecision в chronoMoment.ts, "месяц"/"день" там физически
// бессмысленны.

export const CALENDAR_PRECISIONS = [
  'second',
  'minute',
  'hour',
  'day',
  'month',
  'year',
  'decade',
  'century',
  'millennium',
] as const;

export type CalendarPrecision = (typeof CALENDAR_PRECISIONS)[number];

const ORDER = new Map<CalendarPrecision, number>(CALENDAR_PRECISIONS.map((p, i) => [p, i]));

function orderOf(p: CalendarPrecision): number {
  const order = ORDER.get(p);
  if (order === undefined) {
    throw new Error(`Unknown calendar precision: ${String(p)}`);
  }
  return order;
}

/** true, если a грубее (крупнее по разряду), чем b — например 'year' грубее 'day' */
export function isCoarserThan(a: CalendarPrecision, b: CalendarPrecision): boolean {
  return orderOf(a) > orderOf(b);
}

/** true, если a точнее (мельче по разряду), чем b */
export function isFinerThan(a: CalendarPrecision, b: CalendarPrecision): boolean {
  return orderOf(a) < orderOf(b);
}

/**
 * Более грубая из двух точностей — нужна при сравнении/агрегации дат разной
 * детализации (например, при вычислении общей точности интервала, у которого
 * начало известно до дня, а конец — только до года).
 */
export function coarserOf(a: CalendarPrecision, b: CalendarPrecision): CalendarPrecision {
  return orderOf(a) >= orderOf(b) ? a : b;
}

export function isValidCalendarPrecision(value: unknown): value is CalendarPrecision {
  return typeof value === 'string' && ORDER.has(value as CalendarPrecision);
}
