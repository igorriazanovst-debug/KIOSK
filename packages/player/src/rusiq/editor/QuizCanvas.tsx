// packages/player/src/rusiq/editor/QuizCanvas.tsx
// Прямой порт Konva-паттерна packages/player/src/natcom/editor/Workspace.tsx
// (Тип5, Фаза 5). Объекты РусIQ — прямоугольные области, перемещаемые И
// изменяемые по размеру через Konva Transformer (стандартный виджет
// resize-хендлов), а не точки фиксированного радиуса — по прямому указанию
// пользователя (2026-09-12): "один ответ - одна иконка (или область,
// связанная с этим ответом)", а не абстрактный круг любого радиуса.
//
// В отличие от GameBoardScreen.tsx точки РАЗЛИЧАЮТСЯ цветом по типу -
// это ИНСТРУМЕНТ АВТОРА, не игровой экран: находка 6 финального ревью
// Фазы 1 (нельзя различать точки в игре) сюда не относится - учителю
// НУЖНО видеть, что он редактирует.

import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useHtmlImage } from './useHtmlImage.ts';
import { RUSIQ_DEFAULT_POINT_SIZE, type RusiqPoint, type RusiqQuestion } from '../model/schema.ts';

export type QuizCanvasAddMode = 'none' | 'question' | 'decoy-of-selected' | 'generic-decoy';

const CANVAS_WIDTH = 900;
const COLOR_CORRECT = '#2e7d32';
const COLOR_CORRECT_SELECTED = '#1b5e20';
const COLOR_DECOY_OF_QUESTION = '#e65100';
const COLOR_GENERIC_DECOY = '#616161';

// Konva-id каждой фигуры — по нему Transformer находит текущую выбранную
// фигуру заново при каждой смене selection (см. useEffect ниже), вместо
// того чтобы держать ref на каждую из потенциально сотен фигур разом.
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
  questions: RusiqQuestion[];
  genericDecoyPoints: RusiqPoint[];
  selectedQuestionId: string | null;
  selection: { kind: 'question'; questionId: string } | { kind: 'decoy-of-question'; questionId: string; decoyIndex: number } | { kind: 'generic-decoy'; index: number } | null;
  addMode: QuizCanvasAddMode;
  onSelectQuestion: (id: string | null) => void;
  onAddQuestionPoint: (point: RusiqPoint) => void;
  onAddDecoyToSelected: (point: RusiqPoint) => void;
  onAddGenericDecoy: (point: RusiqPoint) => void;
  onMoveQuestionPoint: (id: string, point: { x: number; y: number }) => void;
  onMoveDecoyOfQuestion: (questionId: string, decoyIndex: number, point: RusiqPoint) => void;
  onMoveGenericDecoy: (index: number, point: RusiqPoint) => void;
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

  const scale = CANVAS_WIDTH / imageWidth;
  const canvasHeight = imageHeight * scale;

  // Transformer в Konva не следует за React-selection автоматически - после
  // каждой смены selection нужно явно найти актуальный узел по его Konva-id
  // и передать Transformer'у (иначе хендлы либо не появляются на только что
  // выбранной фигуре, либо остаются на старой).
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

  function toStageSpace(point: RusiqPoint): { x: number; y: number } {
    return { x: point.x * scale, y: point.y * scale };
  }

  // Konva Transformer масштабирует узел через scaleX/scaleY, а не меняет
  // width/height напрямую - после трансформации нужно "впечатать" масштаб в
  // реальные width/height и сбросить scale обратно в 1, иначе следующее
  // перетаскивание/трансформация будет применяться поверх уже искажённого
  // масштаба (стандартная Konva-ловушка resize через Transformer).
  function readTransformedSize(node: Konva.Node): Size {
    const width = Math.max(1, Math.round((node.width() * node.scaleX()) / scale));
    const height = Math.max(1, Math.round((node.height() * node.scaleY()) / scale));
    node.scaleX(1);
    node.scaleY(1);
    return { width, height };
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target !== e.target.getStage()) return; // клик по фигуре обрабатывается её собственным onClick
    const stage = stageRef.current;
    const pointerPosition = stage?.getPointerPosition();
    if (!pointerPosition) return;
    const point = { ...toImageSpace(pointerPosition.x, pointerPosition.y), width: RUSIQ_DEFAULT_POINT_SIZE, height: RUSIQ_DEFAULT_POINT_SIZE };
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
    <Stage ref={stageRef} width={CANVAS_WIDTH} height={canvasHeight} onClick={handleStageClick}>
      <Layer>
        {backgroundImage ? (
          <KonvaImage image={backgroundImage} x={0} y={0} width={CANVAS_WIDTH} height={canvasHeight} listening={false} />
        ) : (
          // Заглушка, пока фон не загружен (или не загрузился вовсе) - только
          // визуальная, listening={false}: клик по пустому канвасу должен
          // попадать на сам Stage (e.target === e.target.getStage()), а не
          // на эту заглушку, иначе весь workflow добавления точки замирает
          // до окончания загрузки картинки (найдено ревью Задачи 9).
          <Rect x={0} y={0} width={CANVAS_WIDTH} height={canvasHeight} fill="#eee" listening={false} />
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
                  x: Math.max(0, Math.min(CANVAS_WIDTH, pos.x)),
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
                      x: Math.max(0, Math.min(CANVAS_WIDTH, pos.x)),
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
                x: Math.max(0, Math.min(CANVAS_WIDTH, pos.x)),
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
