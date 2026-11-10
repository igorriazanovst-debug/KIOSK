// zod-схемы виджета «ЭУМК» (электронный учебно-методический комплекс) -
// единственная точка, через которую проходят данные с границы системы:
// контент из свойств виджета (приходит из проекта на сервере) и локальные
// данные пользователей на диске. Один движок обслуживает оба комплекса
// (начальные классы, дошкольное образование): отличается только контент.
//
// Размещено в packages/player (не packages/shared): у shared нет
// подключённого npm test, а доменные схемы нужны с тестами с первого дня.

import { z } from 'zod';

export const EUMK_SCHEMA_VERSION = 1;

const NonEmpty = z.string().min(1);

// ---------- Теория ----------

// Источник факта в теории: название, вид (закон, учебник, сайт) и ссылка.
export const SourceRefSchema = z.object({
  title: NonEmpty,
  type: z.string().default(''),
  url: z.string().default(''),
});

// Пример для ученика: условие и ожидаемый ответ/результат.
const TheoryExampleSchema = z.object({
  task: z.string().default(''),
  expected: z.string().default(''),
});

// Блок-схема: шаги по порядку, next - пояснение перехода к следующему шагу.
const TheorySchemeStepSchema = z.object({
  step: NonEmpty,
  next: z.string().nullable().default(null),
});

// Описание иллюстрации (рисуется в рантайме по описанию, файлов нет).
const TheoryIllustrationSchema = z.object({
  caption: z.string().default(''),
  description: z.string().default(''),
});

const TheoryTableSchema = z.object({
  headers: z.array(z.string()).default([]),
  rows: z.array(z.array(z.string())).default([]),
});

export const TheorySectionSchema = z.object({
  id: NonEmpty,
  title: NonEmpty,
  text: z.string().default(''),
  keyPoints: z.array(z.string()).default([]),
  example: TheoryExampleSchema.nullable().default(null),
  table: TheoryTableSchema.nullable().default(null),
  scheme: z.array(TheorySchemeStepSchema).nullable().default(null),
  illustration: TheoryIllustrationSchema.nullable().default(null),
  sources: z.array(SourceRefSchema).default([]),
});

export const TheoryBlockSchema = z.object({
  id: NonEmpty,
  title: NonEmpty,
  sections: z.array(TheorySectionSchema).min(1),
});

// ---------- Банк вопросов итогового теста ----------

export const QuestionLevelSchema = z.enum(['знание', 'понимание', 'применение']);

export const BankQuestionSchema = z.object({
  id: NonEmpty,
  block: NonEmpty,
  section: z.string().default(''),
  level: QuestionLevelSchema,
  question: NonEmpty,
  options: z.array(NonEmpty).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().default(''),
  sources: z.array(z.string()).default([]),
});

// ---------- Интерактивные практические задания ----------
// Семь типов. Данные каждого типа валидируются своей схемой; ответ
// ученика проверяется в tasks.ts.

const SortItemSchema = z.object({ text: NonEmpty, category: NonEmpty });

const TaskBase = {
  id: NonEmpty,
  block: z.string().default(''),
  section: z.string().default(''),
  title: NonEmpty,
  instruction: z.string().default(''),
  explanation: z.string().default(''),
  sources: z.array(z.string()).default([]),
};

export const TaskSchema = z.discriminatedUnion('type', [
  z.object({
    ...TaskBase,
    type: z.literal('choice'),
    data: z.object({ options: z.array(NonEmpty).min(2), correct: z.array(z.number().int().min(0)).length(1) }),
  }),
  z.object({
    ...TaskBase,
    type: z.literal('multi'),
    data: z.object({ options: z.array(NonEmpty).min(2), correct: z.array(z.number().int().min(0)).min(1) }),
  }),
  z.object({
    ...TaskBase,
    type: z.literal('order'),
    data: z.object({ items: z.array(NonEmpty).min(2) }),
  }),
  z.object({
    ...TaskBase,
    type: z.literal('sort'),
    data: z.object({ categories: z.array(NonEmpty).min(2), items: z.array(SortItemSchema).min(2) }),
  }),
  z.object({
    ...TaskBase,
    type: z.literal('match'),
    data: z.object({ pairs: z.array(z.tuple([NonEmpty, NonEmpty])).min(2) }),
  }),
  z.object({
    ...TaskBase,
    type: z.literal('gaps'),
    data: z.object({ text: NonEmpty, options: z.array(NonEmpty).min(1), answers: z.array(NonEmpty).min(1) }),
  }),
  z.object({
    ...TaskBase,
    type: z.literal('input'),
    data: z.object({ accepted: z.array(NonEmpty).min(1), caseSensitive: z.boolean().default(false) }),
  }),
]);

