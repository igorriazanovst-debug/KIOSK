import React, { useState } from 'react';
import { Stage, Layer, Line, Text } from 'react-konva';
import { computeBalance, type WeightPlacement } from './weightsLogic';

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
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 640 }}>
        <h3>Весы</h3>
        <button onClick={onClose}>Выйти</button>
      </div>

      <Stage width={640} height={220}>
        <Layer>
          <Line points={[220, 100, 420, 100]} stroke="#555" strokeWidth={6} rotation={balance.tiltDegrees} x={0} y={0} offsetX={320} offsetY={100} />
          <Text x={160} y={140} text={`Слева: ${balance.leftMass}`} fontSize={18} />
          <Text x={420} y={140} text={`Справа: ${balance.rightMass}`} fontSize={18} />
        </Layer>
      </Stage>

      <p>Слева</p>
      <div style={buttonRowStyle}>
        {weights.map((w, i) => (
          <button key={`left-${w.value}`} onClick={() => toggle(i, 'left')} style={weightButtonStyle(w.pan === 'left')}>
            {w.value}
          </button>
        ))}
      </div>

      <p>Справа</p>
      <div style={buttonRowStyle}>
        {weights.map((w, i) => (
          <button key={`right-${w.value}`} onClick={() => toggle(i, 'right')} style={weightButtonStyle(w.pan === 'right')}>
            {w.value}
          </button>
        ))}
      </div>
    </div>
  );
};

function weightButtonStyle(active: boolean): React.CSSProperties {
  return { padding: '6px 10px', borderRadius: 6, border: active ? '2px solid #2ecc71' : '1px solid #ccc', background: active ? '#eafff2' : '#fff', cursor: 'pointer' };
}

const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };

export default WeightsTool;
