// packages/player/src/rusiq/editor/useHtmlImage.ts
// Загрузка HTMLImageElement для Konva <Image> - react-konva не берёт URL
// напрямую, ему нужен уже загруженный элемент. Та же утилита, что
// packages/player/src/natcom/useHtmlImage.ts - виджеты не импортируют код
// друг у друга через границу своей папки, каждый держит свою копию.

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
