// packages/shared/src/alphabet/model/schema.ts
// Модель данных виджета «АзбукоСлов» (Тип 3).
//
// ЦЕНТРАЛЬНАЯ ИДЕЯ — ГРАФ «буква → слово → слог». Из одного набора данных
// питаются все три этапа обучения: узнавание буквы берёт список слов буквы,
// дополнение слова — отдельную запись «без последнего слога», сборка —
// разбивку на слоги. Такую конструкцию подтвердил разбор эталона, и она
// действительно экономна: один граф вместо трёх независимых наборов заданий.
//
// ОТСЮДА ГЛАВНОЕ ТРЕБОВАНИЕ К КОНТЕНТУ: у каждого слова ТРИ записи —
// целиком, без последнего слога и послогово (последняя собирается из озвучки
// самих слогов). Без записи «без последнего слога» этап 2 не работает вовсе,
// без слоговой озвучки — этап 3. Проверка комплектности обязана ловить это
// до сборки, а не на занятии.
//
// Идентификаторы — транслитерация, как у эталона: `avtobus`, `apel_sin`
// (мягкий знак → `_`). Свои слова и слоги педагога живут в тех же списках, но
// с префиксом `u`, чтобы не столкнуться с поставочными: тот же приём, что в
// виджете `words`, и он там себя оправдал.

import { z } from 'zod';

/**
 * Форма идентификатора сущности, созданной педагогом: «u» и 16 hex-символов.
 *
 * Смысл в том, чтобы поставочные идентификаторы и свои НИКОГДА не совпали:
 * иначе обновление поставки затрёт слово педагога, и он этого даже не
 * заметит.
 */
const USER_ID_RE = /^u[a-f0-9]{16}$/;

/**
 * Идентификатор поставочной сущности — транслитерация слова или слога.
 *
 * Запрещено не «начинаться с u», а СОВПАДАТЬ ПО ФОРМЕ со своим
 * идентификатором. Разница принципиальна: «Утка», «Улитка» и «Ухо» дают
 * `utka`, `ulitka`, `uho` — совершенно законные поставочные слова, и первая
 * версия правила отвергала их целиком вместе с буквой У.
 */
export const LibraryIdSchema = z
  .string()
  .regex(/^[a-z0-9_]{1,40}$/, 'идентификатор — строчная латиница, цифры и «_»')
  .refine(
    (v) => !USER_ID_RE.test(v),
    'поставочный идентификатор не должен совпадать по форме со своим («u» и 16 hex)'
  );

/** Идентификатор сущности, созданной педагогом */
export const UserIdSchema = z
  .string()
  .regex(USER_ID_RE, 'идентификатор своей сущности: «u» и 16 hex-символов');

export const EntityIdSchema = z.union([LibraryIdSchema, UserIdSchema]);

/** Имя файла в каталоге медиа устройства — как в виджете `words` */
export const FileNameSchema = z
  .string()
  .regex(/^[0-9a-f]{32}\.[a-z0-9]{2,4}$/, 'имя файла медиа — хеш содержимого и расширение');

// ─── Буква ──────────────────────────────────────────────────────────────

/**
 * Номер буквы в алфавите, 1..33. Именно номер, а не сама буква: он же имя
 * файла озвучки (`1.mp3` — «А», `33.mp3` — «Я»), и от него не зависит
 * кодировка и регистр.
 */
export const LetterNumberSchema = z.number().int().min(1).max(33);

export const LetterSchema = z.object({
  number: LetterNumberSchema,
  /** Заглавная буква: «А» */
  name: z.string().length(1),
  /**
   * Слова-иллюстрации этой буквы. Обычно — начинающиеся с неё, НО НЕ ВСЕГДА:
   * Ъ, Ы и Ь слово начать не могут, и у них перечисляются слова, где буква
   * стоит внутри. У эталона это Подъезд/Объявление для Ъ, Рыба/Рыцарь для Ы,
   * Борьба/Вьюга для Ь — иначе три буквы остались бы без иллюстраций вовсе
   * и требование ТЗ строки 71 было бы невыполнимо в принципе.
   *
   * Одно и то же слово поэтому законно стоит у двух букв: «Рыба» у Р и у Ы.
   * Проверка графа это учитывает — она требует, чтобы слово было перечислено
   * у СВОЕЙ ПЕРВОЙ буквы, но не запрещает перечислить его ещё где-то.
   *
   * ТЗ (строка 71) требует не менее двух иллюстраций на букву, а иллюстрация
   * есть у каждого слова — значит требование сводится к «не меньше двух слов
   * у каждой буквы». Проверяется отдельно, в checkLetterIllustrations: пустой
   * список здесь допустим, потому что промежуточное состояние пакета
   * контента — законное.
   */
  wordIds: z.array(EntityIdSchema),
});
export type Letter = z.infer<typeof LetterSchema>;

