// packages/player/src/natcom/useHtmlImage.ts
// Загрузка HTMLImageElement для Konva <Image> - тот же паттерн, что
// packages/editor-web/src/components/ImageWidget.tsx (react-konva не берёт
// URL напрямую, ему нужен уже загруженный элемент).

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
