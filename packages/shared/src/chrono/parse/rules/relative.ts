// packages/shared/src/chrono/parse/rules/relative.ts
// Слова, относительные к моменту ввода: "сегодня"/"вчера"/"завтра" и
// т.п. (день-точность), "N лет назад"/"через N лет" (год-точность,
// календарная арифметика — НЕ геологическая, см. epochRelative.ts про то,
// где именно проходит граница между "10 лет назад" и "10 млн лет назад").

import type { ChronoMoment } from '../../chronoMoment';
import type { ParseContext } from '../types';
import { calendarDateTimeToCivilDay } from '../../calendar/civilDay';

function yearMoment(year: number): ChronoMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month: 1, day: 1 }, 'gregorian'),
    precision: 'year',
    calendar: 'gregorian',
    approximate: false,
  };
}

const RELATIVE_DAY_OFFSETS: ReadonlyMap<string, number> = new Map([
  ['позавчера', -2],
  ['вчера', -1],
  ['сегодня', 0],
  ['сейчас', 0],
  ['завтра', 1],
  ['послезавтра', 2],
]);

/** "сегодня", "вчера", "позавчера", "завтра", "послезавтра", "сейчас" */
export function parseRelativeDay(input: string, ctx: ParseContext): ChronoMoment | null {
  const offset = RELATIVE_DAY_OFFSETS.get(input);
  if (offset === undefined) return null;

  const refCivil = calendarDateTimeToCivilDay(ctx.referenceDate, 'gregorian');
  return {
    kind: 'calendar',
    civilDay: { day: refCivil.day + offset, secondOfDay: 0 },
    precision: 'day',
    calendar: 'gregorian',
    approximate: false,
  };
}

const YEAR_WORD = '(?:лет|года?|годов)';

/** "10 лет назад", "1 год назад", "3 года назад" — год относительно referenceDate.year */
export function parseYearsAgo(input: string, ctx: ParseContext): ChronoMoment | null {
  const m = new RegExp(`^(\\d{1,4}) ${YEAR_WORD} назад$`).exec(input);
  if (!m) return null;
  const n = Number(m[1]);
  return yearMoment(ctx.referenceDate.year - n);
}

/** "через 3 года", "через 10 лет" */
export function parseInYears(input: string, ctx: ParseContext): ChronoMoment | null {
  const m = new RegExp(`^через (\\d{1,4}) ${YEAR_WORD}$`).exec(input);
  if (!m) return null;
  const n = Number(m[1]);
  return yearMoment(ctx.referenceDate.year + n);
}

export const RELATIVE_RULES: ReadonlyArray<(input: string, ctx: ParseContext) => ChronoMoment | null> = [
  parseRelativeDay,
  parseYearsAgo,
  parseInYears,
];
