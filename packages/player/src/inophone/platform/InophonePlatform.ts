// packages/player/src/inophone/platform/InophonePlatform.ts
// Вся привязка виджета к среде — в одном интерфейсе.
//
// Тот же приём, что в Типах 2 и 3, и по той же причине: у рантайма ровно две
// зависимости от среды — где лежат данные занятия и как адресуются файлы
// контента. Собранные в одном месте, они стоят один файл; размазанные по
// экранам — переписывание рантайма при каждом изменении среды.
//
// ВТОРОЙ СХЕМЫ ЗДЕСЬ НЕТ, в отличие от Типов 2 и 3. Там рядом с поставочным
// протоколом живёт протокол файлов педагога, потому что педагог добавляет свои
// картинки и записи. У «Инофона» по ТЗ редактора контента нет вовсе —
// добавлять нечего, и заводить схему «на будущее» значило бы держать
// работающий канал к файловой системе, которым никто не пользуется.

import type { InophoneApi } from '../types.ts';

export type PlatformKind = 'electron' | 'web';

export interface InophonePlatform extends InophoneApi {
  readonly kind: PlatformKind;
  /** Путь внутри пакета контента → загружаемый в этой среде URL */
  assetUrl(assetPath: string): string;
}

let current: InophonePlatform | null = null;

/** Задаётся один раз при старте рантайма */
export function setInophonePlatform(platform: InophonePlatform): void {
  current = platform;
}

export function getInophonePlatform(): InophonePlatform | null {
  return current;
}

/**
 * Платформа текущей среды. Признак — наличие моста из preload плеера: он
 * есть только в Electron.
 */
export function detectPlatformKind(): PlatformKind {
  return typeof window !== 'undefined' && window.inophoneAPI ? 'electron' : 'web';
}
