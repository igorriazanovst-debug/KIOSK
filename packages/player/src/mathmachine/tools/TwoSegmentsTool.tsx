import React, { useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text } from 'react-konva';
import {
  generateTwoSegmentsPuzzle,
  checkSegmentAnswer,
  RULER_MIN_CM,
  RULER_MAX_CM,
  type TwoSegmentsPuzzle,
} from './twoSegmentsLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT } from '../theme';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 260;
const RULER_X0 = 20;
const PX_PER_CM = (CANVAS_WIDTH - 40) / RULER_MAX_CM;
const REFERENCE_Y = 60;
const DRAGGED_Y = 160;
const BAR_HEIGHT = 20;

interface Props {
  onClose: () => void;
}

function cmToPx(cm: number): number {
  return RULER_X0 + cm * PX_PER_CM;
}

function directionLabel(direction: TwoSegmentsPuzzle['direction']): string {
  return direction === 'longer' ? 'длиннее' : 'короче';
}

const TwoSegmentsTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<TwoSegmentsPuzzle>(() => generateTwoSegmentsPuzzle());
  const [draggedLength, setDraggedLength] = useState(puzzle.referenceLength);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  function newPuzzle() {
    const next = generateTwoSegmentsPuzzle();
    setPuzzle(next);
    setDraggedLength(next.referenceLength);
    setIsCorrect(null);
  }

  function handleCheck() {
    setIsCorrect(checkSegmentAnswer(puzzle, draggedLength));
  }

  function handleHandleDragMove(e: any) {
    const rawCm = (e.target.x() - RULER_X0) / PX_PER_CM;
    const snappedCm = Math.max(RULER_MIN_CM, Math.min(RULER_MAX_CM, Math.round(rawCm)));
    e.target.x(cmToPx(snappedCm));
    setDraggedLength(snappedCm);
    setIsCorrect(null);
  }

  const ticks = Array.from({ length: RULER_MAX_CM + 1 }, (_, cm) => cm);

  return (
    <ToolShell
      icon="📏"
      title="Два отрезка"
      onClose={onClose}
      actions={
        <>
          <button onClick={handleCheck} style={toolPrimaryButtonStyle}>Проверить</button>
          <button onClick={newPuzzle} style={toolSecondaryButtonStyle}>Новое задание</button>
        </>
      }
      banner={
        isCorrect !== null ? (
          <ToolFeedbackBanner
            correct={isCorrect}
            text={isCorrect ? 'Верно! Отрезки подобраны точно!' : 'Пока не совпадает — подвинь розовый кружок ещё раз.'}
          />
        ) : undefined
      }
    >
      <p style={instructionStyle}>
        Розовый отрезок на {puzzle.delta} см {directionLabel(puzzle.direction)} зелёного.
      </p>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {ticks.map((cm) => (
            <Line
              key={cm}
              points={[cmToPx(cm), REFERENCE_Y - 10, cmToPx(cm), DRAGGED_Y + BAR_HEIGHT + 10]}
              stroke={COLOR.textMuted}
              strokeWidth={2}
            />
          ))}

          <Rect x={RULER_X0} y={REFERENCE_Y} width={puzzle.referenceLength * PX_PER_CM} height={BAR_HEIGHT} fill="#2ecc71" />
          <Text x={RULER_X0} y={REFERENCE_Y - 22} text={`Зелёный: ${puzzle.referenceLength} см`} fontSize={16} fill={COLOR.text} />

          <Rect x={RULER_X0} y={DRAGGED_Y} width={draggedLength * PX_PER_CM} height={BAR_HEIGHT} fill="#e84393" />
          <Text x={RULER_X0} y={DRAGGED_Y - 22} text={`Розовый: ${draggedLength} см`} fontSize={16} fill={COLOR.text} />

          <Circle
            x={cmToPx(draggedLength)}
            y={DRAGGED_Y + BAR_HEIGHT / 2}
            radius={16}
            fill={isCorrect === true ? COLOR.mint : isCorrect === false ? COLOR.amberDark : '#e84393'}
            stroke={isCorrect === null ? undefined : '#fff'}
            strokeWidth={isCorrect === null ? 0 : 2}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: DRAGGED_Y + BAR_HEIGHT / 2 })}
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

export default TwoSegmentsTool;
