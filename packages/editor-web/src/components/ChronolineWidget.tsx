// packages/editor-web/src/components/ChronolineWidget.tsx
// Виджет «Хронолиния» на канвасе редактора (Konva).
// Плашка-заглушка — реальные хронолинии/события создаются локально на
// устройстве после установки, не здесь. См. widgetType.ts и
// Хронолайнер_vs_KIOSK_анализ.md (раздел 8) для контекста.

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { Widget } from '../types';
import type { ChronolineWidgetProperties } from '../utils/chronoline/widgetType';

interface ChronolineWidgetProps {
  widget: Widget;
  onSelect: (e?: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const ChronolineWidget: React.FC<ChronolineWidgetProps> = ({
  widget,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
}) => {
  const groupRef = useRef<any>(null);
  const props = widget.properties as Partial<ChronolineWidgetProperties>;
  const isLocked = widget.locked || false;

  const w = widget.width;
  const h = widget.height;

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
        fill="#2b1a3a"
        stroke="#5a2a72"
        strokeWidth={2}
        dash={[8, 4]}
        cornerRadius={6}
      />
      <Rect width={w} height={h} fill="transparent" listening={true} />
      <Text
        text="🕒"
        x={0}
        y={h / 2 - 60}
        width={w}
        align="center"
        fontSize={Math.min(64, w * 0.15, h * 0.25)}
        listening={false}
      />
      <Text
        text={props.title || 'Хронолиния'}
        x={16}
        y={h / 2 + 8}
        width={w - 32}
        align="center"
        fontSize={Math.min(20, w * 0.04)}
        fill="#c88ee3"
        fontStyle="bold"
        listening={false}
      />
      <Text
        text="Хронолинии создаются на самом устройстве после установки"
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

export default ChronolineWidget;
