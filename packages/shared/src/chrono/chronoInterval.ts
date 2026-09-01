// packages/shared/src/chrono/chronoInterval.ts
// Интервал события + toRange — примитив первого класса с самого начала
// (правка Б5 архитектурного ревью, Хронолайнер_план_реализации.md, Фаза 2).
//
// Момент с precision='year' — это НЕ точка, это интервал
// [1941-01-01, 1942-01-01). Если хранить/сравнивать как точку:
//   - полоса сравнения (Фаза 6, привязана к дате) на "июнь 1941" не попадёт
//     в событие "1941", если оно спроецировано в 1 января;
//   - поиск по дате (Фаза 6) обязан работать через пересечение диапазонов,
//     а не через равенство;
//   - позиционирование при глубоком зуме окажется ложно точным.
// Все три потребителя должны быть построены на toRange с самого начала.
//
// end: null = "по настоящее время" (строка 26 ТЗ, событие "длится по
// настоящий момент") — СИМВОЛЬНЫЙ открытый конец, не материализуется
// конкретной датой при сохранении. У эталона TimelineEvent.init клонирует
// StartDate в пустой StopDate (разбор, строка 26) — это поведение
// намеренно НЕ копируется: оно как раз стирает "незавершённость" и делает
// линию лживой при следующем открытии файла (событие "тянется по сейчас"
// превратилось бы в "закончилось тогда же, когда началось").

import { civilDayToCalendarDateTime, calendarDateTimeToCivilDay, type CivilDayTime } from './calendar/civilDay';
import { civilDayToAxisYears } from './axis';
import { EPOCH_REFERENCE_YEAR, type ChronoMoment, type CalendarMoment, type EpochMoment } from './chronoMoment';
import { APPROX_YEARS_PER_UNIT } from './precision';

export interface ChronoInterval {
  start: ChronoMoment;
  /** null = "по настоящее время" — см. заголовок файла */
  end: ChronoMoment | null;
}

export function isOpenEnded(interval: ChronoInterval): boolean {
  return interval.end === null;
}

export interface AxisRange {
  /** Приблизительные годы (toAxisYears) — та же единая ось, что и всюду в модуле */
  start: number;
  end: number;
}

function civilDayEndOfDay(day: number): CivilDayTime {
  return { day: day + 1, secondOfDay: 0 };
}

