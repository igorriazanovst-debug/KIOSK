// packages/player/src/chrono/media.ts
// URL для отображения локальной медиатеки (chronomedia://, обработчик в
// electron/main.js) - имя файла строится через mediaDiskFileName из
// @kiosk/shared, ту же функцию использует mediaStore.js при импорте, так
// что построенный здесь URL всегда совпадает с реальным именем на диске.

import { mediaDiskFileName, type ChronoMedia } from '@kiosk/shared';

export function mediaUrl(projectId: string, media: ChronoMedia): string {
  return `chronomedia://${projectId}/${encodeURIComponent(mediaDiskFileName(media))}`;
}
