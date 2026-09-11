// zod-схемы данных виджета «РусIQ» (Тип 7) — единственная точка, через
// которую проходят данные с границы системы (контент викторины,
// пользовательская история результатов на диске). Тот же принцип, что у
// mathmachine/model/schema.ts.
//
// Размещено в packages/player (не packages/shared) сознательно — см.
// Global Constraints плана: у packages/shared нет подключённого npm test.

import { z } from 'zod';

export const RusiqPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type RusiqPoint = z.infer<typeof RusiqPointSchema>;

export const RusiqLevelIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type RusiqLevelId = z.infer<typeof RusiqLevelIdSchema>;

export const RusiqQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  answer: z.string().min(1),
  helpText: z.string().default(''),
  x: z.number(),
  y: z.number(),
  decoyPoints: z.array(RusiqPointSchema).default([]),
  price: z.number().int().positive(),
  timeSeconds: z.number().int().positive(),
  level: RusiqLevelIdSchema,
  theme: z.string().min(1),
});
export type RusiqQuestion = z.infer<typeof RusiqQuestionSchema>;

export const RusiqLevelSchema = z.object({
  id: RusiqLevelIdSchema,
  label: z.string().min(1),
});
export type RusiqLevel = z.infer<typeof RusiqLevelSchema>;

export const RUSIQ_QUIZ_SCHEMA_VERSION = 1 as const;

const RusiqQuizShapeSchema = z.object({
  schemaVersion: z.literal(RUSIQ_QUIZ_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().default(''),
  themes: z.array(z.string().min(1)).default([]),
  passwordHash: z.string().nullable().default(null),
  image: z.object({
    fileName: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  levels: z.array(RusiqLevelSchema).min(1),
  questions: z.array(RusiqQuestionSchema).min(1),
  genericDecoyPoints: z.array(RusiqPointSchema).default([]),
});

// Проверяет одну точку (x, y) на попадание в границы [0, width] x [0, height]
// заявленного изображения, добавляя zod issue с точным путём к полю при
// нарушении. Вынесено в helper, т.к. проверяется несколько источников точек
// (вопросы, decoyPoints каждого вопроса, genericDecoyPoints) — находка 1
// финального ревью: несоответствие заявленных image.width/height реальному
// пиксельному пространству координат один раз уже сделало ~20% вопросов
// некликабельными и осталось незамеченным до целенаправленной проверки.
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

export const RusiqQuizSchema = RusiqQuizShapeSchema.superRefine((quiz, ctx) => {
  const bounds = { width: quiz.image.width, height: quiz.image.height };

  quiz.questions.forEach((question, qIndex) => {
    checkPointInBounds(question, bounds, ['questions', qIndex], ctx);
    question.decoyPoints.forEach((point, pIndex) => {
      checkPointInBounds(point, bounds, ['questions', qIndex, 'decoyPoints', pIndex], ctx);
    });
  });

  quiz.genericDecoyPoints.forEach((point, pIndex) => {
    checkPointInBounds(point, bounds, ['genericDecoyPoints', pIndex], ctx);
  });
});
export type RusiqQuiz = z.infer<typeof RusiqQuizShapeSchema>;

// ─── Пользовательские данные — отдельно от контента ────────────────────────

export const RusiqPlayerResultSchema = z.object({
  name: z.string().min(1),
  score: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});
export type RusiqPlayerResult = z.infer<typeof RusiqPlayerResultSchema>;

export const RusiqSessionSchema = z.object({
  id: z.string().min(1),
  quizId: z.string().min(1),
  playedAtIso: z.string().min(1),
  players: z.array(RusiqPlayerResultSchema).min(1),
});
export type RusiqSession = z.infer<typeof RusiqSessionSchema>;

export const RUSIQ_USERDATA_SCHEMA_VERSION = 1 as const;

export const RusiqUserDataSchema = z.object({
  schemaVersion: z.literal(RUSIQ_USERDATA_SCHEMA_VERSION),
  sessions: z.array(RusiqSessionSchema).default([]),
  soundOn: z.boolean().default(true),
  // null = играется встроенная "Обучение грамоте", не magic-id — переживает
  // будущие правки id встроенного контента (Фаза 2a, спека разд. 2.4/1.1).
  activeQuizId: z.string().nullable().default(null),
  // null = PIN режима учителя ещё не задан (Фаза 2a, спека разд. 2.4/3).
  teacherPinHash: z.string().nullable().default(null),
});
export type RusiqUserData = z.infer<typeof RusiqUserDataSchema>;
