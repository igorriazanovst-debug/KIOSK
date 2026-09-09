// zod-схемы модели виджета «Матемашка» (Тип 6) — единственная точка, через
// которую проходят данные с границы системы (контент, зашитый в дистрибутив,
// пользовательский прогресс на диске) — тот же принцип, что у
// naturalCommunities/model/schema.ts.
//
// Минимальный состав сущностей — из ТЗ (раздел 8): Тема/подтема, Группа
// заданий, Задание, Вариант ответа, Подсказка, Математический инструмент,
// Прогресс выполнения, Медиафайл. Настройки приложения — MathMachineUserData.soundOn.

import { z } from 'zod';

export const MediaAssetSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1).max(255).refine((s) => !/[/\\]/.test(s), 'fileName must not contain path separators'),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be a 64-character lowercase hex string'),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

/** Типы заданий Этапа 1 + Этапа 2b, волны 1-3 (спеки 2026-09-08). */
export const TASK_TYPE_IDS = [
  'number_counting',
  'number_sum_two',
  'number_sum_three',
  'number_missing',
  'compare_length',
  'number_subtract_two',
  'number_compare',
  'digit_recognition',
  'number_composition',
  'number_ordering',
  'number_multiply_two',
  'number_divide_remainder',
  'number_multiple_check',
  'round_to_ten',
  'ordinal_position',
  'share_of_whole',
  // Этап 3 (2026-09-09) — Группа 1 покрытия FR-022: виды тем ТЗ за
  // пределами арифметики (величины/время/дроби-оценки), найденные при
  // сверке кода с полным текстом ТЗ_06_Матемашка.docx — см.
  // Тип6_бэклог.md, Эпик 30.
  'compare_mass',
  'compare_volume',
  'weekday_order',
  'season_order',
  'event_order',
  'estimate_mass_volume',
  'estimate_fraction',
] as const;
export const TaskTypeIdSchema = z.enum(TASK_TYPE_IDS);
export type TaskTypeId = z.infer<typeof TaskTypeIdSchema>;

/** Параметры задания: числа или массивы чисел (для number_missing — сама последовательность). */
export const TaskParamsSchema = z.record(z.string(), z.union([z.number(), z.array(z.number())]));
export type TaskParams = z.infer<typeof TaskParamsSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  typeId: TaskTypeIdSchema,
  /** Текст задания — отображается и озвучивается (FR-013). */
  text: z.string().min(1),
  params: TaskParamsSchema,
  correctAnswer: z.union([z.number(), z.string()]),
  /** Варианты для типов с режимом ответа "выбор" (напр. compare_length). */
  choices: z.array(z.union([z.number(), z.string()])).optional(),
  /** Ссылка на MediaAsset.id с готовой (офлайн) озвучкой текста задания. */
  audioTaskTextId: z.string().min(1).nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Первый id — обучающее задание группы (спека, разд. 6). */
  taskIds: z.array(z.string().min(1)).min(1),
});
export type Group = z.infer<typeof GroupSchema>;

export const TopicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  groupIds: z.array(z.string().min(1)).min(1),
});
export type Topic = z.infer<typeof TopicSchema>;

export const SectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  topicIds: z.array(z.string().min(1)).min(1),
});
export type Section = z.infer<typeof SectionSchema>;

/** Этап 1 — «Весы»; Этап 2a добавил 'chain'/'two_segments' (ТЗ FR-024). */
export const MATH_TOOL_IDS = ['weights', 'chain', 'two_segments'] as const;
export const MathToolSchema = z.object({
  id: z.enum(MATH_TOOL_IDS),
  name: z.string().min(1),
});
export type MathTool = z.infer<typeof MathToolSchema>;

export const MATHMACHINE_CONTENT_SCHEMA_VERSION = 1 as const;

export const MathMachineContentSchema = z.object({
  schemaVersion: z.literal(MATHMACHINE_CONTENT_SCHEMA_VERSION),
  sections: z.array(SectionSchema).default([]),
  topics: z.record(z.string(), TopicSchema).default({}),
  groups: z.record(z.string(), GroupSchema).default({}),
  tasks: z.record(z.string(), TaskSchema).default({}),
  mathTools: z.array(MathToolSchema).default([]),
  media: z.record(z.string(), MediaAssetSchema).default({}),
});
export type MathMachineContent = z.infer<typeof MathMachineContentSchema>;

// ─── Пользовательские данные — отдельно от контента (спека, разд. 3) ────

export const GroupProgressSchema = z.object({
  doneTaskIds: z.array(z.string().min(1)).default([]),
  currentTaskId: z.string().min(1).nullable().default(null),
});
export type GroupProgress = z.infer<typeof GroupProgressSchema>;

export const MATHMACHINE_USERDATA_SCHEMA_VERSION = 1 as const;

export const MathMachineUserDataSchema = z.object({
  schemaVersion: z.literal(MATHMACHINE_USERDATA_SCHEMA_VERSION),
  progress: z.record(z.string(), GroupProgressSchema).default({}),
  soundOn: z.boolean().default(true),
});
export type MathMachineUserData = z.infer<typeof MathMachineUserDataSchema>;
