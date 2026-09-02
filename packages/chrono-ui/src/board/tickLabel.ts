// packages/player/src/chrono/board/tickLabel.ts
// Подпись деления шкалы — по значению позиции на оси (approxYears), не по
// названию единицы тика: 'millennium' встречается в ОБЕИХ ветках
// (precision.ts, зона перекрытия) — деление на границе исторической эры и
// деление в 65 млн лет назад оба могут иметь unit='millennium', но
// подписываться должны совсем по-разному ("XIII век" vs "65 млн лет
// назад"). Единственный надёжный сигнал — сама величина года, а не тег
// единицы, который тики используют для выбора ШАГА, не для выбора СТИЛЯ
// подписи.
//
// Сознательно не тянет toRoman/формат века из formatRu.ts для делений
// шкалы — подписи тиков (частая перерисовка при пане/зуме) проще и дешевле
// как обычные числа года; римские века остаются в formatRu.ts для
// карточки события (Фаза 5), где эта форма уместнее.

import { EPOCH_UNIT_WORD, EPOCH_UNIT_DIVISOR, type Tick, type EpochPrecision } from '@kiosk/shared';
import { isValidForEpochBranch } from '@kiosk/shared';

/**
 * Разумный порог "это ещё календарная дата, а не глубокое время" — тот же
 * порядок величины, что архитектурное ревью называло границей
 * правдоподобия пролептического календаря (Фаза 2, ChronoMoment).
 */
const DEEP_TIME_THRESHOLD_YEARS = 10_000;

function formatCalendarYearLabel(year: number): string {
  const rounded = Math.round(year);
  return rounded <= 0 ? `${1 - rounded} до н.э.` : String(rounded);
}

function formatDeepTimeLabel(axisYears: number, unit: EpochPrecision): string {
  const yearsBeforeEpoch = 1950 - axisYears;
  const scaled = yearsBeforeEpoch / EPOCH_UNIT_DIVISOR[unit];
  const rounded = Math.round(scaled * 100) / 100;
  return `${rounded} ${EPOCH_UNIT_WORD[unit]} назад`;
}

export function formatTickLabel(tick: Tick): string {
  const isDeepTime = Math.abs(tick.axisYears - 1950) > DEEP_TIME_THRESHOLD_YEARS;

  if (!isDeepTime || !isValidForEpochBranch(tick.unit)) {
    return formatCalendarYearLabel(tick.axisYears);
  }

  return formatDeepTimeLabel(tick.axisYears, tick.unit);
}
