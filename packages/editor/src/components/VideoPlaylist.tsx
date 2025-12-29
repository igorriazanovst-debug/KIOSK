import React, { useEffect, useState, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { Widget } from '../types';

interface VideoPlaylistProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransformEnd: (e: any) => void;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const VideoPlaylist: React.FC<VideoPlaylistProps> = ({
  widget,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  dragBoundFunc
}) => {
  const groupRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    sources = [],
    autoNext = true,
    loop = true
  } = widget.properties;

  const isLocked = widget.locked || false;
  const currentSource = sources[currentIndex];

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

      {/* Фон видео */}
      <Rect
        width={widget.width}
        height={widget.height}
        fill="#000000"
        listening={false}
      />

      {/* Иконка видео плейлиста */}
      <Text
        x={widget.width / 2}
        y={widget.height / 2 - 30}
        text="▶"
        fontSize={60}
        fill="#ffffff"
        align="center"
        width={widget.width}
        offsetX={widget.width / 2}
        listening={false}
      />

      {/* Текст "Playlist" */}
      <Text
        x={0}
        y={widget.height / 2 + 40}
        text="PLAYLIST"
        fontSize={16}
        fill="#ffffff"
        align="center"
        width={widget.width}
        listening={false}
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

      {/* Индикатор плейлиста */}
      {sources.length > 1 && (
        <>
          <Rect
            x={widget.width - 50}
            y={widget.height - 25}
            width={45}
            height={20}
            fill="rgba(0, 0, 0, 0.8)"
            cornerRadius={4}
            listening={false}
          />
          <Text
            x={widget.width - 48}
            y={widget.height - 21}
            text={`🎬 ${sources.length}`}
            fontSize={12}
            fill="#ffffff"
            listening={false}
          />
        </>
      )}
    </Group>
  );
};

export default VideoPlaylist;
