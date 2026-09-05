// packages/player/src/natcom/mediaUrl.ts
// Резолвинг media.id библиотеки в реально загружаемый URL. Схема natcomlib://
// зарегистрирована в electron/main.js (protocol.handle('natcomlib', ...)) -
// имя файла целиком в pathname (пустой host, три слэша), не в hostname, т.к.
// URL-хосты лаукейзятся, а имена файлов регистрозависимы.

import type { NatComLibrary } from '@kiosk/shared';

export function natcomLibraryAssetUrl(fileName: string): string {
  return `natcomlib:///${encodeURIComponent(fileName)}`;
}

/** media.id → готовый natcomlib:// URL, или null если ссылка не разрешилась (битая библиотека). */
export function resolveMediaUrl(library: NatComLibrary, mediaId: string | null | undefined): string | null {
  if (!mediaId) return null;
  const media = library.media.find((m) => m.id === mediaId);
  return media ? natcomLibraryAssetUrl(media.fileName) : null;
}