function calendarMomentRange(m: CalendarMoment): AxisRange {
  const dt = civilDayToCalendarDateTime(m.civilDay, m.calendar);

  switch (m.precision) {
    case 'second': {
      const startSec = m.civilDay.secondOfDay;
      const endSec = startSec + 1;
      const start = m.civilDay;
      const end: CivilDayTime =
        endSec >= 86400 ? { day: m.civilDay.day + 1, secondOfDay: 0 } : { day: m.civilDay.day, secondOfDay: endSec };
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
    case 'minute': {
      const startSec = Math.floor(m.civilDay.secondOfDay / 60) * 60;
      const endSec = startSec + 60;
      const start: CivilDayTime = { day: m.civilDay.day, secondOfDay: startSec };
      const end: CivilDayTime =
        endSec >= 86400 ? { day: m.civilDay.day + 1, secondOfDay: 0 } : { day: m.civilDay.day, secondOfDay: endSec };
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
    case 'hour': {
      const startSec = Math.floor(m.civilDay.secondOfDay / 3600) * 3600;
      const endSec = startSec + 3600;
      const start: CivilDayTime = { day: m.civilDay.day, secondOfDay: startSec };
      const end: CivilDayTime =
        endSec >= 86400 ? { day: m.civilDay.day + 1, secondOfDay: 0 } : { day: m.civilDay.day, secondOfDay: endSec };
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
    case 'day': {
      const start: CivilDayTime = { day: m.civilDay.day, secondOfDay: 0 };
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(civilDayEndOfDay(m.civilDay.day)) };
    }
    case 'month': {
      const start = calendarDateTimeToCivilDay({ year: dt.year, month: dt.month, day: 1 }, m.calendar);
      const end =
        dt.month === 12
          ? calendarDateTimeToCivilDay({ year: dt.year + 1, month: 1, day: 1 }, m.calendar)
          : calendarDateTimeToCivilDay({ year: dt.year, month: dt.month + 1, day: 1 }, m.calendar);
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
    case 'year': {
      const start = calendarDateTimeToCivilDay({ year: dt.year, month: 1, day: 1 }, m.calendar);
      const end = calendarDateTimeToCivilDay({ year: dt.year + 1, month: 1, day: 1 }, m.calendar);
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
    case 'decade': {
      const floor = Math.floor(dt.year / 10) * 10;
      const start = calendarDateTimeToCivilDay({ year: floor, month: 1, day: 1 }, m.calendar);
      const end = calendarDateTimeToCivilDay({ year: floor + 10, month: 1, day: 1 }, m.calendar);
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
    case 'century': {
      const floor = Math.floor(dt.year / 100) * 100;
      const start = calendarDateTimeToCivilDay({ year: floor, month: 1, day: 1 }, m.calendar);
      const end = calendarDateTimeToCivilDay({ year: floor + 100, month: 1, day: 1 }, m.calendar);
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
    case 'millennium': {
      const floor = Math.floor(dt.year / 1000) * 1000;
      const start = calendarDateTimeToCivilDay({ year: floor, month: 1, day: 1 }, m.calendar);
      const end = calendarDateTimeToCivilDay({ year: floor + 1000, month: 1, day: 1 }, m.calendar);
      return { start: civilDayToAxisYears(start), end: civilDayToAxisYears(end) };
    }
  }
}

function epochMomentRange(m: EpochMoment): AxisRange {
  // Геологическая ветка: единица округляется степенью десяти (правка Б3,
  // зона перекрытия начинается с millennium) — диапазон не симметричен
  // вокруг значения, а покрывает "корзину" этой степени десяти, аналогично
  // календарной ветке (год/век/тысячелетие — тоже не симметричные окна).
  const unitYears = APPROX_YEARS_PER_UNIT[m.precision];
  const floor = Math.floor(m.yearsBeforeEpoch / unitYears) * unitYears;

  // yearsBeforeEpoch растёт "вглубь прошлого", axis растёт "к будущему" —
  // поэтому floor (более старое) даёт axis-МЕНЬШУЮ границу end, а floor+unit
  // (более новое, ближе к опорной эпохе) даёт axis-БОЛЬШУЮ границу start.
  const axisOfOlderBound = EPOCH_REFERENCE_YEAR - (floor + unitYears);
  const axisOfNewerBound = EPOCH_REFERENCE_YEAR - floor;

  return { start: axisOfOlderBound, end: axisOfNewerBound };
}

/**
 * Диапазон момента на единой оси (в приблизительных годах), учитывающий
 * precision — момент с грубой точностью покрывает весь соответствующий
 * "квант" времени, а не одну точку.
 */
export function toRange(moment: ChronoMoment): AxisRange {
  return moment.kind === 'calendar' ? calendarMomentRange(moment) : epochMomentRange(moment);
}

/** true, если диапазоны a и b пересекаются (включая касание границ) */
export function rangesOverlap(a: AxisRange, b: AxisRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * Диапазон интервала целиком: начало — от toRange(start), конец — от
 * toRange(end) либо +Infinity для символьного открытого конца (никогда не
 * материализуется конкретным годом, см. заголовок файла).
 */
export function intervalRange(interval: ChronoInterval): AxisRange {
  const startRange = toRange(interval.start);
  if (interval.end === null) {
    return { start: startRange.start, end: Infinity };
  }
  const endRange = toRange(interval.end);
  return { start: startRange.start, end: endRange.end };
}
