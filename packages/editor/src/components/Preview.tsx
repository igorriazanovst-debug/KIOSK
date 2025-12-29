import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Project, Widget } from '../types';
import './Preview.css';
import GalleryRenderer from './GalleryRenderer';
import PlaylistRenderer from './PlaylistRenderer';

interface PreviewProps {
  project: Project;
  onClose: () => void;
}

const Preview: React.FC<PreviewProps> = ({ project, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  const [expandedMenuItem, setExpandedMenuItem] = useState<string | null>(null);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set());
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState<{ title: string; content: string; width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Выполнение действий
  const executeActions = (actions: any[]) => {
    if (!actions || actions.length === 0) return;

    actions.forEach(action => {
      switch (action.type) {
        case 'url':
          if (action.url) {
            if (action.openInNewTab) {
              window.open(action.url, '_blank');
            } else {
              window.location.href = action.url;
            }
          }
          break;

        case 'page':
          // TODO: Реализация переключения страниц
          console.log('Navigate to page:', action.pageId);
          break;

        case 'popup':
          setPopupData({
            title: action.popupTitle || 'Сообщение',
            content: action.popupContent || '',
            width: action.popupWidth || 400,
            height: action.popupHeight || 300
          });
          setPopupVisible(true);
          break;

        case 'widget_show':
          if (action.targetWidgetId) {
            setHiddenWidgets(prev => {
              const newSet = new Set(prev);
              newSet.delete(action.targetWidgetId);
              return newSet;
            });
          }
          break;

        case 'widget_hide':
          if (action.targetWidgetId) {
            setHiddenWidgets(prev => new Set(prev).add(action.targetWidgetId));
          }
          break;

        case 'video_play':
          if (action.targetWidgetId) {
            const video = videoRefs.current.get(action.targetWidgetId);
            if (video) {
              video.play();
            }
          }
          break;

        case 'video_stop':
          if (action.targetWidgetId) {
            const video = videoRefs.current.get(action.targetWidgetId);
            if (video) {
              video.pause();
            }
          }
          break;
      }
    });
  };

  // Обработка Escape для выхода
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Рендер виджета в HTML
  const renderWidget = (widget: Widget) => {
    // Проверяем, скрыт ли виджет
    if (hiddenWidgets.has(widget.id)) {
      return null;
    }

    const commonStyle: React.CSSProperties = {
      position: 'absolute',
      left: widget.x,
      top: widget.y,
      width: widget.width,
      height: widget.height,
      transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
      zIndex: widget.zIndex || 0,
      boxSizing: 'border-box'
    };

    switch (widget.type) {
      case 'shape':
      case 'rectangle':
        return renderShape(widget, commonStyle);
      
      case 'text':
        return renderText(widget, commonStyle);
      
      case 'button':
        return renderButton(widget, commonStyle);
      
      case 'image':
        return renderImage(widget, commonStyle);
      
      case 'video':
        return renderVideo(widget, commonStyle);
      
      case 'menu':
        return renderMenu(widget, commonStyle);
      
      default:
        return null;
    }
  };

  // Рендер фигуры
  const renderShape = (widget: Widget, baseStyle: React.CSSProperties) => {
    const { 
      shapeType = 'rectangle', 
      fillColor = '#4a90e2', 
      strokeColor = '#2c3e50', 
      strokeWidth = 0, 
      cornerRadius = 0, 
      opacity = 1 
    } = widget.properties;

    const style: React.CSSProperties = {
      ...baseStyle,
      backgroundColor: fillColor,
      opacity,
      border: strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none',
      borderRadius: shapeType === 'rectangle' && cornerRadius ? `${cornerRadius}px` : undefined
    };

    // Для круга и других фигур используем CSS
    if (shapeType === 'circle' || shapeType === 'ellipse') {
      style.borderRadius = '50%';
    }

    return <div key={widget.id} style={style} />;
  };

  // Рендер текста
  const renderText = (widget: Widget, baseStyle: React.CSSProperties) => {
    const {
      text = 'Text',
      fontSize = 16,
      fontFamily = 'Arial',
      fontWeight = 'normal',
      fontStyle = 'normal',
      textAlign = 'left',
      verticalAlign = 'top',
      textColor = '#000000',
      backgroundColor = '#ffffff',
      lineHeight = 1.2,
      padding = 8,
      textDecoration = 'none'
    } = widget.properties;

    const style: React.CSSProperties = {
      ...baseStyle,
      backgroundColor,
      color: textColor,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      textAlign: textAlign as any,
      lineHeight,
      padding,
      textDecoration,
      display: 'flex',
      alignItems: verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word'
    };

    return (
      <div key={widget.id} style={style}>
        {text}
      </div>
    );
  };

  // Рендер кнопки
  const renderButton = (widget: Widget, baseStyle: React.CSSProperties) => {
    const {
      text = 'Button',
      backgroundColor = '#4a90e2',
      textColor = '#ffffff',
      fontSize = 16,
      fontFamily = 'Arial',
      fontWeight = 'normal',
      textAlign = 'center',
      borderRadius = 4,
      borderWidth = 0,
      borderColor = '#000000',
      borderStyle = 'solid',
      paddingX = 16,
      paddingY = 8,
      shadowEnabled = false,
      shadowColor = '#000000',
      shadowBlur = 10,
      shadowOffsetX = 0,
      shadowOffsetY = 4,
      shadowOpacity = 0.3,
      actions = []
    } = widget.properties;

    const style: React.CSSProperties = {
      ...baseStyle,
      backgroundColor,
      color: textColor,
      fontSize,
      fontFamily,
      fontWeight,
      textAlign: textAlign as any,
      borderRadius,
      border: borderWidth > 0 ? `${borderWidth}px ${borderStyle} ${borderColor}` : 'none',
      padding: `${paddingY}px ${paddingX}px`,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: shadowEnabled ? `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}${Math.round(shadowOpacity * 255).toString(16).padStart(2, '0')}` : undefined,
      transition: 'transform 0.1s, box-shadow 0.1s'
    };

    const handleClick = () => {
      executeActions(actions);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rotation = widget.rotation ? `rotate(${widget.rotation}deg) ` : '';
      e.currentTarget.style.transform = `${rotation}scale(0.95)`;
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rotation = widget.rotation ? `rotate(${widget.rotation}deg) ` : '';
      e.currentTarget.style.transform = `${rotation}scale(1)`;
    };

    return (
      <button
        key={widget.id}
        style={style}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {text}
      </button>
    );
  };

  // Рендер изображения
  const renderImage = (widget: Widget, baseStyle: React.CSSProperties) => {
    const { 
      src = '', 
      objectFit = 'contain', 
      borderEnabled = false, 
      borderWidth = 2, 
      borderColor = '#000000',
      clipShape = 'rectangle',
      cornerRadius = 20,
      galleryMode = false,
      sources = [],
      autoSwitch = false,
      switchInterval = 3,
      transition = 'fade',
      transitionDuration = 500,
      showControls = true,
      showIndicators = true,
      loop = true
    } = widget.properties;

    // Если режим галереи
    if (galleryMode && sources.length > 0) {
      const style: React.CSSProperties = {
        ...baseStyle,
        border: borderEnabled ? `${borderWidth}px solid ${borderColor}` : undefined
      };

      return (
        <GalleryRenderer
          key={widget.id}
          sources={sources}
          autoSwitch={autoSwitch}
          switchInterval={switchInterval}
          transition={transition}
          transitionDuration={transitionDuration}
          showControls={showControls}
          showIndicators={showIndicators}
          loop={loop}
          clipShape={clipShape}
          cornerRadius={cornerRadius}
          objectFit={objectFit}
          style={style}
        />
      );
    }

    // Одиночное изображение
    // Получаем CSS clip-path для формы
    const getClipPath = (): string => {
      const w = widget.width;
      const h = widget.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2;

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

    const style: React.CSSProperties = {
      ...baseStyle,
      border: borderEnabled ? `${borderWidth}px solid ${borderColor}` : undefined,
      overflow: 'hidden',
      clipPath: clipPath || undefined,
      WebkitClipPath: clipPath || undefined,
      borderRadius: clipShape === 'rounded-rectangle' ? `${cornerRadius}px` : undefined
    };

    const imgStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: objectFit === 'adaptive' ? 'contain' : objectFit as any
    };

    return (
      <div key={widget.id} style={style}>
        {src && <img src={src} alt="" style={imgStyle} />}
      </div>
    );
  };

  // Рендер видео
  const renderVideo = (widget: Widget, baseStyle: React.CSSProperties) => {
    const {
      sourceType = 'url',
      src = '',
      rtspUrl = '',
      objectFit = 'contain',
      autoplay = false,
      loop = false,
      muted = true,
      controls = true,
      borderEnabled = false,
      borderWidth = 2,
      borderColor = '#000000',
      playlistMode = false,
      sources = [],
      autoNext = true,
      showPlaylist = true,
      playlistPosition = 'right',
      clipShape = 'rectangle',
      cornerRadius = 20
    } = widget.properties;

    // Если режим плейлиста
    if (playlistMode && sources.length > 0) {
      const style: React.CSSProperties = {
        ...baseStyle,
        border: borderEnabled ? `${borderWidth}px solid ${borderColor}` : undefined
      };

      return (
        <PlaylistRenderer
          key={widget.id}
          sources={sources}
          autoplay={autoplay}
          autoNext={autoNext}
          loop={loop}
          controls={controls}
          muted={muted}
          showPlaylist={showPlaylist}
          playlistPosition={playlistPosition}
          clipShape={clipShape}
          cornerRadius={cornerRadius}
          objectFit={objectFit}
          style={style}
        />
      );
    }

    // Одиночное видео
    const style: React.CSSProperties = {
      ...baseStyle,
      border: borderEnabled ? `${borderWidth}px solid ${borderColor}` : undefined,
      overflow: 'hidden'
    };

    const videoStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: objectFit === 'adaptive' ? 'contain' : objectFit as any
    };

    const videoSrc = sourceType === 'rtsp' ? rtspUrl : src;

    return (
      <div key={widget.id} style={style}>
        {videoSrc && (
          <video
            ref={(el) => {
              if (el) {
                videoRefs.current.set(widget.id, el);
              }
            }}
            src={videoSrc}
            style={videoStyle}
            autoPlay={autoplay}
            loop={loop}
            muted={muted}
            controls={controls}
          />
        )}
      </div>
    );
  };

  // Рендер меню
  const renderMenu = (widget: Widget, baseStyle: React.CSSProperties) => {
    const {
      orientation = 'horizontal',
      items = [],
      backgroundColor = '#2c3e50',
      textColor = '#ffffff',
      hoverColor = '#34495e',
      fontSize = 16,
      fontFamily = 'Arial',
      itemPadding = 16,
      submenuBackgroundColor = '#34495e',
      submenuTextColor = '#ffffff',
      borderWidth = 0,
      borderColor = '#000000',
      itemHeight = 40
    } = widget.properties;

    const style: React.CSSProperties = {
      ...baseStyle,
      backgroundColor,
      display: 'flex',
      flexDirection: orientation === 'vertical' ? 'column' : 'row',
      border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : undefined,
      overflow: 'visible'
    };

    return (
      <div key={widget.id} style={style}>
        {items.map((item: any) => (
          <div key={item.id} style={{ position: 'relative' }}>
            <div
              style={{
                height: itemHeight,
                padding: `0 ${itemPadding}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: orientation === 'vertical' ? 'flex-start' : 'center',
                backgroundColor: hoveredMenuItem === item.id ? hoverColor : 'transparent',
                color: textColor,
                fontSize,
                fontFamily,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                userSelect: 'none'
              }}
              onMouseEnter={() => setHoveredMenuItem(item.id)}
              onMouseLeave={() => setHoveredMenuItem(null)}
              onClick={() => {
                // Действия пункта меню
                if (item.actions && item.actions.length > 0) {
                  executeActions(item.actions);
                }
                // Раскрытие подменю
                if (item.children && item.children.length > 0) {
                  setExpandedMenuItem(expandedMenuItem === item.id ? null : item.id);
                }
              }}
            >
              {item.label}
              {item.children && item.children.length > 0 && (
                <span style={{ marginLeft: '8px', fontSize: '10px' }}>
                  {orientation === 'horizontal' ? '▼' : (expandedMenuItem === item.id ? '▼' : '▶')}
                </span>
              )}
            </div>

            {/* Подменю */}
            {expandedMenuItem === item.id && item.children && item.children.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  [orientation === 'horizontal' ? 'top' : 'left']: itemHeight,
                  [orientation === 'horizontal' ? 'left' : 'top']: 0,
                  backgroundColor: submenuBackgroundColor,
                  minWidth: orientation === 'horizontal' ? '200px' : '100%',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  zIndex: 1000
                }}
              >
                {item.children.map((child: any) => (
                  <div
                    key={child.id}
                    style={{
                      height: itemHeight,
                      padding: `0 ${itemPadding}px`,
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: hoveredMenuItem === child.id ? hoverColor : 'transparent',
                      color: submenuTextColor,
                      fontSize: fontSize - 2,
                      fontFamily,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onMouseEnter={() => setHoveredMenuItem(child.id)}
                    onMouseLeave={() => setHoveredMenuItem(null)}
                    onClick={() => {
                      if (child.actions && child.actions.length > 0) {
                        executeActions(child.actions);
                      }
                    }}
                  >
                    {child.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`preview-overlay ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="preview-container" ref={containerRef}>
        {/* Шапка */}
        <div className="preview-header">
          <div className="preview-title">
            <span>Превью: {project.name}</span>
            <span className="preview-resolution">
              {project.canvas.width} × {project.canvas.height}
            </span>
          </div>
          <div className="preview-controls">
            <button
              className="preview-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              className="preview-btn"
              onClick={onClose}
              title="Закрыть (Escape)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Холст превью */}
        <div className="preview-content">
          <div
            className="preview-canvas"
            style={{
              width: project.canvas.width,
              height: project.canvas.height,
              backgroundColor: project.canvas.backgroundColor || '#ffffff',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {project.widgets
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map(widget => renderWidget(widget))}
          </div>
        </div>

        {/* Подсказки */}
        <div className="preview-hints">
          <span>ESC - выход</span>
          {!isFullscreen && <span>F11 или кнопка - полный экран</span>}
        </div>
      </div>

      {/* Popup */}
      {popupVisible && popupData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20000
          }}
          onClick={() => setPopupVisible(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              width: popupData.width,
              maxHeight: popupData.height,
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#e0e0e0',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => setPopupVisible(false)}
            >
              ×
            </button>
            <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '20px' }}>
              {popupData.title}
            </h3>
            <div style={{ color: '#555', fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {popupData.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Preview;
