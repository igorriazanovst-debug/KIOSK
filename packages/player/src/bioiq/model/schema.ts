// zod-схемы данных виджета «БиоIQ» (Тип 10) — единственная точка, через
// которую проходят данные с границы системы (контент викторины,
// пользовательская история результатов на диске). Тот же принцип, что у
// rusiq/model/schema.ts (Тип 7) — домен адаптирован оттуда, см. план
// реализации `Тип10_БиоIQ/Био_план_реализации.md` §1.
//
// Размещено в packages/player (не packages/shared) сознательно — та же
// причина, что у rusiq: у packages/shared нет подключённого npm test.

import { z } from 'zod';

// Прямоугольная кликабельная область точки в пространстве изображения (те же
// единицы, что x/y) — x/y это ЦЕНТР прямоугольника, width/height — его
// полные размеры. Тот же паттерн, что у rusiq (найдено там живьём —
// точка-круг не даёт авторy подогнать область под силуэт ответа на
// конкретной картинке).
export const BIOIQ_DEFAULT_POINT_SIZE = 100;

export const BioiqPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().default(BIOIQ_DEFAULT_POINT_SIZE),
  height: z.number().positive().default(BIOIQ_DEFAULT_POINT_SIZE),
});
export type BioiqPoint = z.infer<typeof BioiqPointSchema>;

export const BioiqLevelIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type BioiqLevelId = z.infer<typeof BioiqLevelIdSchema>;

export const BioiqQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  answer: z.string().min(1),
  helpText: z.string().default(''),
  x: z.number(),
  y: z.number(),
  width: z.number().positive().default(BIOIQ_DEFAULT_POINT_SIZE),
  height: z.number().positive().default(BIOIQ_DEFAULT_POINT_SIZE),
  decoyPoints: z.array(BioiqPointSchema).default([]),
  // Другие экземпляры ТОЙ ЖЕ структуры на картинке (второе лёгкое, второй
  // хлоропласт): клик по ним — тоже верный ответ, а не ошибка.
  alsoCorrectPoints: z.array(BioiqPointSchema).default([]),
  price: z.number().int().positive(),
  timeSeconds: z.number().int().positive(),
  level: BioiqLevelIdSchema,
  theme: z.string().min(1),
  // FR-015 ТЗ (строка 254) — необязательная иллюстрирующая картинка к
  // вопросу/ответу/подсказке, ОТДЕЛЬНАЯ от изображения-карты уровня
  // (quiz.images[level]). Та же механика хранения, что у rusiq
  // (questionImage/answerImage/hintImage) — файл на диске, только имя
  // файла в схеме, не участвует в checkPointInBounds.
  questionImage: z.string().min(1).nullable().default(null),
  answerImage: z.string().min(1).nullable().default(null),
  hintImage: z.string().min(1).nullable().default(null),
});
export type BioiqQuestion = z.infer<typeof BioiqQuestionSchema>;

export const BioiqLevelSchema = z.object({
  id: BioiqLevelIdSchema,
  label: z.string().min(1),
});
export type BioiqLevel = z.infer<typeof BioiqLevelSchema>;

// Decoy-точка, не привязанная ни к какому вопросу (ТЗ строка 251, второй
// пункт FR-012: "координаты точки ответа на изображении без привязки к
// ней конкретного вопроса"). В отличие от rusiq (один общий quiz.image),
// у БиоIQ три изображения — поэтому у точки этого типа ЕСТЬ level, а у
// decoyPoints внутри question.decoyPoints level не нужен: он уже задан
// уровнем самого вопроса-владельца.
export const BioiqGenericDecoyPointSchema = BioiqPointSchema.extend({
  level: BioiqLevelIdSchema,
});
export type BioiqGenericDecoyPoint = z.infer<typeof BioiqGenericDecoyPointSchema>;

