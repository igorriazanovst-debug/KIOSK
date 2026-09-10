import React, { useRef, useState } from 'react';
import { Stage, Layer, Circle, Group, Line } from 'react-konva';
import { generateSymmetryPuzzle, checkSymmetryAnswer, type SymmetryPuzzle } from './symmetryLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT } from '../theme';

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 300;
const AXIS_X = CANVAS_WIDTH / 2;
const FEATURE_OFFSET = 80;
const CONTENT_TOP = 30;
const CONTENT_HEIGHT = 180;
const TRAY_Y = 250;
const DROP_RADIUS = 34;

const PALETTE = [COLOR.mint, COLOR.amber, COLOR.indigo, '#e84393'];

interface Props {
  onClose: () => void;
}

function featureY(relY: number): number {
  return CONTENT_TOP + relY * CONTENT_HEIGHT;
}

function trayX(index: number, count: number): number {
  const gap = CANVAS_WIDTH / (count + 1);
  return gap * (index + 1);
}

const SymmetryTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<SymmetryPuzzle>(() => generateSymmetryPuzzle());
  const [slotAssignment, setSlotAssignment] = useState<(number | null)[]>(() => Array(3).fill(null));
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const trayHomeRef = useRef<Record<number, { x: number; y: number }>>({});

  function newPuzzle() {
    const next = generateSymmetryPuzzle();
    setPuzzle(next);
    setSlotAssignment(Array(next.features.length).fill(null));
    setIsCorrect(null);
  }

  function handleCheck() {
    setIsCorrect(checkSymmetryAnswer(puzzle, slotAssignment));
  }

  function handleTrayDragEnd(trayIndex: number) {
    return (e: any) => {
      const node = e.target;
      const x = node.x();
      const y = node.y();
      let droppedSlot: number | null = null;
      for (let slot = 0; slot < puzzle.features.length; slot++) {
        const dx = x - (AXIS_X + FEATURE_OFFSET);
        const dy = y - featureY(puzzle.features[slot].y);
        if (Math.sqrt(dx * dx + dy * dy) <= DROP_RADIUS) {
          droppedSlot = slot;
          break;
        }
      }
      const home = trayHomeRef.current[trayIndex];
      if (home) node.position(home);
      if (droppedSlot !== null) {
        setSlotAssignment((prev) => {
          const next = prev.map((v) => (v === trayIndex ? null : v));
          next[droppedSlot as number] = trayIndex;
          return next;
        });
        setIsCorrect(null);
      }
    };
  }

  return (
    <ToolShell
      icon="🦋"
      title="Симметрия"
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
            text={isCorrect ? 'Верно! Узор стал симметричным!' : 'Пока не совпадает — попробуй другие детали из ряда снизу.'}
          />
        ) : undefined
      }
    >
      <p style={instructionStyle}>Дорисуй правую половину узора — перетащи подходящие детали из ряда снизу.</p>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          <Line points={[AXIS_X, CONTENT_TOP - 10, AXIS_X, CONTENT_TOP + CONTENT_HEIGHT + 10]} stroke={COLOR.textMuted} strokeWidth={4} dash={[9, 7]} />

          {puzzle.features.map((feature, i) => (
            <Circle
              key={`left-${i}`}
              x={AXIS_X - FEATURE_OFFSET}
              y={featureY(feature.y)}
              radius={feature.radius}
              fill={PALETTE[feature.colorId]}
              stroke={COLOR.text}
              strokeWidth={1.5}
            />
          ))}

          {puzzle.features.map((feature, i) => (
            <Circle
              key={`slot-${i}`}
              x={AXIS_X + FEATURE_OFFSET}
              y={featureY(feature.y)}
              radius={feature.radius + 6}
              fill="transparent"
              stroke={isCorrect === true ? COLOR.mint : isCorrect === false ? COLOR.amberDark : COLOR.textMuted}
              strokeWidth={4}
              dash={slotAssignment[i] === null ? [7, 5] : undefined}
            />
          ))}

          {puzzle.trayItems.map((item, trayIndex) => {
            const placedInSlot = slotAssignment.indexOf(trayIndex);
            const home = { x: trayX(trayIndex, puzzle.trayItems.length), y: TRAY_Y };
            trayHomeRef.current[trayIndex] = home;
            const pos = placedInSlot >= 0 ? { x: AXIS_X + FEATURE_OFFSET, y: featureY(puzzle.features[placedInSlot].y) } : home;
            return (
              <Group key={trayIndex} x={pos.x} y={pos.y} draggable onDragEnd={handleTrayDragEnd(trayIndex)}>
                <Circle radius={item.radius} fill={PALETTE[item.colorId]} stroke={COLOR.text} strokeWidth={1.5} />
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
  fontSize: 16,
  fontWeight: 700,
  color: COLOR.indigoDark,
};

export default SymmetryTool;