export type EumkTask = z.infer<typeof TaskSchema>;
export type TaskType = EumkTask['type'];
export type BankQuestion = z.infer<typeof BankQuestionSchema>;
export type TheoryBlock = z.infer<typeof TheoryBlockSchema>;

// ---------- Игры и кейсы ----------
// Содержимое игр специфично для каждой игры (параметры уровней, наборы
// слов и т.п.), поэтому `data` и `levels` проверяются мягко: форма
// объекта обязательна, детали разбирает сам экран игры.

export const GameTypeSchema = z.enum([
  'attention', 'syllables', 'logic', 'costume', 'observation', // начальные классы
  'sequence', 'speech', 'ecology', 'math', // дошкольное образование
]);

export const GameSchema = z.object({
  id: NonEmpty,
  title: NonEmpty,
  type: GameTypeSchema,
  description: z.string().default(''),
  rules: z.string().default(''),
  // Блок теории, к которому привязана игра (Д-1, K5-контент план §1.5):
  // паттерн как у заданий (TaskBase.block). '' = без привязки - валидно
  // (игры «дошкольного» не поблочные); непустое значение проверяется в
  // superRefine на существование блока.
  block: z.string().default(''),
  data: z.record(z.string(), z.unknown()).default({}),
  levels: z.array(z.record(z.string(), z.unknown())).default([]),
  sources: z.array(z.unknown()).default([]),
});

export const CaseQuestionSchema = z.object({
  q: NonEmpty,
  model: z.string().default(''),
  sources: z.array(z.string()).default([]),
});

export const CaseSchema = z.object({
  id: NonEmpty,
  block: z.string().default(''),
  title: NonEmpty,
  group: z.string().default(''),
  situation: NonEmpty,
  questions: z.array(CaseQuestionSchema).min(1),
  criteria: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
});

// ---------- Справочные материалы ----------

export const ReferencesSchema = z.object({
  normative: z.array(z.object({
    title: NonEmpty,
    number: z.string().default(''),
    date: z.string().default(''),
    url: z.string().default(''),
  })).default([]),
  literature: z.array(z.object({ citation: NonEmpty, url: z.string().default('') })).default([]),
  terms: z.array(z.object({ term: NonEmpty, definition: NonEmpty, source: z.string().default('') })).default([]),
});

// ---------- Настройки итогового теста ----------

export const GradeScaleSchema = z.object({
  // Минимальная доля верных ответов (0..1) для отметок 5, 4, 3.
  five: z.number().min(0).max(1).default(0.9),
  four: z.number().min(0).max(1).default(0.75),
  three: z.number().min(0).max(1).default(0.5),
}).refine((s) => s.five >= s.four && s.four >= s.three, { message: 'Пороги отметок должны убывать: 5 не ниже 4, 4 не ниже 3' });

export const TestSettingsSchema = z.object({
  questionCount: z.number().int().positive().default(20),
  timeLimitSeconds: z.number().int().positive().nullable().default(null),
  gradeScale: GradeScaleSchema.default({ five: 0.9, four: 0.75, three: 0.5 }),
});

// ---------- Контент комплекса целиком ----------

