import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { Widget } from '../types';
import { useEditorStore } from '../stores/editorStore';

interface BrowserContentWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const BrowserContentWidget: React.FC<BrowserContentWidgetProps> = ({
  widget, isSelected, onSelect, onDragEnd, onTransformEnd, dragBoundFunc,
}) => {
  const { x, y, width, height } = widget;
  const browserId: string = widget.properties.browserId || '';
  const contentBg: string = widget.properties.contentBgColor || '#ffffff';
  const { project } = useEditorStore();

  // Найти связанный menu-виджет и взять первую страницу для превью
  const menuWidget = project?.widgets.find(
    (w: any) => w.type === 'browser-menu' && w.properties.browserId === browserId
  );
  const pages: any[] = menuWidget?.properties.pages || [];
  const firstPage = pages[0];
  const previewText = firstPage?.htmlContent
    ? firstPage.htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <Group
      id={widget.id}
      x={x} y={y} width={width} height={height}
      draggable={!widget.locked}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={onDragEnd} onTransformEnd={onTransformEnd}
      dragBoundFunc={dragBoundFunc}
    >
      <Rect x={0} y={0} width={width} height={height} fill="transparent" listening={true} />
      <Rect x={0} y={0} width={width} height={height}
        fill={contentBg === 'transparent' ? '#f8f9fa' : contentBg} listening={false}
      />

      {previewText ? (
        <Text x={8} y={8} width={width - 16} height={height - 16}
          text={previewText} fontSize={11} fill="#444"
          wrap="word" ellipsis listening={false}
        />
      ) : (
        <Text x={4} y={height / 2 - 10} width={width - 8}
          text={browserId ? `Контент: ${browserId.slice(0, 8)}…` : 'Нет связи с меню'}
          fontSize={12} fill="#aaa" align="center" listening={false}
        />
      )}

      <Rect x={0} y={0} width={width} height={height}
        stroke={isSelected ? '#007acc' : '#ddd'}
        strokeWidth={isSelected ? 2 : 1} fill="transparent" listening={false}
      />
      <Text x={width - 20} y={3} text="📄" fontSize={13} listening={false} />
    </Group>
  );
};

export default BrowserContentWidget;
