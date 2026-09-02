// packages/player/src/chrono/board/compareStripLabel.ts
// Подпись позиции полосы сравнения (Фаза 6, план: "привязана к дате, не к
// пикселю") - та же логика "календарь vs глубокое время" по величине, что
// и у tickLabel.ts, но без параметра unit: полоса одна, не серия делений
// шкалы, поэтому автоподбор единицы измерения (млн/млрд лет) избыточен -
// достаточно показать точное число лет назад.

const DEEP_TIME_THRESHOLD_YEARS = 10_000;

export function formatCompareStripLabel(axisYears: number): string {
  if (Math.abs(axisYears - 1950) <= DEEP_TIME_THRESHOLD_YEARS) {
    const rounded = Math.round(axisYears);
    return rounded <= 0 ? `${1 - rounded} до н.э.` : String(rounded);
  }

  const yearsBeforeEpoch = Math.round(1950 - axisYears);
  return `${Math.abs(yearsBeforeEpoch).toLocaleString('ru-RU')} лет назад`;
}
