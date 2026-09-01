// packages/shared/src/chrono/media.ts
// Имя файла НА ДИСКЕ для записи ChronoMedia - sha256 содержимого +
// расширение оригинального имени файла. Единственная реализация: и
// player/electron/chrono/mediaStore.js (копирование при импорте, путь для
// раздачи через chronomedia://), и player/src (URL для <img>/<video> в
// рендерере) используют одну и ту же функцию, а не две параллельные
// строковые операции, которые рискуют молча разойтись.

import type { ChronoMedia } from './model/schema';

type MediaLike = Pick<ChronoMedia, 'sha256' | 'fileName'>;

/** Расширение из имени файла (с точкой, в нижнем регистре), или '' если расширения нет - тот же принцип, что у Node path.extname */
export function mediaFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

export function mediaDiskFileName(media: MediaLike): string {
  return media.sha256 + mediaFileExtension(media.fileName);
}
