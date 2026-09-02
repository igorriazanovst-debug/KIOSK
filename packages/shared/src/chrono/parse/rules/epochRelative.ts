// packages/shared/src/chrono/parse/rules/epochRelative.ts
// Ввод геологического (глубокого) времени текстом - "65 млн лет назад" и
// т.п. Раньше этого файла не было вовсе (упоминался только в комментарии
// types.ts) - домен полностью поддерживает EpochMoment (математика,
// форматирование, отрисовка шкалы), но ввести такую дату педагог не мог
// никак, только через exactDate.ts/range.ts/relative.ts, которые работают
// исключительно с календарной веткой (см. Хронолайнер_план_исправлений.md,
// пункт C-11).
//
// Граница с relative.ts (parseYearsAgo): "10 лет назад" без указания
// тыс./млн/млрд - календарный момент относительно ctx.referenceDate (речь
// про недавнее прошлое учителя). Здесь - ТОЛЬКО когда явно названа единица
// (тыс/млн/млрд), это геологическое время, EpochMoment. Формула НЕ
// использует ctx.referenceDate вовсе - EPOCH_REFERENCE_YEAR (1950)
// зафиксирован в домене, а разница между 1950 и сегодня (десятки лет)
// физически не заметна в масштабе "N миллионов лет" - approximate:true и
// так означает, что точность здесь не до года.
//
// Слово "тыс./млн/млрд лет" - та же терминология, что и у formatRu.ts
// (EPOCH_UNIT_WORD) - зеркально форматированию, не отдельный словарь.

import type { ChronoMoment } from '../../chronoMoment';
import type { EpochPrecision } from '../../precision';

/**
 * Точность выводится НАПРЯМУЮ из произнесённой единицы, а не из величины
 * результата - "5 тыс лет" и "500 тыс лет" оба сказаны с точностью "до
 * тысячи", несмотря на то что второе число на два порядка больше; было бы
 * контринтуитивно, если бы одно и то же слово "тыс" давало РАЗНУЮ точность
 * в зависимости от того, сколько тысяч названо.
 */
const UNIT_TO_MULTIPLIER_AND_PRECISION: ReadonlyArray<{ pattern: RegExp; multiplier: number; precision: EpochPrecision }> = [
  { pattern: /^(?:тыс\.?|тысяч[аи]?)$/, multiplier: 1_000, precision: 'millennium' },
  { pattern: /^(?:млн\.?|миллион(?:а|ов)?)$/, multiplier: 1_000_000, precision: 'millionYears' },
  { pattern: /^(?:млрд\.?|миллиард(?:а|ов)?)$/, multiplier: 1_000_000_000, precision: 'billionYears' },
];

/** "65 млн лет назад", "4.5 млрд лет назад", "300 тысяч лет назад" */
export function parseEpochYearsAgo(input: string): ChronoMoment | null {
  const m = /^([\d]+(?:[.,]\d+)?)\s*([а-яё.]+)\s+лет\s+назад$/.exec(input);
  if (!m) return null;

  const rawNumber = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(rawNumber) || rawNumber < 0) return null;

  const unit = UNIT_TO_MULTIPLIER_AND_PRECISION.find((u) => u.pattern.test(m[2]));
  if (!unit) return null;

  const yearsBeforeEpoch = Math.round(rawNumber * unit.multiplier);
  if (yearsBeforeEpoch <= 0) return null;

  return {
    kind: 'epoch',
    yearsBeforeEpoch,
    precision: unit.precision,
    approximate: true,
  };
}

export const EPOCH_RELATIVE_RULES: ReadonlyArray<(input: string) => ChronoMoment | null> = [parseEpochYearsAgo];
