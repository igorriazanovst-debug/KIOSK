// packages/editor-web/src/components/WordsWidget.tsx
// Виджет «Я знаю много слов» (Тип 2) на канвасе редактора (Konva).
//
// Плашка-заглушка, а не играбельный рантайм: сама игра идёт на устройстве
// после установки, здесь педагог только настраивает занятие. Тот же принцип,
// что у ChronolineWidget.tsx — и осознанное решение не заводить второй общий
// UI-пакет ради превью, которым никто не пользуется (см. Яслов_план_реализации.md,
// «Целевая архитектура»).

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { Widget } from '../types';
import type { WordsWidgetProperties } from '@kiosk/shared';

interface WordsWidgetProps {
  widget: Widget;
  onSelect: (e?: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const WordsWidget: React.FC<WordsWidgetProps> = ({
  widget,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
}) => {
  const groupRef = useRef<any>(null);
  const props = widget.properties as Partial<WordsWidgetProperties>;
  const isLocked = widget.locked || false;

  const w = widget.width;
  const h = widget.height;

  const themeCount = props.enabledThemeIds?.length ?? 0;
  const themesLabel = themeCount === 0 ? 'все темы поставки' : `выбрано тем: ${themeCount}`;
  const playersLabel =
    (props.defaultPlayerCount ?? 1) > 1 ? `игроков: ${props.defaultPlayerCount}` : 'одиночная игра';

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
        fill="#1a2b25"
        stroke="#2a7255"
        strokeWidth={2}
        dash={[8, 4]}
        cornerRadius={6}
      />
      <Rect width={w} height={h} fill="transparent" listening={true} />
      <Text
        text="🔤"
        x={0}
        y={h / 2 - 70}
        width={w}
        align="center"
        fontSize={Math.min(64, w * 0.15, h * 0.25)}
        listening={false}
      />
      <Text
        text={props.title || 'Я знаю много слов'}
        x={16}
        y={h / 2 + 8}
        width={w - 32}
        align="center"
        fontSize={Math.min(20, w * 0.04)}
        fill="#8ee3bc"
        fontStyle="bold"
        listening={false}
      />
      <Text
        text={`${themesLabel} · ${playersLabel}`}
        x={16}
        y={h / 2 + 36}
        width={w - 32}
        align="center"
        fontSize={Math.min(14, w * 0.025)}
        fill="#9ab5a8"
        listening={false}
      />
      <Text
        text="Занятие идёт на самом устройстве после установки"
        x={16}
        y={h / 2 + 58}
        width={w - 32}
        align="center"
        fontSize={Math.min(14, w * 0.025)}
        fill="#aaa"
        listening={false}
      />
    </Group>
  );
};

export default WordsWidget;