// ─── Слог ───────────────────────────────────────────────────────────────

export const SyllableSchema = z.object({
  id: EntityIdSchema,
  /** Слог строчными: «вто» */
  name: z.string().min(1).max(8),
  /**
   * Буквы, из которых состоит слог. Нужны не для игры, а для статистики:
   * результат шага записывается по букве, а шаги этапов 2 и 3 оперируют
   * слогами.
   */
  letterNumbers: z.array(LetterNumberSchema),
});
export type Syllable = z.infer<typeof SyllableSchema>;

// ─── Слово ──────────────────────────────────────────────────────────────

export const WordSchema = z.object({
  id: EntityIdSchema,
  /** Слово как его читает ребёнок: «Автобус» */
  name: z.string().min(1).max(40),
  /**
   * Разбивка на слоги — ссылки на существующие слоги по порядку.
   * Однослоговые слова допустимы (у эталона их 4), но для этапов 2 и 3
   * непригодны: подставлять и собирать там нечего. Отбор заданий это
   * учитывает, схема — нет: слово с одним слогом остаётся законным для
   * этапа 1.
   */
  syllableIds: z.array(EntityIdSchema).min(1),
  /** Есть ли у слова запись «без последнего слога» — она нужна этапу 2 */
  hasWithoutLastSyllable: z.boolean(),
  /** Своя картинка педагога; null — используется поставочная по идентификатору */
  imageFile: FileNameSchema.nullable().optional(),
});
export type Word = z.infer<typeof WordSchema>;

// ─── Комплект ───────────────────────────────────────────────────────────

export const WordSetSchema = z.object({
  id: EntityIdSchema,
  title: z.string().min(1).max(80),
  wordIds: z.array(EntityIdSchema),
});
export type WordSet = z.infer<typeof WordSetSchema>;

// ─── Пакет контента ─────────────────────────────────────────────────────

export const ALPHABET_LIBRARY_SCHEMA_VERSION = 1 as const;

/**
 * Схема озвучки. У эталона голос один и вариантов произношения нет — против
 * одиннадцати записей на слово двумя дикторами в «Я знаю много слов».
 * Именно поэтому его дистрибутив втрое компактнее, и повторять расточительный
 * вариант незачем.
 *
 * `recorded: false` — законное промежуточное состояние: иллюстрации и озвучка
 * производятся разными людьми и в разные сроки, и пакет без звука должен
 * собираться и запускаться.
 */
export const AlphabetAudioSchemeSchema = z.object({
  recorded: z.boolean(),
});
export type AlphabetAudioScheme = z.infer<typeof AlphabetAudioSchemeSchema>;

export const AlphabetLibrarySchema = z.object({
  schemaVersion: z.literal(ALPHABET_LIBRARY_SCHEMA_VERSION),
  audioScheme: AlphabetAudioSchemeSchema,
  letters: z.array(LetterSchema),
  syllables: z.array(SyllableSchema),
  words: z.array(WordSchema),
  sets: z.array(WordSetSchema),
});
export type AlphabetLibrary = z.infer<typeof AlphabetLibrarySchema>;

// ─── Статистика ─────────────────────────────────────────────────────────

/**
 * Результат по одной букве: пара «верно / всего». Разбор эталона показал две
 * пары — последняя сессия и накопленный итог; воспроизводим, потому что
 * педагогу нужно и то и другое: общий итог показывает прогресс, последняя
 * сессия — сегодняшнее занятие.
 */
export const LetterScoreSchema = z.object({
  lastSession: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  total: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
});
export type LetterScore = z.infer<typeof LetterScoreSchema>;

