// packages/shared/src/words/game/stats.ts
// Статистика работы каждого пользователя — ТЗ строка 52 (FR-013).
//
// Два уровня учёта, как у эталона, но с явными типами:
//  • внутри партии — PlayerTally в session.ts (шаги, безошибочные шаги, ошибки);
//  • между запусками — достижения по темам в локальном хранилище.
// Здесь — сведение второго в то, что показывается педагогу и ребёнку.
//
// Функции чистые: на вход отдаётся уже прочитанное с диска, наружу уходит
// готовая к отрисовке сводка. Ни fs, ни IPC здесь нет намеренно — это
// позволяет прогонять сводку тестами без устройства.

import type { AwardTier } from '../model/schema';
import { AWARD_TIERS } from '../model/schema';
import type { GameSession } from './session';
import { accuracy } from './achievements';

/** Достижения одного профиля: тема → ступень */
export type ProfileScores = Readonly<Record<string, AwardTier>>;

export interface ProfileSummary {
  profileId: string;
  /** Сколько тем пройдено хотя бы на одну ступень */
  themesCompleted: number;
  /** Сколько всего тем доступно для изучения */
  themesTotal: number;
  /** Сколько тем закрыто на золото */
  goldCount: number;
  /** Разбивка по ступеням */
  byTier: Readonly<Record<AwardTier, number>>;
  /** Доля пройденных тем 0..1 — для полосы прогресса */
  progress: number;
}

/**
 * Сводка по профилю. Темы, которых больше нет в поставке (контент обновился,
 * а достижение осталось), в счёт не идут: показывать ребёнку прогресс по
 * исчезнувшей теме — вводить педагога в заблуждение.
 */
export function summarizeProfile(
  profileId: string,
  scores: ProfileScores | undefined,
  availableThemeIds: readonly string[]
): ProfileSummary {
  const byTier: Record<AwardTier, number> = { wooden: 0, silver: 0, gold: 0 };
  const available = new Set(availableThemeIds);
  let themesCompleted = 0;

  for (const [themeId, tier] of Object.entries(scores ?? {})) {
    if (!available.has(themeId)) continue;
    if (!AWARD_TIERS.includes(tier)) continue;
    byTier[tier] += 1;
    themesCompleted += 1;
  }

  const themesTotal = available.size;
  return {
    profileId,
    themesCompleted,
    themesTotal,
    goldCount: byTier.gold,
    byTier,
    progress: themesTotal > 0 ? themesCompleted / themesTotal : 0,
  };
}

export interface SessionSummaryRow {
  playerId: string;
  completed: number;
  flawless: number;
  errors: number;
  /** Доля шагов с первой попытки, 0..1 */
  accuracy: number;
}

/**
 * Итоги партии по всем игрокам, в порядке хода — это же порядок, в котором
 * игроки сидят вокруг стола, и менять его на «по убыванию результата» не
 * нужно: экран итогов не соревнование, а обратная связь каждому.
 */
export function summarizeSession(session: GameSession): SessionSummaryRow[] {
  return session.playerIds.map((playerId) => {
    const tally = session.tally[playerId] ?? { completed: 0, flawless: 0, errors: 0 };
    return {
      playerId,
      completed: tally.completed,
      flawless: tally.flawless,
      errors: tally.errors,
      accuracy: accuracy(tally),
    };
  });
}
