import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { Widget } from '../types';

interface ButtonWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const ButtonWidget: React.FC<ButtonWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  const groupRef = useRef<any>(null);
  const textRef = useRef<any>(null);

  // Свойства кнопки
  const {
    text = 'Button',
    backgroundColor = '#2ecc71',
    textColor = '#ffffff',
    fontSize = 16,
    fontFamily = 'Arial',
    fontWeight = 'normal',
    fontStyle = 'normal',
    textAlign = 'center',
    borderRadius = 8,
    borderWidth = 0,
    borderColor = '#000000',
    borderStyle = 'solid',
    paddingX = 16,
    paddingY = 8,
    shadowEnabled = false,
    shadowColor = '#000000',
    shadowBlur = 10,
    shadowOffsetX = 0,
    shadowOffsetY = 4,
    shadowOpacity = 0.3
  } = widget.properties;

  const isLocked = widget.locked || false;

  // Преобразуем borderStyle в dash
  const getDash = () => {
    switch (borderStyle) {
      case 'dashed':
        return [10, 5];
      case 'dotted':
        return [3, 3];
      default:
        return [];
    }
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
      opacity={(widget.properties.opacity ?? 1) * (isLocked ? 0.6 : 1)}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {/* Тень кнопки */}
      {shadowEnabled && (
        <Rect
          x={shadowOffsetX}
          y={shadowOffsetY}
          width={widget.width}
          height={widget.height}
          cornerRadius={borderRadius}
          fill={shadowColor}
          opacity={shadowOpacity}
          blur={shadowBlur}
          listening={false}
        />
      )}

      {/* Фон кнопки */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill={backgroundColor}
        cornerRadius={borderRadius}
        stroke={borderWidth > 0 ? borderColor : undefined}
        strokeWidth={borderWidth}
        dash={getDash()}
        listening={false}
      />

      {/* Текст кнопки */}
      <Text
        ref={textRef}
        text={text}
        x={paddingX}
        y={0}
        width={widget.width - paddingX * 2}
        height={widget.height}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={fontWeight === 'bold' ? 'bold' : fontStyle}
        fill={textColor}
        align={textAlign}
        verticalAlign="middle"
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
          cornerRadius={borderRadius}
          listening={false}
        />
      )}
    </Group>
  );
};

export default ButtonWidget;
