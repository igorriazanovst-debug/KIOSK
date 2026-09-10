// packages/shared/src/words/model/schema.ts
// zod-схемы модели «Я знаю много слов» (Тип 2) — единственная точка, через
// которую проходят данные с границы системы (библиотека контента в поставке,
// пользовательские слова и комплекты на диске, импортируемый файл комплекта).
// Тот же принцип, что у chrono/model/schema.ts и naturalCommunities/model/
// schema.ts: «никогда не доверять внешним данным», не голый JSON.parse.
//
// Версия схемы заложена с первого дня, ещё до появления первой миграции —
// иначе первое же изменение состава полей будет некуда вставить как явную
// миграцию (Сценарий_разработки_фичи.md, раздел 2).
//
// Отличие от эталона ОС3, принятое осознанно: медиа пользовательских слов
// хранятся ФАЙЛАМИ и адресуются именем файла, а не строкой base64 внутри
// JSON. У эталона весь JSON переписывается целиком при каждой правке и
// разрастается вместе с медиатекой педагога.

import { z } from 'zod';

// ─── Идентификаторы ─────────────────────────────────────────────────────

/**
 * Идентификатор поставочного слова — ровно четыре цифры: две первые это
 * порядковый номер темы, две последние — номер слова внутри темы. Схема взята
 * у эталона: тот же идентификатор служит именем файла иллюстрации и именем
 * папки озвучки, поэтому раскладка ресурсов выводится из него одного
 * (см. resources.ts).
 */
export const LibraryWordIdSchema = z
  .string()
  .regex(/^\d{4}$/, 'library word id must be exactly 4 digits');

/**
 * Идентификатор пользовательского слова — префикс "u" и hex, чтобы никогда не
 * столкнуться с четырёхзначными поставочными идентификаторами.
 */
export const UserWordIdSchema = z
  .string()
  .regex(/^u[0-9a-f]{8,32}$/, 'user word id must look like "u" + 8..32 hex chars');

export const WordIdSchema = z.union([LibraryWordIdSchema, UserWordIdSchema]);

/** Слово добавлено педагогом, а не пришло в поставке */
export function isUserWordId(id: string): boolean {
  return UserWordIdSchema.safeParse(id).success;
}

/** Идентификатор темы/комплекта: латиница, цифры, дефис и подчёркивание */
export const ThemeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/, 'theme id must be lowercase latin, digits, "-" or "_"');

/** Имя файла без разделителей пути — тот же контракт, что у natcom MediaFileSchema */
export const FileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((s) => !/[/\\]/.test(s), 'file name must not contain path separators')
  .refine((s) => s !== '.' && s !== '..', 'file name must not be a directory reference');

// ─── Уровни сложности ───────────────────────────────────────────────────

/** Три уровня поставочных слов (ТЗ строка 50: «≥ 3 уровня») */
export const LibraryLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

/** Уровень пользовательского слова — отдельный сценарий озвучки */
export const UserLevelSchema = z.literal(9);

export const LevelSchema = z.union([LibraryLevelSchema, UserLevelSchema]);

// ─── Схема озвучки ──────────────────────────────────────────────────────

/**
 * Сколько звуковых файлов полагается каждому слову. Вынесено в данные, а не
 * зашито числом, потому что это главная развилка бюджета контента: у эталона
 * 11 записей на слово (5 фраз × 2 голоса + нейтральная) дают 198 МБ озвучки.
 * Скрипт проверки комплектности сверяет фактические файлы именно с этой
 * схемой — у эталона двух mp3 в поставке не хватало, и никто этого не заметил.
 */
export const AudioSchemeSchema = z.object({
  /**
   * Идентификаторы голосов дикторов, напр. ["boy", "girl"] или ["girl"].
   * Пустой список — озвучка ещё не записана: это законное состояние пакета
   * контента, потому что иллюстрации и звук производятся разными людьми и в
   * разные сроки. Проверка комплектности в таком пакете спрашивает только
   * картинки (см. schemeHasAudio в resources.ts).
   */
  voices: z.array(z.string().regex(/^[a-z0-9_-]+$/)),
  /** Сколько фразовых вариантов записывается каждым голосом */
  phrasesPerVoice: z.number().int().min(0).max(10),
  /** Есть ли отдельная нейтральная запись слова (без фразы) */
  neutral: z.boolean(),
});
export type AudioScheme = z.infer<typeof AudioSchemeSchema>;

