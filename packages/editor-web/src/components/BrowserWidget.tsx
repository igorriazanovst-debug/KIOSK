import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { Widget } from '../types';

interface BrowserWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDblClick: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const BrowserWidget: React.FC<BrowserWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  onDblClick,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
}) => {
  const { x, y, width, height } = widget;
  const pages: any[] = widget.properties.pages || [];
  const firstPage = pages[0];
  const menuPosition: string = widget.properties.menuPosition || 'top';
  const menuBg: string = widget.properties.menuBgColor || '#2c3e50';
  const menuTextColor: string = widget.properties.menuTextColor || '#ffffff';
  const menuFontSize: number = widget.properties.menuFontSize || 14;

  const MENU_H = (menuPosition === 'top' || menuPosition === 'bottom') ? 40 : 0;
  const MENU_W = (menuPosition === 'left' || menuPosition === 'right') ? 160 : 0;

  const contentX = menuPosition === 'left' ? MENU_W : 0;
  const contentY = menuPosition === 'top' ? MENU_H : 0;
  const contentW = width - MENU_W;
  const contentH = height - MENU_H;

  const menuX = menuPosition === 'right' ? contentW : 0;
  const menuY = menuPosition === 'bottom' ? contentH : 0;
  const menuW = (menuPosition === 'left' || menuPosition === 'right') ? MENU_W : width;
  const menuH = (menuPosition === 'top' || menuPosition === 'bottom') ? MENU_H : height;

  const topLevelPages = pages.filter((p: any) => !p.parentId);
  const isHoriz = menuPosition === 'top' || menuPosition === 'bottom';

  const previewText = firstPage?.htmlContent
    ? firstPage.htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <Group
      id={widget.id}
      x={x}
      y={y}
      width={width}
      height={height}
      draggable={!widget.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      dragBoundFunc={dragBoundFunc}
    >
      {/* Невидимый Rect для перехвата всех кликов */}
      <Rect
        x={0} y={0} width={width} height={height}
        fill="transparent"
        listening={true}
      />

      {/* Граница виджета */}
      <Rect
        x={0} y={0} width={width} height={height}
        stroke={isSelected ? '#007acc' : '#cccccc'}
        strokeWidth={isSelected ? 2 : 1}
        fill="transparent"
        listening={false}
      />

      {/* Контентная область */}
      <Rect
        x={contentX} y={contentY} width={contentW} height={contentH}
        fill="#f8f9fa"
        listening={false}
      />

      {/* Превью текста первой страницы */}
      {previewText ? (
        <Text
          x={contentX + 8} y={contentY + 8}
          width={contentW - 16} height={contentH - 16}
          text={previewText}
          fontSize={11} fill="#444"
          listening={false} wrap="word" ellipsis
        />
      ) : (
        <Text
          x={contentX + 4} y={contentY + contentH / 2 - 10}
          width={contentW - 8}
          text={pages.length === 0 ? 'Двойной клик — редактировать' : 'Нет содержимого'}
          fontSize={12} fill="#aaa" align="center"
          listening={false}
        />
      )}

      {/* Меню */}
      <Rect
        x={menuX} y={menuY} width={menuW} height={menuH}
        fill={menuBg}
        listening={false}
      />

      {/* Пункты меню */}
      {topLevelPages.slice(0, 6).map((page: any, i: number) => {
        const itemW = isHoriz ? Math.min(120, menuW / Math.max(topLevelPages.length, 1)) : menuW;
        const itemH = isHoriz ? menuH : Math.min(36, menuH / Math.max(topLevelPages.length, 1));
        const ix = menuX + (isHoriz ? i * itemW : 0);
        const iy = menuY + (isHoriz ? 0 : i * itemH);
        return (
          <Text
            key={page.id}
            x={ix + 6} y={iy + Math.max(0, itemH / 2 - menuFontSize / 2)}
            text={page.title || 'Страница'}
            fontSize={menuFontSize} fill={menuTextColor}
            listening={false}
            width={itemW - 12}
            ellipsis
          />
        );
      })}

      {/* Иконка */}
      <Text x={width - 22} y={4} text="🌐" fontSize={14} listening={false} />
    </Group>
  );
};

export default BrowserWidget;
