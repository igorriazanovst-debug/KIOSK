import React, { useEffect, useState, useRef } from 'react';

interface GalleryRendererProps {
  sources: Array<{ id: string; type: string; value: string }>;
  autoSwitch: boolean;
  switchInterval: number;
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  transitionDuration: number;
  showControls: boolean;
  showIndicators: boolean;
  loop: boolean;
  clipShape?: string;
  cornerRadius?: number;
  objectFit?: string;
  style: React.CSSProperties;
}

const GalleryRenderer: React.FC<GalleryRendererProps> = ({
  sources,
  autoSwitch,
  switchInterval,
  transition,
  transitionDuration,
  showControls,
  showIndicators,
  loop,
  clipShape = 'rectangle',
  cornerRadius = 20,
  objectFit = 'contain',
  style
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

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

  const goToPrevious = () => {
    setCurrentIndex(prev => {
      if (prev === 0) {
        return loop ? sources.length - 1 : 0;
      }
      return prev - 1;
    });
  };

  const goToNext = () => {
    setCurrentIndex(prev => {
      if (prev === sources.length - 1) {
        return loop ? 0 : sources.length - 1;
      }
      return prev + 1;
    });
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  // Получаем CSS clip-path для формы
  const getClipPath = (): string => {
    switch (clipShape) {
      case 'circle':
        return 'circle(50% at 50% 50%)';
      case 'ellipse':
        return 'ellipse(50% 50% at 50% 50%)';
      case 'triangle':
        return 'polygon(50% 0%, 100% 100%, 0% 100%)';
      case 'diamond':
        return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      case 'pentagon': {
        const points = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
          const x = 50 + 50 * Math.cos(angle);
          const y = 50 + 50 * Math.sin(angle);
          points.push(`${x}% ${y}%`);
        }
        return `polygon(${points.join(', ')})`;
      }
      case 'hexagon': {
        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * 2 * Math.PI / 6) - Math.PI / 2;
          const x = 50 + 50 * Math.cos(angle);
          const y = 50 + 50 * Math.sin(angle);
          points.push(`${x}% ${y}%`);
        }
        return `polygon(${points.join(', ')})`;
      }
      case 'octagon': {
        const points = [];
        for (let i = 0; i < 8; i++) {
          const angle = (i * 2 * Math.PI / 8) - Math.PI / 2;
          const x = 50 + 50 * Math.cos(angle);
          const y = 50 + 50 * Math.sin(angle);
          points.push(`${x}% ${y}%`);
        }
        return `polygon(${points.join(', ')})`;
      }
      case 'rounded-rectangle':
        return '';
      case 'rectangle':
      default:
        return '';
    }
  };

  const clipPath = getClipPath();

  const containerStyle: React.CSSProperties = {
    ...style,
    position: 'relative',
    overflow: 'hidden',
    clipPath: clipPath || undefined,
    WebkitClipPath: clipPath || undefined,
    borderRadius: clipShape === 'rounded-rectangle' ? `${cornerRadius}px` : undefined
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: objectFit as any,
    position: 'absolute',
    top: 0,
    left: 0,
    transition: transition === 'fade' ? `opacity ${transitionDuration}ms ease-in-out` : 'none',
    opacity: 1
  };

  const currentSource = sources[currentIndex];

  return (
    <div style={containerStyle}>
      {/* Изображение */}
      {currentSource && (
        <img 
          src={currentSource.value} 
          alt="" 
          style={imgStyle}
          key={currentSource.id}
        />
      )}

      {/* Контролы навигации */}
      {showControls && sources.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            disabled={!loop && currentIndex === 0}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (!loop && currentIndex === 0) ? 0.3 : 1,
              zIndex: 10
            }}
          >
            ←
          </button>
          
          <button
            onClick={goToNext}
            disabled={!loop && currentIndex === sources.length - 1}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (!loop && currentIndex === sources.length - 1) ? 0.3 : 1,
              zIndex: 10
            }}
          >
            →
          </button>
        </>
      )}

      {/* Индикаторы */}
      {showIndicators && sources.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          zIndex: 10
        }}>
          {sources.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                border: 'none',
                background: index === currentIndex ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>
      )}

      {/* Счетчик */}
      {sources.length > 1 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 10
        }}>
          {currentIndex + 1} / {sources.length}
        </div>
      )}
    </div>
  );
};

export default GalleryRenderer;
