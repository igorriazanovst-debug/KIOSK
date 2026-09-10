// packages/player/src/words/platform/WordsPlatform.ts
// Вся привязка виджета к платформе — в одном интерфейсе.
//
// ТЗ (строка 44) требует Windows И Android. Android реализуется ОТДЕЛЬНЫМ
// нативным приложением, не веб-обёрткой — решение пользователя от 08.09.2026,
// поэтому этот интерфейс к Android отношения не имеет и на него не
// рассчитан. Он нужен здесь по другой причине: у рантайма есть ровно две
// зависимости от среды — где лежат данные занятия и как адресуются файлы
// контента, — и держать их в одном месте дешевле, чем разбирать потом.
//
// Совместимость двух реализаций (эта и нативная Android) обеспечивается НЕ
// общим кодом, а общим контрактом форматов и правил — см.
// docs/words-cross-platform-contract.md и сверочные векторы рядом с ним.
//
// Ровно этот приём разбор эталона ОС3 назвал причиной, по которой перенос
// того продукта на другую платформу оценивается как малая работа: у него вся
// поверхность привязки — один класс из трёх методов.
//
// Правила (имя игрока, монотонность достижений) сюда НЕ входят: они общие и
// живут в @kiosk/shared/words/store/rules, чтобы две платформы не разошлись
// в поведении.

import type { WordsApi } from '../types.ts';

export type PlatformKind = 'electron' | 'web';

export interface WordsPlatform extends WordsApi {
  readonly kind: PlatformKind;
  /**
   * Путь внутри пакета контента → загружаемый в этой среде URL.
   * Electron отдаёт файл своим протоколом, веб — обычным относительным путём.
   */
  assetUrl(assetPath: string): string;
  /** Файл, добавленный педагогом на устройстве, → загружаемый URL */
  userMediaUrl(fileName: string): string;
}

let current: WordsPlatform | null = null;

/** Задаётся один раз при старте рантайма */
export function setWordsPlatform(platform: WordsPlatform): void {
  current = platform;
}

export function getWordsPlatform(): WordsPlatform | null {
  return current;
}

/**
 * Платформа для текущей среды. Признак — наличие моста, который выставляет
 * preload плеера: он есть только в Electron.
 */
export function detectPlatformKind(): PlatformKind {
  return typeof window !== 'undefined' && window.wordsAPI ? 'electron' : 'web';
}
