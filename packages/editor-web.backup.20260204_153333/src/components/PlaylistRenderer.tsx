import React, { useEffect, useState, useRef } from 'react';

interface PlaylistRendererProps {
  sources: Array<{ id: string; type: string; value: string; title?: string }>;
  autoplay: boolean;
  autoNext: boolean;
  loop: boolean;
  controls: boolean;
  muted: boolean;
  showPlaylist: boolean;
  playlistPosition: 'right' | 'bottom';
  clipShape?: string;
  cornerRadius?: number;
  objectFit?: string;
  style: React.CSSProperties;
}

const PlaylistRenderer: React.FC<PlaylistRendererProps> = ({
  sources,
  autoplay,
  autoNext,
  loop,
  controls,
  muted,
  showPlaylist,
  playlistPosition,
  clipShape = 'rectangle',
  cornerRadius = 20,
  objectFit = 'contain',
  style
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Автопереход к следующему видео
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoNext) return;

    const handleEnded = () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= sources.length) {
        if (loop) {
          setCurrentIndex(0);
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [currentIndex, sources.length, autoNext, loop]);

  const goToVideo = (index: number) => {
    setCurrentIndex(index);
    if (videoRef.current) {
      videoRef.current.load();
      if (autoplay) {
        videoRef.current.play().catch(err => console.log('Play prevented:', err));
      }
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      goToVideo(currentIndex - 1);
    } else if (loop) {
      goToVideo(sources.length - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < sources.length - 1) {
      goToVideo(currentIndex + 1);
    } else if (loop) {
      goToVideo(0);
    }
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
  const currentSource = sources[currentIndex];

  const isHorizontal = playlistPosition === 'bottom';
  const videoContainerStyle: React.CSSProperties = {
    flex: isHorizontal ? '1' : showPlaylist ? '0 0 70%' : '1',
    position: 'relative',
    overflow: 'hidden',
    clipPath: clipPath || undefined,
    WebkitClipPath: clipPath || undefined,
    borderRadius: clipShape === 'rounded-rectangle' ? `${cornerRadius}px` : undefined,
    backgroundColor: '#000'
  };

  const playlistContainerStyle: React.CSSProperties = {
    flex: isHorizontal ? '0 0 120px' : '0 0 30%',
    backgroundColor: '#1a1a1a',
    overflowY: 'auto',
    padding: '8px'
  };

  const mainContainerStyle: React.CSSProperties = {
    ...style,
    display: 'flex',
    flexDirection: isHorizontal ? 'column' : 'row',
    overflow: 'hidden'
  };

  return (
    <div style={mainContainerStyle}>
      {/* Видео контейнер */}
      <div style={videoContainerStyle}>
        {currentSource && (
          <video
            ref={videoRef}
            key={currentSource.id}
            autoPlay={autoplay}
            loop={false}
            muted={muted}
            controls={controls}
            style={{
              width: '100%',
              height: '100%',
              objectFit: objectFit as any
            }}
          >
            <source src={currentSource.value} />
          </video>
        )}

        {/* Контролы плейлиста поверх видео */}
        {sources.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              disabled={!loop && currentIndex === 0}
              style={{
                position: 'absolute',
                left: '10px',
                bottom: '60px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '14px',
                cursor: 'pointer',
                opacity: (!loop && currentIndex === 0) ? 0.3 : 1,
                zIndex: 10
              }}
            >
              ⏮ Назад
            </button>

            <button
              onClick={goToNext}
              disabled={!loop && currentIndex === sources.length - 1}
              style={{
                position: 'absolute',
                right: '10px',
                bottom: '60px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '14px',
                cursor: 'pointer',
                opacity: (!loop && currentIndex === sources.length - 1) ? 0.3 : 1,
                zIndex: 10
              }}
            >
              Вперёд ⏭
            </button>

            {/* Счётчик */}
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 10
            }}>
              {currentIndex + 1} / {sources.length}
            </div>
          </>
        )}
      </div>

      {/* Плейлист */}
      {showPlaylist && sources.length > 1 && (
        <div style={playlistContainerStyle}>
          <div style={{ color: '#fff', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
            Плейлист ({sources.length})
          </div>
          {sources.map((source, index) => (
            <div
              key={source.id}
              onClick={() => goToVideo(index)}
              style={{
                padding: '8px',
                marginBottom: '4px',
                backgroundColor: index === currentIndex ? '#007acc' : '#2a2a2a',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '11px',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '14px' }}>
                {index === currentIndex ? '▶' : '⏸'}
              </span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: index === currentIndex ? 'bold' : 'normal' }}>
                  {source.title || `Видео ${index + 1}`}
                </div>
                <div style={{ fontSize: '9px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {source.type === 'url' ? '🌐' : '📁'} {source.value.substring(0, 40)}...
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistRenderer;
