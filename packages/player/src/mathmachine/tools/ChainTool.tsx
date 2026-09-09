import React, { useRef, useState } from 'react';
import { Stage, Layer, Circle, Group, Line, Text } from 'react-konva';
import {
  generateChainPuzzle,
  checkChainAnswers,
  buildNumberPaletteValues,
  SHAPE_POOL,
  LETTER_POOL,
  TOY_POOL,
  type ChainCategory,
  type ChainPuzzle,
} from './chainLogic.ts';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 340;
const CHAIN_Y = 80;
const PALETTE_Y = 220;
const PALETTE_ROW_HEIGHT = 60;
const PALETTE_TILE_SPACING = 60;
// Найдено вживую (Задача 7): числовая палитра «Цепочки» может содержать до
// 12 плиток (10 цифр + до 2 двузначных ответов), а при шаге 70px в один ряд
// плитки уходили за границу Stage (640px) и переставали быть доступны для
// перетаскивания — большинство числовых цепочек было нерешаемо. Плитки
// теперь переносятся на новую строку.
const DROP_RADIUS = 40;

const TABS: { id: ChainCategory; label: string }[] = [
  { id: 'number', label: 'Числа' },
  { id: 'shape', label: 'Фигуры' },
  { id: 'letter', label: 'Буквы' },
  { id: 'toy', label: 'Игрушки' },
];

interface Props {
  onClose: () => void;
}

function slotX(index: number, length: number): number {
  const gap = CANVAS_WIDTH / (length + 1);
  return gap * (index + 1);
}

function paletteTilesPerRow(): number {
  return Math.max(1, Math.floor((CANVAS_WIDTH - 40) / PALETTE_TILE_SPACING));
}

function paletteX(index: number): number {
  return 40 + (index % paletteTilesPerRow()) * PALETTE_TILE_SPACING;
}

function paletteY(index: number): number {
  return PALETTE_Y + Math.floor(index / paletteTilesPerRow()) * PALETTE_ROW_HEIGHT;
}

function paletteValuesForTab(tab: ChainCategory, puzzle: ChainPuzzle): string[] {
  if (tab === 'number') return buildNumberPaletteValues(puzzle);
  if (tab === 'shape') return [...SHAPE_POOL];
  if (tab === 'letter') return [...LETTER_POOL];
  return [...TOY_POOL];
}

const ChainTool: React.FC<Props> = ({ onClose }) => {
  const [puzzle, setPuzzle] = useState<ChainPuzzle>(() => generateChainPuzzle());
  const [placedByIndex, setPlacedByIndex] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Record<number, boolean> | null>(null);
  const [activeTab, setActiveTab] = useState<ChainCategory>('number');
  const tileHomeRef = useRef<Record<string, { x: number; y: number }>>({});

  function newPuzzle() {
    setPuzzle(generateChainPuzzle());
    setPlacedByIndex({});
    setResult(null);
  }

  function handleCheck() {
    setResult(checkChainAnswers(puzzle, placedByIndex));
  }

  function handleTileDragEnd(value: string, tileKey: string) {
    return (e: any) => {
      const node = e.target;
      const x = node.x();
      const y = node.y();
      let droppedIndex: number | null = null;
      for (const index of puzzle.blankIndices) {
        const dx = x - slotX(index, puzzle.values.length);
        const dy = y - CHAIN_Y;
        if (Math.sqrt(dx * dx + dy * dy) <= DROP_RADIUS) {
          droppedIndex = index;
          break;
        }
      }
      const home = tileHomeRef.current[tileKey];
      if (home) node.position(home);
      if (droppedIndex !== null) {
        setPlacedByIndex((prev) => ({ ...prev, [droppedIndex as number]: value }));
        setResult(null);
      }
    };
  }

  const paletteValues = paletteValuesForTab(activeTab, puzzle);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: CANVAS_WIDTH }}>
        <h3>Цепочка</h3>
        <button onClick={onClose}>Выйти</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabButtonStyle(tab.id === activeTab)}>
            {tab.label}
          </button>
        ))}
      </div>

      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          <Line points={[20, CHAIN_Y, CANVAS_WIDTH - 20, CHAIN_Y]} stroke="#f1c40f" strokeWidth={4} />
          {puzzle.values.map((value, index) => {
            const isBlank = puzzle.blankIndices.includes(index);
            const placed = placedByIndex[index];
            const shown = isBlank ? placed : value;
            const isCorrect = result ? result[index] : undefined;
            const strokeColor = isCorrect === true ? '#2ecc71' : isCorrect === false ? '#e74c3c' : '#888';
            return (
              <React.Fragment key={index}>
                <Circle
                  x={slotX(index, puzzle.values.length)}
                  y={CHAIN_Y}
                  radius={26}
                  fill={shown ? '#fff' : 'transparent'}
                  stroke={strokeColor}
                  strokeWidth={3}
                  dash={shown ? undefined : [6, 4]}
                />
                {shown && (
                  <Text
                    text={shown}
                    x={slotX(index, puzzle.values.length) - 20}
                    y={CHAIN_Y - 12}
                    width={40}
                    align="center"
                    fontSize={20}
                  />
                )}
              </React.Fragment>
            );
          })}

          {paletteValues.map((value, i) => {
            const tileKey = `${activeTab}-${value}-${i}`;
            const home = { x: paletteX(i), y: paletteY(i) };
            tileHomeRef.current[tileKey] = home;
            return (
              <Group key={tileKey} x={home.x} y={home.y} draggable onDragEnd={handleTileDragEnd(value, tileKey)}>
                <Circle radius={24} fill="#eaf4ff" stroke="#3498db" strokeWidth={2} />
                <Text text={value} x={-20} y={-10} width={40} align="center" fontSize={18} listening={false} />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={handleCheck}>Проверить</button>
        <button onClick={newPuzzle}>Новая цепочка</button>
      </div>
    </div>
  );
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 6,
    border: active ? '2px solid #2ecc71' : '1px solid #ccc',
    background: active ? '#eafff2' : '#fff',
    cursor: 'pointer',
  };
}

export default ChainTool;
