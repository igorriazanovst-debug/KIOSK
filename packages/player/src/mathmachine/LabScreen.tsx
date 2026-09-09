import React, { useState } from 'react';
import WeightsTool from './tools/WeightsTool';
import ChainTool from './tools/ChainTool';
import TwoSegmentsTool from './tools/TwoSegmentsTool';

type LabTool = 'menu' | 'weights' | 'chain' | 'two_segments';

interface Props {
  onExit: () => void;
}

const LabScreen: React.FC<Props> = ({ onExit }) => {
  const [tool, setTool] = useState<LabTool>('menu');

  if (tool === 'weights') return <WeightsTool onClose={() => setTool('menu')} />;
  if (tool === 'chain') return <ChainTool onClose={() => setTool('menu')} />;
  if (tool === 'two_segments') return <TwoSegmentsTool onClose={() => setTool('menu')} />;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 640 }}>
        <h3>Лаборатория</h3>
        <button onClick={onExit}>Назад</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={() => setTool('weights')}>Весы</button>
        <button onClick={() => setTool('chain')}>Цепочка</button>
        <button onClick={() => setTool('two_segments')}>Два отрезка</button>
      </div>
    </div>
  );
};

export default LabScreen;
