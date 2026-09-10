// packages/shared/src/words/game/achievements.ts
// Достижения по теме: три ступени и правило их обновления.
//
// Правило обновления МОНОТОННОЕ — результат можно только улучшить, понижение
// отклоняется. Так у эталона, и это осознанно правильно для дошкольника:
// один неудачный заход в конце дня не должен стирать заработанное золото.
//
// ВНИМАНИЕ, открытый вопрос плана: сами ПОРОГИ в разборе эталона восстановить
// не удалось — в коде ОС3 видно только монотонность, но не критерии ступеней.
// Значения ниже выбраны нами и должны быть подтверждены методистом; они
// намеренно вынесены в одну константу, чтобы правка была в одном месте и
// покрыта тестами.

import type { GameSession, PlayerTally } from './session';
import type { AwardTier } from '../model/schema';
import { AWARD_TIERS } from '../model/schema';

/**
 * Доля шагов, пройденных с первой попытки, начиная с которой присуждается
 * ступень. Проверяются сверху вниз.
 */
export const WORDS_AWARD_THRESHOLDS: ReadonlyArray<{ tier: AwardTier; minAccuracy: number }> = [
  { tier: 'gold', minAccuracy: 0.9 },
  { tier: 'silver', minAccuracy: 0.7 },
  { tier: 'wooden', minAccuracy: 0 },
];

/** Доля шагов, пройденных без единой ошибки, 0..1 */
export function accuracy(tally: PlayerTally): number {
  if (tally.completed <= 0) return 0;
  return tally.flawless / tally.completed;
}

/**
 * Ступень за партию. Если игрок не закрыл ни одного шага (вышел сразу),
 * достижения нет вовсе — не «деревянная ступень за участие».
 */
export function awardFor(tally: PlayerTally): AwardTier | null {
  if (tally.completed <= 0) return null;
  const value = accuracy(tally);
  for (const { tier, minAccuracy } of WORDS_AWARD_THRESHOLDS) {
    if (value >= minAccuracy) return tier;
  }
  return null;
}

/** Ступень игрока по итогам партии */
export function awardForPlayer(session: GameSession, playerId: string): AwardTier | null {
  const tally = session.tally[playerId];
  return tally ? awardFor(tally) : null;
}

function tierRank(tier: AwardTier): number {
  return AWARD_TIERS.indexOf(tier);
}

/**
 * Монотонное обновление: возвращает новую ступень, только если она выше уже
 * заработанной, иначе null — «менять нечего». Понижение невозможно.
 */
export function upgradeAward(
  current: AwardTier | null | undefined,
  earned: AwardTier | null
): AwardTier | null {
  if (!earned) return null;
  if (!current) return earned;
  return tierRank(earned) > tierRank(current) ? earned : null;
}
