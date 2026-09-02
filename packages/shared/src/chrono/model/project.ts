// packages/shared/src/chrono/model/project.ts
// Разбор/валидация проекта с границы системы + миграции версий схемы +
// проверка сериализуемости при ЗАПИСИ (не только при чтении) — решения
// архитектурного ревью, Фаза 2.

import { z } from 'zod';
import {
  ChronoProjectSchema,
  CHRONO_PROJECT_SCHEMA_VERSION,
  type ChronoProject,
} from './schema';
import { assertFiniteMoment } from '../chronoMoment';

export class ChronoProjectParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ChronoProjectParseError';
  }
}

const VersionProbeSchema = z.object({ schemaVersion: z.number().optional() });

/**
 * Приводит произвольный документ (любой прежней версии) к текущей схеме.
 * v1 — первая версия, миграций пока нет, но функция существует с первого
 * дня — правило ревью: без неё первое же изменение лестницы precision или
 * опорного года будет НЕКУДА вставить, кроме как молча переинтерпретировать
 * всё, что уже сохранено.
 */
function migrateToLatest(raw: unknown, fromVersion: number): unknown {
  if (fromVersion === CHRONO_PROJECT_SCHEMA_VERSION) {
    return raw;
  }
  if (fromVersion > CHRONO_PROJECT_SCHEMA_VERSION) {
    throw new ChronoProjectParseError(
      `Документ сохранён более новой версией приложения (schemaVersion=${fromVersion}), эта версия умеет до ${CHRONO_PROJECT_SCHEMA_VERSION}`
    );
  }
  // fromVersion < CHRONO_PROJECT_SCHEMA_VERSION, включая 0 (поле отсутствует
  // вовсе) — веток миграции пока нет, добавлять сюда по мере роста версии.
  throw new ChronoProjectParseError(
    `Нет миграции с версии ${fromVersion} на ${CHRONO_PROJECT_SCHEMA_VERSION}`
  );
}

/**
 * Разбирает и валидирует документ проекта с границы системы (файл на диске,
 * импорт). Бросает ChronoProjectParseError с понятным сообщением, а не
 * пропускает сырые ошибки zod дальше.
 */
export function parseChronoProject(raw: unknown): ChronoProject {
  const probe = VersionProbeSchema.safeParse(raw);
  const fromVersion = probe.success ? (probe.data.schemaVersion ?? 0) : 0;

  const migrated = fromVersion === CHRONO_PROJECT_SCHEMA_VERSION ? raw : migrateToLatest(raw, fromVersion);

  const result = ChronoProjectSchema.safeParse(migrated);
  if (!result.success) {
    throw new ChronoProjectParseError('Документ проекта не прошёл валидацию схемы', result.error);
  }
  return result.data;
}

/**
 * Бросает, если проект содержит NaN/Infinity где-либо во вложенных
 * ChronoMoment — проверка ПЕРЕД записью на диск, не только при чтении.
 * JSON.stringify превращает NaN/Infinity в null молча — арифметическая
 * ошибка где-то в Фазе 6 иначе тихо портит файл проекта при автосохранении.
 */
export function assertProjectSerializable(project: ChronoProject): void {
  for (const timeline of project.timelines) {
    for (const event of timeline.events) {
      assertFiniteMoment(event.interval.start);
      if (event.interval.end !== null) {
        assertFiniteMoment(event.interval.end);
      }
    }
  }
}

export { ChronoProjectSchema, CHRONO_PROJECT_SCHEMA_VERSION };
export type { ChronoProject } from './schema';
