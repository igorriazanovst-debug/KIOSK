import React, { useRef } from 'react';
import { Group, Rect, Circle, RegularPolygon, Star, Ellipse, Line } from 'react-konva';
import { Widget } from '../types';

interface ShapeWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const ShapeWidget: React.FC<ShapeWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  const groupRef = useRef<any>(null);

  const {
    shapeType = 'rectangle',
    fillColor = '#4a90e2',
    strokeColor = '#2c3e50',
    strokeWidth = 0,
    cornerRadius = 0,
    opacity = 1
  } = widget.properties;

  const isLocked = widget.locked || false;

  // Рендерим нужную фигуру
  const renderShape = () => {
    const commonProps = {
      fill: fillColor,
      stroke: strokeWidth > 0 ? strokeColor : undefined,
      strokeWidth: strokeWidth,
      opacity: opacity,
      listening: false
    };

    switch (shapeType) {
      case 'rectangle':
        return (
          <Rect
            x={0}
            y={0}
            width={widget.width}
            height={widget.height}
            cornerRadius={cornerRadius}
            {...commonProps}
          />
        );

      case 'circle':
        // Круг - используем минимальный размер для радиуса
        const radius = Math.min(widget.width, widget.height) / 2;
        return (
          <Circle
            x={widget.width / 2}
            y={widget.height / 2}
            radius={radius}
            {...commonProps}
          />
        );

      case 'ellipse':
        return (
          <Ellipse
            x={widget.width / 2}
            y={widget.height / 2}
            radiusX={widget.width / 2}
            radiusY={widget.height / 2}
            {...commonProps}
          />
        );

      case 'triangle':
        return (
          <RegularPolygon
            x={widget.width / 2}
            y={widget.height / 2}
            sides={3}
            radius={Math.min(widget.width, widget.height) / 2}
            {...commonProps}
          />
        );

      case 'pentagon':
        return (
          <RegularPolygon
            x={widget.width / 2}
            y={widget.height / 2}
            sides={5}
            radius={Math.min(widget.width, widget.height) / 2}
            {...commonProps}
          />
        );

      case 'hexagon':
        return (
          <RegularPolygon
            x={widget.width / 2}
            y={widget.height / 2}
            sides={6}
            radius={Math.min(widget.width, widget.height) / 2}
            {...commonProps}
          />
        );

      case 'star':
        return (
          <Star
            x={widget.width / 2}
            y={widget.height / 2}
            numPoints={5}
            innerRadius={Math.min(widget.width, widget.height) / 4}
            outerRadius={Math.min(widget.width, widget.height) / 2}
            {...commonProps}
          />
        );

      case 'diamond':
        // Ромб - поворачиваем квадрат на 45°
        return (
          <RegularPolygon
            x={widget.width / 2}
            y={widget.height / 2}
            sides={4}
            radius={Math.min(widget.width, widget.height) / 2}
            rotation={45}
            {...commonProps}
          />
        );

      case 'line':
        return (
          <Line
            points={[0, widget.height / 2, widget.width, widget.height / 2]}
            stroke={strokeColor}
            strokeWidth={Math.max(strokeWidth, 2)}
            opacity={opacity}
            listening={false}
          />
        );

      case 'arrow':
        // Стрелка вправо
        const arrowWidth = widget.width;
        const arrowHeight = widget.height;
        const headWidth = arrowHeight * 0.6;
        const shaftHeight = arrowHeight * 0.4;
        
        return (
          <Line
            points={[
              0, arrowHeight / 2 - shaftHeight / 2,  // Начало верхней линии
              arrowWidth - headWidth, arrowHeight / 2 - shaftHeight / 2,  // Верхняя линия до стрелки
              arrowWidth - headWidth, 0,  // Верх стрелки
              arrowWidth, arrowHeight / 2,  // Кончик стрелки
              arrowWidth - headWidth, arrowHeight,  // Низ стрелки
              arrowWidth - headWidth, arrowHeight / 2 + shaftHeight / 2,  // Нижняя линия от стрелки
              0, arrowHeight / 2 + shaftHeight / 2  // Конец нижней линии
            ]}
            closed
            fill={fillColor}
            stroke={strokeWidth > 0 ? strokeColor : undefined}
            strokeWidth={strokeWidth}
            opacity={opacity}
            listening={false}
          />
        );

      default:
        return (
          <Rect
            x={0}
            y={0}
            width={widget.width}
            height={widget.height}
            {...commonProps}
          />
        );
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
      opacity={isLocked ? 0.6 : 1}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {/* Невидимый прямоугольник для кликов */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill="transparent"
        listening={true}
      />

      {/* Фигура */}
      {renderShape()}

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

export default ShapeWidget;
