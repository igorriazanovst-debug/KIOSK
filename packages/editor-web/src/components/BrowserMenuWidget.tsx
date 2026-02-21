import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { Widget } from '../types';

interface BrowserMenuWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDblClick: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const BrowserMenuWidget: React.FC<BrowserMenuWidgetProps> = ({
  widget, isSelected, onSelect, onDblClick, onDragEnd, onTransformEnd, dragBoundFunc,
}) => {
  const { x, y, width, height } = widget;
  const pages: any[] = widget.properties.pages || [];
  const orientation: string = widget.properties.orientation || 'vertical';
  const menuBg: string = widget.properties.menuBgColor || '#2c3e50';
  const menuTextColor: string = widget.properties.menuTextColor || '#ffffff';
  const menuFontSize: number = widget.properties.menuFontSize || 14;
  const isHoriz = orientation === 'horizontal';
  const topLevel = pages.filter((p: any) => !p.parentId);

  return (
    <Group
      id={widget.id}
      x={x} y={y} width={width} height={height}
      draggable={!widget.locked}
      onClick={onSelect} onTap={onSelect}
      onDblClick={onDblClick}
      onDragEnd={onDragEnd} onTransformEnd={onTransformEnd}
      dragBoundFunc={dragBoundFunc}
    >
      <Rect x={0} y={0} width={width} height={height} fill="transparent" listening={true} />
      <Rect x={0} y={0} width={width} height={height} fill={menuBg} listening={false} />

      {topLevel.slice(0, 20).map((page: any, i: number) => {
        const itemW = isHoriz ? Math.min(140, width / Math.max(topLevel.length, 1)) : width;
        const itemH = isHoriz ? height : Math.min(40, height / Math.max(topLevel.length, 1));
        const ix = isHoriz ? i * itemW : 0;
        const iy = isHoriz ? 0 : i * itemH;
        return (
          <React.Fragment key={page.id}>
            <Rect x={ix} y={iy} width={itemW} height={itemH}
              fill="transparent" listening={false} />
            <Text
              x={ix + 8} y={iy + Math.max(0, itemH / 2 - menuFontSize / 2)}
              text={page.title || 'Страница'}
              fontSize={menuFontSize} fill={menuTextColor}
              width={itemW - 16} ellipsis listening={false}
            />
          </React.Fragment>
        );
      })}

      {pages.length === 0 && (
        <Text x={4} y={height / 2 - 8} width={width - 8}
          text="Двойной клик — редактировать"
          fontSize={11} fill="rgba(255,255,255,0.5)" align="center" listening={false}
        />
      )}

      <Rect x={0} y={0} width={width} height={height}
        stroke={isSelected ? '#007acc' : 'transparent'}
        strokeWidth={2} fill="transparent" listening={false}
      />
      <Text x={width - 20} y={3} text="🌐" fontSize={13} listening={false} />
    </Group>
  );
};

export default BrowserMenuWidget;
