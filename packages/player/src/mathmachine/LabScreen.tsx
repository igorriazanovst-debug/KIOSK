import React, { useState } from 'react';
import WeightsTool from './tools/WeightsTool';
import ChainTool from './tools/ChainTool';
import TwoSegmentsTool from './tools/TwoSegmentsTool';
import { COLOR, FONT, RADIUS, SHADOW } from './theme';

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
    <div style={{ padding: '24px 32px', fontFamily: FONT.ui, color: COLOR.text, background: COLOR.cream, minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 640 }}>
        <h3 style={{ fontFamily: FONT.display, fontSize: 24, color: COLOR.indigo, margin: 0 }}>Лаборатория</h3>
        <button onClick={onExit} style={backButtonStyle}>Назад</button>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 20 }}>
        <button onClick={() => setTool('weights')} style={toolCardStyle}>⚖️ Весы</button>
        <button onClick={() => setTool('chain')} style={toolCardStyle}>🔗 Цепочка</button>
        <button onClick={() => setTool('two_segments')} style={toolCardStyle}>📏 Два отрезка</button>
      </div>
    </div>
  );
};

const backButtonStyle: React.CSSProperties = {
  padding: '9px 18px',
  fontFamily: FONT.ui,
  fontWeight: 700,
  fontSize: 14,
  borderRadius: RADIUS.sm,
  border: `2px solid ${COLOR.border}`,
  background: COLOR.surface,
  color: COLOR.textMuted,
  cursor: 'pointer',
};

const toolCardStyle: React.CSSProperties = {
  padding: '20px 28px',
  fontFamily: FONT.ui,
  fontSize: 17,
  fontWeight: 700,
  borderRadius: RADIUS.md,
  border: `2px solid ${COLOR.border}`,
  background: COLOR.surface,
  color: COLOR.text,
  cursor: 'pointer',
  boxShadow: SHADOW.soft,
};

export default LabScreen;
