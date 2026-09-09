import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Line, Circle, Text } from 'react-konva';
import Konva from 'konva';
import { computeBalance } from './weightsLogic';
import ToolShell, { toolToggleButtonStyle } from './ToolShell';
import { COLOR, FONT } from '../theme';

const AVAILABLE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SIDES = ['left', 'right'] as const;
type Side = (typeof SIDES)[number];

const CENTER_X = 320;
const CENTER_Y = 90;
const BEAM_HALF = 100;
const HANGER_LENGTH = 22;
const WEIGHT_RADIUS = 14;
const WEIGHT_GAP = 34;
const WEIGHTS_PER_ROW = 3;

interface Props {
  onClose: () => void;
}

const WeightsTool: React.FC<Props> = ({ onClose }) => {
  // Найдено вживую: раньше каждое значение было ОДНИМ общим объектом
  // (pan: 'left'|'right'|null) — одна и та же гиря не могла лежать на
  // обеих чашах одновременно, хотя кнопки "Слева"/"Справа" выглядят как
  // два независимых набора. Теперь это два независимых списка активных
  // значений — одно и то же число можно включить и слева, и справа.
  const [leftValues, setLeftValues] = useState<number[]>([]);
  const [rightValues, setRightValues] = useState<number[]>([]);
  const weightNodeRefs = useRef<Record<string, Konva.Group | null>>({});
  // См. комментарий в предыдущей версии: сравнение с предыдущим
  // состоянием нужно, чтобы НЕ дёргать .to() для уже неактивных грузиков
  // при каждом рендере (иначе Konva.Animation остаётся активным без
  // причины — вызывало зависание Page.captureScreenshot при живой
  // CDP-проверке).
  const prevStateRef = useRef({ left: leftValues, right: rightValues });

  const balance = computeBalance(leftValues, rightValues);

  function toggle(side: Side, value: number) {
    const setter = side === 'left' ? setLeftValues : setRightValues;
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = { left: leftValues, right: rightValues };

    for (const side of SIDES) {
      const values = side === 'left' ? leftValues : rightValues;
      const prevValues = side === 'left' ? prev.left : prev.right;
      const anchorX = side === 'left' ? CENTER_X - BEAM_HALF : CENTER_X + BEAM_HALF;

      for (const value of AVAILABLE_VALUES) {
        const node = weightNodeRefs.current[`${side}-${value}`];
        if (!node) continue;
        const isOn = values.includes(value);
        const wasOn = prevValues.includes(value);
        if (!isOn) {
          if (wasOn) node.to({ scaleX: 0, scaleY: 0, duration: 0.15, easing: Konva.Easings.EaseIn });
          continue;
        }
        const slot = values.indexOf(value);
        const col = slot % WEIGHTS_PER_ROW;
        const row = Math.floor(slot / WEIGHTS_PER_ROW);
        const targetX = anchorX + (col - 1) * WEIGHT_GAP;
        const targetY = CENTER_Y + HANGER_LENGTH + 32 + row * WEIGHT_GAP;
        node.to({ x: targetX, y: targetY, scaleX: 1, scaleY: 1, duration: 0.3, easing: Konva.Easings.BackEaseOut });
      }
    }
  }, [leftValues, rightValues]);

  return (
    <ToolShell icon="⚖️" title="Весы" onClose={onClose}>
      <Stage width={640} height={230}>
        <Layer>
          {/* Неподвижная стойка — НЕ вращается вместе с лучом, только сам
              луч+чаши+грузики (см. Group ниже с rotation). */}
          <Line points={[CENTER_X, CENTER_Y, CENTER_X, CENTER_Y + 74]} stroke={COLOR.indigoDark} strokeWidth={5} lineCap="round" />
          <Line
            points={[CENTER_X - 36, CENTER_Y + 88, CENTER_X + 36, CENTER_Y + 88, CENTER_X, CENTER_Y + 66]}
            closed
            fill={COLOR.indigoDark}
          />
          <Line points={[CENTER_X - 130, CENTER_Y + 88, CENTER_X + 130, CENTER_Y + 88]} stroke={COLOR.border} strokeWidth={3} lineCap="round" />
          <Circle x={CENTER_X} y={CENTER_Y} radius={7} fill={COLOR.amber} stroke={COLOR.amberDark} strokeWidth={2} />

          <Group rotation={balance.tiltDegrees} x={CENTER_X} y={CENTER_Y} offsetX={CENTER_X} offsetY={CENTER_Y}>
            <Line points={[CENTER_X - BEAM_HALF, CENTER_Y, CENTER_X + BEAM_HALF, CENTER_Y]} stroke={COLOR.indigo} strokeWidth={6} lineCap="round" />
            <Circle x={CENTER_X - BEAM_HALF} y={CENTER_Y} radius={5} fill={COLOR.indigoDark} />
            <Circle x={CENTER_X + BEAM_HALF} y={CENTER_Y} radius={5} fill={COLOR.indigoDark} />

            {SIDES.map((side) => {
              const anchorX = side === 'left' ? CENTER_X - BEAM_HALF : CENTER_X + BEAM_HALF;
              return (
                <Group key={side}>
                  <Line points={[anchorX, CENTER_Y, anchorX - 22, CENTER_Y + HANGER_LENGTH]} stroke={COLOR.indigoDark} strokeWidth={2} />
                  <Line points={[anchorX, CENTER_Y, anchorX + 22, CENTER_Y + HANGER_LENGTH]} stroke={COLOR.indigoDark} strokeWidth={2} />
                  <Line
                    points={[
                      anchorX - 22, CENTER_Y + HANGER_LENGTH,
                      anchorX + 22, CENTER_Y + HANGER_LENGTH,
                      anchorX + 15, CENTER_Y + HANGER_LENGTH + 16,
                      anchorX - 15, CENTER_Y + HANGER_LENGTH + 16,
                    ]}
                    closed
                    fill={COLOR.amberLight}
                    stroke={COLOR.amber}
                    strokeWidth={2}
                  />
                </Group>
              );
            })}

            {SIDES.flatMap((side) =>
              AVAILABLE_VALUES.map((value) => (
                <Group
                  key={`${side}-${value}`}
                  ref={(node) => { weightNodeRefs.current[`${side}-${value}`] = node; }}
                  x={side === 'left' ? CENTER_X - BEAM_HALF : CENTER_X + BEAM_HALF}
                  y={CENTER_Y + HANGER_LENGTH + 32}
                  scaleX={0}
                  scaleY={0}
                >
                  <Circle radius={WEIGHT_RADIUS} fill={COLOR.mintLight} stroke={COLOR.mint} strokeWidth={2} />
                  <Text text={String(value)} x={-WEIGHT_RADIUS} y={-9} width={WEIGHT_RADIUS * 2} align="center" fontSize={15} fontStyle="700" fill={COLOR.mintDark} />
                </Group>
              ))
            )}
          </Group>

          <Text x={CENTER_X - BEAM_HALF - 46} y={CENTER_Y + 102} text={`Слева: ${balance.leftMass}`} fontSize={18} fill={COLOR.text} />
          <Text x={CENTER_X + BEAM_HALF - 46} y={CENTER_Y + 102} text={`Справа: ${balance.rightMass}`} fontSize={18} fill={COLOR.text} />
        </Layer>
      </Stage>

      <p style={labelStyle}>Слева</p>
      <div style={buttonRowStyle}>
        {AVAILABLE_VALUES.map((v) => (
          <button key={`left-${v}`} onClick={() => toggle('left', v)} style={toolToggleButtonStyle(leftValues.includes(v))}>
            {v}
          </button>
        ))}
      </div>

      <p style={labelStyle}>Справа</p>
      <div style={buttonRowStyle}>
        {AVAILABLE_VALUES.map((v) => (
          <button key={`right-${v}`} onClick={() => toggle('right', v)} style={toolToggleButtonStyle(rightValues.includes(v))}>
            {v}
          </button>
        ))}
      </div>
    </ToolShell>
  );
};

const labelStyle: React.CSSProperties = { fontFamily: FONT.ui, fontWeight: 700, color: COLOR.indigoDark, margin: '14px 0 6px' };
const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };

export default WeightsTool;
