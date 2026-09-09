import React, { useRef, useState } from 'react';
import { Stage, Layer, Circle, Group, Text } from 'react-konva';
import { generateSeriationPuzzle, checkSeriationAnswer, type SeriationPuzzle } from './seriationLogic.ts';
import ToolShell, { toolPrimaryButtonStyle, toolSecondaryButtonStyle } from './ToolShell';
import ToolFeedbackBanner from './ToolFeedbackBanner';
import { COLOR, FONT } from '../theme';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 280;
const TRAY_Y = 70;
const SLOT_Y = 200;
const DROP_RADIUS = 40;

interface Props {
  onClose: () => void;
}

function slotX(index: number, count: number): number {
  const gap = CANVAS_WIDTH / (count + 1);
  return gap * (index + 1);
}

function trayX(index: number, count: number): number {
  const gap = CANVAS_WIDTH / (count + 1);
  return gap * (index + 1);
}

function directionLabel(direction: SeriationPuzzle['direction']): string {
  return direction === 'ascending'
    ? 'от самой маленькой фигуры к самой большой'
    : 'от самой большой фигуры к самой маленькой';
}

const SeriationTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<SeriationPuzzle>(() => generateSeriationPuzzle());
  // slotOrder[i] = индекс элемента puzzle.sizes, помещённого в i-й слот
  const [slotOrder, setSlotOrder] = useState<(number | null)[]>(() => Array(puzzle.sizes.length).fill(null));
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const trayHomeRef = useRef<Record<number, { x: number; y: number }>>({});

  function newPuzzle() {
    const next = generateSeriationPuzzle();
    setPuzzle(next);
    setSlotOrder(Array(next.sizes.length).fill(null));
    setIsCorrect(null);
  }

  function handleCheck() {
    setIsCorrect(checkSeriationAnswer(puzzle, slotOrder));
  }

  function handleTrayDragEnd(trayIndex: number) {
    return (e: any) => {
      const node = e.target;
      const x = node.x();
      const y = node.y();
      let droppedSlot: number | null = null;
      for (let slot = 0; slot < puzzle.sizes.length; slot++) {
        const dx = x - slotX(slot, puzzle.sizes.length);
        const dy = y - SLOT_Y;
        if (Math.sqrt(dx * dx + dy * dy) <= DROP_RADIUS) {
          droppedSlot = slot;
          break;
        }
      }
      const home = trayHomeRef.current[trayIndex];
      if (home) node.position(home);
      if (droppedSlot !== null) {
        setSlotOrder((prev) => {
          // Убираем этот элемент лотка из любого другого слота, где он уже
          // мог быть размещён, и из целевого слота вытесняем прежний
          // элемент обратно в лоток (простая замена, без второго drag).
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
      icon="📶"
      title="Серпация"
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
            text={isCorrect ? 'Верно! Порядок построен правильно!' : 'Пока не по порядку — попробуй переставить фигуры.'}
          />
        ) : undefined
      }
    >
      <p style={instructionStyle}>Разложи фигуры по порядку — {directionLabel(puzzle.direction)}.</p>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          {Array.from({ length: puzzle.sizes.length }).map((_, slot) => {
            const filled = slotOrder[slot] !== null;
            return (
              <React.Fragment key={slot}>
                <Circle
                  x={slotX(slot, puzzle.sizes.length)}
                  y={SLOT_Y}
                  radius={38}
                  fill="transparent"
                  stroke={isCorrect === true ? COLOR.mint : isCorrect === false ? COLOR.amberDark : COLOR.border}
                  strokeWidth={filled ? 3 : 2}
                  dash={filled ? undefined : [6, 4]}
                />
                <Text
                  text={String(slot + 1)}
                  x={slotX(slot, puzzle.sizes.length) - 10}
                  y={SLOT_Y + 46}
                  width={20}
                  align="center"
                  fontSize={13}
                  fill={COLOR.textMuted}
                />
              </React.Fragment>
            );
          })}

          {puzzle.sizes.map((size, trayIndex) => {
            const placedInSlot = slotOrder.indexOf(trayIndex);
            const home = { x: trayX(trayIndex, puzzle.sizes.length), y: TRAY_Y };
            trayHomeRef.current[trayIndex] = home;
            const pos = placedInSlot >= 0 ? { x: slotX(placedInSlot, puzzle.sizes.length), y: SLOT_Y } : home;
            return (
              <Group
                key={trayIndex}
                x={pos.x}
                y={pos.y}
                draggable
                onDragEnd={handleTrayDragEnd(trayIndex)}
              >
                <Circle radius={size / 2} fill={COLOR.mint} stroke={COLOR.mintDark} strokeWidth={2.5} />
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

export default SeriationTool;
