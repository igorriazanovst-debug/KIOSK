import React, { useState } from 'react';
import { Stage, Layer, Ellipse, Rect, Circle } from 'react-konva';
import { generateDeformationPuzzle, checkDeformationAnswer, BASE_SIZE } from './deformationLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT } from '../theme';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 220;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;
const MIN_WIDTH = BASE_SIZE * 0.3;
const MAX_WIDTH = BASE_SIZE * 3;

interface Props {
  onClose: () => void;
}

const DeformationTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState(() => generateDeformationPuzzle());
  const [width, setWidth] = useState(BASE_SIZE);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  function newPuzzle() {
    setPuzzle(generateDeformationPuzzle());
    setWidth(BASE_SIZE);
    setIsCorrect(null);
  }

  function handleCheck() {
    setIsCorrect(checkDeformationAnswer(puzzle, width, BASE_SIZE));
  }

  function handleHandleDragMove(e: any) {
    const rawWidth = (e.target.x() - CENTER_X) * 2;
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rawWidth));
    e.target.x(CENTER_X + clamped / 2);
    setWidth(clamped);
    setIsCorrect(null);
  }

  const shapeLabel = puzzle.isEllipse ? 'круг в эллипс' : 'квадрат в прямоугольник';
  // «Круг»/«эллипс»/«квадрат»/«прямоугольник» — все мужского рода ("он
  // стал", не "она стала"). Направление и множитель тоже должны совпадать
  // друг с другом: targetRatio < 1 значит результат ДОЛЖЕН стать УЖЕ своей
  // высоты (во столько раз, во сколько targetRatio меньше единицы), а не
  // "шире" при любом значении, как было раньше.
  const isWider = puzzle.targetRatio > 1;
  const directionHint = isWider ? 'растяни в ширину' : 'сожми по бокам';
  const relativeWord = isWider ? 'шире' : 'уже';
  const displayFactor = isWider ? puzzle.targetRatio : 1 / puzzle.targetRatio;

  return (
    <ToolShell
      icon="↔️"
      title="Деформация"
      onClose={onClose}
      actions={
        <>
          <button onClick={handleCheck} style={toolPrimaryButtonStyle}>Проверить</button>
          <button onClick={newPuzzle} style={toolSecondaryButtonStyle}>Новая фигура</button>
        </>
      }
      banner={
        isCorrect !== null ? (
          <ToolFeedbackBanner
            correct={isCorrect}
            text={isCorrect ? 'Верно! Форма подобрана точно!' : 'Пока не то соотношение — потяни жёлтый кружок ещё.'}
          />
        ) : undefined
      }
    >
      <p style={instructionStyle}>
        Перетащи жёлтый кружок — преврати {shapeLabel} так, чтобы он стал примерно в {displayFactor.toFixed(1)} раза {relativeWord} своей высоты ({directionHint}).
      </p>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {puzzle.isEllipse ? (
            <Ellipse
              x={CENTER_X}
              y={CENTER_Y}
              radiusX={width / 2}
              radiusY={BASE_SIZE / 2}
              fill={isCorrect === true ? COLOR.mint : COLOR.indigoLight}
              stroke={COLOR.indigo}
              strokeWidth={3}
            />
          ) : (
            <Rect
              x={CENTER_X - width / 2}
              y={CENTER_Y - BASE_SIZE / 2}
              width={width}
              height={BASE_SIZE}
              fill={isCorrect === true ? COLOR.mint : COLOR.indigoLight}
              stroke={COLOR.indigo}
              strokeWidth={3}
            />
          )}

          <Circle
            x={CENTER_X + width / 2}
            y={CENTER_Y}
            radius={16}
            fill={COLOR.amber}
            stroke={COLOR.amberDark}
            strokeWidth={3}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: CENTER_Y })}
            onDragMove={handleHandleDragMove}
          />
        </Layer>
      </Stage>
    </ToolShell>
  );
};

const instructionStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontFamily: FONT.ui,
  fontSize: 16,
  fontWeight: 700,
  color: COLOR.indigoDark,
};

export default DeformationTool;
