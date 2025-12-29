import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { Widget } from '../types';

interface TextWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const TextWidget: React.FC<TextWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  const groupRef = useRef<any>(null);

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

  const isLocked = widget.locked || false;

  // Применяем textDecoration
  const getTextDecoration = () => {
    if (textDecoration === 'underline') return 'underline';
    if (textDecoration === 'line-through') return 'line-through';
    return '';
  };

  return (
    <Group
      ref={groupRef}
      id={widget.id}
      x={widget.x}
      y={widget.y}
      width={widget.width}
      height={widget.height}
      rotation={widget.rotation || 0}
      draggable={!isLocked}
      dragBoundFunc={dragBoundFunc}
      opacity={isLocked ? 0.6 : 1}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {/* Фон */}
      {backgroundColor !== 'transparent' && (
        <Rect
          width={widget.width}
          height={widget.height}
          fill={backgroundColor}
          listening={false}
        />
      )}

      {/* Текст */}
      <Text
        text={text}
        x={padding}
        y={padding}
        width={widget.width - padding * 2}
        height={widget.height - padding * 2}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={fontWeight === 'bold' ? 'bold' : fontStyle}
        fill={textColor}
        align={textAlign}
        verticalAlign={verticalAlign}
        lineHeight={lineHeight}
        textDecoration={getTextDecoration()}
        listening={false}
      />

      {/* Невидимый слой для кликов */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill="transparent"
        listening={true}
      />

      {/* Рамка выделения */}
      {isSelected && (
        <Rect
          width={widget.width}
          height={widget.height}
          stroke="#007acc"
          strokeWidth={2}
          listening={false}
        />
      )}
    </Group>
  );
};

export default TextWidget;
