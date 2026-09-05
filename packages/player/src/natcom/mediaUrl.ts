// packages/player/src/natcom/mediaUrl.ts
// Резолвинг media.id библиотеки в реально загружаемый URL. Схема natcomlib://
// зарегистрирована в electron/main.js (protocol.handle('natcomlib', ...)).
//
// НАЙДЕНО ВЖИВУЮ (Эпик 8, живой прогон): схема зарегистрирована как
// `standard: true`, и WHATWG URL-парсер для standard-схемы с ПУСТЫМ host
// (`natcomlib:///file.svg`) не сохраняет ожидаемое host=''+pathname='/file.svg' -
// имя файла реально "проваливается" в host (`.src` реально отражается как
// `natcomlib://file.svg/`), а pathname становится '/'. Итог - main.js всегда
// получал пустой fileName и отдавал 404 молча, ни один natcomlib-ресурс
// НИКОГДА не загружался, начиная с Эпика 6 - клики/drag/resize при этом
// работали, т.к. не зависят от реальной загрузки картинки (невидимый
// Rect-перехватчик кликов, добавленный в Эпике 7, случайно маскировал баг
// во всех предыдущих живых прогонах). Фикс - непустой host ("asset"), тот
// же паттерн, что уже рабочий chronomedia://<projectId>/<fileName>.

import type { NatComLibrary } from '@kiosk/shared';

export function natcomLibraryAssetUrl(fileName: string): string {
  return `natcomlib://asset/${encodeURIComponent(fileName)}`;
}

/** media.id → готовый natcomlib:// URL, или null если ссылка не разрешилась (битая библиотека). */
export function resolveMediaUrl(library: NatComLibrary, mediaId: string | null | undefined): string | null {
  if (!mediaId) return null;
  const media = library.media.find((m) => m.id === mediaId);
  return media ? natcomLibraryAssetUrl(media.fileName) : null;
}
