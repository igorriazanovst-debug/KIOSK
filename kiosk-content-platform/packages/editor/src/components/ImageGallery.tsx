import React, { useEffect, useState, useRef } from 'react';
import { Image as KonvaImage, Group, Rect } from 'react-konva';
import { Widget } from '../types';
import ClippedImage from './ClippedImage';

interface ImageGalleryProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  const groupRef = useRef<any>(null);
  const [images, setImages] = useState<{ [key: string]: HTMLImageElement }>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  const {
    sources = [],
    autoSwitch = false,
    switchInterval = 3,
    transition = 'fade',
    clipShape = 'rectangle',
    loop = true
  } = widget.properties;

  // Загрузка всех изображений
  useEffect(() => {
    const loadedImages: { [key: string]: HTMLImageElement } = {};
    let loadCount = 0;

    sources.forEach((source: any) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        loadedImages[source.id] = img;
        loadCount++;
        
        // Когда все загружены, обновляем состояние
        if (loadCount === sources.length) {
          setImages({ ...loadedImages });
        }
      };
      
      img.onerror = () => {
        console.error('Failed to load image:', source.value);
        loadCount++;
        if (loadCount === sources.length) {
          setImages({ ...loadedImages });
        }
      };
      
      img.src = source.value;
    });

    return () => {
      Object.values(loadedImages).forEach(img => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [sources]);

  // Автопереключение
  useEffect(() => {
    if (!autoSwitch || sources.length <= 1) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= sources.length) {
          return loop ? 0 : prev;
        }
        return next;
      });
    }, switchInterval * 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoSwitch, switchInterval, sources.length, loop]);

  const isLocked = widget.locked || false;
  const currentSource = sources[currentIndex];
  const currentImage = currentSource ? images[currentSource.id] : null;

  return (
    <Group
      ref={groupRef}
      id={widget.id}
      x={widget.x}
      y={widget.y}
      width={widget.width}
      height={widget.height}
      rotation={widget.rotation || 0}
      draggable={!isLocked}
      dragBoundFunc={dragBoundFunc}
      opacity={isLocked ? 0.6 : 1}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {/* Невидимый прямоугольник для кликов */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill="transparent"
        listening={true}
      />

      {/* Фон если изображений нет */}
      {(!currentImage || sources.length === 0) && (
        <Rect
          width={widget.width}
          height={widget.height}
          fill="#9b59b6"
          listening={false}
        />
      )}

      {/* Текущее изображение */}
      {currentImage && (
        clipShape && clipShape !== 'rectangle' ? (
          <ClippedImage widget={widget} image={currentImage} />
        ) : (
          <KonvaImage
            image={currentImage}
            x={0}
            y={0}
            width={widget.width}
            height={widget.height}
            listening={false}
          />
        )
      )}

      {/* Рамка выделения */}
      {isSelected && (
        <Rect
          width={widget.width}
          height={widget.height}
          stroke="#007acc"
          strokeWidth={2}
          listening={false}
        />
      )}

      {/* Индикатор галереи в редакторе */}
      {sources.length > 1 && (
        <Rect
          x={widget.width - 40}
          y={widget.height - 20}
          width={35}
          height={15}
          fill="rgba(0, 0, 0, 0.7)"
          cornerRadius={3}
          listening={false}
        />
      )}
      {sources.length > 1 && (
        <KonvaImage
          x={widget.width - 35}
          y={widget.height - 18}
          width={10}
          height={10}
          image={(() => {
            // Создаём иконку "gallery"
            const canvas = document.createElement('canvas');
            canvas.width = 10;
            canvas.height = 10;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#fff';
              ctx.font = '10px Arial';
              ctx.fillText('📷', 0, 9);
            }
            const img = new window.Image();
            img.src = canvas.toDataURL();
            return img;
          })()}
          listening={false}
        />
      )}
    </Group>
  );
};

export default ImageGallery;
