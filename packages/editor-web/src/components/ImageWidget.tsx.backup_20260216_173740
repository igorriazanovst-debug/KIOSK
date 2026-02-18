import React, { useEffect, useState, useRef } from 'react';
import { Image as KonvaImage, Rect, Group, Circle, Ellipse, RegularPolygon, Star, Line } from 'react-konva';
import { Widget } from '../types';
import { useEditorStore } from '../stores/editorStore';
import ClippedImage from './ClippedImage';
import ImageGallery from './ImageGallery';

interface ImageWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const ImageWidget: React.FC<ImageWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  // Если режим галереи - используем ImageGallery
  if (widget.properties.galleryMode) {
    return (
      <ImageGallery
        widget={widget}
        isSelected={isSelected}
        onSelect={onSelect}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
        dragBoundFunc={dragBoundFunc}
      />
    );
  }

  // Иначе стандартный режим одиночного изображения
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const groupRef = useRef<any>(null);
  
  const { clipShape = 'rectangle' } = widget.properties;

  useEffect(() => {
    if (!widget.properties.src) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      setImage(img);
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', widget.properties.src);
      setImage(null);
    };
    
    img.src = widget.properties.src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [widget.properties.src]);

  // Адаптивный режим - изменяем размер виджета под пропорции изображения
  useEffect(() => {
    if (!image || widget.properties.objectFit !== 'adaptive') return;

    const { updateWidget } = useEditorStore.getState();
    const imgRatio = image.width / image.height;
    const currentRatio = widget.width / widget.height;

    // Проверяем, нужно ли обновлять размеры
    // Используем небольшую погрешность для избежания бесконечного цикла
    if (Math.abs(imgRatio - currentRatio) > 0.01) {
      // Сохраняем ширину, меняем высоту
      const newHeight = widget.width / imgRatio;
      
      updateWidget(widget.id, {
        height: Math.round(newHeight)
      });
    }
  }, [image, widget.properties.objectFit, widget.width, widget.height, widget.id]);

  // Вычисляем размеры изображения в зависимости от objectFit
  const getImageProps = () => {
    if (!image) return null;

    const { width, height } = widget;
    const { objectFit = 'contain' } = widget.properties;
    const imgRatio = image.width / image.height;
    const widgetRatio = width / height;

    let cropX = 0;
    let cropY = 0;
    let cropWidth = image.width;
    let cropHeight = image.height;

    switch (objectFit) {
      case 'cover': {
        // Заполняет весь виджет, обрезая лишнее
        if (imgRatio > widgetRatio) {
          // Изображение шире виджета - обрезаем по бокам
          cropWidth = image.height * widgetRatio;
          cropX = (image.width - cropWidth) / 2;
        } else {
          // Изображение выше виджета - обрезаем сверху/снизу
          cropHeight = image.width / widgetRatio;
          cropY = (image.height - cropHeight) / 2;
        }
        break;
      }
      case 'contain':
        // Вписывает всё изображение с сохранением пропорций
        // Используем весь canvas виджета
        break;
      case 'fill':
        // Растягивает на весь виджет, игнорируя пропорции
        break;
      case 'scale-down': {
        // Оригинальный размер: сохраняем пропорции, масштабируем чтобы вписать
        // Это похоже на contain, но если изображение меньше виджета - не увеличиваем
        if (image.width <= width && image.height <= height) {
          // Изображение меньше виджета - показываем как есть
          cropWidth = image.width;
          cropHeight = image.height;
        } else {
          // Изображение больше - вписываем с пропорциями (как contain)
          // crop остаётся полным
        }
        break;
      }
      case 'adaptive':
        // Адаптивный режим обрабатывается отдельно через useEffect
        break;
    }

    return {
      cropX,
      cropY,
      cropWidth,
      cropHeight
    };
  };

  const imageProps = getImageProps();
  const { borderEnabled, borderStyle, borderWidth = 2, borderColor = '#000000' } = widget.properties;

  // Преобразуем borderStyle в strokeDash
  const getStrokeDash = (style: string) => {
    switch (style) {
      case 'dashed':
        return [10, 5];
      case 'dotted':
        return [2, 2];
      case 'double':
        return [];
      default:
        return [];
    }
  };

  const handleTransform = (e: any) => {
    const node = groupRef.current;
    if (!node) return;

    // Не сбрасываем scale здесь - это будет сделано в Canvas.tsx
    onTransformEnd(e);
  };

  const isLocked = widget.locked || false;
  // Рендер рамки по форме clipShape
  const renderBorder = () => {
    if (!borderEnabled) return null;

    const strokeProps: any = {
      stroke: borderColor,
      strokeWidth: borderWidth,
      dash: getStrokeDash(borderStyle),
      fill: undefined,
      listening: false,
    };

    const shape = clipShape || 'rectangle';
    const w = widget.width;
    const h = widget.height;
    const r = Math.min(w, h) / 2;
    const cx = w / 2;
    const cy = h / 2;

    switch (shape) {
      case 'circle':
        return <Circle x={cx} y={cy} radius={r} {...strokeProps} />;

      case 'ellipse':
        return <Ellipse x={cx} y={cy} radiusX={w / 2} radiusY={h / 2} {...strokeProps} />;

      case 'triangle':
        return <RegularPolygon x={cx} y={cy} sides={3} radius={r} {...strokeProps} />;

      case 'diamond':
        return <RegularPolygon x={cx} y={cy} sides={4} radius={r} rotation={45} {...strokeProps} />;

      case 'pentagon':
        return <RegularPolygon x={cx} y={cy} sides={5} radius={r} {...strokeProps} />;

      case 'hexagon':
        return <RegularPolygon x={cx} y={cy} sides={6} radius={r} {...strokeProps} />;

      case 'octagon':
        return <RegularPolygon x={cx} y={cy} sides={8} radius={r} {...strokeProps} />;

      case 'star':
        return <Star x={cx} y={cy} numPoints={5} innerRadius={r * 0.5} outerRadius={r} {...strokeProps} />;

      case 'rounded-rectangle':
        return <Rect width={w} height={h} cornerRadius={widget.properties.cornerRadius || 20} {...strokeProps} />;

      case 'rectangle':
      default:
        return <Rect width={w} height={h} {...strokeProps} />;
    }
  };


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
      onTransformEnd={handleTransform}
    >
      {/* Невидимый прямоугольник для перехвата кликов */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill="transparent"
        listening={true}
      />

      {/* Фон (если изображение не загружено) */}
      {!image && (
        <Rect
          width={widget.width}
          height={widget.height}
          fill="#9b59b6"
          listening={false}
        />
      )}

      {/* Изображение */}
      {image && (
        clipShape && clipShape !== 'rectangle' ? (
          <ClippedImage widget={widget} image={image} />
        ) : (
          imageProps && (
            <KonvaImage
              image={image}
              x={0}
              y={0}
              width={widget.width}
              height={widget.height}
              crop={{
                x: imageProps.cropX,
                y: imageProps.cropY,
                width: imageProps.cropWidth,
                height: imageProps.cropHeight
              }}
              listening={false}
            />
          )
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

      {/* Пользовательская рамка (по форме clipShape) */}
      {renderBorder()}
    </Group>
  );
};

export default ImageWidget;
