import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Line, Rect, Circle, Text } from 'react-konva';
import Konva from 'konva';
import { computeBalance, type WeightPlacement } from './weightsLogic';
import ToolShell, { toolToggleButtonStyle } from './ToolShell';
import { COLOR, FONT } from '../theme';

const AVAILABLE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const CENTER_X = 320;
const CENTER_Y = 100;
const BEAM_HALF = 100;
const HANGER_LENGTH = 20;
const WEIGHT_RADIUS = 14;
const WEIGHT_GAP = 34;
const WEIGHTS_PER_ROW = 3;

interface Props {
  onClose: () => void;
}

const WeightsTool: React.FC<Props> = ({ onClose }) => {
  const [weights, setWeights] = useState<WeightPlacement[]>(AVAILABLE_VALUES.map((value) => ({ value, pan: null })));
  // Узлы грузиков двигаются и появляются через Konva.Tween (см. useEffect
  // ниже), а не через React-пропы x/y/scale - именно поэтому в JSX у
  // <Group> ниже эти значения ЗАФИКСИРОВАНЫ константами и не зависят от
  // w.pan: если бы они менялись вместе с состоянием, react-konva применял
  // бы их МГНОВЕННО при каждом рендере ДО того, как отработает Tween,
  // и анимация дёргалась бы вместо плавного движения.
  const weightNodeRefs = useRef<Record<number, Konva.Group | null>>({});
  // Хранит предыдущий снимок weights, чтобы отличать реальные переходы
  // (грузик поставили/сняли) от первого монтирования — иначе на старте
  // эффект молча пытался бы анимировать все 9 ещё не размещённых грузиков
  // "из нуля в ноль", что бессмысленно и просто держит Konva.Animation
  // активным без причины.
  const prevWeightsRef = useRef(weights);

  const balance = computeBalance(weights);

  function toggle(index: number, pan: 'left' | 'right') {
    setWeights((prev) => prev.map((w, i) => (i === index ? { ...w, pan: w.pan === pan ? null : pan } : w)));
  }

  useEffect(() => {
    const prevWeights = prevWeightsRef.current;
    prevWeightsRef.current = weights;
    const leftPlaced = weights.filter((w) => w.pan === 'left');
    const rightPlaced = weights.filter((w) => w.pan === 'right');

    for (const w of weights) {
      const node = weightNodeRefs.current[w.value];
      if (!node) continue;
      const prevPan = prevWeights.find((p) => p.value === w.value)?.pan ?? null;
      if (w.pan === null) {
        if (prevPan === null) continue;
        node.to({ scaleX: 0, scaleY: 0, duration: 0.15, easing: Konva.Easings.EaseIn });
        continue;
      }
      const list = w.pan === 'left' ? leftPlaced : rightPlaced;
      const slot = list.findIndex((item) => item.value === w.value);
      const col = slot % WEIGHTS_PER_ROW;
      const row = Math.floor(slot / WEIGHTS_PER_ROW);
      const anchorX = w.pan === 'left' ? CENTER_X - BEAM_HALF : CENTER_X + BEAM_HALF;
      const targetX = anchorX + (col - 1) * WEIGHT_GAP;
      const targetY = CENTER_Y + HANGER_LENGTH + 24 + row * WEIGHT_GAP;
      node.to({ x: targetX, y: targetY, scaleX: 1, scaleY: 1, duration: 0.3, easing: Konva.Easings.BackEaseOut });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights]);

  return (
    <ToolShell icon="⚖️" title="Весы" onClose={onClose}>
      <Stage width={640} height={220}>
        <Layer>
          <Group rotation={balance.tiltDegrees} x={CENTER_X} y={CENTER_Y} offsetX={CENTER_X} offsetY={CENTER_Y}>
            <Line points={[CENTER_X - BEAM_HALF, CENTER_Y, CENTER_X + BEAM_HALF, CENTER_Y]} stroke={COLOR.indigo} strokeWidth={6} />

            <Line points={[CENTER_X - BEAM_HALF, CENTER_Y, CENTER_X - BEAM_HALF, CENTER_Y + HANGER_LENGTH]} stroke={COLOR.indigoDark} strokeWidth={3} />
            <Rect x={CENTER_X - BEAM_HALF - 46} y={CENTER_Y + HANGER_LENGTH} width={92} height={8} cornerRadius={4} fill={COLOR.amberLight} stroke={COLOR.amber} strokeWidth={2} />

            <Line points={[CENTER_X + BEAM_HALF, CENTER_Y, CENTER_X + BEAM_HALF, CENTER_Y + HANGER_LENGTH]} stroke={COLOR.indigoDark} strokeWidth={3} />
            <Rect x={CENTER_X + BEAM_HALF - 46} y={CENTER_Y + HANGER_LENGTH} width={92} height={8} cornerRadius={4} fill={COLOR.amberLight} stroke={COLOR.amber} strokeWidth={2} />

            {weights.map((w) => (
              <Group
                key={w.value}
                ref={(node) => { weightNodeRefs.current[w.value] = node; }}
                x={CENTER_X - BEAM_HALF}
                y={CENTER_Y + HANGER_LENGTH + 24}
                scaleX={0}
                scaleY={0}
              >
                <Circle radius={WEIGHT_RADIUS} fill={COLOR.mintLight} stroke={COLOR.mint} strokeWidth={2} />
                <Text text={String(w.value)} x={-WEIGHT_RADIUS} y={-9} width={WEIGHT_RADIUS * 2} align="center" fontSize={15} fontStyle="700" fill={COLOR.mintDark} />
              </Group>
            ))}
          </Group>

          <Text x={CENTER_X - BEAM_HALF - 46} y={CENTER_Y + 92} text={`Слева: ${balance.leftMass}`} fontSize={18} fill={COLOR.text} />
          <Text x={CENTER_X + BEAM_HALF - 46} y={CENTER_Y + 92} text={`Справа: ${balance.rightMass}`} fontSize={18} fill={COLOR.text} />
        </Layer>
      </Stage>

      <p style={labelStyle}>Слева</p>
      <div style={buttonRowStyle}>
        {weights.map((w, i) => (
          <button key={`left-${w.value}`} onClick={() => toggle(i, 'left')} style={toolToggleButtonStyle(w.pan === 'left')}>
            {w.value}
          </button>
        ))}
      </div>

      <p style={labelStyle}>Справа</p>
      <div style={buttonRowStyle}>
        {weights.map((w, i) => (
          <button key={`right-${w.value}`} onClick={() => toggle(i, 'right')} style={toolToggleButtonStyle(w.pan === 'right')}>
            {w.value}
          </button>
        ))}
      </div>
    </ToolShell>
  );
};

const labelStyle: React.CSSProperties = { fontFamily: FONT.ui, fontWeight: 700, color: COLOR.indigoDark, margin: '14px 0 6px' };
const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };

export default WeightsTool;