export const EumkContentSchema = z.object({
  schemaVersion: z.literal(EUMK_SCHEMA_VERSION),
  id: NonEmpty,
  title: NonEmpty,
  subtitle: z.string().default(''),
  audience: z.enum(['primary', 'preschool']),
  theory: z.array(TheoryBlockSchema).min(1),
  bank: z.array(BankQuestionSchema).min(1),
  tasks: z.array(TaskSchema).default([]),
  games: z.array(GameSchema).default([]),
  cases: z.array(CaseSchema).default([]),
  references: ReferencesSchema.default({ normative: [], literature: [], terms: [] }),
  test: TestSettingsSchema.default({ questionCount: 20, timeLimitSeconds: null, gradeScale: { five: 0.9, four: 0.75, three: 0.5 } }),
}).superRefine((content, ctx) => {
  const blockIds = new Set(content.theory.map((b) => b.id));
  const seen = new Set<string>();
  content.bank.forEach((q, index) => {
    if (seen.has(q.id)) ctx.addIssue({ code: 'custom', path: ['bank', index, 'id'], message: `Повторяющийся id вопроса ${q.id}` });
    seen.add(q.id);
    if (!blockIds.has(q.block)) ctx.addIssue({ code: 'custom', path: ['bank', index, 'block'], message: `Вопрос ${q.id} ссылается на несуществующий блок ${q.block}` });
  });
  if (content.test.questionCount > content.bank.length) {
    ctx.addIssue({ code: 'custom', path: ['test', 'questionCount'], message: 'Вопросов в тесте больше, чем в банке' });
  }
  const taskIds = new Set<string>();
  const gameIds = new Set<string>();
  content.games.forEach((game, index) => {
    if (gameIds.has(game.id)) ctx.addIssue({ code: 'custom', path: ['games', index, 'id'], message: `Повторяющийся id игры ${game.id}` });
    gameIds.add(game.id);
    // Д-1: непустая привязка игры обязана указывать на существующий блок
    // теории (тот же инвариант, что у вопросов банка).
    if (game.block !== '' && !blockIds.has(game.block)) {
      ctx.addIssue({ code: 'custom', path: ['games', index, 'block'], message: `Игра ${game.id} ссылается на несуществующий блок ${game.block}` });
    }
  });
  content.tasks.forEach((task, index) => {
    if (taskIds.has(task.id)) ctx.addIssue({ code: 'custom', path: ['tasks', index, 'id'], message: `Повторяющийся id задания ${task.id}` });
    taskIds.add(task.id);
    if (task.type === 'choice' || task.type === 'multi') {
      if (task.data.correct.some((i) => i >= task.data.options.length)) {
        ctx.addIssue({ code: 'custom', path: ['tasks', index, 'data', 'correct'], message: `Задание ${task.id}: индекс верного ответа вне списка вариантов` });
      }
    }
    if (task.type === 'sort') {
      const cats = new Set(task.data.categories);
      if (task.data.items.some((item) => !cats.has(item.category))) {
        ctx.addIssue({ code: 'custom', path: ['tasks', index, 'data', 'items'], message: `Задание ${task.id}: у элемента категория вне списка категорий` });
      }
    }
    if (task.type === 'sort' && new Set(task.data.items.map((i) => i.text)).size !== task.data.items.length) {
      ctx.addIssue({ code: 'custom', path: ['tasks', index, 'data', 'items'], message: `Задание ${task.id}: повторяются элементы` });
    }
    if (task.type === 'match' && new Set(task.data.pairs.map((p) => p[0])).size !== task.data.pairs.length) {
      ctx.addIssue({ code: 'custom', path: ['tasks', index, 'data', 'pairs'], message: `Задание ${task.id}: повторяются левые части пар` });
    }
    if (task.type === 'gaps') {
      if (task.data.answers.some((a) => !task.data.options.includes(a))) {
        ctx.addIssue({ code: 'custom', path: ['tasks', index, 'data', 'answers'], message: `Задание ${task.id}: ответ пропуска отсутствует среди вариантов` });
      }
      const gapCount = task.data.text.split('___').length - 1;
      if (gapCount !== task.data.answers.length) {
        ctx.addIssue({ code: 'custom', path: ['tasks', index, 'data', 'answers'], message: `Задание ${task.id}: число пропусков (${gapCount}) не равно числу ответов (${task.data.answers.length})` });
      }
    }
  });
});

export type EumkContent = z.infer<typeof EumkContentSchema>;
export type EumkGame = z.infer<typeof GameSchema>;
export type EumkCase = z.infer<typeof CaseSchema>;
export type GradeScale = z.infer<typeof GradeScaleSchema>;

export function parseEumkContent(raw: unknown): EumkContent {
  return EumkContentSchema.parse(raw);
}

// ---------- Локальные данные пользователей ----------

export const TestResultSchema = z.object({
  id: NonEmpty,
  accountId: NonEmpty,
  finishedAt: z.number().int(),
  durationSeconds: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  grade: z.number().int().min(2).max(5),
  // Подпись набора вопросов: по ней движок отличает уже выпадавшие комбинации.
  signature: NonEmpty,
  questionIds: z.array(NonEmpty).min(1),
});

