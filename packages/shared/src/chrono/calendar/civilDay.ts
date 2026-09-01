// packages/shared/src/chrono/calendar/civilDay.ts
// Целочисленное хранение календарного момента — { day: int, secondOfDay: int }
// поверх дробного JDN из jdn.ts. Решение архитектурного ревью (Б2,
// Хронолайнер_план_реализации.md, Фаза 2):
//
//   1. JDN начинается в полдень (0.5 = полночь) — классический источник
//      ошибки на полсуток при работе с дробным числом напрямую.
//   2. Дробные секунды суток не представимы в двоичном виде точно —
//      цикл drag → автосохранение (debounce) → загрузка → снова drag
//      (Фаза 3) накапливает float-дрейф, и события начинают видимо съезжать
//      после нескольких сессий редактирования.
//   3. Целые числа сравниваются на равенство точно — нужно для "та же
//      дата", дедупликации, сравнения снимков undo/redo, определения
//      "документ изменился" для автосохранения.
//
// day — гражданские сутки: JDN во ВРЕМЯ ПОЛУНОЧИ этих суток, округлённое
// до целого (переход в полночь, не в полдень, в отличие от сырого JDN).
// secondOfDay — 0..86399, секунды от начала этих же суток.

import {
  calendarToJdn,
  jdnToCalendar,
  type CalendarDateTimeParts,
  type CalendarSystem,
} from './jdn';

export interface CivilDayTime {
  /** Гражданские сутки — JDN в полночь, целое число */
  day: number;
  /** Секунды от начала суток, 0..86399 */
  secondOfDay: number;
}

/** Календарная дата+время → { day, secondOfDay }. Оба поля — целые числа. */
export function calendarDateTimeToCivilDay(
  parts: CalendarDateTimeParts,
  calendar: CalendarSystem
): CivilDayTime {
  // calendarToJdn с целым day (без времени) даёт JDN ровно в ПОЛНОЧЬ начала
  // этих суток (JDN считается от полудня, поэтому "midnight JDN" = "noon JDN
  // предыдущих полусуток" = calendarToJdn(...).5 меньше, чем в полдень).
  const midnightJdn = calendarToJdn({ year: parts.year, month: parts.month, day: parts.day }, calendar);
  const day = Math.round(midnightJdn + 0.5);

  const rawSeconds =
    (parts.hour ?? 0) * 3600 + (parts.minute ?? 0) * 60 + (parts.second ?? 0);
  let secondOfDay = Math.round(rawSeconds);

  let carryDay = 0;
  if (secondOfDay >= 86400) {
    secondOfDay -= 86400;
    carryDay = 1;
  } else if (secondOfDay < 0) {
    // Не ожидается от корректного ввода, но не должно тихо портить данные
    throw new RangeError(`Negative time of day: ${rawSeconds}s`);
  }

  return { day: day + carryDay, secondOfDay };
}

/** { day, secondOfDay } → календарная дата+время (целые год/месяц/день/час/минута/секунда) */
export function civilDayToCalendarDateTime(
  civilDay: CivilDayTime,
  calendar: CalendarSystem
): Required<CalendarDateTimeParts> {
  const midnightJdn = civilDay.day - 0.5;
  const { year, month, day } = jdnToCalendar(midnightJdn, calendar);
  // day здесь должен быть целым (полночь ровно на границе суток) — Math.round
  // страхует от последнего бита погрешности double, не от реальной дроби.
  const dayInt = Math.round(day);

  const hour = Math.floor(civilDay.secondOfDay / 3600);
  const minute = Math.floor(civilDay.secondOfDay / 60) % 60;
  const second = civilDay.secondOfDay % 60;

  return { year, month, day: dayInt, hour, minute, second };
}

/** true, если a и b — один и тот же гражданский момент (точное целочисленное сравнение) */
export function civilDayTimeEquals(a: CivilDayTime, b: CivilDayTime): boolean {
  return a.day === b.day && a.secondOfDay === b.secondOfDay;
}

/** -1 | 0 | 1 — точное целочисленное сравнение двух моментов внутри одной календарной ветки */
export function compareCivilDayTime(a: CivilDayTime, b: CivilDayTime): -1 | 0 | 1 {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  if (a.secondOfDay !== b.secondOfDay) return a.secondOfDay < b.secondOfDay ? -1 : 1;
  return 0;
}