/** профиль → номер буквы → результат */
export const StatisticsSchema = z.record(
  z.string(),
  z.record(z.string(), LetterScoreSchema)
);
export type Statistics = z.infer<typeof StatisticsSchema>;

// ─── Настройки ──────────────────────────────────────────────────────────

export const ALPHABET_SETTINGS_SCHEMA_VERSION = 1 as const;

export const AlphabetDeviceModeSchema = z.enum(['tablet', 'board', 'table']);
export type AlphabetDeviceMode = z.infer<typeof AlphabetDeviceModeSchema>;

/** Сколько вопросов в партии — у эталона это отдельный экран настройки */
export const QUESTION_COUNTS = [5, 10, 15, 20] as const;
export const QuestionCountSchema = z
  .number()
  .int()
  .refine((v) => (QUESTION_COUNTS as readonly number[]).includes(v), 'недопустимое число вопросов');

export const AlphabetSettingsSchema = z.object({
  schemaVersion: z.literal(ALPHABET_SETTINGS_SCHEMA_VERSION),
  volume: z.number().int().min(0).max(100),
  device: AlphabetDeviceModeSchema,
  questionCount: QuestionCountSchema,
});
export type AlphabetSettings = z.infer<typeof AlphabetSettingsSchema>;

export const DEFAULT_ALPHABET_SETTINGS: AlphabetSettings = {
  schemaVersion: ALPHABET_SETTINGS_SCHEMA_VERSION,
  volume: 70,
  device: 'board',
  questionCount: 10,
};

// ─── Разбор с границы системы ───────────────────────────────────────────

export class AlphabetValidationError extends Error {
  readonly issues: string[];
  constructor(what: string, issues: string[]) {
    super(`${what}: ${issues.join('; ')}`);
    this.name = 'AlphabetValidationError';
    this.issues = issues;
  }
}

function issueLines(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(корень)'}: ${i.message}`);
}

/**
 * Единственная точка разбора пакета контента. Недоверенные данные не идут
 * мимо неё — правило сценария разработки, раздел 4.
 */
export function parseAlphabetLibrary(input: unknown): AlphabetLibrary {
  const parsed = AlphabetLibrarySchema.safeParse(input);
  if (!parsed.success) {
    throw new AlphabetValidationError('пакет контента «АзбукоСлов»', issueLines(parsed.error));
  }
  const library = parsed.data;

  // Уникальность идентификаторов проверяется здесь, а не схемой: zod этого не
  // умеет, а дубликат ломает граф молча — второе слово просто затеняет первое
  assertUnique(library.letters.map((l) => String(l.number)), 'номера букв');
  assertUnique(library.syllables.map((s) => s.id), 'идентификаторы слогов');
  assertUnique(library.words.map((w) => w.id), 'идентификаторы слов');
  assertUnique(library.sets.map((s) => s.id), 'идентификаторы комплектов');

  return library;
}

function assertUnique(values: string[], what: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size > 0) {
    throw new AlphabetValidationError(what, [`повторяются: ${[...duplicates].join(', ')}`]);
  }
}

export function parseAlphabetSettings(input: unknown): AlphabetSettings {
  const parsed = AlphabetSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new AlphabetValidationError('настройки «АзбукоСлов»', issueLines(parsed.error));
  }
  return parsed.data;
}

/**
 * Статистика разбирается терпимо: битая запись по одной букве отбрасывается,
 * остальные выживают. Потерять из-за одной испорченной строки весь прогресс
 * класса — несоразмерная цена.
 */
export function parseStatistics(input: unknown): Statistics {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Statistics = {};
  for (const [userId, letters] of Object.entries(input as Record<string, unknown>)) {
    if (!letters || typeof letters !== 'object' || Array.isArray(letters)) continue;
    const kept: Record<string, LetterScore> = {};
    for (const [letterNumber, score] of Object.entries(letters as Record<string, unknown>)) {
      const parsed = LetterScoreSchema.safeParse(score);
      if (parsed.success) kept[letterNumber] = parsed.data;
    }
    if (Object.keys(kept).length > 0) out[userId] = kept;
  }
  return out;
}
