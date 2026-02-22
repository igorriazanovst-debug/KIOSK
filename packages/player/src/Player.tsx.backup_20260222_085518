import React, { useEffect, useState, useRef } from 'react';
import './Player.css';
import GalleryRenderer from './components/GalleryRenderer';
import PlaylistRenderer from './components/PlaylistRenderer';
import { serverConnection } from './services/server-connection';

interface Project {
  name: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor?: string;
  };
  widgets: Widget[];
}

interface Widget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  rotation?: number;
  properties: any;
}

interface PlayerProps {
  embedded?: boolean;
}


// ============================================
// CLIP-PATH ГЕНЕРАТОР (правильные полигоны)
// ============================================
function getClipPathForShape(shape: string, w: number, h: number, cornerRadius: number = 0): string | undefined {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;

  const polygon = (sides: number, startAngle: number = -Math.PI / 2): string => {
    const points: string[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = startAngle + (2 * Math.PI * i) / sides;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      const pctX = ((px / w) * 100).toFixed(1);
      const pctY = ((py / h) * 100).toFixed(1);
      points.push(`${pctX}% ${pctY}%`);
    }
    return `polygon(${points.join(', ')})`;
  };

  switch (shape) {
    case 'circle':
      return `circle(${r}px at ${cx}px ${cy}px)`;
    case 'ellipse':
      return `ellipse(50% 50% at 50% 50%)`;
    case 'triangle': {
      const pts: string[] = [];
      const angles = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6];
      for (const angle of angles) {
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        pts.push(`${((px / w) * 100).toFixed(1)}% ${((py / h) * 100).toFixed(1)}%`);
      }
      return `polygon(${pts.join(', ')})`;
    }
    case 'diamond':
      return `polygon(${cx / w * 100}% 0%, 100% ${cy / h * 100}%, ${cx / w * 100}% 100%, 0% ${cy / h * 100}%)`;
    case 'pentagon':
      return polygon(5);
    case 'hexagon':
      return polygon(6);
    case 'octagon':
      return polygon(8);
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI / 5) - Math.PI / 2;
        const sr = i % 2 === 0 ? r : r * 0.5;
        const px = cx + sr * Math.cos(angle);
        const py = cy + sr * Math.sin(angle);
        pts.push(`${((px / w) * 100).toFixed(1)}% ${((py / h) * 100).toFixed(1)}%`);
      }
      return `polygon(${pts.join(', ')})`;
    }
    case 'rounded-rectangle':
      return undefined;
    case 'rectangle':
    default:
      return undefined;
  }
}

