// packages/player/src/bioiq/editor/useHtmlImage.ts
// Загрузка HTMLImageElement для Konva <Image>. Прямая копия
// rusiq/editor/useHtmlImage.ts (Тип 7) — доменно-независимо; виджеты не
// импортируют код друг у друга через границу своей папки.

import { useEffect, useState } from 'react';

export function useHtmlImage(src: string | null | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
}
