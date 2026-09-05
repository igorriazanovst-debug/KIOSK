// packages/natcom-student-web/src/useHtmlImage.ts
// Тот же хук, что packages/player/src/natcom/useHtmlImage.ts (react-konva
// <Image> нужен уже загруженный HTMLImageElement, не URL напрямую).

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