const Player: React.FC<PlayerProps> = ({ embedded = false }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set());
  const hiddenWidgetsInitialized = React.useRef(false);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  const [expandedMenuItem, setExpandedMenuItem] = useState<string | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState<any>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    loadProject();

    // Initialize server connection
    initServerConnection();

    // Слушаем загрузку проекта из main процесса
    if (window.electronAPI) {
      window.electronAPI.onLoadProject((loadedProject: Project) => {
        setProject(loadedProject);
        if (!hiddenWidgetsInitialized.current) {
          const initialHidden = new Set<string>(
            (loadedProject.widgets || []).filter((w: any) => w.visible === false).map((w: any) => w.id)
          );
          setHiddenWidgets(initialHidden);
          hiddenWidgetsInitialized.current = true;
        }
        setLoading(false);
      });
    }

    // Обработчик клавиш
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popupVisible) {
          setPopupVisible(false);
        } else if (isFullscreen && window.electronAPI) {
          window.electronAPI.toggleFullscreen().then((newState: boolean) => {
            setIsFullscreen(newState);
          });
        }
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (window.electronAPI) {
          window.electronAPI.toggleFullscreen().then((newState: boolean) => {
            setIsFullscreen(newState);
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      serverConnection.disconnect();
    };
  }, [popupVisible, isFullscreen]);

  const loadProject = async () => {
    try {
      if (window.electronAPI) {
        const loadedProject = await window.electronAPI.getProject();
        if (loadedProject) {
          setProject(loadedProject);
        } else {
          setError('Проект не найден. Используйте меню для загрузки проекта.');
        }
      } else {
        setError('Electron API недоступен');
      }
    } catch (err) {
      setError('Ошибка загрузки проекта');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initialize server connection and listen for deployments
   */
  const initServerConnection = () => {
    // Initialize with saved config
    serverConnection.init();

    // Listen for project deployments
    serverConnection.on('deployment:start', (data) => {
      console.log('[Player] Received project deployment:', data);
      
      if (data.projectData) {
        // Load deployed project
        setProject(data.projectData);
        setError(null);
        setLoading(false);
        
        // Send log to server
        serverConnection.sendLog('info', 'Project deployed successfully', {
          projectName: data.projectData.name,
          taskId: data.taskId,
        });
        
        // Show notification
        if (!embedded) {
          alert(`✅ Project "${data.projectData.name}" deployed from server!`);
        }
      }
    });

    // Listen for connection status
    serverConnection.on('connected', () => {
      console.log('[Player] Connected to server');
      serverConnection.sendLog('info', 'Player started');
    });

    serverConnection.on('disconnected', () => {
      console.log('[Player] Disconnected from server');
    });
  };

  const handleOpenProject = async () => {
    if (window.electronAPI) {
      const loadedProject = await window.electronAPI.openProject();
      if (loadedProject) {
        setProject(loadedProject);
        setError(null);
      }
    }
  };

  const executeActions = (actions: any[]) => {
    if (!actions || actions.length === 0) return;

    actions.forEach(action => {
      switch (action.type) {
        case 'url':
          if (action.url) {
            window.open(action.url, action.openInNewTab ? '_blank' : '_self');
          }
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
        case 'widget_toggle':
          if (action.targetWidgetId) {
            setHiddenWidgets(prev => {
              const next = new Set(prev);
              if (next.has(action.targetWidgetId)) {
                next.delete(action.targetWidgetId);
              } else {
                next.add(action.targetWidgetId);
              }
              return next;
            });
          }
          break;

        case 'video_play':
          if (action.targetWidgetId) {
            const video = videoRefs.current.get(action.targetWidgetId);
            if (video) video.play();
          }
          break;

        case 'video_stop':
          if (action.targetWidgetId) {
            const video = videoRefs.current.get(action.targetWidgetId);
            if (video) video.pause();
          }
          break;
      }
    });
  };

  const renderWidget = (widget: Widget) => {
    if (hiddenWidgets.has(widget.id)) return null;

    const commonStyle: React.CSSProperties = {
      position: 'absolute',
      left: widget.x,
      top: widget.y,
      width: widget.width,
      height: widget.height,
      transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
      transformOrigin: 'top left',
      zIndex: widget.zIndex || 0,
      boxSizing: 'border-box',
      opacity: widget.properties.opacity ?? 1,
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

  // Методы рендера виджетов
  const renderShape = (widget: Widget, baseStyle: React.CSSProperties) => {
    const {
      shapeType = 'rectangle', fillColor = '#4a90e2',
      strokeColor = '#000000', strokeWidth = 0,
      cornerRadius = 0, opacity = 1,
    } = widget.properties;

    const shapeClip = getClipPathForShape(shapeType, widget.width, widget.height, cornerRadius);
    const needsClip = shapeClip !== undefined;
    const br = shapeType === 'circle' ? '50%' : (shapeType === 'rounded-rectangle' || shapeType === 'rectangle' ? `${cornerRadius}px` : undefined);

    // Двухслойный подход для обводки clip-path фигур
    if (needsClip && strokeWidth > 0) {
      const scaleX = (widget.width - strokeWidth * 4) / widget.width;
      const scaleY = (widget.height - strokeWidth * 4) / widget.height;
      return (
        <div key={widget.id} style={{
          ...baseStyle,
          opacity,
        }}>
          {/* Слой рамки — полная фигура цветом рамки */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            backgroundColor: strokeColor,
            clipPath: shapeClip,
            WebkitClipPath: shapeClip,
          } as React.CSSProperties} />
          {/* Слой заливки — та же фигура, уменьшена через scale */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            backgroundColor: fillColor,
            clipPath: shapeClip,
            WebkitClipPath: shapeClip,
            transform: `scale(${scaleX}, ${scaleY})`,
          } as React.CSSProperties} />
        </div>
      );
    }

    // Clip-path без обводки
    if (needsClip) {
      return (
        <div key={widget.id} style={{
          ...baseStyle,
          backgroundColor: fillColor,
          clipPath: shapeClip,
          WebkitClipPath: shapeClip,
          opacity,
        } as React.CSSProperties} />
      );
    }

    // Простые фигуры (rectangle, rounded-rectangle, circle) — CSS border работает
    return (
      <div key={widget.id} style={{
        ...baseStyle,
        backgroundColor: fillColor,
        border: strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none',
        borderRadius: br,
        opacity,
        overflow: 'hidden',
      }} />
    );
  };

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

    const hAlign = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';
    const vAlign = verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start';

    const htmlContent = widget.properties.htmlContent;

    const style: React.CSSProperties = {
      ...baseStyle,
      backgroundColor,
      display: 'flex',
      flexDirection: 'column',
      alignItems: htmlContent ? 'stretch' : hAlign,
      justifyContent: vAlign,
      padding,
      overflow: 'hidden',
    };

    if (htmlContent) {
      return (
        <div key={widget.id} style={style} dangerouslySetInnerHTML={{ __html: htmlContent }} />
      );
    }

    return (
      <div key={widget.id} style={style}>
        <span style={{ color: textColor, fontSize, fontFamily, fontWeight, fontStyle, textDecoration, lineHeight, textAlign: textAlign as any, width: '100%', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{text}</span>
      </div>
    );
  };

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

    return (
      <button
        key={widget.id}
        style={style}
        onClick={() => executeActions(actions)}
        onMouseDown={(e) => {
          const rotation = widget.rotation ? `rotate(${widget.rotation}deg) ` : '';
          e.currentTarget.style.transform = `${rotation}scale(0.95)`;
        }}
        onMouseUp={(e) => {
          const rotation = widget.rotation ? `rotate(${widget.rotation}deg) ` : '';
          e.currentTarget.style.transform = `${rotation}scale(1)`;
        }}
      >
        {text}
      </button>
    );
  };

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
    const hasClip = clipShape && clipShape !== 'rectangle' && clipShape !== 'rounded-rectangle';
    const clipPath = hasClip ? getClipPathForShape(clipShape, widget.width, widget.height, cornerRadius) : undefined;
    const effectiveObjectFit = hasClip ? 'cover' : (objectFit === 'adaptive' ? 'contain' : objectFit);
    const br = (clipShape === 'rounded-rectangle' && cornerRadius) ? `${cornerRadius}px` : undefined;

    const imgStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: effectiveObjectFit as any,
    };

    // Двухслойная обводка для clip-path фигур
    if (hasClip && borderEnabled && borderWidth > 0 && clipPath) {
      const scaleX = (widget.width - borderWidth * 4) / widget.width;
      const scaleY = (widget.height - borderWidth * 4) / widget.height;
      return (
        <div key={widget.id} style={{
          ...baseStyle,
          opacity: widget.properties.opacity || 1,
        }}>
          {/* Слой рамки */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            backgroundColor: borderColor,
            clipPath: clipPath,
            WebkitClipPath: clipPath,
          } as React.CSSProperties} />
          {/* Слой изображения — уменьшен через scale */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            overflow: 'hidden',
            clipPath: clipPath,
            WebkitClipPath: clipPath,
            transform: `scale(${scaleX}, ${scaleY})`,
          } as React.CSSProperties}>
            {src && <img src={src} style={imgStyle} alt="" />}
          </div>
        </div>
      );
    }

    // Clip-path без обводки
    if (hasClip && clipPath) {
      return (
        <div key={widget.id} style={{
          ...baseStyle,
          overflow: 'hidden',
          clipPath: clipPath,
          WebkitClipPath: clipPath,
        } as React.CSSProperties}>
          {src && <img src={src} style={imgStyle} alt="" />}
        </div>
      );
    }

    // Обычный режим (rectangle, rounded-rectangle)
    return (
      <div key={widget.id} style={{
        ...baseStyle,
        border: borderEnabled ? `${borderWidth}px solid ${borderColor}` : undefined,
        overflow: 'hidden',
        borderRadius: br,
      }}>
        {src && <img src={src} style={imgStyle} alt="" />}
      </div>
    );
  };

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
              if (el) videoRefs.current.set(widget.id, el);
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
                justifyContent: 'space-between',
                cursor: 'pointer',
                backgroundColor: hoveredMenuItem === item.id ? hoverColor : backgroundColor,
                color: textColor,
                fontSize,
                fontFamily,
                transition: 'background-color 0.2s',
                userSelect: 'none'
              }}
              onMouseEnter={() => setHoveredMenuItem(item.id)}
              onMouseLeave={() => setHoveredMenuItem(null)}
              onClick={() => {
                if (item.actions && item.actions.length > 0) {
                  executeActions(item.actions);
                }
                if (item.children && item.children.length > 0) {
                  setExpandedMenuItem(expandedMenuItem === item.id ? null : item.id);
                }
              }}
            >
              <span>{item.label}</span>
              {item.children && item.children.length > 0 && (
                <span>{expandedMenuItem === item.id ? '▼' : (orientation === 'horizontal' ? '▼' : '▶')}</span>
              )}
            </div>

            {item.children && item.children.length > 0 && expandedMenuItem === item.id && (
              <div
                style={{
                  position: 'absolute',
                  [orientation === 'horizontal' ? 'top' : 'left']: '100%',
                  [orientation === 'horizontal' ? 'left' : 'top']: 0,
                  backgroundColor: submenuBackgroundColor,
                  minWidth: 200,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
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
                      cursor: 'pointer',
                      backgroundColor: hoveredMenuItem === child.id ? hoverColor : submenuBackgroundColor,
                      color: submenuTextColor,
                      fontSize,
                      fontFamily,
                      transition: 'background-color 0.2s',
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

  if (loading) {
    return (
      <div className="player-loading">
        <div className="spinner"></div>
        <p>Загрузка проекта...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="player-error">
        <h2>⚠️ Ошибка</h2>
        <p>{error}</p>
        {!embedded && window.electronAPI && (
          <button onClick={handleOpenProject} className="btn-load">
            📂 Открыть проект
          </button>
        )}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="player-error">
        <h2>Проект не загружен</h2>
        {!embedded && window.electronAPI && (
          <button onClick={handleOpenProject} className="btn-load">
            📂 Открыть проект
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="player-container">
      <div
        className="player-canvas"
        style={{
          width: project.canvas.width,
          height: project.canvas.height,
          backgroundColor: project.canvas.backgroundColor || '#ffffff',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {project.widgets
          .slice()
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map(widget => renderWidget(widget))}
      </div>

      {/* Popup */}
      {popupVisible && popupData && (
        <div className="popup-overlay" onClick={() => setPopupVisible(false)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={() => setPopupVisible(false)}>×</button>
            <h3>{popupData.title}</h3>
            <div className="popup-body">{popupData.content}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player;
