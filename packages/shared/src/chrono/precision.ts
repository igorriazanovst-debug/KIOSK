// packages/shared/src/chrono/precision.ts
// Точность (детализация) момента времени — до какого разряда дата значима.
// У эталона (ОС3 Хронолайнер) это поле называется detalization: указав
// только "1941", пользователь получает событие с точностью до года, а не
// 1 января (см. Хронолайнер_3.6.27_разбор.md, §4.1).
//
// ЕДИНАЯ упорядоченная лестница на весь диапазон — от секунд до миллиардов
// лет, а не два непересекающихся перечисления. Это решение архитектурного
// ревью (Б3, см. Хронолайнер_план_реализации.md, Фаза 2): генератор делений
// шкалы (Фаза 3) работает с одной монотонной лестницей единиц, и два
// enum'а заставили бы его иметь ветвление там, где предметно ветвления нет.
//
// Ветка (календарная/геологическая, см. chronoMoment.ts) определяет, каким
// НОСИТЕЛЕМ хранится значение, а не то, насколько оно грубое — тег ветки
// и precision ортогональны. Зона перекрытия начинается с 'millennium':
// и календарный момент, и геологический могут иметь точность 'millennium',
// и конверсия между ветками в этой зоне точна (1000 лет — ровно 1000 лет
// в обеих).

export const PRECISION_LADDER = [
  'second',
  'minute',
  'hour',
  'day',
  'month',
  'year',
  'decade',
  'century',
  'millennium',
  'tenThousandYears',
  'hundredThousandYears',
  'millionYears',
  'tenMillionYears',
  'hundredMillionYears',
  'billionYears',
] as const;

export type Precision = (typeof PRECISION_LADDER)[number];

/** Единицы, допустимые у календарной ветки (CalendarMoment) — до millennium включительно */
export const CALENDAR_PRECISIONS = [
  'second', 'minute', 'hour', 'day', 'month', 'year', 'decade', 'century', 'millennium',
] as const satisfies readonly Precision[];

export type CalendarPrecision = (typeof CALENDAR_PRECISIONS)[number];

/** Единицы, допустимые у геологической ветки (EpochMoment) — от millennium (зона перекрытия) и грубее */
export const EPOCH_PRECISIONS = [
  'millennium',
  'tenThousandYears',
  'hundredThousandYears',
  'millionYears',
  'tenMillionYears',
  'hundredMillionYears',
  'billionYears',
] as const satisfies readonly Precision[];

export type EpochPrecision = (typeof EPOCH_PRECISIONS)[number];

/** Грубая оценка "сколько примерно лет" в одной единице — для генератора делений шкалы (Фаза 3) */
export const APPROX_YEARS_PER_UNIT: Record<Precision, number> = {
  second: 1 / (365.25 * 86400),
  minute: 1 / (365.25 * 24 * 60),
  hour: 1 / (365.25 * 24),
  day: 1 / 365.25,
  month: 1 / 12,
  year: 1,
  decade: 10,
  century: 100,
  millennium: 1_000,
  tenThousandYears: 10_000,
  hundredThousandYears: 100_000,
  millionYears: 1_000_000,
  tenMillionYears: 10_000_000,
  hundredMillionYears: 100_000_000,
  billionYears: 1_000_000_000,
};

const ORDER = new Map<Precision, number>(PRECISION_LADDER.map((p, i) => [p, i]));
const CALENDAR_SET = new Set<Precision>(CALENDAR_PRECISIONS);
const EPOCH_SET = new Set<Precision>(EPOCH_PRECISIONS);

function orderOf(p: Precision): number {
  const order = ORDER.get(p);
  if (order === undefined) {
    throw new Error(`Unknown precision: ${String(p)}`);
  }
  return order;
}

/** true, если a грубее (крупнее по разряду), чем b — например 'year' грубее 'day' */
export function isCoarserThan(a: Precision, b: Precision): boolean {
  return orderOf(a) > orderOf(b);
}

/** true, если a точнее (мельче по разряду), чем b */
export function isFinerThan(a: Precision, b: Precision): boolean {
  return orderOf(a) < orderOf(b);
}

/**
 * Более грубая из двух точностей — нужна при сравнении/агрегации дат разной
 * детализации (например, при вычислении общей точности интервала, у которого
 * начало известно до дня, а конец — только до года).
 */
export function coarserOf(a: Precision, b: Precision): Precision {
  return orderOf(a) >= orderOf(b) ? a : b;
}

export function isValidPrecision(value: unknown): value is Precision {
  return typeof value === 'string' && ORDER.has(value as Precision);
}

export function isValidForCalendarBranch(p: Precision): p is CalendarPrecision {
  return CALENDAR_SET.has(p);
}

export function isValidForEpochBranch(p: Precision): p is EpochPrecision {
  return EPOCH_SET.has(p);
}