// ─── Поставочная библиотека ─────────────────────────────────────────────

export const LibraryWordSchema = z.object({
  id: LibraryWordIdSchema,
  /** Подпись на карточке и то, что произносится */
  name: z.string().min(1).max(64),
  themeId: ThemeIdSchema,
  level: LibraryLevelSchema,
});
export type LibraryWord = z.infer<typeof LibraryWordSchema>;

export const LibraryThemeSchema = z.object({
  id: ThemeIdSchema,
  /** Название темы. Уникальность проверяется отдельно — см. parseWordsLibrary */
  title: z.string().min(1).max(80),
  /** Упорядоченный список идентификаторов слов темы */
  wordIds: z.array(LibraryWordIdSchema),
});
export type LibraryTheme = z.infer<typeof LibraryThemeSchema>;

export const WORDS_LIBRARY_SCHEMA_VERSION = 1 as const;

export const WordsLibrarySchema = z.object({
  schemaVersion: z.literal(WORDS_LIBRARY_SCHEMA_VERSION),
  audioScheme: AudioSchemeSchema,
  themes: z.array(LibraryThemeSchema),
  words: z.array(LibraryWordSchema),
});
export type WordsLibrary = z.infer<typeof WordsLibrarySchema>;

// ─── Пользовательский контент (на устройстве) ───────────────────────────

export const UserWordSchema = z.object({
  id: UserWordIdSchema,
  name: z.string().min(1).max(64),
  level: UserLevelSchema,
  /** Имя файла иллюстрации в каталоге медиа профиля; null — картинки нет */
  imageFile: FileNameSchema.nullable(),
  /** Имя файла озвучки; null — записи нет */
  audioFile: FileNameSchema.nullable(),
});
export type UserWord = z.infer<typeof UserWordSchema>;

/** Комплект слов, собранный педагогом (ТЗ строки 56 и 57) */
export const UserSetSchema = z.object({
  id: ThemeIdSchema,
  title: z.string().min(1).max(80),
  /** Может смешивать поставочные и свои слова — прямое требование строки 56 */
  wordIds: z.array(WordIdSchema),
});
export type UserSet = z.infer<typeof UserSetSchema>;

/** Профиль ребёнка (ТЗ строка 47). Без пароля — это не учётная запись ОС */
export const ProfileSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(40),
  createdAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Ступени достижения по теме, от низшей к высшей */
export const AWARD_TIERS = ['wooden', 'silver', 'gold'] as const;
export const AwardTierSchema = z.enum(AWARD_TIERS);
export type AwardTier = z.infer<typeof AwardTierSchema>;

/** Достижения: профиль → тема → ступень (ТЗ строка 52) */
export const ScoreBookSchema = z.record(
  z.string(),
  z.record(ThemeIdSchema, AwardTierSchema)
);
export type ScoreBook = z.infer<typeof ScoreBookSchema>;

export const DeviceModeSchema = z.enum(['tablet', 'board', 'table']);
export type DeviceMode = z.infer<typeof DeviceModeSchema>;

export const WORDS_SETTINGS_SCHEMA_VERSION = 1 as const;

export const WordsSettingsSchema = z.object({
  schemaVersion: z.literal(WORDS_SETTINGS_SCHEMA_VERSION),
  /** Громкость 0..100 (ТЗ строка 51) */
  volume: z.number().int().min(0).max(100),
  /**
   * Режим устройства. У эталона переключатель знает только «планшет» и
   * «интерактивную доску», отдельного режима стола нет — замечание разбора.
   * Здесь режим стола заведён явно с самого начала.
   */
  device: DeviceModeSchema,
  /** Переназначенные педагогом уровни слов (ТЗ строка 50) */
  levelOverrides: z.record(WordIdSchema, LevelSchema),
});
export type WordsSettings = z.infer<typeof WordsSettingsSchema>;

// ─── Разбор с границы системы ───────────────────────────────────────────

