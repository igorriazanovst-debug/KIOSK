// packages/shared/src/naturalCommunities/model/schema.ts
// zod-схемы модели «Конструктора природных сообществ» (Тип 5) — единственная
// точка, через которую проходят данные с границы системы (библиотека объектов
// в поставке, презентации на диске, импорт файла) — тот же принцип, что и у
// chrono/model/schema.ts: «никогда не доверять внешним данным».
//
// Каноничный минимальный состав сущностей — из формального ТЗ (раздел 8):
// Природное сообщество (Background), Представитель сообщества (LibraryObject),
// Описание объекта (поле description на LibraryObject/ProjectObject), Медиафайл,
// Презентация (NatComProject), Сессия подключения, Статистика подключений.
// Пользователь/профиль/Лицензия/Настройки приложения переиспользуют
// существующую модель KIOSK (License/LicenseUser) — не дублируются здесь,
// см. Тип5_план_реализации.md, раздел 2.

import { z } from 'zod';

// ─── Медиафайл ──────────────────────────────────────────────────────────

export const MediaFileSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1).max(255).refine((s) => !/[/\\]/.test(s), 'fileName must not contain path separators'),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  /** Дедупликация по содержимому - ровно 64 hex-символа (sha256), тот же контракт, что у chrono/model/schema.ts MediaSchema */
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be a 64-character lowercase hex string'),
});
export type NatComMediaFile = z.infer<typeof MediaFileSchema>;

// ─── Библиотека (поставочный, read-only контент) ───────────────────────

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Category = z.infer<typeof CategorySchema>;

export const BackgroundSchema = z.object({
  id: z.string().min(1),
  /** Название природного сообщества (напр. "Тайга сибирская") */
  name: z.string().min(1),
  /** Ссылка на MediaFile.id (фоновое изображение ландшафта) */
  imageMediaId: z.string().min(1),
});
export type Background = z.infer<typeof BackgroundSchema>;

export const LibraryObjectSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  /** Название представителя (напр. "Бурый медведь") */
  name: z.string().min(1),
  /** Текстовое описание - ТЗ FR-017 (строка 116): "каждый объект должен иметь описание и изображение" */
  description: z.string().min(1),
  /** Ссылка на MediaFile.id (статичное изображение) */
  imageMediaId: z.string().min(1),
  /** Ссылка на MediaFile.id (видео поведения) - опционально: не все представители обязаны иметь анимацию для MVP-контента (см. план, раздел 5) */
  animationMediaId: z.string().nullable().optional(),
});
export type LibraryObject = z.infer<typeof LibraryObjectSchema>;

export const NATCOM_LIBRARY_SCHEMA_VERSION = 1 as const;

export const NatComLibrarySchema = z.object({
  schemaVersion: z.literal(NATCOM_LIBRARY_SCHEMA_VERSION),
  backgrounds: z.array(BackgroundSchema).default([]),
  categories: z.array(CategorySchema).default([]),
  objects: z.array(LibraryObjectSchema).default([]),
  media: z.array(MediaFileSchema).default([]),
});
export type NatComLibrary = z.infer<typeof NatComLibrarySchema>;

// ─── Презентация (проект) ──────────────────────────────────────────────

/**
 * Положение/размер объекта на сцене - в ДОЛЯХ (0..1) от размера доски, не в
 * пикселях. Сознательное отклонение от модели оригинала (там пересчёт между
 * "экранным" и "хранимым" видом через отдельные convertObject/scaleObject
 * функции, привязанные к запомненному опорному размеру) - дробные координаты
 * тривиально пересчитываются в пиксели при ЛЮБОМ размере доски простым
 * умножением (см. geometry.ts), без хранения опорного размера и без риска
 * рассинхронизации, если экран показа отличается от экрана редактирования.
 */
export const ProjectObjectSchema = z.object({
  id: z.string().min(1),
  /** Ссылка на LibraryObject.id */
  libraryObjectId: z.string().min(1),
  xFraction: z.number().min(0).max(1),
  yFraction: z.number().min(0).max(1),
  widthFraction: z.number().positive().max(1),
  heightFraction: z.number().positive().max(1),
  /** Градусы, 0 = без поворота */
  rotation: z.number().default(0),
  /** Зеркальное отражение по горизонтали - ТЗ строка 118 ("взаимное расположение") */
  flip: z.boolean().default(false),
  /** Переопределения поверх библиотечных значений - ТЗ строка 119 ("пользовательские текстовые описания") */
  titleOverride: z.string().nullable().optional(),
  descriptionOverride: z.string().nullable().optional(),
});
export type ProjectObject = z.infer<typeof ProjectObjectSchema>;

export const NATCOM_PROJECT_SCHEMA_VERSION = 1 as const;

export const NatComProjectSchema = z.object({
  schemaVersion: z.literal(NATCOM_PROJECT_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string(),
  /** Ссылка на Background.id */
  backgroundId: z.string().min(1),
  objects: z.array(ProjectObjectSchema).default([]),
  /** Владелец презентации - устраняет находку оригинала "общий файл на всех" (см. план, раздел 3, п.4) */
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  /** true у семи готовых презентаций из поставки, false у пользовательских */
  isDefault: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NatComProject = z.infer<typeof NatComProjectSchema>;

// ─── Учёт подключений (ТЗ, раздел 8: "Сессия подключения", "Статистика подключений") ─

export const ConnectionSessionSchema = z.object({
  id: z.string().min(1),
  /** Идентификатор socket.io-соединения на момент подключения */
  socketId: z.string().min(1),
  connectedAt: z.string(),
  /** null - соединение ещё активно */
  disconnectedAt: z.string().nullable(),
});
export type ConnectionSession = z.infer<typeof ConnectionSessionSchema>;

export const ConnectionStatsSchema = z.object({
  /** Сколько раз за всё время работы виджета клиент успешно подключался (join, не connect - см. Тип5_план_реализации.md, раздел 2/Фаза 4) */
  totalJoinsCount: z.number().int().nonnegative().default(0),
  /** Сколько раз подключение было отклонено из-за исчерпанной ёмкости (ТЗ FR-011) */
  totalRejectedCount: z.number().int().nonnegative().default(0),
  updatedAt: z.string(),
});
export type ConnectionStats = z.infer<typeof ConnectionStatsSchema>;
