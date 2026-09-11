// packages/player/src/periodictable/screens/LegendTab.tsx
import React from 'react';
import type { ColorIndicationMode } from '../viewTypes.ts';
import { CLASS_COLOR, ELECTRON_TYPE_COLOR, OXIDE_COLOR } from '../colorPalette.ts';

interface Props {
  colorIndication: ColorIndicationMode;
}

// Цвета — из colorPalette.ts (та же карта, что TableScreen.tsx красит
// ячейки), не отдельные hex-литералы: раньше эти два файла независимо
// хранили одинаковые значения, и ничто не мешало им разойтись при правке
// одного без другого.
const LEGEND_ENTRIES: Record<Exclude<ColorIndicationMode, 'none'>, { color: string; label: string }[]> = {
  class: [
    { color: CLASS_COLOR.metal, label: 'Металлы' },
    { color: CLASS_COLOR.metalloid, label: 'Металлоиды' },
    { color: CLASS_COLOR.nonmetal, label: 'Неметаллы' },
  ],
  electronType: [
    { color: ELECTRON_TYPE_COLOR.s, label: 's-элементы' },
    { color: ELECTRON_TYPE_COLOR.p, label: 'p-элементы' },
    { color: ELECTRON_TYPE_COLOR.d, label: 'd-элементы' },
    { color: ELECTRON_TYPE_COLOR.f, label: 'f-элементы' },
  ],
  oxideCharacter: [
    { color: OXIDE_COLOR.acidic, label: 'Кислотный характер' },
    { color: OXIDE_COLOR.basic, label: 'Основной характер' },
    { color: OXIDE_COLOR.amphoteric, label: 'Амфотерный характер' },
    { color: OXIDE_COLOR.none, label: 'Не выражен' },
  ],
};

const LegendTab: React.FC<Props> = ({ colorIndication }) => {
  if (colorIndication === 'none') {
    // «Настройки вида» защищена PIN учителя (спека, разд. 5) — для ученика
    // это не «сам включи», а «попроси учителя включить».
    return <div style={{ padding: 16 }}>Цветовая индикация сейчас отключена. Включить её может учитель во вкладке «Настройки вида».</div>;
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