export class WordsValidationError extends Error {
  readonly issues: string[];
  constructor(what: string, issues: string[]) {
    super(`${what}: ${issues.join('; ')}`);
    this.name = 'WordsValidationError';
    this.issues = issues;
  }
}

function issueLines(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`);
}

/**
 * Единственная точка разбора поставочной библиотеки. Кроме схемы проверяет
 * ссылочную целостность и то, что эталон как раз нарушал: уникальность
 * названий тем (у ОС3 «Домашние животные» и «Дикие животные» встречаются по
 * два раза, уникальных названий 13 из 15 — риск на приёмке по строке 59).
 */
export function parseWordsLibrary(input: unknown): WordsLibrary {
  const parsed = WordsLibrarySchema.safeParse(input);
  if (!parsed.success) {
    throw new WordsValidationError('words library', issueLines(parsed.error));
  }
  const library = parsed.data;
  const issues: string[] = [];

  const wordById = new Map<string, LibraryWord>();
  for (const word of library.words) {
    if (wordById.has(word.id)) issues.push(`duplicate word id "${word.id}"`);
    wordById.set(word.id, word);
  }

  const themeById = new Map<string, LibraryTheme>();
  const titleSeen = new Map<string, string>();
  for (const theme of library.themes) {
    if (themeById.has(theme.id)) issues.push(`duplicate theme id "${theme.id}"`);
    themeById.set(theme.id, theme);

    const titleKey = theme.title.trim().toLowerCase();
    const owner = titleSeen.get(titleKey);
    if (owner) {
      issues.push(`theme title "${theme.title}" is used by both "${owner}" and "${theme.id}"`);
    } else {
      titleSeen.set(titleKey, theme.id);
    }

    for (const wordId of theme.wordIds) {
      if (!wordById.has(wordId)) {
        issues.push(`theme "${theme.id}" references unknown word "${wordId}"`);
      }
    }
  }

  for (const word of library.words) {
    const theme = themeById.get(word.themeId);
    if (!theme) {
      issues.push(`word "${word.id}" belongs to unknown theme "${word.themeId}"`);
    } else if (!theme.wordIds.includes(word.id)) {
      issues.push(`word "${word.id}" is not listed in its theme "${word.themeId}"`);
    }
  }

  if (issues.length > 0) throw new WordsValidationError('words library', issues);
  return library;
}

/** Разбор пользовательских слов с диска */
export function parseUserWords(input: unknown): UserWord[] {
  const parsed = z.array(UserWordSchema).safeParse(input);
  if (!parsed.success) throw new WordsValidationError('user words', issueLines(parsed.error));
  return parsed.data;
}

/**
 * Разбор пользовательских комплектов. Дополнительно требует, чтобы каждое
 * слово комплекта существовало — либо в поставке, либо среди своих слов:
 * висячих ссылок после удаления слова остаться не должно.
 */
export function parseUserSets(
  input: unknown,
  knownWordIds: ReadonlySet<string>
): UserSet[] {
  const parsed = z.array(UserSetSchema).safeParse(input);
  if (!parsed.success) throw new WordsValidationError('user sets', issueLines(parsed.error));

  const issues: string[] = [];
  const seen = new Set<string>();
  for (const set of parsed.data) {
    if (seen.has(set.id)) issues.push(`duplicate set id "${set.id}"`);
    seen.add(set.id);
    for (const wordId of set.wordIds) {
      if (!knownWordIds.has(wordId)) {
        issues.push(`set "${set.id}" references unknown word "${wordId}"`);
      }
    }
  }
  if (issues.length > 0) throw new WordsValidationError('user sets', issues);
  return parsed.data;
}

/** Разбор настроек. Отсутствующий файл — это дефолт, а не ошибка */
export function parseWordsSettings(input: unknown): WordsSettings {
  const parsed = WordsSettingsSchema.safeParse(input);
  if (!parsed.success) throw new WordsValidationError('words settings', issueLines(parsed.error));
  return parsed.data;
}

export const DEFAULT_WORDS_SETTINGS: WordsSettings = {
  schemaVersion: WORDS_SETTINGS_SCHEMA_VERSION,
  volume: 70,
  device: 'board',
  levelOverrides: {},
};
