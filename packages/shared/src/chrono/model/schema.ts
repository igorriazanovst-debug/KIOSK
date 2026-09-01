// packages/shared/src/chrono/model/schema.ts
// zod-схемы модели проекта «Хронолинии» — единственная точка, через которую
// проходят данные с границы системы (чтение файла с диска, импорт, будущий
// экспорт/импорт .ktl из Фазы 8) — правило «никогда не доверять внешним
// данным». z.discriminatedUnion по kind — решение архитектурного ревью,
// даёт внятные ошибки при разборе, в отличие от обычного union.
//
// Модель СОЗНАТЕЛЬНО не копирует .NET-наследие эталона (реляционные
// TimeLine/Event/TimeLineEventSet/EventMediaSet как отдельные "таблицы" ради
// совместимости с сериализованным DataSet, опечатка TimeLiteID) — здесь
// обычная вложенная JSON-структура: проект → хронолинии → события.

import { z } from 'zod';
import { CALENDAR_PRECISIONS, EPOCH_PRECISIONS } from '../precision';

// ─── ChronoMoment / ChronoInterval ─────────────────────────────────────────

export const CalendarSystemSchema = z.enum(['gregorian', 'julian']);

export const CivilDayTimeSchema = z.object({
  day: z.number().int(),
  secondOfDay: z.number().int().min(0).max(86399),
});

export const CalendarMomentSchema = z.object({
  kind: z.literal('calendar'),
  civilDay: CivilDayTimeSchema,
  precision: z.enum(CALENDAR_PRECISIONS),
  calendar: CalendarSystemSchema,
  approximate: z.boolean(),
});

export const EpochMomentSchema = z.object({
  kind: z.literal('epoch'),
  yearsBeforeEpoch: z.number().int(),
  precision: z.enum(EPOCH_PRECISIONS),
  approximate: z.boolean(),
});

export const ChronoMomentSchema = z.discriminatedUnion('kind', [CalendarMomentSchema, EpochMomentSchema]);

export const ChronoIntervalSchema = z.object({
  start: ChronoMomentSchema,
  /** null = "по настоящее время", символьно — см. chronoInterval.ts */
  end: ChronoMomentSchema.nullable(),
});

// ─── Атрибуты (строка 15 ТЗ) — 6 типов ─────────────────────────────────────

export const AttributeTypeSchema = z.enum(['string', 'number', 'boolean', 'set', 'enum', 'eventLink']);
export type AttributeType = z.infer<typeof AttributeTypeSchema>;

export const AttributeDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: AttributeTypeSchema,
  /** Допустимые значения — обязательно для type='enum'/'set', игнорируется для остальных */
  enumValues: z.array(z.string()).optional(),
});
export type AttributeDef = z.infer<typeof AttributeDefSchema>;

/**
 * Значение атрибута у конкретного события. Форма зависит от типа
 * атрибута (string→string, number→number, boolean→boolean,
 * enum→string, set→string[], eventLink→string[] id событий — "ссылок
 * может быть несколько", строка 34 ТЗ). Соответствие значения
 * заявленному типу атрибута — инвариант уровня приложения, не проверяется
 * этой схемой (та же дилемма, что и у зависимых типов вообще).
 */
export const AttributeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
export type AttributeValue = z.infer<typeof AttributeValueSchema>;

// ─── Событие ────────────────────────────────────────────────────────────

export const EventViewSchema = z.enum(['compact', 'flag', 'image', 'card']);
export type EventView = z.infer<typeof EventViewSchema>;

export const TimelineEventSchema = z.object({
  id: z.string().min(1),
  interval: ChronoIntervalSchema,
  name: z.string(),
  place: z.string().optional(),
  sources: z.array(z.string()).optional(),
  /** HTML, пропускается через DOMPurify на выводе (Фаза 5/8), не здесь при разборе */
  descriptionHtml: z.string().optional(),
  mediaIds: z.array(z.string()).default([]),
  defaultMediaId: z.string().nullable().optional(),
  /** attributeId → значение */
  attributeValues: z.record(z.string(), AttributeValueSchema).default({}),
  view: EventViewSchema,
  color: z.string().optional(),
  fontColor: z.string().optional(),
  groupId: z.string().nullable().optional(),
  verticalPriority: z.number().default(1000),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ─── Хронолиния ─────────────────────────────────────────────────────────

export const TimelineSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  events: z.array(TimelineEventSchema).default([]),
  attributes: z.array(AttributeDefSchema).default([]),
  /** Порядок/сворачивание в UI (Фаза 3/6) — минимум на сейчас */
  collapsed: z.boolean().default(false),
  color: z.string().optional(),
});
export type ChronoTimeline = z.infer<typeof TimelineSchema>;

// ─── Медиа ──────────────────────────────────────────────────────────────

export const MediaSchema = z.object({
  id: z.string().min(1),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  /** Дедупликация (Фаза 5) */
  sha256: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  duration: z.number().optional(),
});
export type ChronoMedia = z.infer<typeof MediaSchema>;

// ─── Проект (корневой документ) ────────────────────────────────────────

/**
 * Версия схемы данных проекта. Меняется только вручную вместе с добавлением
 * ветки в migrateToLatest (project.ts) — правило архитектурного ревью:
 * без версии любое будущее изменение лестницы precision или опорного года
 * молча переинтерпретирует уже сохранённые проекты (формат без БД-миграций).
 */
export const CHRONO_PROJECT_SCHEMA_VERSION = 1 as const;

export const ChronoProjectSchema = z.object({
  schemaVersion: z.literal(CHRONO_PROJECT_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string(),
  timelines: z.array(TimelineSchema).default([]),
  media: z.array(MediaSchema).default([]),
  compareStrip: z.object({ enabled: z.boolean(), color: z.string() }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChronoProject = z.infer<typeof ChronoProjectSchema>;
