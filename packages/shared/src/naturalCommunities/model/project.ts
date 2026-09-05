// packages/shared/src/naturalCommunities/model/project.ts
// Разбор/валидация презентации и библиотеки с границы системы (файл на диске,
// импорт) + миграции версий схемы - тот же принцип, что chrono/model/project.ts.
// ТЗ (раздел 9, НФТ "Безопасность"): "пользовательские файлы не должны
// исполняться как код; входные файлы и импортируемый контент должны
// проверяться по типу/формату" - это и есть та функция валидации, не прямой
// JSON.parse где-либо ещё в коде.

import { z } from 'zod';
import {
  NatComProjectSchema,
  NATCOM_PROJECT_SCHEMA_VERSION,
  NatComLibrarySchema,
  NATCOM_LIBRARY_SCHEMA_VERSION,
  type NatComProject,
  type NatComLibrary,
} from './schema';

export class NatComParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NatComParseError';
  }
}

const VersionProbeSchema = z.object({ schemaVersion: z.number().optional() });

/**
 * Приводит произвольный документ (любой прежней версии) к текущей схеме.
 * Миграций пока нет (schemaVersion=1 - первая версия), но функция существует
 * с первого дня - без неё первое же изменение состава полей будет НЕКУДА
 * вставить как явную миграцию, кроме как молча переинтерпретировать всё, что
 * уже сохранено (тот же аргумент, что и у chrono/model/project.ts).
 */
function migrateToLatest(raw: unknown, fromVersion: number, currentVersion: number, kind: string): unknown {
  if (fromVersion === currentVersion) {
    return raw;
  }
  if (fromVersion > currentVersion) {
    throw new NatComParseError(
      `${kind} сохранён более новой версией приложения (schemaVersion=${fromVersion}), эта версия умеет до ${currentVersion}`
    );
  }
  throw new NatComParseError(`Нет миграции ${kind} с версии ${fromVersion} на ${currentVersion}`);
}

/**
 * Разбирает и валидирует презентацию с границы системы (файл на диске,
 * импорт). Бросает NatComParseError с понятным сообщением, а не пропускает
 * сырые ошибки zod дальше.
 */
export function parseNatComProject(raw: unknown): NatComProject {
  const probe = VersionProbeSchema.safeParse(raw);
  const fromVersion = probe.success ? (probe.data.schemaVersion ?? 0) : 0;
  const migrated =
    fromVersion === NATCOM_PROJECT_SCHEMA_VERSION
      ? raw
      : migrateToLatest(raw, fromVersion, NATCOM_PROJECT_SCHEMA_VERSION, 'Презентация');

  const result = NatComProjectSchema.safeParse(migrated);
  if (!result.success) {
    throw new NatComParseError('Документ презентации не прошёл валидацию схемой', result.error);
  }
  return result.data;
}

/**
 * Разбирает и валидирует библиотеку (поставочный, read-only каталог фонов/
 * категорий/объектов) - та же дисциплина, что и у презентации: битая
 * библиотека валит загрузку с понятной ошибкой, а не рендерится частично.
 */
export function parseNatComLibrary(raw: unknown): NatComLibrary {
  const probe = VersionProbeSchema.safeParse(raw);
  const fromVersion = probe.success ? (probe.data.schemaVersion ?? 0) : 0;
  const migrated =
    fromVersion === NATCOM_LIBRARY_SCHEMA_VERSION
      ? raw
      : migrateToLatest(raw, fromVersion, NATCOM_LIBRARY_SCHEMA_VERSION, 'Библиотека');

  const result = NatComLibrarySchema.safeParse(migrated);
  if (!result.success) {
    throw new NatComParseError('Документ библиотеки не прошёл валидацию схемой', result.error);
  }
  return result.data;
}

/**
 * Проверяет ссылочную целостность презентации относительно библиотеки:
 * backgroundId и libraryObjectId у каждого объекта на сцене должны
 * существовать в переданной библиотеке. НЕ входит в parseNatComProject -
 * презентация может быть валидна сама по себе (например, при экспорте до
 * загрузки библиотеки); проверка целостности - отдельный шаг, вызывается
 * там, где оба документа уже на руках (см. Эпик 4/6 бэклога).
 */
export function assertProjectReferencesExist(project: NatComProject, library: NatComLibrary): void {
  const backgroundIds = new Set(library.backgrounds.map((b) => b.id));
  if (!backgroundIds.has(project.backgroundId)) {
    throw new NatComParseError(`Презентация ссылается на несуществующий фон "${project.backgroundId}"`);
  }
  const objectIds = new Set(library.objects.map((o) => o.id));
  for (const obj of project.objects) {
    if (!objectIds.has(obj.libraryObjectId)) {
      throw new NatComParseError(
        `Презентация ссылается на несуществующий объект библиотеки "${obj.libraryObjectId}"`
      );
    }
  }
}

export { NatComProjectSchema, NATCOM_PROJECT_SCHEMA_VERSION, NatComLibrarySchema, NATCOM_LIBRARY_SCHEMA_VERSION };
export type { NatComProject, NatComLibrary } from './schema';
