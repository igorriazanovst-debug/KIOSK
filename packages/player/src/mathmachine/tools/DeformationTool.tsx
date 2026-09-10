import React, { useState } from 'react';
import { Stage, Layer, Ellipse, Rect, Circle, Line, Text } from 'react-konva';
import { generateDeformationPuzzle, checkDeformationAnswer, BASE_SIZE } from './deformationLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT } from '../theme';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 260;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = 110;
const MIN_WIDTH = BASE_SIZE * 0.3;
const MAX_WIDTH = BASE_SIZE * 3;
// Линейка снизу — найдено живой проверкой пользователя (2026-09-10): без
// неё непонятно, на сколько именно фигура уже изменилась, и задание
// нерешаемо. Шкала в единицах отношения ширина/высота (не в пикселях) —
// цена деления построена так, что смещение ручки на HALF_RULER_STEP_PX
// соответствует ровно 0.5 к соотношению (см. RULER_Y ниже).
const RULER_Y = 210;
const RULER_TICK_STEP_PX = 25; // каждые 25px — шаг 0.5 к отношению
const RULER_MAX_OFFSET_PX = MAX_WIDTH / 2;

function offsetToRatio(offsetPx: number): number {
  return offsetPx / (BASE_SIZE / 2);
}

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

  const currentRatio = width / BASE_SIZE;
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

          <Text
            x={CENTER_X - 100}
            y={CENTER_Y - BASE_SIZE / 2 - 30}
            width={200}
            align="center"
            text={`Сейчас: ${currentRatio.toFixed(2)}`}
            fontSize={16}
            fontStyle="800"
            fill={COLOR.indigoDark}
          />

          <Line
            points={[CENTER_X - RULER_MAX_OFFSET_PX, RULER_Y, CENTER_X + RULER_MAX_OFFSET_PX, RULER_Y]}
            stroke={COLOR.border}
            strokeWidth={2}
          />
          {Array.from({ length: Math.floor(RULER_MAX_OFFSET_PX / RULER_TICK_STEP_PX) * 2 + 1 }).map((_, i) => {
            const offset = -RULER_MAX_OFFSET_PX + i * RULER_TICK_STEP_PX;
            const ratio = offsetToRatio(Math.abs(offset));
            const isWholeUnit = Math.abs(ratio - Math.round(ratio)) < 0.01;
            return (
              <React.Fragment key={i}>
                <Line
                  points={[CENTER_X + offset, RULER_Y - (isWholeUnit ? 8 : 4), CENTER_X + offset, RULER_Y + (isWholeUnit ? 8 : 4)]}
                  stroke={COLOR.textMuted}
                  strokeWidth={isWholeUnit ? 2 : 1}
                />
                {isWholeUnit && (
                  <Text
                    x={CENTER_X + offset - 12}
                    y={RULER_Y + 12}
                    width={24}
                    align="center"
                    text={ratio.toFixed(0)}
                    fontSize={11}
                    fill={COLOR.textMuted}
                  />
                )}
              </React.Fragment>
            );
          })}
          <Line
            points={[CENTER_X + width / 2, RULER_Y - 14, CENTER_X + width / 2 - 6, RULER_Y - 24, CENTER_X + width / 2 + 6, RULER_Y - 24]}
            closed
            fill={COLOR.amberDark}
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
