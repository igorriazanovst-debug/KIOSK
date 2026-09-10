// packages/shared/src/words/store/rules.ts
// Правила работы с локальными данными занятия — чистые функции без файловой
// системы и без Electron.
//
// ЗАЧЕМ ОТДЕЛЬНЫМ МОДУЛЕМ: продукт по ТЗ (строка 44) живёт на двух
// платформах — Windows и Android. Плеер KIOSK это Electron, а Electron под
// Android не работает, значит Android-сборка будет другим шелом поверх той же
// веб-сборки. Если правила «как зовут игрока», «можно ли понизить ступень»,
// «что делать с достижениями удалённого игрока» живут внутри Electron-кода,
// их придётся написать второй раз — и второй раз по-другому.
//
// Здесь они написаны один раз. Каждая платформа отвечает только за
// сохранение и чтение (у эталона ОС3 ровно этот приём: вся привязка к
// платформе — один класс из трёх методов read/save/delete, и именно поэтому
// разбор оценил перенос как малую работу).

import type { AwardTier, Profile } from '../model/schema';
import { AWARD_TIERS } from '../model/schema';

export const MAX_PROFILES = 64;
export const MAX_PROFILE_NAME_LENGTH = 40;

export class WordsRulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordsRulesError';
  }
}

/**
 * Отбрасывает битые записи, сохраняя целые. Файл мог быть повреждён частично —
 * терять из-за одной сломанной записи весь список детей нельзя.
 */
export function sanitizeProfiles(raw: unknown): Profile[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is Profile =>
      !!p &&
      typeof p === 'object' &&
      typeof (p as Profile).id === 'string' &&
      typeof (p as Profile).name === 'string'
  );
}

/**
 * Правила заведения игрока: имя без краевых пробелов, непустое, не длиннее
 * предела, не совпадающее с уже существующим без учёта регистра.
 * Идентификатор передаётся снаружи — генератор случайности у платформ разный.
 */
export function applyCreateProfile(
  profiles: readonly Profile[],
  name: string,
  id: string,
  createdAt: string
): { profiles: Profile[]; created: Profile } {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new WordsRulesError('Имя игрока не может быть пустым');
  if (trimmed.length > MAX_PROFILE_NAME_LENGTH) {
    throw new WordsRulesError(`Имя игрока длиннее ${MAX_PROFILE_NAME_LENGTH} символов`);
  }
  if (profiles.length >= MAX_PROFILES) {
    throw new WordsRulesError(`Больше ${MAX_PROFILES} игроков на устройстве не поддерживается`);
  }
  if (profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new WordsRulesError(`Игрок «${trimmed}» уже есть в списке`);
  }

  const created: Profile = { id, name: trimmed, createdAt };
  return { profiles: [...profiles, created], created };
}

/**
 * Удаление игрока вместе с его достижениями: оставлять осиротевшие записи
 * незачем, а новый игрок с тем же именем получит новый идентификатор и не
 * должен унаследовать чужое золото.
 */
export function applyDeleteProfile(
  profiles: readonly Profile[],
  scores: Readonly<Record<string, Record<string, AwardTier>>>,
  profileId: string
): { profiles: Profile[]; scores: Record<string, Record<string, AwardTier>> } {
  const remaining = profiles.filter((p) => p.id !== profileId);
  if (remaining.length === profiles.length) {
    throw new WordsRulesError('Такого игрока нет в списке');
  }
  const nextScores = { ...scores };
  delete nextScores[profileId];
  return { profiles: remaining, scores: nextScores };
}

function tierRank(tier: string): number {
  return (AWARD_TIERS as readonly string[]).indexOf(tier);
}

/**
 * Монотонное обновление достижения: ступень можно только повысить.
 * changed === false означает «уже было не хуже» — понизить нельзя ничем,
 * включая прямой вызов из рантайма.
 */
export function applySaveScore(
  scores: Readonly<Record<string, Record<string, AwardTier>>>,
  profileId: string,
  themeId: string,
  tier: AwardTier
): { scores: Record<string, Record<string, AwardTier>>; changed: boolean; tier: AwardTier } {
  if (tierRank(tier) < 0) throw new WordsRulesError(`Неизвестная ступень достижения: ${tier}`);

  const current = scores[profileId]?.[themeId];
  if (current !== undefined && tierRank(current) >= tierRank(tier)) {
    return { scores: { ...scores }, changed: false, tier: current };
  }

  return {
    scores: { ...scores, [profileId]: { ...scores[profileId], [themeId]: tier } },
    changed: true,
    tier,
  };
}
