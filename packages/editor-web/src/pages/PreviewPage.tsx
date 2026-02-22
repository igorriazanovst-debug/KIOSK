/**
 * PreviewPage.tsx
 * Страница предпросмотра проекта — полноэкранный режим без UI
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient, Project as ServerProject } from '../services/api-client';
import './PreviewPage.css';

// Типы
interface Widget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  properties: Record<string, any>;
}

interface WidgetEvent {
  trigger: 'click' | 'hover';
  actions: WidgetAction[];
}

interface WidgetAction {
  type: 'url' | 'page' | 'popup' | 'widget_show' | 'widget_hide' | 'video_play' | 'video_stop';
  url?: string;
  openInNewTab?: boolean;
  pageId?: string;
  popupTitle?: string;
  popupContent?: string;
  popupWidth?: number;
  popupHeight?: number;
  targetWidgetId?: string;
}

interface LocalProject {
  id?: string;
  version: string;
  name: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor?: string;
  };
  widgets: Widget[];
}

// ============================================
// CLIP-PATH ГЕНЕРАТОР (правильные полигоны)
// ============================================

function getClipPath(shape: string, w: number, h: number, cornerRadius: number = 0, usePx: boolean = false): string | undefined {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;

  const fmt = (px: number, py: number): string => {
    if (usePx) return `${px.toFixed(1)}px ${py.toFixed(1)}px`;
    return `${((px / w) * 100).toFixed(1)}% ${((py / h) * 100).toFixed(1)}%`;
  };

  const polygon = (sides: number, startAngle: number = -Math.PI / 2): string => {
    const points: string[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = startAngle + (2 * Math.PI * i) / sides;
      points.push(fmt(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
    }
    return `polygon(${points.join(', ')})`;
  };

  switch (shape) {
    case 'circle':
      if (usePx) return `circle(${r.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
      return `circle(${r}px at ${cx}px ${cy}px)`;
    case 'ellipse':
      if (usePx) return `ellipse(${(w/2).toFixed(1)}px ${(h/2).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
      return `ellipse(50% 50% at 50% 50%)`;
    case 'triangle': {
      const angles = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6];
      const pts = angles.map(a => fmt(cx + r * Math.cos(a), cy + r * Math.sin(a)));
      return `polygon(${pts.join(', ')})`;
    }
    case 'diamond':
      return `polygon(${fmt(cx, 0)}, ${fmt(w, cy)}, ${fmt(cx, h)}, ${fmt(0, cy)})`;
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
        pts.push(fmt(cx + sr * Math.cos(angle), cy + sr * Math.sin(angle)));
      }
      return `polygon(${pts.join(', ')})`;
    }
    case 'rounded-rectangle':
    case 'rectangle':
    default:
      return undefined;
  }
}

// ============================================
// MENU WIDGET КОМПОНЕНТ
// ============================================

interface MenuItemType {
  id: string;
  label: string;
  actions?: any[];
  children?: MenuItemType[];
}

interface MenuWidgetProps {
  widgetId: string;
  commonStyle: React.CSSProperties;
  items: MenuItemType[];
  isHorizontal: boolean;
  backgroundColor: string;
  textColor: string;
  hoverColor: string;
  fontSize: number;
  fontFamily: string;
  itemPadding: number;
  itemHeight: number;
  submenuBackgroundColor: string;
  submenuTextColor: string;
  borderWidth: number;
  borderColor: string;
  executeActions: (actions: any[]) => void;
}

const MenuWidget: React.FC<MenuWidgetProps> = ({
  widgetId, commonStyle, items, isHorizontal,
  backgroundColor, textColor, hoverColor,
  fontSize, fontFamily, itemPadding, itemHeight,
  submenuBackgroundColor, submenuTextColor,
  borderWidth, borderColor, executeActions,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const containerStyle: React.CSSProperties = {
    ...commonStyle,
    backgroundColor,
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none',
    overflow: 'visible',
    position: 'absolute',
  };

  const itemStyle = (itemId: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${itemPadding}px`,
    height: `${itemHeight}px`,
    minWidth: isHorizontal ? 'auto' : '100%',
    color: hoveredItem === itemId ? submenuTextColor : textColor,
    backgroundColor: hoveredItem === itemId ? hoverColor : backgroundColor,
    fontSize: `${fontSize}px`,
    fontFamily,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'background-color 0.15s',
    position: 'relative' as const,
    boxSizing: 'border-box' as const,
  });

  const submenuStyle = (parentId: string): React.CSSProperties => ({
    display: expandedItem === parentId ? 'flex' : 'none',
    flexDirection: 'column',
    position: 'absolute',
    top: isHorizontal ? `${itemHeight}px` : '0',
    left: isHorizontal ? '0' : '100%',
    backgroundColor: submenuBackgroundColor,
    zIndex: 9999,
    minWidth: '150px',
    boxShadow: '2px 4px 12px rgba(0,0,0,0.4)',
  });

  return (
    <div data-widget-id={widgetId} style={containerStyle}>
      {items.map((item) => {
        const hasChildren = item.children && item.children.length > 0;
        return (
          <div
            key={item.id}
            style={{ position: 'relative' }}
            onMouseEnter={() => {
              setHoveredItem(item.id);
              if (hasChildren) setExpandedItem(item.id);
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
              if (hasChildren) setExpandedItem(null);
            }}
          >
            <div
              style={itemStyle(item.id)}
              onClick={() => {
                if (item.actions && item.actions.length > 0) {
                  executeActions(item.actions);
                }
              }}
            >
              {item.label}
              {hasChildren && (
                <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.7 }}>
                  {isHorizontal ? '▼' : '▶'}
                </span>
              )}
            </div>
            {hasChildren && (
              <div style={submenuStyle(item.id)}>
                {item.children!.map((child) => (
                  <div
                    key={child.id}
                    style={{
                      padding: `0 ${itemPadding}px`,
                      height: `${itemHeight}px`,
                      display: 'flex',
                      alignItems: 'center',
                      color: hoveredItem === child.id ? textColor : submenuTextColor,
                      backgroundColor: hoveredItem === child.id ? hoverColor : 'transparent',
                      fontSize: `${fontSize - 2}px`,
                      fontFamily,
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={() => setHoveredItem(child.id)}
                    onMouseLeave={() => setHoveredItem(null)}
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
        );
      })}
    </div>
  );
};

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================

const PreviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [project, setProject] = useState<LocalProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState<any>(null);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(new Set());
  const hiddenWidgetsInitialized = React.useRef(false);

  // Загрузка проекта
  useEffect(() => {
    if (!projectId) {
      setError('Project ID not provided');
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        const serverProject = await apiClient.getProject(projectId);
        const localProject: LocalProject = {
          id: serverProject.id,
          version: '1.0',
          name: serverProject.name,
          canvas: {
            width: serverProject.canvasWidth,
            height: serverProject.canvasHeight,
            backgroundColor: serverProject.canvasBackground,
          },
          widgets: serverProject.projectData?.widgets || [],
        };
        setProject(localProject);
        if (!hiddenWidgetsInitialized.current) {
          const initialHidden = new Set<string>(
            localProject.widgets.filter((w: any) => w.visible === false).map((w: any) => w.id)
          );
          setHiddenWidgets(initialHidden);
          hiddenWidgetsInitialized.current = true;
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  // Удаление preview-snapshot при закрытии окна
  useEffect(() => {
    if (!projectId) return;

    const deleteSnapshot = () => {
      const token = localStorage.getItem('kiosk_client_token') || sessionStorage.getItem('kiosk_client_token');
      if (!token || !projectId) return;

      const baseUrl = window.location.origin;
      const url = `${baseUrl}/api/projects/${projectId}`;

      // Способ 1: sendBeacon с Blob (надёжнее при закрытии вкладки)
      try {
        const blob = new Blob([JSON.stringify({ _method: 'DELETE' })], { type: 'application/json' });
        // sendBeacon не поддерживает DELETE, поэтому используем XMLHttpRequest sync
        const xhr = new XMLHttpRequest();
        xhr.open('DELETE', url, false); // synchronous!
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send();
      } catch (e) {
        // Способ 2: fetch с keepalive
        fetch(url, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
          keepalive: true
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', deleteSnapshot);
    window.addEventListener('pagehide', deleteSnapshot);

    return () => {
      window.removeEventListener('beforeunload', deleteSnapshot);
      window.removeEventListener('pagehide', deleteSnapshot);
      deleteSnapshot();
    };
  }, [projectId]);


  // Закрытие по ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popupVisible) {
          setPopupVisible(false);
        } else {
          window.close();
        }
      }
    };
    document.documentElement.requestFullscreen?.().catch(() => {});
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popupVisible]);

  // Обработка действий виджетов
  const executeActions = (actions: WidgetAction[]) => {
    actions.forEach((action) => {
      switch (action.type as string) {
        case 'url':
          if (action.url) {
            if (action.openInNewTab) {
              window.open(action.url, '_blank');
            } else {
              window.location.href = action.url;
            }
          }
          break;
        case 'popup':
          setPopupData({
            title: action.popupTitle || 'Информация',
            content: action.popupContent || '',
            width: action.popupWidth || 400,
            height: action.popupHeight || 300,
          });
          setPopupVisible(true);
          break;
        case 'widget_show':
          if (action.targetWidgetId) {
            setHiddenWidgets((prev) => {
              const newSet = new Set(prev);
              newSet.delete(action.targetWidgetId!);
              return newSet;
            });
          }
          break;
        case 'widget_hide':
          if (action.targetWidgetId) {
            setHiddenWidgets((prev) => new Set(prev).add(action.targetWidgetId!));
          }
          break;
        case 'widget_toggle':
          if (action.targetWidgetId) {
            setHiddenWidgets((prev) => {
              const next = new Set(prev);
              if (next.has(action.targetWidgetId!)) {
                next.delete(action.targetWidgetId!);
              } else {
                next.add(action.targetWidgetId!);
              }
              return next;
            });
          }
          break;
        case 'video_play':
          if (action.targetWidgetId) {
            const el = document.querySelector(`[data-widget-id="${action.targetWidgetId}"] video`) as HTMLVideoElement;
            if (el) el.play();
          }
          break;
        case 'video_stop':
          if (action.targetWidgetId) {
            const el = document.querySelector(`[data-widget-id="${action.targetWidgetId}"] video`) as HTMLVideoElement;
            if (el) { el.pause(); el.currentTime = 0; }
          }
          break;
      }
    });
  };

  // Рендер виджетов


// ─── Browser Preview State (глобальный для связи меню↔контент) ────────────
const browserActivePages: Record<string, string> = {};
const browserListeners: Record<string, Set<() => void>> = {};

function setBrowserActivePage(browserId: string, pageId: string) {
  browserActivePages[browserId] = pageId;
  (browserListeners[browserId] || new Set()).forEach(fn => fn());
}

function handleBrowserLink(href: string, allWidgets: any[], goToSlide?: (i: number) => void) {
  console.log('[BrowserLink] href:', href, 'allWidgets count:', allWidgets.length);
  if (href.startsWith('browser-page://')) {
    const pageId = href.replace('browser-page://', '');
    // Найти browserId для этой страницы
    const menuWidget = allWidgets.find((w: any) =>
      w.type === 'browser-menu' && (w.properties.pages || []).some((p: any) => p.id === pageId)
    );
    console.log('[BrowserLink] pageId:', pageId, 'menuWidget:', menuWidget?.id, 'browserId:', menuWidget?.properties?.browserId);
    if (menuWidget) setBrowserActivePage(menuWidget.properties.browserId, pageId);
  } else if (href.startsWith('slide://')) {
    const idx = parseInt(href.replace('slide://', ''), 10);
    if (goToSlide) goToSlide(idx);
  }
}

function useBrowserActivePage(browserId: string): string | undefined {
  const [pageId, setPageId] = React.useState<string | undefined>(browserActivePages[browserId]);
  React.useEffect(() => {
    if (!browserListeners[browserId]) browserListeners[browserId] = new Set();
    const fn = () => setPageId(browserActivePages[browserId]);
    browserListeners[browserId].add(fn);
    return () => { browserListeners[browserId]?.delete(fn); };
  }, [browserId]);
  return pageId;
}

// ─── BrowserMenuPreview ────────────────────────────────────────────────────
interface BrowserMenuPreviewProps {
  widget: any;
  allWidgets: any[];
  commonStyle: React.CSSProperties;
}

const BrowserMenuPreview: React.FC<BrowserMenuPreviewProps> = ({ widget, allWidgets, commonStyle }) => {
  const browserId: string = widget.properties.browserId || '';
  const pages: any[] = widget.properties.pages || [];
  const orientation: string = widget.properties.orientation || 'vertical';
  const menuBg: string = widget.properties.menuBgColor || '#2c3e50';
  const menuText: string = widget.properties.menuTextColor || '#ffffff';
  const menuFs: number = widget.properties.menuFontSize || 14;
  const isHoriz = orientation === 'horizontal';
  const activePageId = useBrowserActivePage(browserId);
  const topLevel = pages.filter((p: any) => !p.parentId);

  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <div style={{
      ...commonStyle,
      background: menuBg,
      display: 'flex',
      flexDirection: isHoriz ? 'row' : 'column',
      overflow: 'hidden',
      position: 'absolute',
    }}>
      {topLevel.map((page: any) => {
        const children = pages.filter((p: any) => p.parentId === page.id);
        const isActive = activePageId === page.id;
        const isExpanded = expanded === page.id;
        return (
          <div key={page.id} style={{ position: 'relative' }}>
            <div
              onClick={() => {
                setBrowserActivePage(browserId, page.id);
                setExpanded(isExpanded ? null : page.id);
              }}
              style={{
                padding: isHoriz ? `0 ${menuFs}px` : `${Math.round(menuFs * 0.6)}px ${menuFs}px`,
                color: menuText,
                fontSize: `${menuFs}px`,
                cursor: 'pointer',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                fontWeight: isActive ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                minHeight: isHoriz ? '100%' : `${menuFs * 2.2}px`,
              }}
            >
              {page.title}
              {children.length > 0 && <span style={{ marginLeft: '6px', fontSize: '10px' }}>{isExpanded ? '▲' : '▼'}</span>}
            </div>
            {/* Подпункты */}
            {children.length > 0 && isExpanded && (
              <div style={{
                position: isHoriz ? 'absolute' : 'relative',
                top: isHoriz ? '100%' : undefined,
                left: 0,
                background: menuBg,
                zIndex: 100,
                minWidth: '140px',
                boxShadow: isHoriz ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
              }}>
                {children.map((child: any) => (
                  <div
                    key={child.id}
                    onClick={(e) => { e.stopPropagation(); setBrowserActivePage(browserId, child.id); setExpanded(null); }}
                    style={{
                      padding: `${Math.round(menuFs * 0.5)}px ${menuFs}px`,
                      paddingLeft: isHoriz ? `${menuFs}px` : `${menuFs * 1.5}px`,
                      color: menuText,
                      fontSize: `${menuFs - 1}px`,
                      cursor: 'pointer',
                      opacity: 0.9,
                    }}
                  >
                    {child.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── BrowserContentPreview ─────────────────────────────────────────────────
interface BrowserContentPreviewProps {
  widget: any;
  allWidgets: any[];
  commonStyle: React.CSSProperties;
}

const processGalleries = (html: string): string => {
  if (!html || !html.includes('data-gallery-images')) return html;
  const parts = html.split(/<div /);
  const processed = parts.map((part, idx) => {
    if (idx === 0) return part;
    if (!part.includes('data-gallery-images')) return '<div ' + part;
    const closeTag = part.indexOf('>');
    if (closeTag === -1) return '<div ' + part;
    const attrs = part.substring(0, closeTag);
    const rest = part.substring(closeTag + 1);
    const imgAttrStart = attrs.indexOf('data-gallery-images=');
    if (imgAttrStart === -1) return '<div ' + part;
    const imgValStart = imgAttrStart + 'data-gallery-images='.length;
    const imgQuote = attrs[imgValStart];
    const imgValEnd = attrs.indexOf(imgQuote, imgValStart + 1);
    const rawImages = attrs.substring(imgValStart + 1, imgValEnd)
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const colsAttrStart = attrs.indexOf('data-gallery-cols=');
    const rawCols = colsAttrStart !== -1 ? (() => {
      const s = colsAttrStart + 'data-gallery-cols='.length;
      const q = attrs[s];
      return attrs.substring(s + 1, attrs.indexOf(q, s + 1));
    })() : '3';
    if (!rawImages) return '<div ' + part;
    let imgs: string[] = [];
    try { imgs = JSON.parse(rawImages); } catch { return '<div ' + part; }
    if (imgs.length === 0) return '<div ' + part;
    const cols = parseInt(rawCols) || 3;
    const total = imgs.length;
    const id = 'g' + Math.random().toString(36).substr(2, 6);
    const thumbItems = imgs.map((src: string, i: number) => {
      const safeSrc = src.replace(/'/g, "\'");
      const openFn = `(function(){var lb=document.getElementById('${id}_lb');lb.setAttribute('data-cur','${i}');lb.style.display='flex';document.getElementById('${id}_img').src='${safeSrc}';document.getElementById('${id}_cnt').textContent='${i+1} / ${total}';})()`;
      return `<div style="width:min(calc(${100/cols}% - 8px), 100px);height:100px;overflow:hidden;border-radius:6px;cursor:pointer;display:inline-block;margin:4px;" onclick="${openFn}"><img src="${src}" style="width:100%;height:100%;object-fit:cover;" /></div>`;
    }).join('');
    const allSrcs = imgs.map((s: string) => s.replace(/'/g, "\'")).join("','");
    const prevFn = `(function(){var lb=document.getElementById('${id}_lb');var srcs=['${allSrcs}'];var c=(parseInt(lb.getAttribute('data-cur'))-1+${total})%${total};lb.setAttribute('data-cur',c);document.getElementById('${id}_img').src=srcs[c];document.getElementById('${id}_cnt').textContent=(c+1)+' / ${total}';})()`;
    const nextFn = `(function(){var lb=document.getElementById('${id}_lb');var srcs=['${allSrcs}'];var c=(parseInt(lb.getAttribute('data-cur'))+1)%${total};lb.setAttribute('data-cur',c);document.getElementById('${id}_img').src=srcs[c];document.getElementById('${id}_cnt').textContent=(c+1)+' / ${total}';})()`;
    const closeFn = `document.getElementById('${id}_lb').style.display='none'`;
    const closingDiv = rest.indexOf('</div>');
    const afterGalleryDiv = closingDiv !== -1 ? rest.substring(closingDiv + 6) : rest;
    return `<div style="margin:12px 0;"><div style="display:flex;flex-wrap:wrap;">${thumbItems}</div><div id="${id}_lb" data-cur="0" onclick="if(event.target===this){${closeFn}}" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:99999;align-items:center;justify-content:center;flex-direction:column;"><img id="${id}_img" src="" style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:8px;" /><div style="display:flex;align-items:center;gap:20px;margin-top:16px;"><button onclick="${prevFn}" style="background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;cursor:pointer;">◀</button><span id="${id}_cnt" style="color:#aaa;font-size:13px;"></span><button onclick="${nextFn}" style="background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;cursor:pointer;">▶</button></div><button onclick="${closeFn}" style="position:absolute;top:18px;right:24px;background:none;color:#fff;border:none;font-size:28px;cursor:pointer;">✕</button></div></div>${afterGalleryDiv}`;
  });
  return processed.join('');
};

const BrowserContentPreview: React.FC<BrowserContentPreviewProps> = ({ widget, allWidgets, commonStyle }) => {
  const browserId: string = widget.properties.browserId || '';
  const contentBg: string = widget.properties.contentBgColor || '#ffffff';
  const activePageId = useBrowserActivePage(browserId);

  const menuWidget = allWidgets.find(
    (w: any) => w.type === 'browser-menu' && w.properties.browserId === browserId
  );
  const pages: any[] = menuWidget?.properties.pages || [];

  const activePage = activePageId
    ? pages.find((p: any) => p.id === activePageId)
    : pages[0];

  console.log('[BrowserContent] FULL htmlContent:', activePage?.htmlContent);

  return (
    <div style={{
      ...commonStyle,
      background: contentBg,
      overflow: 'auto',
      position: 'absolute',
    }}>
      {activePage?.htmlContent ? (
        <div
          style={{ padding: '16px', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{ __html: processGalleries(activePage.htmlContent) }}
          onClick={(e) => {
            console.log('[BrowserContent] click target:', (e.target as HTMLElement).tagName, (e.target as HTMLElement).getAttribute('href'));
            const a = (e.target as HTMLElement).closest('a');
            console.log('[BrowserContent] closest a:', a?.getAttribute('href'));
            if (!a) return;
            const href = a.getAttribute('href') || '';
            if (href.startsWith('browser-page://') || href.startsWith('slide://')) {
              e.preventDefault();
              handleBrowserLink(href, allWidgets);
            }
          }}
        />
      ) : (
        <div style={{ padding: '16px', color: '#aaa', fontSize: '14px' }}>
          {pages.length === 0 ? 'Нет страниц' : 'Выберите страницу в меню'}
        </div>
      )}
    </div>
  );
};
// ──────────────────────────────────────────────────────────────────────────

// ─── Browser Preview Widget (legacy) ──────────────────────────────────────
interface BrowserPreviewWidgetProps {
  widget: any;
  pages: any[];
  menuPosition: string;
  menuBg: string;
  menuText: string;
  menuFs: number;
  MENU_H: number;
  MENU_W: number;
  contentBg: string;
  commonStyle: React.CSSProperties;
}

const BrowserPreviewWidget: React.FC<BrowserPreviewWidgetProps> = ({
  widget, pages, menuPosition, menuBg, menuText, menuFs,
  MENU_H, MENU_W, contentBg, commonStyle,
}) => {
  const [activePage, setActivePage] = React.useState<any>(pages[0] || null);

  const isHoriz = menuPosition === 'top' || menuPosition === 'bottom';
  const topLevel = pages.filter((p: any) => !p.parentId);
  const children = activePage ? pages.filter((p: any) => p.parentId === activePage.id) : [];

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    background: menuBg,
    color: menuText,
    fontSize: `${menuFs}px`,
    display: 'flex',
    flexDirection: isHoriz ? 'row' : 'column',
    alignItems: isHoriz ? 'center' : 'flex-start',
    overflowX: isHoriz ? 'auto' : 'hidden',
    overflowY: isHoriz ? 'hidden' : 'auto',
    zIndex: 2,
    ...(menuPosition === 'top'    ? { top: 0, left: 0, right: 0, height: `${MENU_H}px` } : {}),
    ...(menuPosition === 'bottom' ? { bottom: 0, left: 0, right: 0, height: `${MENU_H}px` } : {}),
    ...(menuPosition === 'left'   ? { top: 0, left: 0, bottom: 0, width: `${MENU_W}px` } : {}),
    ...(menuPosition === 'right'  ? { top: 0, right: 0, bottom: 0, width: `${MENU_W}px` } : {}),
  };

  const contentStyle: React.CSSProperties = {
    position: 'absolute',
    overflow: 'auto',
    background: contentBg,
    ...(menuPosition === 'top'    ? { top: `${MENU_H}px`, left: 0, right: 0, bottom: 0 } : {}),
    ...(menuPosition === 'bottom' ? { top: 0, left: 0, right: 0, bottom: `${MENU_H}px` } : {}),
    ...(menuPosition === 'left'   ? { top: 0, left: `${MENU_W}px`, right: 0, bottom: 0 } : {}),
    ...(menuPosition === 'right'  ? { top: 0, left: 0, right: `${MENU_W}px`, bottom: 0 } : {}),
    ...(MENU_H === 0 && MENU_W === 0 ? { inset: 0 } : {}),
  };

  return (
    <div style={{ ...commonStyle, overflow: 'hidden', position: 'absolute' }}>
      {/* Меню */}
      <div style={menuStyle}>
        {topLevel.map((page: any) => (
          <div
            key={page.id}
            onClick={() => setActivePage(page)}
            style={{
              padding: isHoriz ? `0 ${menuFs}px` : `${menuFs / 2}px ${menuFs}px`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activePage?.id === page.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              fontWeight: activePage?.id === page.id ? 'bold' : 'normal',
              borderBottom: !isHoriz && activePage?.id === page.id ? '2px solid rgba(255,255,255,0.5)' : 'none',
            }}
          >
            {page.title}
            {/* Подпункты */}
            {activePage?.id === page.id && children.length > 0 && !isHoriz && (
              <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                {children.map((child: any) => (
                  <div
                    key={child.id}
                    onClick={(e) => { e.stopPropagation(); setActivePage(child); }}
                    style={{ padding: '4px 0', fontSize: `${menuFs - 2}px`, opacity: 0.85, cursor: 'pointer' }}
                  >
                    › {child.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Контент */}
      <div style={contentStyle}>
        {activePage?.htmlContent ? (
          <div
            style={{ padding: '16px', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' }}
            dangerouslySetInnerHTML={{ __html: activePage.htmlContent }}
          />
        ) : (
          <div style={{ padding: '16px', color: '#aaa', fontSize: '14px' }}>Нет содержимого</div>
        )}
      </div>
    </div>
  );
};
// ──────────────────────────────────────────────────────────────────────────
  const renderWidget = (widget: Widget) => {
    if (hiddenWidgets.has(widget.id)) return null;

    const events = (widget as any).events as WidgetEvent[] | undefined;
    const handleClick = () => {
      if (events) {
        events.filter((e) => e.trigger === 'click').forEach((event) => executeActions(event.actions));
      }
    };

    const commonStyle: React.CSSProperties = {
      position: 'absolute',
      left: widget.x,
      top: widget.y,
      width: widget.width,
      height: widget.height,
      transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
      transformOrigin: 'top left',
      cursor: events && events.some((e) => e.trigger === 'click') ? 'pointer' : 'default',
      zIndex: widget.zIndex || 0,
      opacity: widget.properties.opacity ?? 1,
    };

    // Shape
    if (widget.type === 'shape') {
      const {
        shapeType = 'rectangle', fillColor = '#4a90e2',
        strokeColor = '#000000', strokeWidth = 0,
        cornerRadius = 0, opacity = 1,
      } = widget.properties;

      const shapeClip = getClipPath(shapeType, widget.width, widget.height, cornerRadius);
      const needsClip = shapeClip !== undefined;
      const br = shapeType === 'circle' ? '50%' : (shapeType === 'rounded-rectangle' || shapeType === 'rectangle' ? `${cornerRadius}px` : undefined);

      if (needsClip && strokeWidth > 0) {
        const scaleX = (widget.width - strokeWidth * 4) / widget.width;
        const scaleY = (widget.height - strokeWidth * 4) / widget.height;
        return (
          <div key={widget.id} data-widget-id={widget.id} style={{
            ...commonStyle,
            opacity,
          }} onClick={handleClick}>
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

      if (needsClip) {
        return (
          <div key={widget.id} data-widget-id={widget.id} style={{
            ...commonStyle,
            backgroundColor: fillColor,
            clipPath: shapeClip,
            WebkitClipPath: shapeClip,
            opacity,
          } as React.CSSProperties} onClick={handleClick} />
        );
      }

      return (
        <div key={widget.id} data-widget-id={widget.id} style={{
          ...commonStyle,
          backgroundColor: fillColor,
          border: strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none',
          borderRadius: br,
          opacity,
        } as React.CSSProperties} onClick={handleClick} />
      );
    }

    // Text
    if (widget.type === 'text') {
      const {
        text = 'Text', fontSize = 24, color = '#000000',
        fontFamily = 'Arial', fontWeight = 'normal',
        textAlign = 'left', verticalAlign = 'top',
        backgroundColor = 'transparent',
      } = widget.properties;

      const htmlContent = widget.properties.htmlContent;
      const hAlign = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';
      const vAlign = verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start';
      const containerStyle: React.CSSProperties = {
        ...commonStyle,
        backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: htmlContent ? 'stretch' : hAlign,
        justifyContent: vAlign,
        overflow: 'hidden',
        padding: `${widget.properties.padding ?? 8}px`,
        boxSizing: 'border-box' as const,
      };
      if (htmlContent) {
        return (
          <div key={widget.id} data-widget-id={widget.id} style={containerStyle} onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        );
      }
      return (
        <div key={widget.id} data-widget-id={widget.id} style={containerStyle} onClick={handleClick}>
          <span style={{ fontSize: `${fontSize}px`, color, fontFamily, fontWeight, textAlign: textAlign as any, width: '100%', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{text}</span>
        </div>
      );
    }

    // Image (с clipShape)
    if (widget.type === 'image') {
      const {
        src = '', objectFit = 'contain', opacity = 1,
        clipShape = 'rectangle', cornerRadius = 0,
        borderEnabled = false, borderWidth = 2, borderColor = '#000000',
      } = widget.properties;
      if (!src) return null;

      const hasClip = clipShape && clipShape !== 'rectangle';
      const clipPath = hasClip ? getClipPath(clipShape, widget.width, widget.height, cornerRadius) : undefined;
      const effectiveObjectFit = hasClip ? 'cover' : objectFit;
      const br = (clipShape === 'rounded-rectangle' && cornerRadius) ? `${cornerRadius}px` : undefined;

      // Рамка по форме clip-path (двухслойный подход)
      if (hasClip && borderEnabled && borderWidth > 0) {
        const scaleX = (widget.width - borderWidth * 4) / widget.width;
        const scaleY = (widget.height - borderWidth * 4) / widget.height;
        return (
          <div key={widget.id} data-widget-id={widget.id} style={{
            ...commonStyle,
            opacity,
          }} onClick={handleClick}>
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
              <img src={src} alt="" style={{
                width: '100%', height: '100%',
                objectFit: effectiveObjectFit as any,
              }} />
            </div>
          </div>
        );
      }

      // Обычный рендер (без рамки по форме или прямоугольная)
      return (
        <div key={widget.id} data-widget-id={widget.id} style={{
          ...commonStyle,
          opacity,
          borderRadius: br,
          overflow: 'hidden',
          clipPath: clipPath,
          WebkitClipPath: clipPath,
          border: (borderEnabled && borderWidth > 0 && !hasClip) ? `${borderWidth}px solid ${borderColor}` : undefined,
        } as React.CSSProperties} onClick={handleClick}>
          <img src={src} alt="" style={{
            width: '100%', height: '100%',
            objectFit: effectiveObjectFit as any,
          }} />
        </div>
      );
    }

    // Video
    if (widget.type === 'video') {
      const { src = '', autoplay = false, loop = false, muted = true, objectFit = 'contain' } = widget.properties;
      if (!src) return null;

      return (
        <div key={widget.id} data-widget-id={widget.id} style={commonStyle} onClick={handleClick}>
          <video src={src} autoPlay={autoplay} loop={loop} muted={muted} style={{
            width: '100%', height: '100%', objectFit: objectFit as any,
          }} />
        </div>
      );
    }

    // Button
    if (widget.type === 'button') {
      const {
        text = 'Button', backgroundColor = '#4a90e2', textColor = '#ffffff',
        fontSize = 16, fontFamily = 'Arial', fontWeight = 'normal',
        textAlign = 'center', borderRadius = 4,
        borderWidth = 0, borderColor = '#000000', borderStyle = 'solid',
        paddingX = 16, paddingY = 8,
        shadowEnabled = false, shadowColor = '#000000',
        shadowBlur = 10, shadowOffsetX = 0, shadowOffsetY = 4, shadowOpacity = 0.3,
      } = widget.properties;

      return (
        <div key={widget.id} data-widget-id={widget.id} style={{
          ...commonStyle,
          backgroundColor, color: textColor,
          fontSize: `${fontSize}px`, fontFamily, fontWeight,
          borderRadius: `${borderRadius}px`,
          border: borderWidth > 0 ? `${borderWidth}px ${borderStyle} ${borderColor}` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', userSelect: 'none',
          boxShadow: shadowEnabled ? `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}${Math.round(shadowOpacity * 255).toString(16).padStart(2, '0')}` : undefined,
        }} onClick={handleClick}>
          {text}
        </div>
      );
    }

    // Menu
    if (widget.type === 'menu') {
      const {
        items = [], orientation = 'horizontal',
        backgroundColor = '#2c3e50', textColor = '#ffffff',
        hoverColor = '#34495e', fontSize = 16, fontFamily = 'Arial',
        itemPadding = 16, itemHeight = 40,
        submenuBackgroundColor = '#34495e', submenuTextColor = '#ffffff',
        borderWidth = 0, borderColor = '#000000',
      } = widget.properties;

      return (
        <MenuWidget
          key={widget.id} widgetId={widget.id} commonStyle={commonStyle}
          items={items} isHorizontal={orientation === 'horizontal'}
          backgroundColor={backgroundColor} textColor={textColor}
          hoverColor={hoverColor} fontSize={fontSize} fontFamily={fontFamily}
          itemPadding={itemPadding} itemHeight={itemHeight}
          submenuBackgroundColor={submenuBackgroundColor}
          submenuTextColor={submenuTextColor}
          borderWidth={borderWidth} borderColor={borderColor}
          executeActions={executeActions}
        />
      );
    }


    // browser-menu
    if (widget.type === 'browser-menu') {
      return (
        <BrowserMenuPreview
          key={widget.id}
          widget={widget}
          allWidgets={project.widgets}
          commonStyle={commonStyle}
        />
      );
    }

    // browser-content
    if (widget.type === 'browser-content') {
      return (
        <BrowserContentPreview
          key={widget.id}
          widget={widget}
          allWidgets={project.widgets}
          commonStyle={commonStyle}
        />
      );
    }

    // Browser (legacy)
    if (widget.type === 'browser') {
      const pages: any[] = widget.properties.pages || [];
      const menuPosition: string = widget.properties.menuPosition || 'top';
      const menuBg: string = widget.properties.menuBgColor || '#2c3e50';
      const contentBg: string = widget.properties.contentBgColor || '#ffffff';
      const menuText: string = widget.properties.menuTextColor || '#ffffff';
      const menuFs: number = widget.properties.menuFontSize || 14;

      const MENU_H = (menuPosition === 'top' || menuPosition === 'bottom') ? 40 : 0;
      const MENU_W = (menuPosition === 'left' || menuPosition === 'right') ? 160 : 0;

      return (
        <BrowserPreviewWidget
          key={widget.id}
          widget={widget}
          pages={pages}
          menuPosition={menuPosition}
          menuBg={menuBg}
          menuText={menuText}
          menuFs={menuFs}
          MENU_H={MENU_H}
          MENU_W={MENU_W}
          contentBg={contentBg}
          commonStyle={commonStyle}
        />
      );
    }
    return null;
  };

  // Loading
  if (loading) {
    return (
      <div className="preview-page preview-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Error
  if (error || !project) {
    return (
      <div className="preview-page preview-error">
        <p>{error || 'Проект не найден'}</p>
      </div>
    );
  }

  return (
    <div className="preview-page">
      {/* Canvas — без масштабирования, 1:1 */}
      <div
        className="preview-canvas"
        style={{
          width: project.canvas.width,
          height: project.canvas.height,
          backgroundColor: project.canvas.backgroundColor || '#ffffff',
          position: 'relative',
        }}
      >
        {project.widgets
          .slice()
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map((widget) => renderWidget(widget))}
      </div>

      {/* Popup */}
      {popupVisible && popupData && (
        <div className="preview-popup-overlay" onClick={() => setPopupVisible(false)}>
          <div
            className="preview-popup"
            style={{ width: popupData.width, maxHeight: popupData.height }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-popup-header">
              <h3>{popupData.title}</h3>
              <button onClick={() => setPopupVisible(false)}>×</button>
            </div>
            <div className="preview-popup-content">{popupData.content}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPage;
