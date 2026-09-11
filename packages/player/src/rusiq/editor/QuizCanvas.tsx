// packages/player/src/rusiq/editor/QuizCanvas.tsx
// Прямой порт Konva-паттерна packages/player/src/natcom/editor/Workspace.tsx
// (Тип5, Фаза 5), упрощённый: объекты РусIQ - точки фиксированного
// размера (как в GameBoardScreen.tsx), только перемещаемые, без
// вращения/масштабирования/отражения - в игре точки всегда одного
// размера и формы, незачем и в редакторе (спека Фазы 2a, разд. 4).
//
// В отличие от GameBoardScreen.tsx точки РАЗЛИЧАЮТСЯ цветом по типу -
// это ИНСТРУМЕНТ АВТОРА, не игровой экран: находка 6 финального ревью
// Фазы 1 (нельзя различать точки в игре) сюда не относится - учителю
// НУЖНО видеть, что он редактирует.

import React, { useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Rect } from 'react-konva';
import type Konva from 'konva';
import { useHtmlImage } from './useHtmlImage.ts';
import type { RusiqPoint, RusiqQuestion } from '../model/schema.ts';

export type QuizCanvasAddMode = 'none' | 'question' | 'decoy-of-selected' | 'generic-decoy';

const CANVAS_WIDTH = 900;
const POINT_RADIUS = 10;
const COLOR_CORRECT = '#2e7d32';
const COLOR_CORRECT_SELECTED = '#1b5e20';
const COLOR_DECOY_OF_QUESTION = '#e65100';
const COLOR_GENERIC_DECOY = '#616161';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  questions: RusiqQuestion[];
  genericDecoyPoints: RusiqPoint[];
  selectedQuestionId: string | null;
  addMode: QuizCanvasAddMode;
  onSelectQuestion: (id: string | null) => void;
  onAddQuestionPoint: (point: RusiqPoint) => void;
  onAddDecoyToSelected: (point: RusiqPoint) => void;
  onAddGenericDecoy: (point: RusiqPoint) => void;
  onMoveQuestionPoint: (id: string, point: RusiqPoint) => void;
  onMoveDecoyOfQuestion: (questionId: string, decoyIndex: number, point: RusiqPoint) => void;
  onMoveGenericDecoy: (index: number, point: RusiqPoint) => void;
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
  addMode,
  onSelectQuestion,
  onAddQuestionPoint,
  onAddDecoyToSelected,
  onAddGenericDecoy,
  onMoveQuestionPoint,
  onMoveDecoyOfQuestion,
  onMoveGenericDecoy,
  onSelectDecoyOfQuestion,
  onSelectGenericDecoy,
}) => {
  const backgroundImage = useHtmlImage(imageUrl);
  const stageRef = useRef<Konva.Stage | null>(null);

  const scale = CANVAS_WIDTH / imageWidth;
  const canvasHeight = imageHeight * scale;

  function toImageSpace(stageX: number, stageY: number): RusiqPoint {
    return { x: Math.round(stageX / scale), y: Math.round(stageY / scale) };
  }

  function toStageSpace(point: RusiqPoint): { x: number; y: number } {
    return { x: point.x * scale, y: point.y * scale };
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target !== e.target.getStage()) return; // клик по точке обрабатывается её собственным onClick
    const stage = stageRef.current;
    const pointerPosition = stage?.getPointerPosition();
    if (!pointerPosition) return;
    const point = toImageSpace(pointerPosition.x, pointerPosition.y);
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
          return (
            <React.Fragment key={question.id}>
              <Circle
                x={stagePos.x}
                y={stagePos.y}
                radius={POINT_RADIUS}
                fill={isSelected ? COLOR_CORRECT_SELECTED : COLOR_CORRECT}
                stroke={isSelected ? '#fff' : undefined}
                strokeWidth={isSelected ? 2 : 0}
                draggable
                onClick={() => onSelectQuestion(question.id)}
                onTap={() => onSelectQuestion(question.id)}
                onDragEnd={(e) => onMoveQuestionPoint(question.id, toImageSpace(e.target.x(), e.target.y()))}
              />
              {question.decoyPoints.map((decoy, decoyIndex) => {
                const decoyPos = toStageSpace(decoy);
                return (
                  <Circle
                    key={`${question.id}-decoy-${decoyIndex}`}
                    x={decoyPos.x}
                    y={decoyPos.y}
                    radius={POINT_RADIUS}
                    fill={COLOR_DECOY_OF_QUESTION}
                    draggable
                    onClick={() => onSelectDecoyOfQuestion(question.id, decoyIndex)}
                    onTap={() => onSelectDecoyOfQuestion(question.id, decoyIndex)}
                    onDragEnd={(e) => onMoveDecoyOfQuestion(question.id, decoyIndex, toImageSpace(e.target.x(), e.target.y()))}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        {genericDecoyPoints.map((point, index) => {
          const stagePos = toStageSpace(point);
          return (
            <Circle
              key={`generic-${index}`}
              x={stagePos.x}
              y={stagePos.y}
              radius={POINT_RADIUS}
              fill={COLOR_GENERIC_DECOY}
              draggable
              onClick={() => onSelectGenericDecoy(index)}
              onTap={() => onSelectGenericDecoy(index)}
              onDragEnd={(e) => onMoveGenericDecoy(index, toImageSpace(e.target.x(), e.target.y()))}
            />
          );
        })}
      </Layer>
    </Stage>
  );
};

export default QuizCanvas;
