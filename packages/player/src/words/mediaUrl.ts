// packages/player/src/words/mediaUrl.ts
// Адресация ресурсов пакета контента.
//
// Сама схема адресации платформозависима (Electron отдаёт файлы протоколом
// wordslib://, веб и Android — обычными относительными путями), поэтому здесь
// только маршрутизация в текущую платформу. Экраны вызывают эти функции и о
// платформе ничего не знают — иначе разница между Windows и Android
// расползлась бы по всему интерфейсу.

import { wordImagePath, themeCoverPath } from '@kiosk/shared';
import { getWordsPlatform } from './platform/WordsPlatform.ts';

/** Путь внутри пакета контента → загружаемый URL текущей платформы */
export function libraryAssetUrl(assetPath: string): string {
  const platform = getWordsPlatform();
  // До инициализации платформы (первый кадр, тесты компонентов) отдаём
  // относительный путь: он безвреден и не роняет отрисовку.
  return platform ? platform.assetUrl(assetPath) : `words-library/assets/${assetPath}`;
}

/** Иллюстрация поставочного слова */
export function wordImageUrl(wordId: string): string {
  return libraryAssetUrl(wordImagePath(wordId));
}

/** Обложка темы на карте */
export function themeCoverUrl(themeId: string): string {
  return libraryAssetUrl(themeCoverPath(themeId));
}

/** Картинка или запись, добавленная педагогом на устройстве */
export function userMediaUrl(fileName: string): string {
  const platform = getWordsPlatform();
  return platform ? platform.userMediaUrl(fileName) : `user-media/${fileName}`;
}

/**
 * Иллюстрация любого слова — поставочного или своего. Экранам не нужно
 * знать, откуда слово: идентификатор своего начинается с "u".
 */
export function anyWordImageUrl(wordId: string, userImageFile?: string | null): string | null {
  if (wordId.startsWith('u')) return userImageFile ? userMediaUrl(userImageFile) : null;
  return wordImageUrl(wordId);
}
