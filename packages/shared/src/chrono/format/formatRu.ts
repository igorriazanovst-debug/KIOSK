// packages/shared/src/chrono/format/formatRu.ts
// Форматирование ChronoMoment/ChronoInterval в русский текст, с учётом
// precision (строка 25 ТЗ — обязательное подписание с учётом детализации)
// и "до н.э."/приблизительности/старого стиля (строка 26 ТЗ).
//
// Нумерация года — астрономическая внутри модели, историческая только
// здесь, в слое отображения (решение архитектурного ревью, Фаза 2): год 0
// = "1 год до н.э.", год -1 = "2 год до н.э.".
//
// Упрощение, принятое сознательно: номер века/тысячелетия для дат до н.э.
// считается по формуле "историческое рассуждение назад от года 1 до н.э.",
// без выверки классических пограничных случаев историографии (тонкости
// нумерации веков до н.э. в источниках расходятся). Для календарной эры
// (год > 0) номер века/тысячелетия точен и соответствует формальному
// определению (XX век = 1901-2000).

import { civilDayToCalendarDateTime } from '../calendar/civilDay';
import type { ChronoMoment, CalendarMoment, EpochMoment } from '../chronoMoment';
import type { ChronoInterval } from '../chronoInterval';
import { APPROX_YEARS_PER_UNIT, type EpochPrecision } from '../precision';

const MONTH_NOMINATIVE = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const;

const MONTH_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

const ROMAN_TABLE: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Целое положительное число → римские цифры (1..3999) */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError(`toRoman: ${n} is out of range 1..3999`);
  }
  let remaining = n;
  let result = '';
  for (const [value, symbol] of ROMAN_TABLE) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Астрономический год → строка с историческим "до н.э." при необходимости */
function formatYear(year: number): string {
  return year <= 0 ? `${1 - year} до н.э.` : `${year}`;
}

/** Номер века (формально точен для year > 0; для year <= 0 — см. заголовок файла) */
function centuryNumber(year: number): number {
  return year > 0 ? Math.ceil(year / 100) : Math.ceil((1 - year) / 100);
}

function millenniumNumber(year: number): number {
  return year > 0 ? Math.ceil(year / 1000) : Math.ceil((1 - year) / 1000);
}

export function formatCalendarMoment(m: CalendarMoment): string {
  const dt = civilDayToCalendarDateTime(m.civilDay, m.calendar);
  const isBce = dt.year <= 0;
  const bceSuffix = isBce ? ' до н.э.' : '';

  let core: string;
  switch (m.precision) {
    case 'year':
      core = formatYear(dt.year);
      break;
    case 'month':
      core = `${MONTH_NOMINATIVE[dt.month - 1]} ${formatYear(dt.year)}`;
      break;
    case 'day':
      core = `${dt.day} ${MONTH_GENITIVE[dt.month - 1]} ${formatYear(dt.year)}`;
      break;
    case 'hour':
      core = `${dt.day} ${MONTH_GENITIVE[dt.month - 1]} ${formatYear(dt.year)}, ${pad2(dt.hour)}:00`;
      break;
    case 'minute':
      core = `${dt.day} ${MONTH_GENITIVE[dt.month - 1]} ${formatYear(dt.year)}, ${pad2(dt.hour)}:${pad2(dt.minute)}`;
      break;
    case 'second':
      core = `${dt.day} ${MONTH_GENITIVE[dt.month - 1]} ${formatYear(dt.year)}, ${pad2(dt.hour)}:${pad2(dt.minute)}:${pad2(dt.second)}`;
      break;
    case 'decade': {
      const decadeStart = Math.floor(dt.year / 10) * 10;
      core = isBce ? `${1 - decadeStart}-е до н.э.` : `${decadeStart}-е`;
      break;
    }
    case 'century':
      core = `${toRoman(centuryNumber(dt.year))} век${bceSuffix}`;
      break;
    case 'millennium':
      core = `${toRoman(millenniumNumber(dt.year))} тысячелетие${bceSuffix}`;
      break;
  }

  const calendarSuffix = m.calendar === 'julian' ? ' (по старому стилю)' : '';
  const approxPrefix = m.approximate ? 'приблизительно ' : '';
  return `${approxPrefix}${core}${calendarSuffix}`;
}

export const EPOCH_UNIT_WORD: Record<EpochPrecision, string> = {
  millennium: 'тыс. лет',
  tenThousandYears: 'тыс. лет',
  hundredThousandYears: 'тыс. лет',
  millionYears: 'млн лет',
  tenMillionYears: 'млн лет',
  hundredMillionYears: 'млн лет',
  billionYears: 'млрд лет',
};

export const EPOCH_UNIT_DIVISOR: Record<EpochPrecision, number> = {
  millennium: 1_000,
  tenThousandYears: 1_000,
  hundredThousandYears: 1_000,
  millionYears: 1_000_000,
  tenMillionYears: 1_000_000,
  hundredMillionYears: 1_000_000,
  billionYears: 1_000_000_000,
};

export function formatEpochMoment(m: EpochMoment): string {
  const scaled = m.yearsBeforeEpoch / EPOCH_UNIT_DIVISOR[m.precision];
  // Убираем незначащий хвост (65.000000001 -> "65"), но сохраняем реальную
  // дробность там, где она есть (4.5 млрд лет).
  const rounded = Math.round(scaled * 100) / 100;
  const approxPrefix = m.approximate ? '~' : '';
  return `${approxPrefix}${rounded} ${EPOCH_UNIT_WORD[m.precision]} назад`;
}

export function formatMoment(m: ChronoMoment): string {
  return m.kind === 'calendar' ? formatCalendarMoment(m) : formatEpochMoment(m);
}

/** "с X по Y" / "X — по настоящее время" (строка 26 ТЗ — не материализуется конкретной датой) */
export function formatInterval(interval: ChronoInterval): string {
  const startStr = formatMoment(interval.start);
  if (interval.end === null) {
    return `${startStr} — по настоящее время`;
  }
  return `с ${startStr} по ${formatMoment(interval.end)}`;
}
