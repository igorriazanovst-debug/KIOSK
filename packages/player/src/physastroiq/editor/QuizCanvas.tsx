// packages/player/src/physastroiq/editor/QuizCanvas.tsx
// Прямая адаптация rusiq/editor/QuizCanvas.tsx (Тип 7) — Konva-канвас для
// расстановки прямоугольных кликабельных областей поверх изображения.
// Компонент УЖЕ уровне-агностичен: получает списки questions/
// genericDecoyPoints, отфильтрованные вызывающим кодом (EditorScreen) по
// текущему редактируемому уровню, и не знает о существовании остальных
// двух уровней — та же картинка/точки, что у rusiq, просто для одного
// уровня за раз.

import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useHtmlImage } from './useHtmlImage.ts';
import { PHYSASTROIQ_DEFAULT_POINT_SIZE, type PhysastroiqPoint, type PhysastroiqQuestion } from '../model/schema.ts';

export type QuizCanvasAddMode = 'none' | 'question' | 'decoy-of-selected' | 'generic-decoy';

const CANVAS_WIDTH = 900;
const COLOR_CORRECT = '#2e7d32';
const COLOR_CORRECT_SELECTED = '#1b5e20';
const COLOR_DECOY_OF_QUESTION = '#e65100';
const COLOR_GENERIC_DECOY = '#616161';

function decoyOfQuestionNodeId(questionId: string, decoyIndex: number): string {
  return `decoy::${questionId}::${decoyIndex}`;
}
function genericDecoyNodeId(index: number): string {
  return `generic::${index}`;
}

interface Size {
  width: number;
  height: number;
}

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  // Найденный баг (2026-09-15, тот же класс, что на игровом поле —
  // GameBoardScreen.tsx): масштаб раньше считался ТОЛЬКО от ширины
  // (CANVAS_WIDTH / imageWidth) — для высоких изображений (наш уровень 1,
  // 1520×1440) канвас получался выше доступного окна (~852px против
  // ~779px), и нижняя часть с частью точек физически не помещалась.
  // maxHeightPx — измеренная EditorScreen доступная высота; если задана,
  // масштаб выбирается по МЕНЬШЕЙ из двух границ (ширина/высота), чтобы
  // канвас целиком помещался в видимую область.
  maxHeightPx?: number;
  questions: PhysastroiqQuestion[];
  genericDecoyPoints: PhysastroiqPoint[];
  selectedQuestionId: string | null;
  selection: { kind: 'question'; questionId: string } | { kind: 'decoy-of-question'; questionId: string; decoyIndex: number } | { kind: 'generic-decoy'; index: number } | null;
  addMode: QuizCanvasAddMode;
  onSelectQuestion: (id: string | null) => void;
  onAddQuestionPoint: (point: PhysastroiqPoint) => void;
  onAddDecoyToSelected: (point: PhysastroiqPoint) => void;
  onAddGenericDecoy: (point: PhysastroiqPoint) => void;
  onMoveQuestionPoint: (id: string, point: { x: number; y: number }) => void;
  onMoveDecoyOfQuestion: (questionId: string, decoyIndex: number, point: PhysastroiqPoint) => void;
  onMoveGenericDecoy: (index: number, point: PhysastroiqPoint) => void;
  onResizeQuestionPoint: (id: string, size: Size) => void;
  onResizeDecoyOfQuestion: (questionId: string, decoyIndex: number, size: Size) => void;
  onResizeGenericDecoy: (index: number, size: Size) => void;
  onSelectDecoyOfQuestion: (questionId: string, decoyIndex: number) => void;
  onSelectGenericDecoy: (index: number) => void;
}

