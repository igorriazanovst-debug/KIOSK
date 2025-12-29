import React, { useRef, useState } from 'react';
import { Group, Rect, Text as KonvaText, Line } from 'react-konva';
import { Widget } from '../types';

interface MenuWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

export interface MenuItem {
  id: string;
  label: string;
  children?: MenuItem[];
}

const MenuWidget: React.FC<MenuWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  const groupRef = useRef<any>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const {
    orientation = 'horizontal',
    items = [
      { id: '1', label: 'Главная' },
      { id: '2', label: 'О нас' },
      { id: '3', label: 'Услуги', children: [
        { id: '3-1', label: 'Услуга 1' },
        { id: '3-2', label: 'Услуга 2' }
      ]},
      { id: '4', label: 'Контакты' }
    ] as MenuItem[],
    backgroundColor = '#2c3e50',
    textColor = '#ffffff',
    hoverColor = '#34495e',
    fontSize = 16,
    fontFamily = 'Arial',
    itemPadding = 16,
    submenuBackgroundColor = '#34495e',
    submenuTextColor = '#ffffff',
    borderWidth = 0,
    borderColor = '#000000',
    itemHeight = 40
  } = widget.properties;

  const isLocked = widget.locked || false;
  const isHorizontal = orientation === 'horizontal';

  // Вычисляем размеры пунктов меню
  const calculateItemWidth = (label: string) => {
    // Приблизительная ширина текста
    return label.length * (fontSize * 0.6) + itemPadding * 2;
  };

  // Рендерим горизонтальное меню
  const renderHorizontalMenu = () => {
    const elements: JSX.Element[] = [];
    let currentX = 0;

    items.forEach((item, index) => {
      const itemWidth = calculateItemWidth(item.label);
      const isHovered = hoveredItem === item.id;
      const isExpanded = expandedItem === item.id;
      const hasChildren = item.children && item.children.length > 0;

      // Фон пункта меню
      elements.push(
        <Rect
          key={`bg-${item.id}`}
          x={currentX}
          y={0}
          width={itemWidth}
          height={itemHeight}
          fill={isHovered ? hoverColor : backgroundColor}
          listening={true}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => {
            if (hasChildren) {
              setExpandedItem(expandedItem === item.id ? null : item.id);
            }
          }}
        />
      );

      // Текст пункта меню
      elements.push(
        <KonvaText
          key={`text-${item.id}`}
          x={currentX}
          y={0}
          width={itemWidth}
          height={itemHeight}
          text={item.label}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={textColor}
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      );

      // Индикатор подменю (стрелка вниз)
      if (hasChildren) {
        elements.push(
          <KonvaText
            key={`arrow-${item.id}`}
            x={currentX + itemWidth - 20}
            y={0}
            width={20}
            height={itemHeight}
            text="▼"
            fontSize={10}
            fill={textColor}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        );
      }

      // Разделитель
      if (index < items.length - 1) {
        elements.push(
          <Line
            key={`divider-${item.id}`}
            points={[currentX + itemWidth, 5, currentX + itemWidth, itemHeight - 5]}
            stroke={borderColor}
            strokeWidth={1}
            opacity={0.3}
            listening={false}
          />
        );
      }

      // Подменю (если развёрнуто)
      if (isExpanded && hasChildren) {
        item.children!.forEach((child, childIndex) => {
          const childY = itemHeight + childIndex * itemHeight;
          const childWidth = Math.max(itemWidth, calculateItemWidth(child.label));

          // Фон подменю
          elements.push(
            <Rect
              key={`submenu-bg-${child.id}`}
              x={currentX}
              y={childY}
              width={childWidth}
              height={itemHeight}
              fill={submenuBackgroundColor}
              listening={true}
              onMouseEnter={() => setHoveredItem(child.id)}
              onMouseLeave={() => setHoveredItem(null)}
            />
          );

          // Текст подменю
          elements.push(
            <KonvaText
              key={`submenu-text-${child.id}`}
              x={currentX + itemPadding / 2}
              y={childY}
              width={childWidth - itemPadding / 2}
              height={itemHeight}
              text={child.label}
              fontSize={fontSize - 2}
              fontFamily={fontFamily}
              fill={submenuTextColor}
              align="left"
              verticalAlign="middle"
              listening={false}
            />
          );
        });
      }

      currentX += itemWidth;
    });

    return elements;
  };

  // Рендерим вертикальное меню
  const renderVerticalMenu = () => {
    const elements: JSX.Element[] = [];
    let currentY = 0;
    const menuWidth = widget.width;

    items.forEach((item, index) => {
      const isHovered = hoveredItem === item.id;
      const isExpanded = expandedItem === item.id;
      const hasChildren = item.children && item.children.length > 0;

      // Фон пункта меню
      elements.push(
        <Rect
          key={`bg-${item.id}`}
          x={0}
          y={currentY}
          width={menuWidth}
          height={itemHeight}
          fill={isHovered ? hoverColor : backgroundColor}
          listening={true}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => {
            if (hasChildren) {
              setExpandedItem(expandedItem === item.id ? null : item.id);
            }
          }}
        />
      );

      // Текст пункта меню
      elements.push(
        <KonvaText
          key={`text-${item.id}`}
          x={itemPadding}
          y={currentY}
          width={menuWidth - itemPadding * 2 - (hasChildren ? 20 : 0)}
          height={itemHeight}
          text={item.label}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={textColor}
          align="left"
          verticalAlign="middle"
          listening={false}
        />
      );

      // Индикатор подменю (стрелка вправо или вниз)
      if (hasChildren) {
        elements.push(
          <KonvaText
            key={`arrow-${item.id}`}
            x={menuWidth - 20}
            y={currentY}
            width={20}
            height={itemHeight}
            text={isExpanded ? "▼" : "▶"}
            fontSize={10}
            fill={textColor}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        );
      }

      currentY += itemHeight;

      // Разделитель
      if (index < items.length - 1 && !isExpanded) {
        elements.push(
          <Line
            key={`divider-${item.id}`}
            points={[10, currentY, menuWidth - 10, currentY]}
            stroke={borderColor}
            strokeWidth={1}
            opacity={0.3}
            listening={false}
          />
        );
      }

      // Подменю (если развёрнуто)
      if (isExpanded && hasChildren) {
        item.children!.forEach((child, childIndex) => {
          const childIsHovered = hoveredItem === child.id;

          // Фон подменю
          elements.push(
            <Rect
              key={`submenu-bg-${child.id}`}
              x={0}
              y={currentY}
              width={menuWidth}
              height={itemHeight}
              fill={childIsHovered ? hoverColor : submenuBackgroundColor}
              listening={true}
              onMouseEnter={() => setHoveredItem(child.id)}
              onMouseLeave={() => setHoveredItem(null)}
            />
          );

          // Индентация для подменю
          elements.push(
            <KonvaText
              key={`submenu-text-${child.id}`}
              x={itemPadding * 2}
              y={currentY}
              width={menuWidth - itemPadding * 3}
              height={itemHeight}
              text={child.label}
              fontSize={fontSize - 2}
              fontFamily={fontFamily}
              fill={submenuTextColor}
              align="left"
              verticalAlign="middle"
              listening={false}
            />
          );

          currentY += itemHeight;
        });

        // Разделитель после подменю
        if (index < items.length - 1) {
          elements.push(
            <Line
              key={`divider-after-${item.id}`}
              points={[10, currentY, menuWidth - 10, currentY]}
              stroke={borderColor}
              strokeWidth={1}
              opacity={0.3}
              listening={false}
            />
          );
        }
      }
    });

    return elements;
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

      {/* Фон меню */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill={backgroundColor}
        listening={false}
      />

      {/* Рамка */}
      {borderWidth > 0 && (
        <Rect
          width={widget.width}
          height={widget.height}
          stroke={borderColor}
          strokeWidth={borderWidth}
          listening={false}
        />
      )}

      {/* Пункты меню */}
      {isHorizontal ? renderHorizontalMenu() : renderVerticalMenu()}

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

export default MenuWidget;
