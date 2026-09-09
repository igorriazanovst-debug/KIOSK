import React, { useState } from 'react';
import { Stage, Layer, Rect, Circle, Star, Line } from 'react-konva';
import {
  generateMovementPuzzle, applyMove, checkMovementAnswer,
  type MovementPuzzle, type GridPos, type MoveDirection,
} from './movementLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT, RADIUS } from '../theme';

const CELL = 56;
const GRID_ORIGIN_X = 20;
const GRID_ORIGIN_Y = 20;

interface Props {
  onClose: () => void;
}

function cellCenter(pos: GridPos): { x: number; y: number } {
  return { x: GRID_ORIGIN_X + pos.col * CELL + CELL / 2, y: GRID_ORIGIN_Y + pos.row * CELL + CELL / 2 };
}

const MovementTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<MovementPuzzle>(() => generateMovementPuzzle());
  const [pos, setPos] = useState<GridPos>(() => puzzle.start);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  function newPuzzle() {
    const next = generateMovementPuzzle();
    setPuzzle(next);
    setPos(next.start);
    setIsCorrect(null);
  }

  function move(direction: MoveDirection) {
    setPos((prev) => applyMove(puzzle, prev, direction));
    setIsCorrect(null);
  }

  function handleCheck() {
    setIsCorrect(checkMovementAnswer(puzzle, pos));
  }

  const gridPixels = puzzle.size * CELL;
  const objectCenter = cellCenter(pos);
  const targetCenter = cellCenter(puzzle.target);

  return (
    <ToolShell
      icon="🧭"
      title="Движение"
      onClose={onClose}
      sidebar={
        <div style={arrowsGridStyle}>
          <span />
          <button onClick={() => move('up')} style={arrowButtonStyle}>▲</button>
          <span />
          <button onClick={() => move('left')} style={arrowButtonStyle}>◀</button>
          <span />
          <button onClick={() => move('right')} style={arrowButtonStyle}>▶</button>
          <span />
          <button onClick={() => move('down')} style={arrowButtonStyle}>▼</button>
          <span />
        </div>
      }
      actions={
        <>
          <button onClick={handleCheck} style={toolPrimaryButtonStyle}>Проверить</button>
          <button onClick={newPuzzle} style={toolSecondaryButtonStyle}>Новый маршрут</button>
        </>
      }
      banner={
        isCorrect !== null ? (
          <ToolFeedbackBanner
            correct={isCorrect}
            text={isCorrect ? 'Верно! Ты довёл фигурку до цели!' : 'Пока не дошёл до звёздочки — используй стрелки.'}
          />
        ) : undefined
      }
    >
      <p style={instructionStyle}>Стрелками проведи кружок до звёздочки, обходя препятствие.</p>

      <Stage width={gridPixels + 40} height={gridPixels + 40}>
        <Layer>
          {Array.from({ length: puzzle.size + 1 }).map((_, i) => (
            <React.Fragment key={i}>
              <Line
                points={[GRID_ORIGIN_X, GRID_ORIGIN_Y + i * CELL, GRID_ORIGIN_X + gridPixels, GRID_ORIGIN_Y + i * CELL]}
                stroke={COLOR.border}
                strokeWidth={2}
              />
              <Line
                points={[GRID_ORIGIN_X + i * CELL, GRID_ORIGIN_Y, GRID_ORIGIN_X + i * CELL, GRID_ORIGIN_Y + gridPixels]}
                stroke={COLOR.border}
                strokeWidth={2}
              />
            </React.Fragment>
          ))}

          {puzzle.obstacle && (
            <Rect
              x={GRID_ORIGIN_X + puzzle.obstacle.col * CELL + 4}
              y={GRID_ORIGIN_Y + puzzle.obstacle.row * CELL + 4}
              width={CELL - 8}
              height={CELL - 8}
              fill={COLOR.textMuted}
              cornerRadius={6}
            />
          )}

          <Star
            x={targetCenter.x}
            y={targetCenter.y}
            numPoints={5}
            innerRadius={10}
            outerRadius={20}
            fill={COLOR.amber}
            stroke={COLOR.amberDark}
            strokeWidth={2}
          />

          <Circle
            x={objectCenter.x}
            y={objectCenter.y}
            radius={18}
            fill={isCorrect === true ? COLOR.mint : COLOR.indigo}
            stroke={COLOR.indigoDark}
            strokeWidth={2.5}
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

const arrowsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 28px)',
  gridTemplateRows: 'repeat(3, 28px)',
  gap: 4,
};

const arrowButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: RADIUS.sm,
  border: `2px solid ${COLOR.indigo}`,
  background: COLOR.indigoLight,
  color: COLOR.indigoDark,
  fontSize: 14,
  cursor: 'pointer',
  padding: 0,
};

export default MovementTool;
