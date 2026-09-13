// packages/player/src/alphabet/platform/AlphabetPlatform.ts
// Вся привязка виджета к среде — в одном интерфейсе.
//
// Тот же приём, что в Тип 2, и по той же причине: у рантайма ровно две
// зависимости от среды — где лежат данные занятия и как адресуются файлы
// контента. Собранные в одном месте, они стоят один файл; размазанные по
// экранам — переписывание рантайма при каждом изменении среды.
//
// ТЗ (строка 67) требует Windows И Android. Android — ОТДЕЛЬНОЕ нативное
// приложение, а не веб-обёртка (решение пользователя от 08.09.2026), поэтому
// этот интерфейс к нему отношения не имеет. Совместимость двух реализаций
// обеспечивается общим контрактом форматов и правил в @kiosk/shared, а не
// общим кодом рантайма.

import type { AlphabetApi } from '../types.ts';

export type PlatformKind = 'electron' | 'web';

export interface AlphabetPlatform extends AlphabetApi {
  readonly kind: PlatformKind;
  /** Путь внутри пакета контента → загружаемый в этой среде URL */
  assetUrl(assetPath: string): string;
}

let current: AlphabetPlatform | null = null;

/** Задаётся один раз при старте рантайма */
export function setAlphabetPlatform(platform: AlphabetPlatform): void {
  current = platform;
}

export function getAlphabetPlatform(): AlphabetPlatform | null {
  return current;
}

/**
 * Платформа текущей среды. Признак — наличие моста из preload плеера: он
 * есть только в Electron.
 */
export function detectPlatformKind(): PlatformKind {
  return typeof window !== 'undefined' && window.alphabetAPI ? 'electron' : 'web';
}
