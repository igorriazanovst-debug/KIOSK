// packages/editor-web/src/components/NavigationWidget.tsx
// Виджет навигации на канвасе редактора (Konva).
// На этом шаге — только плашка-заглушка. Полная разметка будет добавлена на Шаге 3b.

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { Widget } from '../types';
import type { NavigationWidgetProperties } from '../utils/navigation/widgetType';

interface NavigationWidgetProps {
  widget: Widget;
  onSelect: (e?: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const NavigationWidget: React.FC<NavigationWidgetProps> = ({
  widget,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
}) => {
  const groupRef = useRef<any>(null);
  const props = widget.properties as Partial<NavigationWidgetProperties>;
  const isLocked = widget.locked || false;

  const floorsCount = props.navData?.floors?.length ?? 0;
  const activeFloor =
    props.navData?.floors?.find((f) => f.id === props.activeFloorId) ||
    props.navData?.floors?.[0];
  const roomsCount = activeFloor?.rooms?.length ?? 0;
  const terminalsCount = activeFloor?.terminals?.length ?? 0;

  const w = widget.width;
  const h = widget.height;
  const hasPlan = !!(activeFloor?.svgContent || activeFloor?.svgFileId);

  return (
    <Group
      ref={groupRef}
      id={widget.id}
      x={widget.x}
      y={widget.y}
      width={w}
      height={h}
      rotation={widget.rotation || 0}
      draggable={!isLocked}
      dragBoundFunc={dragBoundFunc}
      opacity={isLocked ? 0.6 : 1}
      onClick={(e: any) => onSelect(e)}
      onTap={(e: any) => onSelect(e)}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      <Rect
        width={w}
        height={h}
        fill="#1a3a52"
        stroke="#2a5a72"
        strokeWidth={2}
        dash={[8, 4]}
        cornerRadius={6}
      />
      <Rect width={w} height={h} fill="transparent" listening={true} />
      <Text
        text="🧭"
        x={0}
        y={h / 2 - 60}
        width={w}
        align="center"
        fontSize={Math.min(64, w * 0.15, h * 0.25)}
        listening={false}
      />
      <Text
        text={props.title || 'Навигация по зданию'}
        x={16}
        y={h / 2 + 8}
        width={w - 32}
        align="center"
        fontSize={Math.min(20, w * 0.04)}
        fill="#7ec8e3"
        fontStyle="bold"
        listening={false}
      />
      <Text
        text={
          floorsCount === 0
            ? 'Нет этажей. Откройте редактор плана в свойствах.'
            : hasPlan
            ? `Этажей: ${floorsCount} · Помещений: ${roomsCount} · Терминалов: ${terminalsCount}`
            : 'План не загружен. Откройте редактор плана в свойствах.'
        }
        x={16}
        y={h / 2 + 36}
        width={w - 32}
        align="center"
        fontSize={Math.min(14, w * 0.025)}
        fill="#aaa"
        listening={false}
      />
    </Group>
  );
};

export default NavigationWidget;
