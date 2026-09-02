// packages/shared/src/chrono/shiftMoment.ts
// Сдвиг момента/интервала на дельту в годах оси — общая математика для
// перетаскивания события на доске (Фаза 3, useEventDrag) и для будущего
// сдвига группы событий. Правило ревью «drag сохраняет precision» (Фаза 2,
// раздел "Не сделано из списка правок"): результат остаётся в ТОЙ ЖЕ ветке
// и с ТОЙ ЖЕ precision, что и исходный момент — сдвигается только числовое
// значение (civilDay.day для календарной ветки, yearsBeforeEpoch для
// геологической), а не тег или уровень детализации.
//
// Открытый конец интервала (end === null, "по настоящее время") сознательно
// НЕ сдвигается и не материализуется — он и так не привязан к конкретной
// дате (chronoInterval.ts).

import { DAYS_PER_YEAR } from './axis';
import type { ChronoMoment } from './chronoMoment';
import type { ChronoInterval } from './chronoInterval';

/**
 * @param moment Исходный момент
 * @param deltaAxisYears Сдвиг в приблизительных годах оси (toAxisYears); положительное — вперёд по времени
 */
export function shiftMoment(moment: ChronoMoment, deltaAxisYears: number): ChronoMoment {
  if (moment.kind === 'epoch') {
    // yearsBeforeEpoch считается ДО опорной эпохи, поэтому рост оси
    // (движение к настоящему) уменьшает yearsBeforeEpoch (см. axis.ts).
    return { ...moment, yearsBeforeEpoch: Math.round(moment.yearsBeforeEpoch - deltaAxisYears) };
  }

  const deltaDays = Math.round(deltaAxisYears * DAYS_PER_YEAR);
  return { ...moment, civilDay: { ...moment.civilDay, day: moment.civilDay.day + deltaDays } };
}

/** Сдвигает оба конца интервала на одну и ту же дельту; открытый конец не трогает. */
export function shiftInterval(interval: ChronoInterval, deltaAxisYears: number): ChronoInterval {
  return {
    start: shiftMoment(interval.start, deltaAxisYears),
    end: interval.end === null ? null : shiftMoment(interval.end, deltaAxisYears),
  };
}
