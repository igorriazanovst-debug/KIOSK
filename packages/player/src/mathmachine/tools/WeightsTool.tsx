import React, { useState } from 'react';
import { Stage, Layer, Line, Text } from 'react-konva';
import { computeBalance, type WeightPlacement } from './weightsLogic';
import ToolShell, { toolToggleButtonStyle } from './ToolShell';
import { COLOR, FONT } from '../theme';

const AVAILABLE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  onClose: () => void;
}

const WeightsTool: React.FC<Props> = ({ onClose }) => {
  const [weights, setWeights] = useState<WeightPlacement[]>(AVAILABLE_VALUES.map((value) => ({ value, pan: null })));

  const balance = computeBalance(weights);

  function toggle(index: number, pan: 'left' | 'right') {
    setWeights((prev) => prev.map((w, i) => (i === index ? { ...w, pan: w.pan === pan ? null : pan } : w)));
  }

  return (
    <ToolShell icon="⚖️" title="Весы" onClose={onClose}>
      <Stage width={640} height={220}>
        <Layer>
          {/* Найдено вживую (Задача 15): offsetX/offsetY задают точку поворота
              внутри координат самой фигуры, но Konva ТАКЖЕ сдвигает рендер
              фигуры на -offset от x/y — без компенсации x/y тем же значением
              луч уезжал почти за пределы холста. x/y здесь равны offsetX/offsetY,
              чтобы видимая позиция луча не сдвинулась, а вращение шло вокруг
              его середины (320, 100). */}
          <Line points={[220, 100, 420, 100]} stroke={COLOR.indigo} strokeWidth={6} rotation={balance.tiltDegrees} x={320} y={100} offsetX={320} offsetY={100} />
          <Text x={160} y={140} text={`Слева: ${balance.leftMass}`} fontSize={18} fill={COLOR.text} />
          <Text x={420} y={140} text={`Справа: ${balance.rightMass}`} fontSize={18} fill={COLOR.text} />
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