// Изображение-карта — с шириной/высотой РЕАЛЬНО измеренными в момент
// загрузки файла (см. quizStore/useHtmlImage у rusiq — тот же приём:
// Image.onload перед сохранением), а не переписанными из чужого
// эталонного документа. Это единственная защита от класса бага,
// стоившего rusiq ~20% некликабельных вопросов (заявленная "логическая
// сцена" разошлась с реальным пикселем PNG/JPG) — см. план реализации §2.
export const BioiqLevelImageSchema = z.object({
  fileName: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type BioiqLevelImage = z.infer<typeof BioiqLevelImageSchema>;

export const BIOIQ_QUIZ_SCHEMA_VERSION = 1 as const;

const BioiqQuizShapeSchema = z.object({
  schemaVersion: z.literal(BIOIQ_QUIZ_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().default(''),
  themes: z.array(z.string().min(1)).default([]),
  passwordHash: z.string().nullable().default(null),
  // КЛЮЧЕВОЕ ОТЛИЧИЕ ОТ RUSIQ: у БиоIQ своё изображение-карта на КАЖДЫЙ
  // из трёх уровней (спецификация эталона §7 — "выбор изображений по
  // уровням", отдельная карта для Начинающего/Опытного/Профессионала),
  // не одно общее изображение на всю викторину. Ключи — те же значения,
  // что BioiqLevelIdSchema (1|2|3), но zod-объект с числовыми ключами
  // не даёт статической полноты — полнота (все три уровня присутствуют)
  // проверяется в superRefine ниже вместе с bounds.
  images: z.record(z.string(), BioiqLevelImageSchema),
  levels: z.array(BioiqLevelSchema).min(1),
  questions: z.array(BioiqQuestionSchema).min(1),
  genericDecoyPoints: z.array(BioiqGenericDecoyPointSchema).default([]),
});

// Проверяет одну точку (x, y) на попадание в границы [0, width] x [0, height]
// изображения ЕЁ УРОВНЯ, добавляя zod issue с точным путём к полю при
// нарушении. Адаптация checkPointInBounds из rusiq — там проверка шла
// против единственного общего quiz.image, здесь — против
// quiz.images[level] конкретного вопроса.
function checkPointInBounds(
  point: { x: number; y: number },
  bounds: { width: number; height: number },
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  if (point.x < 0 || point.x > bounds.width) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'x'],
      message: `x=${point.x} выходит за границы изображения [0, ${bounds.width}]`,
    });
  }
  if (point.y < 0 || point.y > bounds.height) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'y'],
      message: `y=${point.y} выходит за границы изображения [0, ${bounds.height}]`,
    });
  }
}

export const BioiqQuizSchema = BioiqQuizShapeSchema.superRefine((quiz, ctx) => {
  // Полнота: у каждого объявленного уровня (quiz.levels) должно быть своё
  // изображение — иначе на этом уровне физически негде разместить точки.
  quiz.levels.forEach((level) => {
    if (!quiz.images[String(level.id)]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images', String(level.id)],
        message: `нет изображения-карты для уровня ${level.id} (${level.label})`,
      });
    }
  });

  quiz.questions.forEach((question, qIndex) => {
    const image = quiz.images[String(question.level)];
    if (!image) return; // уже сообщено issue выше по отсутствующему уровню
    const bounds = { width: image.width, height: image.height };
    checkPointInBounds(question, bounds, ['questions', qIndex], ctx);
    question.decoyPoints.forEach((point, pIndex) => {
      checkPointInBounds(point, bounds, ['questions', qIndex, 'decoyPoints', pIndex], ctx);
    });
    question.alsoCorrectPoints.forEach((point, pIndex) => {
      checkPointInBounds(point, bounds, ['questions', qIndex, 'alsoCorrectPoints', pIndex], ctx);
    });
  });

  quiz.genericDecoyPoints.forEach((point, pIndex) => {
    const image = quiz.images[String(point.level)];
    if (!image) return; // уже сообщено issue выше по отсутствующему уровню
    checkPointInBounds(point, { width: image.width, height: image.height }, ['genericDecoyPoints', pIndex], ctx);
  });
});
export type BioiqQuiz = z.infer<typeof BioiqQuizShapeSchema>;

// ─── Пользовательские данные — отдельно от контента ────────────────────────

export const BioiqPlayerResultSchema = z.object({
  name: z.string().min(1),
  score: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});
export type BioiqPlayerResult = z.infer<typeof BioiqPlayerResultSchema>;

export const BioiqSessionSchema = z.object({
  id: z.string().min(1),
  quizId: z.string().min(1),
  playedAtIso: z.string().min(1),
  players: z.array(BioiqPlayerResultSchema).min(1),
});
export type BioiqSession = z.infer<typeof BioiqSessionSchema>;

export const BIOIQ_USERDATA_SCHEMA_VERSION = 1 as const;

export const BioiqUserDataSchema = z.object({
  schemaVersion: z.literal(BIOIQ_USERDATA_SCHEMA_VERSION),
  sessions: z.array(BioiqSessionSchema).default([]),
  soundOn: z.boolean().default(true),
  // Предпочтение «Крупнее» на игровом поле, сохраняется между партиями (по
  // предложению пользователя 2026-09-15) - без этого поля кнопка сбрасывалась
  // при каждой новой игре, и тому, кому нужен крупный текст, приходилось
  // включать её заново каждый раз.
  boardZoomed: z.boolean().default(false),
  // null = играется встроенная методическая викторина, не magic-id.
  activeQuizId: z.string().nullable().default(null),
  // null = пароль режима учителя ещё не задан.
  teacherPinHash: z.string().nullable().default(null),
});
export type BioiqUserData = z.infer<typeof BioiqUserDataSchema>;
