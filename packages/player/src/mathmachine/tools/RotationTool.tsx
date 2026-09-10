import React, { useState } from 'react';
import { Stage, Layer, Circle, Group, Line, RegularPolygon, Arrow, Text } from 'react-konva';
import {
  generateRotationPuzzle, accumulateRotation, checkFullTurn,
} from './rotationLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT } from '../theme';

const CANVAS_SIZE = 320;
const CENTER = CANVAS_SIZE / 2;
const HANDLE_RADIUS = 110;
const HANDLE_SIZE = 16;

interface Props {
  onClose: () => void;
}

function handlePos(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + Math.cos(rad) * HANDLE_RADIUS, y: CENTER + Math.sin(rad) * HANDLE_RADIUS };
}

// Три варианта заведомо НЕСИММЕТРИЧНОЙ фигуры — при повороте на 90/180/270°
// она обязана выглядеть иначе, чем в исходном положении, иначе "полный
// оборот" неотличим на глаз от четверти оборота (см. спека, разд. 3.5).
const SHAPE_RENDER: React.FC<{ shapeId: number }>[] = [
  () => (
    <Arrow points={[0, 0, 60, 0]} pointerLength={18} pointerWidth={16} fill={COLOR.amber} stroke={COLOR.amberDark} strokeWidth={3} />
  ),
  () => (
    <Group>
      <Line points={[0, 0, 0, -70]} stroke={COLOR.indigoDark} strokeWidth={5} />
      <RegularPolygon x={22} y={-60} sides={3} radius={20} rotation={90} fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={2} />
    </Group>
  ),
  () => (
    <Group>
      <Line points={[-40, 20, 40, 20, 40, -40]} stroke={COLOR.amberDark} strokeWidth={8} lineCap="round" lineJoin="round" />
      <Circle x={-40} y={20} radius={8} fill={COLOR.indigo} />
    </Group>
  ),
];

const RotationTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState(() => generateRotationPuzzle());
  const [currentAngle, setCurrentAngle] = useState(0);
  const [accumulated, setAccumulated] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  function newPuzzle() {
    setPuzzle(generateRotationPuzzle());
    setCurrentAngle(0);
    setAccumulated(0);
    setIsCorrect(null);
  }

  function handleDragMove(e: any) {
    const node = e.target;
    const dx = node.x() - CENTER;
    const dy = node.y() - CENTER;
    const rawDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const newAngle = ((rawDeg % 360) + 360) % 360;
    setAccumulated((prev) => accumulateRotation(prev, currentAngle, newAngle));
    setCurrentAngle(newAngle);
    setIsCorrect(null);
  }

  function handleCheck() {
    setIsCorrect(checkFullTurn(accumulated));
  }

  const handle = handlePos(currentAngle);
  const ShapeRender = SHAPE_RENDER[puzzle.shapeId];

  return (
    <ToolShell
      icon="🔄"
      title="Вращение"
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
            text={isCorrect ? 'Верно! Это целый, полный оборот!' : 'Пока не полный оборот — прокрути янтарный кружок дальше по кругу.'}
          />
        ) : undefined
      }
    >
      <p style={instructionStyle}>Потяни оранжевый кружок по кругу — сделай ровно один ПОЛНЫЙ оборот.</p>

      <Stage width={CANVAS_SIZE} height={CANVAS_SIZE}>
        <Layer>
          <Text
            x={0}
            y={4}
            width={CANVAS_SIZE}
            align="center"
            text={`Пройдено: ${Math.round(Math.abs(accumulated))}° из 360°`}
            fontSize={16}
            fontStyle="800"
            fill={COLOR.indigoDark}
          />

          <Circle x={CENTER} y={CENTER} radius={HANDLE_RADIUS} stroke={COLOR.textMuted} strokeWidth={4} dash={[9, 7]} />

          <Group x={CENTER} y={CENTER} rotation={currentAngle}>
            <ShapeRender shapeId={puzzle.shapeId} />
          </Group>

          <Circle
            x={handle.x}
            y={handle.y}
            radius={HANDLE_SIZE}
            fill={COLOR.amber}
            stroke={COLOR.amberDark}
            strokeWidth={3}
            draggable
            dragBoundFunc={(pos) => {
              const dx = pos.x - CENTER;
              const dy = pos.y - CENTER;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              return { x: CENTER + (dx / dist) * HANDLE_RADIUS, y: CENTER + (dy / dist) * HANDLE_RADIUS };
            }}
            onDragMove={handleDragMove}
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

export default RotationTool;
