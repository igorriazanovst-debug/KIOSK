// packages/editor-web/src/components/AlphabetWidget.tsx
// Виджет «АзбукоСлов» (Тип 3) на канвасе редактора (Konva).
//
// Плашка-заглушка, а не играбельный рантайм: игра идёт на устройстве после
// установки, здесь педагог только настраивает занятие. Тот же принцип, что у
// ChronolineWidget.tsx и WordsWidget.tsx — и то же осознанное решение не
// заводить второй общий UI-пакет ради превью, которым никто не пользуется.

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { Widget } from '../types';
import {
  ALPHABET_STAGE_TITLES,
  ALPHABET_DEFAULT_PROPS,
  ALPHABET_DEFAULT_QUESTION_COUNT,
} from '@kiosk/shared';
import type { AlphabetWidgetProperties } from '@kiosk/shared';

interface AlphabetWidgetProps {
  widget: Widget;
  onSelect: (e?: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const AlphabetWidget: React.FC<AlphabetWidgetProps> = ({
  widget,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
}) => {
  const groupRef = useRef<any>(null);
  const props = widget.properties as Partial<AlphabetWidgetProperties>;
  const isLocked = widget.locked || false;

  const w = widget.width;
  const h = widget.height;

  const stage = props.defaultStage ?? ALPHABET_DEFAULT_PROPS.defaultStage;
  const stageLabel = ALPHABET_STAGE_TITLES[stage] ?? stage;
  const questionCount = props.questionCount ?? ALPHABET_DEFAULT_QUESTION_COUNT;
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
        fill="#1b2433"
        stroke="#3a6ea5"
        strokeWidth={2}
        dash={[8, 4]}
        cornerRadius={6}
      />
      <Rect width={w} height={h} fill="transparent" listening={true} />
      <Text
        text="А Б В"
        x={0}
        y={h / 2 - 70}
        width={w}
        align="center"
        fontSize={Math.min(56, w * 0.13, h * 0.22)}
        fill="#e8a33d"
        fontStyle="bold"
        listening={false}
      />
      <Text
        text={props.title || 'АзбукоСлов'}
        x={16}
        y={h / 2 + 8}
        width={w - 32}
        align="center"
        fontSize={Math.min(20, w * 0.04)}
        fill="#9ec6f0"
        fontStyle="bold"
        listening={false}
      />
      <Text
        text={`${stageLabel} · вопросов: ${questionCount} · ${playersLabel}`}
        x={16}
        y={h / 2 + 36}
        width={w - 32}
        align="center"
        fontSize={Math.min(14, w * 0.025)}
        fill="#9aa8b5"
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

export default AlphabetWidget;
