// packages/player/src/periodictable/screens/LegendTab.tsx
import React from 'react';
import type { ColorIndicationMode } from '../viewTypes.ts';

interface Props {
  colorIndication: ColorIndicationMode;
}

const LEGEND_ENTRIES: Record<Exclude<ColorIndicationMode, 'none'>, { color: string; label: string }[]> = {
  class: [
    { color: '#e3f2fd', label: 'Металлы' },
    { color: '#fff3e0', label: 'Металлоиды' },
    { color: '#e8f5e9', label: 'Неметаллы' },
  ],
  electronType: [
    { color: '#ffebee', label: 's-элементы' },
    { color: '#e8f5e9', label: 'p-элементы' },
    { color: '#e3f2fd', label: 'd-элементы' },
    { color: '#f3e5f5', label: 'f-элементы' },
  ],
  oxideCharacter: [
    { color: '#ffebee', label: 'Кислотный характер' },
    { color: '#e3f2fd', label: 'Основной характер' },
    { color: '#fff3e0', label: 'Амфотерный характер' },
    { color: '#f5f5f5', label: 'Не выражен' },
  ],
};

const LegendTab: React.FC<Props> = ({ colorIndication }) => {
  if (colorIndication === 'none') {
    return <div style={{ padding: 16 }}>Цветовая индикация сейчас отключена — включите её во вкладке «Настройки вида».</div>;
  }
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {LEGEND_ENTRIES[colorIndication].map((entry) => (
        <div key={entry.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 24, height: 24, background: entry.color, border: '1px solid #ccc', display: 'inline-block' }} />
          <span>{entry.label}</span>
        </div>
      ))}
    </div>
  );
};

export default LegendTab;