const QuizCanvas: React.FC<Props> = ({
  imageUrl,
  imageWidth,
  imageHeight,
  maxHeightPx,
  questions,
  genericDecoyPoints,
  selectedQuestionId,
  selection,
  addMode,
  onSelectQuestion,
  onAddQuestionPoint,
  onAddDecoyToSelected,
  onAddGenericDecoy,
  onMoveQuestionPoint,
  onMoveDecoyOfQuestion,
  onMoveGenericDecoy,
  onResizeQuestionPoint,
  onResizeDecoyOfQuestion,
  onResizeGenericDecoy,
  onSelectDecoyOfQuestion,
  onSelectGenericDecoy,
}) => {
  const backgroundImage = useHtmlImage(imageUrl);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);

  const scaleByWidth = CANVAS_WIDTH / imageWidth;
  const scaleByHeight = maxHeightPx && maxHeightPx > 0 ? maxHeightPx / imageHeight : Infinity;
  const scale = Math.min(scaleByWidth, scaleByHeight);
  const canvasWidth = imageWidth * scale;
  const canvasHeight = imageHeight * scale;

  useEffect(() => {
    const stage = stageRef.current;
    const tr = transformerRef.current;
    if (!stage || !tr) return;
    let nodeId: string | null = null;
    if (selection?.kind === 'question') nodeId = selection.questionId;
    else if (selection?.kind === 'decoy-of-question') nodeId = decoyOfQuestionNodeId(selection.questionId, selection.decoyIndex);
    else if (selection?.kind === 'generic-decoy') nodeId = genericDecoyNodeId(selection.index);
    const node = nodeId ? stage.findOne('#' + nodeId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selection]);

  function toImageSpace(stageX: number, stageY: number): { x: number; y: number } {
    return { x: Math.round(stageX / scale), y: Math.round(stageY / scale) };
  }

  function toStageSpace(point: PhysastroiqPoint): { x: number; y: number } {
    return { x: point.x * scale, y: point.y * scale };
  }

  function readTransformedSize(node: Konva.Node): Size {
    const width = Math.max(1, Math.round((node.width() * node.scaleX()) / scale));
    const height = Math.max(1, Math.round((node.height() * node.scaleY()) / scale));
    node.scaleX(1);
    node.scaleY(1);
    return { width, height };
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target !== e.target.getStage()) return;
    const stage = stageRef.current;
    const pointerPosition = stage?.getPointerPosition();
    if (!pointerPosition) return;
    const point = { ...toImageSpace(pointerPosition.x, pointerPosition.y), width: PHYSASTROIQ_DEFAULT_POINT_SIZE, height: PHYSASTROIQ_DEFAULT_POINT_SIZE };
    if (addMode === 'question') {
      onAddQuestionPoint(point);
    } else if (addMode === 'decoy-of-selected' && selectedQuestionId) {
      onAddDecoyToSelected(point);
    } else if (addMode === 'generic-decoy') {
      onAddGenericDecoy(point);
    } else {
      onSelectQuestion(null);
    }
  }

  return (
    <Stage ref={stageRef} width={canvasWidth} height={canvasHeight} onClick={handleStageClick}>
      <Layer>
        {backgroundImage ? (
          <KonvaImage image={backgroundImage} x={0} y={0} width={canvasWidth} height={canvasHeight} listening={false} />
        ) : (
          <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#eee" listening={false} />
        )}

        {questions.map((question) => {
          const isSelected = question.id === selectedQuestionId;
          const stagePos = toStageSpace(question);
          const w = question.width * scale;
          const h = question.height * scale;
          return (
            <React.Fragment key={question.id}>
              <Rect
                id={question.id}
                x={stagePos.x}
                y={stagePos.y}
                offsetX={w / 2}
                offsetY={h / 2}
                width={w}
                height={h}
                cornerRadius={4}
                fill={isSelected ? COLOR_CORRECT_SELECTED : COLOR_CORRECT}
                opacity={0.55}
                stroke={isSelected ? '#fff' : undefined}
                strokeWidth={isSelected ? 2 : 0}
                draggable
                dragBoundFunc={(pos) => ({
                  x: Math.max(0, Math.min(canvasWidth, pos.x)),
                  y: Math.max(0, Math.min(canvasHeight, pos.y)),
                })}
                onClick={() => onSelectQuestion(question.id)}
                onTap={() => onSelectQuestion(question.id)}
                onDragEnd={(e) => onMoveQuestionPoint(question.id, toImageSpace(e.target.x(), e.target.y()))}
                onTransformEnd={(e) => onResizeQuestionPoint(question.id, readTransformedSize(e.target))}
              />
              {question.decoyPoints.map((decoy, decoyIndex) => {
                const decoyPos = toStageSpace(decoy);
                const dw = decoy.width * scale;
                const dh = decoy.height * scale;
                return (
                  <Rect
                    key={`${question.id}-decoy-${decoyIndex}`}
                    id={decoyOfQuestionNodeId(question.id, decoyIndex)}
                    x={decoyPos.x}
                    y={decoyPos.y}
                    offsetX={dw / 2}
                    offsetY={dh / 2}
                    width={dw}
                    height={dh}
                    cornerRadius={4}
                    fill={COLOR_DECOY_OF_QUESTION}
                    opacity={0.55}
                    draggable
                    dragBoundFunc={(pos) => ({
                      x: Math.max(0, Math.min(canvasWidth, pos.x)),
                      y: Math.max(0, Math.min(canvasHeight, pos.y)),
                    })}
                    onClick={() => onSelectDecoyOfQuestion(question.id, decoyIndex)}
                    onTap={() => onSelectDecoyOfQuestion(question.id, decoyIndex)}
                    onDragEnd={(e) =>
                      onMoveDecoyOfQuestion(question.id, decoyIndex, { ...toImageSpace(e.target.x(), e.target.y()), width: decoy.width, height: decoy.height })
                    }
                    onTransformEnd={(e) => onResizeDecoyOfQuestion(question.id, decoyIndex, readTransformedSize(e.target))}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        {genericDecoyPoints.map((point, index) => {
          const stagePos = toStageSpace(point);
          const pw = point.width * scale;
          const ph = point.height * scale;
          return (
            <Rect
              key={`generic-${index}`}
              id={genericDecoyNodeId(index)}
              x={stagePos.x}
              y={stagePos.y}
              offsetX={pw / 2}
              offsetY={ph / 2}
              width={pw}
              height={ph}
              cornerRadius={4}
              fill={COLOR_GENERIC_DECOY}
              opacity={0.55}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(0, Math.min(canvasWidth, pos.x)),
                y: Math.max(0, Math.min(canvasHeight, pos.y)),
              })}
              onClick={() => onSelectGenericDecoy(index)}
              onTap={() => onSelectGenericDecoy(index)}
              onDragEnd={(e) => onMoveGenericDecoy(index, { ...toImageSpace(e.target.x(), e.target.y()), width: point.width, height: point.height })}
              onTransformEnd={(e) => onResizeGenericDecoy(index, readTransformedSize(e.target))}
            />
          );
        })}

        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
        />
      </Layer>
    </Stage>
  );
};

export default QuizCanvas;
