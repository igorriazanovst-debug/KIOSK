// packages/shared/src/inophone/model/statistics.ts
// Настройки занятия и статистика ученика (ТЗ строки 87, 88, 93).
//
// РАЗБОР ТЕРПИМЫЙ, А ЗАПИСЬ СТРОГАЯ. Настройки и статистика лежат на диске,
// переживают обновления и правятся руками. Битая запись по одной сцене не
// должна уносить остальные: ребёнок потеряет строчку в отчёте, а не весь
// свой прогресс. Та же логика принята в Типе 3 и по той же причине.

import { z } from 'zod';
import {
  DEFAULT_INTERFACE_LANGUAGE,
  DEFAULT_STUDY_LANGUAGES,
  LANGUAGE_CODES,
  MAX_STUDY_LANGUAGES,
  type LanguageCode,
} from './languages';

export const INOPHONE_SETTINGS_VERSION = 1 as const;

export const InophoneSettingsSchema = z.object({
  schemaVersion: z.literal(INOPHONE_SETTINGS_VERSION),
  /** Язык интерфейса, он же родной язык ученика (ТЗ строка 87) */
  interfaceLanguage: z.enum(LANGUAGE_CODES),
  /** Изучаемые языки (ТЗ строка 88): от одного до трёх */
  studyLanguages: z.array(z.enum(LANGUAGE_CODES)).min(1).max(MAX_STUDY_LANGUAGES),
  volume: z.number().int().min(0).max(100),
});
export type InophoneSettings = z.infer<typeof InophoneSettingsSchema>;

export const DEFAULT_INOPHONE_SETTINGS: InophoneSettings = {
  schemaVersion: INOPHONE_SETTINGS_VERSION,
  interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
  studyLanguages: [...DEFAULT_STUDY_LANGUAGES],
  volume: 70,
};

/**
 * Разбор настроек: битые дают значения по умолчанию.
 *
 * Здесь терпимость уместна — см. заголовок файла. Отдельно выправляется
 * ситуация «изучаемый язык совпал с родным»: она не ломает формат, но делает
 * занятие бессмысленным (карточка показала бы одно и то же дважды), а
 * возникает легко — сменил язык интерфейса и не заметил.
 */
export function parseInophoneSettings(raw: unknown): InophoneSettings {
  const parsed = InophoneSettingsSchema.safeParse(raw);
  const base = parsed.success ? parsed.data : DEFAULT_INOPHONE_SETTINGS;

  const study = base.studyLanguages.filter((code) => code !== base.interfaceLanguage);
  if (study.length === 0) {
    // Все изучаемые совпали с родным — берём первый отличный от родного, а не
    // оставляем пустой список: пустой не даст открыть ни одну сцену
    const fallback = LANGUAGE_CODES.find((c) => c !== base.interfaceLanguage) as LanguageCode;
    return { ...base, studyLanguages: [fallback] };
  }
  return study.length === base.studyLanguages.length ? base : { ...base, studyLanguages: study };
}

// ─── статистика ──────────────────────────────────────────────────────────

/** Пара «верно / всего» */
export type Tally = readonly [number, number];

export interface SceneStat {
  /** Последняя партия на этой сцене */
  lastSession: Tally;
  /** За всё время */
  total: Tally;
}

/**
 * Статистика ученика: по сцене и отдельно по каждому изучаемому языку.
 *
 * ПОЧЕМУ ПО ЯЗЫКАМ, а не только по сценам. Смысл пособия — иностранные языки,
 * и педагогу нужно видеть, что ребёнок уверенно узнаёт слова по-английски и
 * путается по-немецки. Сводка только по сценам этого не покажет вовсе.
 */
export interface ProfileStatistics {
  byScene: Record<string, SceneStat>;
  byLanguage: Record<string, SceneStat>;
}

export type InophoneStatistics = Record<string, ProfileStatistics>;

const TallySchema = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
const SceneStatSchema = z.object({ lastSession: TallySchema, total: TallySchema });
const ProfileStatisticsSchema = z.object({
  byScene: z.record(z.string(), SceneStatSchema),
  byLanguage: z.record(z.string(), SceneStatSchema),
});

/**
 * Терпимый разбор: битая запись по одному профилю отбрасывается, остальные
 * выживают. Строгий разбор здесь означал бы «у одного ребёнка испортилась
 * строка — отчёта нет ни у кого».
 */
export function parseInophoneStatistics(raw: unknown): InophoneStatistics {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: InophoneStatistics = {};
  for (const [profileId, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = ProfileStatisticsSchema.safeParse(value);
    if (parsed.success) out[profileId] = parsed.data;
  }
  return out;
}

const EMPTY: SceneStat = { lastSession: [0, 0], total: [0, 0] };

function merge(prev: SceneStat | undefined, add: Tally): SceneStat {
  const base = prev ?? EMPTY;
  return {
    // Последняя партия ЗАМЕЩАЕТСЯ, итог НАКАПЛИВАЕТСЯ — то же правило, что в
    // Типе 3: «как прошло сегодня» и «как вообще» это разные вопросы
    lastSession: add,
    total: [base.total[0] + add[0], base.total[1] + add[1]],
  };
}

/**
 * Слить итог партии в статистику профиля.
 *
 * `byLanguage` — сколько верных и всего пришлось на каждый изучаемый язык в
 * этой партии. Сумма по языкам даёт итог сцены, поэтому он не передаётся
 * отдельно: два источника одного числа разъедутся.
 */
export function mergeStatistics(
  current: InophoneStatistics,
  profileId: string,
  sceneId: string,
  byLanguage: Readonly<Record<string, Tally>>
): InophoneStatistics {
  const profile = current[profileId] ?? { byScene: {}, byLanguage: {} };

  let ok = 0;
  let all = 0;
  const nextByLanguage: Record<string, SceneStat> = { ...profile.byLanguage };
  for (const [code, tally] of Object.entries(byLanguage)) {
    ok += tally[0];
    all += tally[1];
    nextByLanguage[code] = merge(profile.byLanguage[code], tally);
  }

  return {
    ...current,
    [profileId]: {
      byScene: { ...profile.byScene, [sceneId]: merge(profile.byScene[sceneId], [ok, all]) },
      byLanguage: nextByLanguage,
    },
  };
}

/**
 * Доля верных ответов, 0..1. Без ответов — null, а НЕ ноль.
 *
 * Ноль читается как «отвечал и всё неверно» — ровно противоположно правде.
 * Это же правило принято в Типе 3 при построении графика по буквам.
 */
export function successShare(stat: SceneStat | undefined, which: 'lastSession' | 'total'): number | null {
  if (!stat) return null;
  const [ok, all] = stat[which];
  return all === 0 ? null : ok / all;
}
