// packages/shared/src/chrono/chronoMoment.ts
// Момент времени — тегированное объединение из двух веток, решение
// архитектурного ревью (Хронолайнер_план_реализации.md, Фаза 2):
//
//   - CalendarMoment — исторический диапазон, точная календарная дата
//     (григорианская или юлианская), хранится как целые { day, secondOfDay }
//     (см. calendar/civilDay.ts, правка Б2).
//   - EpochMoment — геологический/астрономический диапазон, "N лет до
//     опорной эпохи" (правка Б1: НЕ "лет от сейчас" — такое определение
//     тихо портило бы уже сохранённые данные с каждым прошедшим годом).
//
// Разделение оправдано СЕМАНТИЧЕСКИ, не численно: пролептический
// григорианский календарь на 4,5 млрд лет назад — фикция без всякого
// "какие сутки это были". Единая ось "целые сутки" технически возможна
// (4,5·10⁹ × 365,25 ≈ 1,64·10¹² суток — далеко внутри точности double), но
// давала бы ложную точность там, где предметная область её не имеет.
//
// Ветку выбирает ФОРМА ВВОДА ("N лет назад" / "млн лет" → epoch; "год" /
// "дата" / "до н.э." → calendar), а не величина — тег ХРАНИТСЯ явно, не
// выводится из числа. Причины: (1) выведенный тег незаписан в файле — сдвиг
// порога в будущем молча переинтерпретирует все старые проекты; (2)
// "10 000 лет назад" (epoch, календарь бессмысленен) и "10000 год до н.э."
// (calendar, может иметь месяц) — разные авторские намерения при близкой
// величине, парсер обязан их различать, а число — нет.
//
// Данные — простые объекты (POJO) + свободные функции, НЕ классы. Эталон
// (ОС3 Хронолайнер) построен на классах ChronoDate/ChronoDateRelative — этот
// выбор копировать не надо: классы не переживают JSON round-trip, а весь
// документ проекта (плюс снимки undo/redo и React-состояние) — JSON.
//
// Относительная шкала (нужна для галереи "Робототехника" и строки 4 ТЗ про
// "планирование работ по проекту") НЕ реализована здесь — это свойство
// ЛИНИИ, а не момента (у эталона IsRelative — поле TimeLine, не события).
// ChronoMoment/ChronoDuration спроектированы так, чтобы относительная линия
// пристёгивалась позже без изменения этого union.

import type { CalendarPrecision, EpochPrecision } from './precision';
import type { CalendarSystem } from './calendar/jdn';
import type { CivilDayTime } from './calendar/civilDay';

/**
 * Опорная эпоха для геологической ветки — год 1950 н.э. (астрономическая
 * нумерация). Это стандарт BP ("Before Present") из радиоуглеродного
 * датирования/геологии/археологии — то же самое, что реально имеют в виду
 * в школьных материалах под "N лет назад". Зафиксировано и не меняется:
 * смена этой константы задним числом молча переинтерпретирует уже
 * сохранённые проекты (в формате без миграций, см. STATUS.md).
 */
export const EPOCH_REFERENCE_YEAR = 1950;

export interface CalendarMoment {
  kind: 'calendar';
  civilDay: CivilDayTime;
  precision: CalendarPrecision;
  calendar: CalendarSystem;
  /** "Примерно" — влияет ТОЛЬКО на отображение, не на порядок/позицию/toRange (см. axis.ts, chronoInterval.ts) */
  approximate: boolean;
}

export interface EpochMoment {
  kind: 'epoch';
  /** Целое число лет ДО EPOCH_REFERENCE_YEAR. Положительное = в прошлом. */
  yearsBeforeEpoch: number;
  precision: EpochPrecision;
  /** "Примерно" — влияет ТОЛЬКО на отображение, не на порядок/позицию/toRange */
  approximate: boolean;
}

export type ChronoMoment = CalendarMoment | EpochMoment;

export function isCalendarMoment(m: ChronoMoment): m is CalendarMoment {
  return m.kind === 'calendar';
}

export function isEpochMoment(m: ChronoMoment): m is EpochMoment {
  return m.kind === 'epoch';
}

/**
 * Бросает, если момент содержит NaN/Infinity — проверка при ЗАПИСИ, не
 * только при чтении (правка ревью): JSON.stringify превращает NaN/Infinity
 * в null молча, арифметическая ошибка где-то выше по стеку иначе тихо
 * портит файл проекта при автосохранении.
 */
export function assertFiniteMoment(m: ChronoMoment): void {
  if (m.kind === 'calendar') {
    if (!Number.isFinite(m.civilDay.day) || !Number.isFinite(m.civilDay.secondOfDay)) {
      throw new RangeError(`CalendarMoment has a non-finite civilDay: ${JSON.stringify(m)}`);
    }
  } else {
    if (!Number.isFinite(m.yearsBeforeEpoch)) {
      throw new RangeError(`EpochMoment has a non-finite yearsBeforeEpoch: ${JSON.stringify(m)}`);
    }
  }
}
