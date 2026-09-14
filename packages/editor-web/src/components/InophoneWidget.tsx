// packages/editor-web/src/components/InophoneWidget.tsx
// Виджет «Инофон» (Тип 4) на канвасе редактора (Konva).
//
// Плашка-заглушка, а не играбельный рантайм: занятие идёт на устройстве после
// установки, здесь педагог только настраивает. Тот же принцип, что у
// ChronolineWidget, WordsWidget и AlphabetWidget.
//
// На плашке показаны ИЗУЧАЕМЫЕ ЯЗЫКИ их собственными названиями. Это главная
// настройка виджета, и педагог, глядя на канвас с несколькими виджетами,
// должен различать их не по заголовку, а по сути занятия.

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { Widget } from '../types';
import {
  INOPHONE_DEFAULT_PROPS,
  INOPHONE_DEFAULT_QUESTION_COUNT,
  INOPHONE_LANGUAGES,
  INOPHONE_MODE_TITLES,
} from '@kiosk/shared';
import type { InophoneWidgetProperties } from '@kiosk/shared';

interface InophoneWidgetProps {
  widget: Widget;
  onSelect: (e?: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const InophoneWidget: React.FC<InophoneWidgetProps> = ({
  widget,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc,
}) => {
  const groupRef = useRef<any>(null);
  const props = widget.properties as Partial<InophoneWidgetProperties>;
  const isLocked = widget.locked || false;

  const w = widget.width;
  const h = widget.height;

  const studyCodes = props.studyLanguages ?? INOPHONE_DEFAULT_PROPS.studyLanguages;
  // Название языка — на нём самом: так же, как в списке выбора у пользователя
  const studyNames = studyCodes
    .map((code) => INOPHONE_LANGUAGES.find((l) => l.code === code)?.nativeName ?? code)
    .join(' · ');

  const mode = props.defaultMode ?? INOPHONE_DEFAULT_PROPS.defaultMode;
  const modeLabel = INOPHONE_MODE_TITLES[mode] ?? mode;
  const questionCount = props.questionCount ?? INOPHONE_DEFAULT_QUESTION_COUNT;
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
        stroke="#4a8a7a"
        strokeWidth={2}
        dash={[8, 4]}
        cornerRadius={6}
      />
      <Rect width={w} height={h} fill="transparent" listening={true} />
      <Text
        text={studyNames || '—'}
        x={0}
        y={h / 2 - 70}
        width={w}
        align="center"
        fontSize={Math.min(48, w * 0.09, h * 0.2)}
        fill="#6fc2a8"
        fontStyle="bold"
        listening={false}
      />
      <Text
        text={props.title || 'Инофон'}
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
        text={`${modeLabel} · вопросов: ${questionCount} · ${playersLabel}`}
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

export default InophoneWidget;