// ---------- Пароль локальной учётной записи (K5-1) ----------
//
// В хранилище лежит ТОЛЬКО хэш: PBKDF2-HMAC-SHA256, у каждой записи своя
// криптослучайная соль. Запись самодостаточна (алгоритм и параметры внутри),
// чтобы проверка не зависела от текущих констант кода: старые записи
// продолжают проверяться своими параметрами. Версия схемы хранилища
// (EUMK_SCHEMA_VERSION) не менялась: поле пароля у аккаунта НЕобязательное,
// старые блобы данных парсятся без миграции.

// Идентификатор формата записи пароля. Появится наследник - схема будет
// расширена union'ом известных версий, чтобы старые записи оставались
// проверяемыми; записи НЕизвестных версий сейчас fail-closed (понятная
// ошибка, не «пароля нет» и не «неверный пароль»).
export const PASSWORD_RECORD_VERSION = 1;

export const PBKDF2_ALGO_ID = 'pbkdf2-sha256';

// Итерации по OWASP Password Storage Cheat Sheet (2023) для PBKDF2-HMAC-SHA256:
// 600 000. Значение намеренно продублировано в electron/eumk/passwords.js
// (главный процесс) - общего пакета у рендерера и главного процесса нет.
export const PBKDF2_ITERATIONS = 600000;

// Верхняя граница для защиты от испорченной записи: миллионы итераций на
// каждую попытку входа заморозили бы приложение.
export const PBKDF2_MAX_ITERATIONS = 5000000;

// Криптослучайная соль на каждого пользователя, 16 байт (128 бит).
export const PASSWORD_SALT_BYTES = 16;

// Длина ключа PBKDF2 (32 байта = 256 бит) и его пределы для валидации.
export const PBKDF2_KEYLEN_BYTES = 32;
export const PBKDF2_MAX_KEYLEN_BYTES = 128;

const HexString = z.string().regex(/^[0-9a-f]+$/, 'ожидалась hex-строка');

export const PasswordRecordSchema = z.object({
  version: z.literal(PASSWORD_RECORD_VERSION),
  algo: z.literal(PBKDF2_ALGO_ID),
  iterations: z.number().int().min(1).max(PBKDF2_MAX_ITERATIONS),
  salt: HexString,
  hash: HexString,
  keyLen: z.number().int().min(16).max(PBKDF2_MAX_KEYLEN_BYTES),
  // Длины согласованы с параметрами: соль не короче PASSWORD_SALT_BYTES и
  // чётной длины (нечётный hex - обрезанная запись, её обязана настигнуть
  // ошибка «повреждена», а не «неверный пароль»), длина хэша ровно keyLen*2.
}).refine(
  (record) => record.salt.length % 2 === 0 && record.salt.length >= PASSWORD_SALT_BYTES * 2 && record.hash.length === record.keyLen * 2,
  { message: 'длины salt/hash не согласованы с keyLen' },
);

export type PasswordRecord = z.infer<typeof PasswordRecordSchema>;

export const AccountSchema = z.object({
  id: NonEmpty,
  name: NonEmpty,
  createdAt: z.number().int(),
  // Запись пароля. У аккаунтов, созданных до K5-1, поля нет - при разборе
  // становится null (миграция: при входе такому аккаунту предлагается
  // задать пароль). Здесь НЕ строгая схема, а unknown с отдельным разбором
  // через passwordRecordOf(): испорченная запись пароля не должна
  // объявлять повреждённым весь файл данных.
  password: z.unknown().nullable().default(null),
});

export const EumkUserDataSchema = z.object({
  schemaVersion: z.literal(EUMK_SCHEMA_VERSION),
  accounts: z.array(AccountSchema).default([]),
  results: z.array(TestResultSchema).default([]),
  taskProgress: z.record(z.string(), z.record(z.string(), z.boolean())).default({}),
  soundOn: z.boolean().default(true),
});

export type Account = z.infer<typeof AccountSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type EumkUserData = z.infer<typeof EumkUserDataSchema>;

export function emptyUserData(): EumkUserData {
  return { schemaVersion: EUMK_SCHEMA_VERSION, accounts: [], results: [], taskProgress: {}, soundOn: true };
}
