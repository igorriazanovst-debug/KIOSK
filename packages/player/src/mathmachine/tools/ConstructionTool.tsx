import React, { useState } from 'react';
import { Stage, Layer, Line, Group } from 'react-konva';
import { generateConstructionPuzzle, checkConstructionAnswer, type ConstructionPuzzle, type PieceState } from './constructionLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT } from '../theme';

const CANVAS_WIDTH = 460;
const CANVAS_HEIGHT = 420;
const SILHOUETTE_X = CANVAS_WIDTH / 2;
const SILHOUETTE_Y = 130;

const PALETTE = [COLOR.mint, COLOR.amber, COLOR.indigo, '#e84393'];

interface Props {
  onClose: () => void;
}

const ConstructionTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<ConstructionPuzzle>(() => generateConstructionPuzzle());
  const [states, setStates] = useState<PieceState[]>(() => puzzle.initialStates);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  function newPuzzle() {
    const next = generateConstructionPuzzle();
    setPuzzle(next);
    setStates(next.initialStates);
    setIsCorrect(null);
  }

  function handleCheck() {
    const absoluteStates = states.map((s) => ({ x: s.x + SILHOUETTE_X, y: s.y + SILHOUETTE_Y, rotationDeg: s.rotationDeg }));
    const targetsInStageSpace = puzzle.pieces.map((p) => ({ ...p, targetX: p.targetX + SILHOUETTE_X, targetY: p.targetY + SILHOUETTE_Y }));
    setIsCorrect(checkConstructionAnswer({ ...puzzle, pieces: targetsInStageSpace }, absoluteStates));
  }

  function handleDragEnd(index: number) {
    return (e: any) => {
      const node = e.target;
      setStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], x: node.x() - SILHOUETTE_X, y: node.y() - SILHOUETTE_Y };
        return next;
      });
      setIsCorrect(null);
    };
  }

  function handleRotateClick(index: number) {
    return () => {
      setStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], rotationDeg: (next[index].rotationDeg + 90) % 360 };
        return next;
      });
      setIsCorrect(null);
    };
  }

  return (
    <ToolShell
      icon="🧩"
      title="Конструирование"
      onClose={onClose}
      actions={
        <>
          <button onClick={handleCheck} style={toolPrimaryButtonStyle}>Проверить</button>
          <button onClick={newPuzzle} style={toolSecondaryButtonStyle}>Новый узор</button>
        </>
      }
      banner={
        isCorrect !== null ? (
          <ToolFeedbackBanner
            correct={isCorrect}
            text={isCorrect ? 'Верно! Квадрат собран из всех кусочков!' : 'Пока не совпадает — подвинь и поверни кусочки точнее (клик по кусочку — поворот).'}
          />
        ) : undefined
      }
    >
      <p style={instructionStyle}>
        Перетащи 4 треугольника в пунктирный квадрат и собери его целиком. Клик по треугольнику поворачивает его на 90°.
      </p>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          <Line
            points={[
              SILHOUETTE_X - puzzle.halfSide, SILHOUETTE_Y - puzzle.halfSide,
              SILHOUETTE_X + puzzle.halfSide, SILHOUETTE_Y - puzzle.halfSide,
              SILHOUETTE_X + puzzle.halfSide, SILHOUETTE_Y + puzzle.halfSide,
              SILHOUETTE_X - puzzle.halfSide, SILHOUETTE_Y + puzzle.halfSide,
            ]}
            closed
            stroke={isCorrect === true ? COLOR.mint : COLOR.textMuted}
            strokeWidth={5}
            dash={isCorrect === true ? undefined : [10, 7]}
          />

          {puzzle.pieces.map((piece, i) => {
            const state = states[i];
            return (
              <Group
                key={piece.id}
                x={state.x + SILHOUETTE_X}
                y={state.y + SILHOUETTE_Y}
                rotation={state.rotationDeg}
                draggable
                onDragEnd={handleDragEnd(i)}
                onClick={handleRotateClick(i)}
              >
                <Line points={piece.localPoints} closed fill={PALETTE[piece.colorId]} stroke={COLOR.text} strokeWidth={1.5} />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </ToolShell>
  );
};

const instructionStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontFamily: FONT.ui,
  fontSize: 15,
  fontWeight: 700,
  color: COLOR.indigoDark,
};

export default ConstructionTool;
