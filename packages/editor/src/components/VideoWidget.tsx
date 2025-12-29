import React, { useEffect, useState, useRef } from 'react';
import { Group, Rect, Text as KonvaText, Image as KonvaImage } from 'react-konva';
import { Widget } from '../types';
import { useEditorStore } from '../stores/editorStore';
import VideoPlaylist from './VideoPlaylist';

interface VideoWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const VideoWidget: React.FC<VideoWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  // Если режим плейлиста - используем VideoPlaylist
  if (widget.properties.playlistMode) {
    return (
      <VideoPlaylist
        widget={widget}
        isSelected={isSelected}
        onSelect={onSelect}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
        dragBoundFunc={dragBoundFunc}
      />
    );
  }

  // Иначе стандартный режим одиночного видео
  const groupRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const animationRef = useRef<number>();

  const {
    sourceType = 'url',
    src = '',
    rtspUrl = '',
    isLocalFile = false,
    fileName = '',
    objectFit = 'contain',
    borderEnabled = false,
    borderStyle = 'solid',
    borderWidth = 2,
    borderColor = '#000000',
    autoplay = false,
    loop = false,
    muted = true,
    controls = false
  } = widget.properties;

  // Создаём и настраиваем video элемент
  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.loop = loop;
    video.muted = muted;
    video.playsInline = true;
    
    if (sourceType === 'url' && src) {
      video.src = src;
      
      video.onloadedmetadata = () => {
        setVideoElement(video);
        if (autoplay) {
          video.play().catch(err => {
            console.log('Autoplay prevented:', err);
          });
        }
      };

      video.onerror = () => {
        console.error('Failed to load video:', src);
        setVideoElement(null);
      };
    } else {
      setVideoElement(null);
    }

    videoRef.current = video;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      video.pause();
      video.src = '';
      video.load();
    };
  }, [src, sourceType, autoplay, loop, muted]);

  // Анимация для обновления кадров видео
  useEffect(() => {
    if (!videoElement) return;

    const updateCanvas = () => {
      // Принудительно перерисовываем слой
      const layer = groupRef.current?.getLayer();
      if (layer) {
        layer.batchDraw();
      }
      animationRef.current = requestAnimationFrame(updateCanvas);
    };

    animationRef.current = requestAnimationFrame(updateCanvas);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [videoElement]);

  // Адаптивный режим
  useEffect(() => {
    if (objectFit !== 'adaptive' || !videoElement) return;

    const { updateWidget } = useEditorStore.getState();
    const videoRatio = videoElement.videoWidth / videoElement.videoHeight || 16 / 9;
    const currentRatio = widget.width / widget.height;

    if (Math.abs(videoRatio - currentRatio) > 0.01) {
      const newHeight = widget.width / videoRatio;
      
      updateWidget(widget.id, {
        height: Math.round(newHeight)
      });
    }
  }, [objectFit, videoElement, widget.width, widget.height, widget.id]);

  // Вычисляем размеры видео в зависимости от objectFit
  const getVideoProps = () => {
    if (!videoElement || videoElement.videoWidth === 0) return null;

    const { width, height } = widget;
    const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
    const widgetRatio = width / height;

    let sx = 0;
    let sy = 0;
    let sWidth = videoElement.videoWidth;
    let sHeight = videoElement.videoHeight;
    let dx = 0;
    let dy = 0;
    let dWidth = width;
    let dHeight = height;

    switch (objectFit) {
      case 'cover': {
        if (videoRatio > widgetRatio) {
          // Видео шире - обрезаем по бокам
          sWidth = videoElement.videoHeight * widgetRatio;
          sx = (videoElement.videoWidth - sWidth) / 2;
        } else {
          // Видео выше - обрезаем сверху/снизу
          sHeight = videoElement.videoWidth / widgetRatio;
          sy = (videoElement.videoHeight - sHeight) / 2;
        }
        break;
      }
      case 'contain': {
        // Вписываем с сохранением пропорций
        if (videoRatio > widgetRatio) {
          dHeight = width / videoRatio;
          dy = (height - dHeight) / 2;
        } else {
          dWidth = height * videoRatio;
          dx = (width - dWidth) / 2;
        }
        break;
      }
      case 'scale-down': {
        // Оригинальный размер, только если больше виджета
        if (videoElement.videoWidth <= width && videoElement.videoHeight <= height) {
          dWidth = videoElement.videoWidth;
          dHeight = videoElement.videoHeight;
          dx = (width - dWidth) / 2;
          dy = (height - dHeight) / 2;
        } else {
          // Вписываем как contain
          if (videoRatio > widgetRatio) {
            dHeight = width / videoRatio;
            dy = (height - dHeight) / 2;
          } else {
            dWidth = height * videoRatio;
            dx = (width - dWidth) / 2;
          }
        }
        break;
      }
      case 'fill':
      default:
        // Растягиваем на весь виджет
        break;
    }

    return {
      crop: { x: sx, y: sy, width: sWidth, height: sHeight },
      position: { x: dx, y: dy, width: dWidth, height: dHeight }
    };
  };

  const videoProps = getVideoProps();

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

    onTransformEnd(e);
  };

  // Обработка клика для управления воспроизведением
  const handleClick = (e: any) => {
    onSelect(e);
    
    // Если включены controls, переключаем play/pause
    if (controls && videoElement) {
      if (videoElement.paused) {
        videoElement.play();
      } else {
        videoElement.pause();
      }
    }
  };

  const isLocked = widget.locked || false;

  // Определяем текст для отображения (если видео не загружено)
  const getDisplayText = () => {
    if (sourceType === 'rtsp' && rtspUrl) {
      return `📹 RTSP\n${rtspUrl.substring(0, 30)}...`;
    }
    if (sourceType === 'url' && src) {
      if (isLocalFile && fileName) {
        return `📁 ${fileName}`;
      }
      return `🎥 Видео\n${src.substring(0, 30)}...`;
    }
    return '🎥 Видео\nНажмите для настройки';
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
      onClick={handleClick}
      onTap={handleClick}
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

      {/* Фон */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill={sourceType === 'rtsp' ? '#2c3e50' : '#f39c12'}
        listening={false}
      />

      {/* Видео (если загружено) */}
      {videoElement && videoProps ? (
        <KonvaImage
          image={videoElement}
          x={videoProps.position.x}
          y={videoProps.position.y}
          width={videoProps.position.width}
          height={videoProps.position.height}
          crop={videoProps.crop}
          listening={false}
        />
      ) : (
        /* Текст-заглушка (если видео не загружено) */
        <KonvaText
          text={getDisplayText()}
          x={0}
          y={0}
          width={widget.width}
          height={widget.height}
          fontSize={14}
          fontFamily="Arial"
          fill="#ffffff"
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      )}

      {/* Индикаторы состояния */}
      {sourceType === 'rtsp' && (
        <Rect
          x={10}
          y={10}
          width={45}
          height={20}
          fill="#ff0000"
          cornerRadius={4}
          listening={false}
        />
      )}
      
      {sourceType === 'rtsp' && (
        <KonvaText
          text="LIVE"
          x={10}
          y={13}
          width={45}
          fontSize={12}
          fontFamily="Arial"
          fontWeight="bold"
          fill="#ffffff"
          align="center"
          listening={false}
        />
      )}

      {videoElement && !videoElement.paused && (
        <KonvaText
          text="▶"
          x={widget.width - 30}
          y={10}
          fontSize={16}
          fontFamily="Arial"
          fill="#00ff00"
          listening={false}
        />
      )}

      {controls && videoElement && (
        <KonvaText
          text={videoElement.paused ? "⏸ Пауза" : "▶ Играет"}
          x={10}
          y={widget.height - 30}
          fontSize={12}
          fontFamily="Arial"
          fill="#ffffff"
          listening={false}
        />
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

      {/* Пользовательская рамка */}
      {borderEnabled && (
        <Rect
          width={widget.width}
          height={widget.height}
          stroke={borderColor}
          strokeWidth={borderWidth}
          dash={getStrokeDash(borderStyle)}
          listening={false}
        />
      )}
    </Group>
  );
};

export default VideoWidget;
