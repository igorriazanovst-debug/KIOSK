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

export const RusiqQuizSchema = z.object({
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
export type RusiqQuiz = z.infer<typeof RusiqQuizSchema>;

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
});
export type RusiqUserData = z.infer<typeof RusiqUserDataSchema>;
