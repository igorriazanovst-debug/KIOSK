// packages/shared/src/chrono/calendar/jdn.ts
// Конверсия календарная дата ↔ юлианский день (JDN) — стандартный алгоритм
// Мееса (Jean Meeus, "Astronomical Algorithms", гл. 7), корректно работает
// для проэктированного (proleptic) григорианского и юлианского календарей,
// включая отрицательные годы (см. годовая нумерация ниже).
//
// JDN — непрерывная числовая ось (1 JDN = 1 сутки), дробная часть которой —
// время суток. Это внутреннее представление календарной ветки ChronoMoment
// (см. chronoMoment.ts) — единый способ сравнивать/вычитать даты без ручной
// календарной арифметики (переменная длина месяцев, високосные годы) на
// каждом месте использования.
//
// Годовая нумерация — астрономическая (ISO 8601): год 1 до н.э. = 0,
// 2 год до н.э. = -1, и так далее. Без "нулевого года" в историческом стиле
// счёта — это стандартная практика для непрерывной числовой оси.
//
// Какой календарь использовать (григорианский/юлианский, он же "старый
// стиль") — решает вызывающий код, не эта функция: у эталона это явный
// пользовательский выбор (см. Хронолайнер_3.6.27_разбор.md, §4.1,
// атрибут calendar), а не автоопределение по дате исторической реформы
// 1582 года. Событие может быть явно помечено юлианским календарём даже
// если оно позже 1582 года (Россия перешла на григорианский только в 1918).

export type CalendarSystem = 'gregorian' | 'julian';

export interface CalendarDateParts {
  /** Астрономическая нумерация года — см. заголовок файла */
  year: number;
  /** 1-12 */
  month: number;
  /** Может быть дробным (0.5 = полдень) — время суток как доля суток */
  day: number;
}

export interface CalendarDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

/**
 * Календарная дата (год/месяц/дробный день) → юлианский день.
 * Алгоритм Мееса, ch. 7.
 */
export function calendarToJdn(parts: CalendarDateParts, calendar: CalendarSystem): number {
  let Y = parts.year;
  let M = parts.month;
  const D = parts.day;

  if (M <= 2) {
    Y -= 1;
    M += 12;
  }

  let B: number;
  if (calendar === 'gregorian') {
    const A = Math.floor(Y / 100);
    B = 2 - A + Math.floor(A / 4);
  } else {
    B = 0;
  }

  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;
}

/**
 * Юлианский день → календарная дата (год/месяц/дробный день).
 * Обратный алгоритм Мееса, ch. 7. Не автоопределяет календарь по дате
 * реформы — какой calendar передан, тот и используется, всегда.
 */
export function jdnToCalendar(jd: number, calendar: CalendarSystem): CalendarDateParts {
  const Z = Math.floor(jd + 0.5);
  const F = jd + 0.5 - Z;

  let A: number;
  if (calendar === 'gregorian') {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  } else {
    A = Z;
  }

  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  return { year, month, day };
}

/** Время суток (часы/минуты/секунды) → доля суток, для сложения с целым днём */
function timeOfDayFraction(hour: number, minute: number, second: number): number {
  return (hour + minute / 60 + second / 3600) / 24;
}

/** Календарная дата+время → юлианский день */
export function calendarDateTimeToJdn(parts: CalendarDateTimeParts, calendar: CalendarSystem): number {
  const fractionalDay =
    parts.day + timeOfDayFraction(parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0);
  return calendarToJdn({ year: parts.year, month: parts.month, day: fractionalDay }, calendar);
}

/** Юлианский день → календарная дата+время (час/минута/секунда — целые) */
export function jdnToCalendarDateTime(
  jd: number,
  calendar: CalendarSystem
): Required<CalendarDateTimeParts> {
  const { year, month, day } = jdnToCalendar(jd, calendar);
  const dayInt = Math.floor(day);
  const fractionalDay = day - dayInt;

  // Округляем до секунды, чтобы избежать 23:59:59.9999 из-за плавающей точки.
  // Округление может дать ровно 86400 (перекат на следующие сутки) — если
  // это не обработать явно, время молча "заворачивается" на 00:00:00 того же
  // дня вместо перехода на следующий.
  let totalSeconds = Math.round(fractionalDay * 86400);
  let carryDay = 0;
  if (totalSeconds >= 86400) {
    totalSeconds -= 86400;
    carryDay = 1;
  }

  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor(totalSeconds / 60) % 60;
  const second = totalSeconds % 60;

  if (carryDay === 0) {
    return { year, month, day: dayInt, hour, minute, second };
  }

  // Сутки перекатились — пересчитываем календарную дату через JDN+1, а не
  // вручную инкрементируем day (учитывает конец месяца/года/переход границы
  // григорианской реформы за нас).
  const next = jdnToCalendar(Math.floor(jd + 0.5) + 0.5, calendar);
  return { year: next.year, month: next.month, day: Math.floor(next.day), hour, minute, second };
}
