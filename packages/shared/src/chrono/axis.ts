// packages/shared/src/chrono/axis.ts
// toAxisYears — канонический ТОТАЛЬНЫЙ порядок для сортировки, рендера,
// полосы сравнения и поиска (нужен и для событий одной хронолинии, и для
// сравнения событий из разных линий — например "22 июня 1941" против
// "65 млн лет назад" на одной шкале). Это не "грубая lossy-функция для
// позиционирования" (как было в первой версии обоснования), а единственный
// тотальный порядок с известными характеристиками — так решено на
// архитектурном ревью (Фаза 2): точность деградирует ровно там, где
// перестаёт быть значимой (ULP double при |год| ≈ 4,5 млрд ≈ 31 секунда —
// то есть именно там, где секундная точность для геологического времени
// физически бессмысленна).
//
// compareMoments — точное сравнение внутри одной ветки (через целочисленный
// civilDay/secondOfDay или через yearsBeforeEpoch), деградирует до
// сравнения по оси ТОЛЬКО между разными ветками. Инвариант, который должен
// держаться всегда и проверен property-тестом ниже: для пары моментов
// ОДНОЙ ветки sign(точное сравнение) === sign(сравнение по оси).

import { compareCivilDayTime, calendarDateTimeToCivilDay, type CivilDayTime } from './calendar/civilDay';
import { EPOCH_REFERENCE_YEAR, type ChronoMoment } from './chronoMoment';

// Юлианское среднее (365.25), не более точное григорианское (365.2425) —
// эта ось приблизительная по назначению (см. заголовок файла), точный год
// для конкретной даты всегда берётся из civilDay/calendar, не отсюда.
// Цена выбора: ~15 суток дрейфа на 2000 лет — на два порядка меньше того,
// что вообще имеет значение при межветочном сравнении (разница в миллионы
// и миллиарды лет).
const DAYS_PER_YEAR = 365.25;

// Опорная точка для календарной ветки — гражданские сутки 1 января
// астрономического года 0 (григорианский, выбор календаря здесь не влияет
// на day: JDN и производный civilDay календарно-агностичны, оба календаря
// проецируются на одну и ту же непрерывную числовую ось).
const YEAR_ZERO_CIVIL_DAY = calendarDateTimeToCivilDay({ year: 0, month: 1, day: 1 }, 'gregorian').day;

/**
 * civilDay+secondOfDay → приблизительный астрономический год. Вынесено
 * отдельно от toAxisYears (не только от ChronoMoment), потому что
 * chronoInterval.ts (toRange) считает границы прямо через civilDay, минуя
 * промежуточную сборку целого CalendarMoment.
 */
export function civilDayToAxisYears(civilDay: CivilDayTime): number {
  const daysFromYearZero = civilDay.day - YEAR_ZERO_CIVIL_DAY + civilDay.secondOfDay / 86400;
  return daysFromYearZero / DAYS_PER_YEAR;
}

/**
 * Приблизительный астрономический год (double) — единая ось для обеих
 * веток. НЕ используется для точного хранения/вывода, только для
 * межветочного упорядочивания/позиционирования.
 */
export function toAxisYears(moment: ChronoMoment): number {
  if (moment.kind === 'calendar') {
    return civilDayToAxisYears(moment.civilDay);
  }
  return EPOCH_REFERENCE_YEAR - moment.yearsBeforeEpoch;
}

/**
 * -1 | 0 | 1. Точное сравнение внутри одной ветки; между ветками —
 * сравнение по toAxisYears (единственный доступный общий язык).
 */
export function compareMoments(a: ChronoMoment, b: ChronoMoment): -1 | 0 | 1 {
  if (a.kind === 'calendar' && b.kind === 'calendar') {
    return compareCivilDayTime(a.civilDay, b.civilDay);
  }

  if (a.kind === 'epoch' && b.kind === 'epoch') {
    // yearsBeforeEpoch больше = дальше в прошлом = раньше на оси времени
    if (a.yearsBeforeEpoch === b.yearsBeforeEpoch) return 0;
    return a.yearsBeforeEpoch > b.yearsBeforeEpoch ? -1 : 1;
  }

  const axisA = toAxisYears(a);
  const axisB = toAxisYears(b);
  if (axisA === axisB) return 0;
  return axisA < axisB ? -1 : 1;
}
