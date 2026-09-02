// packages/shared/src/chrono/parse/rules/exactDate.ts
// Точные даты и голый год — самый частый ввод для хронолинии (спайк 0.3
// показал: именно это `chrono-node` не осилил вообще, ни в каком виде).
// Порядок правил внутри файла — от самого специфичного к самому общему,
// вызывающий код (index.ts) пробует их в этом же порядке.

import type { ChronoMoment } from '../../chronoMoment';
import { calendarDateTimeToCivilDay } from '../../calendar/civilDay';

const MONTH_NAME_TO_NUMBER: ReadonlyMap<string, number> = new Map([
  ['январь', 1], ['января', 1],
  ['февраль', 2], ['февраля', 2],
  ['март', 3], ['марта', 3],
  ['апрель', 4], ['апреля', 4],
  ['май', 5], ['мая', 5],
  ['июнь', 6], ['июня', 6],
  ['июль', 7], ['июля', 7],
  ['август', 8], ['августа', 8],
  ['сентябрь', 9], ['сентября', 9],
  ['октябрь', 10], ['октября', 10],
  ['ноябрь', 11], ['ноября', 11],
  ['декабрь', 12], ['декабря', 12],
]);

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // февраль — 29, невисокосность не проверяем на этапе распознавания (это проверит civilDay при реальном выходе за границу)

function isPlausibleDate(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1] && Number.isFinite(year);
}

/** Отделяет суффикс "до н.э." / "до нашей эры" в конце строки, не трогая остальное */
function stripBceSuffix(s: string): { core: string; isBce: boolean } {
  const m = /^(.+?)\s+до\s+(?:н\.?\s*э\.?|нашей\s+эры)$/.exec(s);
  if (!m) return { core: s, isBce: false };
  return { core: m[1], isBce: true };
}

/** Историческое число года ("44" в "44 до н.э.") → астрономическая нумерация */
function toAstronomicalYear(historicalYear: number, isBce: boolean): number {
  return isBce ? 1 - historicalYear : historicalYear;
}

function makeMoment(year: number, month: number, day: number, precision: 'day' | 'month' | 'year'): ChronoMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month, day }, 'gregorian'),
    precision,
    calendar: 'gregorian',
    approximate: false,
  };
}

/** 22.06.1941 / 22.6.1941 */
export function parseDotDate(input: string): ChronoMoment | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{1,5})$/.exec(input);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!isPlausibleDate(year, month, day)) return null;
  return makeMoment(year, month, day, 'day');
}

/** "22 июня 1941", "22 июня 1941 года", "22 июня 1941 г.", с опциональным "до н.э." */
export function parseDayMonthYear(input: string): ChronoMoment | null {
  const { core, isBce } = stripBceSuffix(input);
  const withoutSuffix = core.replace(/\s*(?:года?|г\.?)\s*$/, '').trim();

  const m = /^(\d{1,2}) ([а-яё]+) (\d{1,5})$/.exec(withoutSuffix);
  if (!m) return null;

  const day = Number(m[1]);
  const month = MONTH_NAME_TO_NUMBER.get(m[2]);
  if (month === undefined) return null;

  const year = toAstronomicalYear(Number(m[3]), isBce);
  if (!isPlausibleDate(year, month, day)) return null;
  return makeMoment(year, month, day, 'day');
}

/** "июнь 1941", "июня 1941 года" (без числа дня) */
export function parseMonthYear(input: string): ChronoMoment | null {
  const { core, isBce } = stripBceSuffix(input);
  const withoutSuffix = core.replace(/\s*(?:года?|г\.?)\s*$/, '').trim();

  const m = /^([а-яё]+) (\d{1,5})$/.exec(withoutSuffix);
  if (!m) return null;

  const month = MONTH_NAME_TO_NUMBER.get(m[1]);
  if (month === undefined) return null;

  const year = toAstronomicalYear(Number(m[2]), isBce);
  if (month < 1 || month > 12 || !Number.isFinite(year)) return null;
  return makeMoment(year, month, 1, 'month');
}

/** "1941", "1941 год", "1941 года", "1941 г.", "100 до н.э." */
export function parseYearOnly(input: string): ChronoMoment | null {
  const { core, isBce } = stripBceSuffix(input);
  const withoutSuffix = core.replace(/\s*(?:года?|г\.?)\s*$/, '').trim();

  const m = /^(-?\d{1,5})$/.exec(withoutSuffix);
  if (!m) return null;

  const rawYear = Number(m[1]);
  if (!Number.isFinite(rawYear)) return null;
  if (isBce && rawYear < 1) return null;

  const year = toAstronomicalYear(rawYear, isBce);
  return makeMoment(year, 1, 1, 'year');
}

/** Все правила этого файла, в порядке от специфичного к общему */
export const EXACT_DATE_RULES: ReadonlyArray<(input: string) => ChronoMoment | null> = [
  parseDotDate,
  parseDayMonthYear,
  parseMonthYear,
  parseYearOnly,
];
