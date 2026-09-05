// packages/player/src/natcom/editor/Workspace.tsx
// Сцена Konva виджета «Конструктор природных сообществ» (Тип5_бэклог.md,
// T5-060/T5-061/T5-062) - аналог Workspace/WorkspaceBackground/
// WorkspaceObject/WorkspaceTransformer оригинала (СПЕЦИФИКАЦИЯ, раздел 4.2).
//
// "Доска" - это буквально текущий размер контейнера (boardWidthPx/
// boardHeightPx приходят из ResizeObserver в EditorScreen.tsx), без
// фиксированного аспекта - именно это гарантирует geometry.ts (fractional-
// координаты пересчитываются под ЛЮБОЙ размер доски без опорного размера).

import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { NatComLibrary, ProjectObject } from '@kiosk/shared';
import { toPixelRect } from '@kiosk/shared';
import { useHtmlImage } from '../useHtmlImage';
import { resolveMediaUrl } from '../mediaUrl';

export type EditorMode = 'drag' | 'transform' | 'edit' | 'play';

interface WorkspaceObjectNodeProps {
  object: ProjectObject;
  library: NatComLibrary;
  boardWidthPx: number;
  boardHeightPx: number;
  isSelected: boolean;
  interactive: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragEnd: (xPx: number, yPx: number) => void;
  registerNode: (node: Konva.Group | null) => void;
}

const WorkspaceObjectNode: React.FC<WorkspaceObjectNodeProps> = ({
  object,
  library,
  boardWidthPx,
  boardHeightPx,
  isSelected,
  interactive,
  draggable,
  onSelect,
  onDragEnd,
  registerNode,
}) => {
  const libraryObject = library.objects.find((o) => o.id === object.libraryObjectId);
  const imageUrl = resolveMediaUrl(library, libraryObject?.imageMediaId ?? null);
  const image = useHtmlImage(imageUrl);

  const px = toPixelRect(object, boardWidthPx, boardHeightPx);
  const centerX = px.x + px.width / 2;
  const centerY = px.y + px.height / 2;

  return (
    <Group
      ref={registerNode}
      x={centerX}
      y={centerY}
      width={px.width}
      height={px.height}
      offsetX={px.width / 2}
      offsetY={px.height / 2}
      rotation={object.rotation}
      scaleX={object.flip ? -1 : 1}
      scaleY={1}
      draggable={draggable}
      onClick={interactive ? onSelect : undefined}
      onTap={interactive ? onSelect : undefined}
      onDragStart={interactive ? onSelect : undefined}
      onDragEnd={(e) => {
        const node = e.target;
        // node.x()/y() остаются "центром" (offset уже вычтен Konva) - для
        // фракционных координат нужен верхний левый угол.
        onDragEnd(node.x() - px.width / 2, node.y() - px.height / 2);
      }}
    >
      {/* Невидимый прямоугольник-перехватчик кликов - без него, пока
          изображение ещё не загрузилось (или для пустой заглушки), Konva
          не находит ничего под курсором и клик проваливается сквозь объект
          на пустой фон сцены (тот же паттерн, что ImageWidget.tsx в
          editor-web). */}
      <Rect width={px.width} height={px.height} fill="transparent" listening />
      {image ? (
        <KonvaImage image={image} width={px.width} height={px.height} listening={false} />
      ) : null}
      {isSelected && (
        <Rect width={px.width} height={px.height} stroke="#3fae68" strokeWidth={2} fill="transparent" listening={false} />
      )}
    </Group>
  );
};

interface WorkspaceProps {
  library: NatComLibrary;
  backgroundUrl: string | null;
  objects: ProjectObject[];
  mode: EditorMode;
  selectedObjectId: string | null;
  boardWidthPx: number;
  boardHeightPx: number;
  onSelectObject: (id: string | null) => void;
  onObjectMoved: (id: string, xPx: number, yPx: number) => void;
  onObjectTransformed: (id: string, xPx: number, yPx: number, widthPx: number, heightPx: number, rotation: number, flip: boolean) => void;
  onDropNewObject: (libraryObjectId: string, xFraction: number, yFraction: number) => void;
}

const Workspace: React.FC<WorkspaceProps> = ({
  library,
  backgroundUrl,
  objects,
  mode,
  selectedObjectId,
  boardWidthPx,
  boardHeightPx,
  onSelectObject,
  onObjectMoved,
  onObjectTransformed,
  onDropNewObject,
}) => {
  const backgroundImage = useHtmlImage(backgroundUrl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodesRef = useRef(new Map<string, Konva.Group>());

  const isInteractive = mode !== 'play';
  const canDrag = mode === 'drag' || mode === 'transform';

  useEffect(() => {
    if (!transformerRef.current) return;
    const selectedNode = selectedObjectId ? nodesRef.current.get(selectedObjectId) : undefined;
    if (mode === 'transform' && selectedNode) {
      transformerRef.current.nodes([selectedNode]);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [mode, selectedObjectId, objects]);

  const handleTransformEnd = () => {
    const node = selectedObjectId ? nodesRef.current.get(selectedObjectId) : undefined;
    if (!node || !selectedObjectId) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const baseWidth = node.width();
    const baseHeight = node.height();
    const newWidth = Math.abs(scaleX) * baseWidth;
    const newHeight = Math.abs(scaleY) * baseHeight;
    const flip = scaleX < 0;
    const centerX = node.x();
    const centerY = node.y();
    // Сбрасываем scale узла в ±1 - дальше React перерисует его из
    // width/height/flip в состоянии (стандартный паттерн Konva Transformer:
    // не копить composed scale между трансформациями).
    node.scaleX(flip ? -1 : 1);
    node.scaleY(1);
    onObjectTransformed(
      selectedObjectId,
      centerX - newWidth / 2,
      centerY - newHeight / 2,
      newWidth,
      newHeight,
      node.rotation(),
      flip
    );
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const libraryObjectId = e.dataTransfer.getData('application/x-natcom-object-id');
    if (!libraryObjectId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xFraction = (e.clientX - rect.left) / boardWidthPx;
    const yFraction = (e.clientY - rect.top) / boardHeightPx;
    onDropNewObject(libraryObjectId, xFraction, yFraction);
  };

  return (
    <div
      ref={containerRef}
      className="natcom-workspace"
      style={{ width: boardWidthPx, height: boardHeightPx }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={mode !== 'play' ? handleDrop : undefined}
    >
      <Stage
        width={boardWidthPx}
        height={boardHeightPx}
        onClick={(e) => {
          if (isInteractive && e.target === e.target.getStage()) onSelectObject(null);
        }}
      >
        <Layer>
          {backgroundImage && (
            <KonvaImage image={backgroundImage} x={0} y={0} width={boardWidthPx} height={boardHeightPx} listening={false} />
          )}
          {objects.map((object) => (
            <WorkspaceObjectNode
              key={object.id}
              object={object}
              library={library}
              boardWidthPx={boardWidthPx}
              boardHeightPx={boardHeightPx}
              isSelected={isInteractive && object.id === selectedObjectId}
              interactive={isInteractive}
              draggable={isInteractive && canDrag}
              onSelect={() => onSelectObject(object.id)}
              onDragEnd={(xPx, yPx) => onObjectMoved(object.id, xPx, yPx)}
              registerNode={(node) => {
                if (node) nodesRef.current.set(object.id, node);
                else nodesRef.current.delete(object.id);
              }}
            />
          ))}
          {mode === 'transform' && (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              flipEnabled={false}
              onTransformEnd={handleTransformEnd}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default Workspace;
