// packages/natcom-student-web/src/mediaUrl.ts
// Тот же принцип, что packages/player/src/natcom/mediaUrl.ts, но обычный
// относительный HTTP-путь (`/library-assets/<file>`, см. server.js) -
// у браузера без Electron нет кастомного протокола natcomlib://.

import type { NatComLibrary } from '@kiosk/shared';

export function libraryAssetUrl(fileName: string): string {
  return `/library-assets/${encodeURIComponent(fileName)}`;
}

export function resolveMediaUrl(library: NatComLibrary, mediaId: string | null | undefined): string | null {
  if (!mediaId) return null;
  const media = library.media.find((m) => m.id === mediaId);
  return media ? libraryAssetUrl(media.fileName) : null;
}
