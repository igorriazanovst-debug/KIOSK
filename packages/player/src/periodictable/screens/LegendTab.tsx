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

// Названия режимов должны дословно совпадать с подписями в выпадающем
// списке «Цветовая индикация» вкладки «Настройки вида»
// (ViewSettingsTab.tsx) — иначе заголовок легенды и список выбора режима
// называют один и тот же режим по-разному, и связь между ними не читается.
const MODE_LABEL_RU: Record<Exclude<ColorIndicationMode, 'none'>, string> = {
  class: 'Классы элементов',
  electronType: 'Электронный тип',
  oxideCharacter: 'Характер оксидов и гидроксидов',
};

const LegendTab: React.FC<Props> = ({ colorIndication }) => {
  if (colorIndication === 'none') {
    // «Настройки вида» защищена PIN учителя (спека, разд. 5) — для ученика
    // это не «сам включи», а «попроси учителя включить».
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎨</div>
        <p style={{ margin: 0, color: '#37474f' }}>
          Цветовая индикация сейчас отключена — плитки таблицы не окрашены по категориям.
        </p>
        <p style={{ margin: '4px 0 0', color: '#78909c', fontSize: 13 }}>
          Включить её может учитель во вкладке «Настройки вида».
        </p>
      </div>
    );
  }
  return (
    <div style={{ padding: 16 }}>
      {/* Заголовок называет РЕЖИМ, чьи цвета показаны ниже, и явно говорит,
          что это те же цвета, что сейчас на плитках таблицы — раньше
          вкладка сразу показывала список цветных квадратов без единого
          слова о том, что это вообще такое и откуда взялось. */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: '#0d47a1' }}>
          Легенда: {MODE_LABEL_RU[colorIndication]}
        </div>
        <div style={{ fontSize: 13, color: '#607d8b', marginTop: 2 }}>
          Этими цветами сейчас окрашены плитки элементов в таблице.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LEGEND_ENTRIES[colorIndication].map((entry) => (
          <div
            key={entry.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              background: '#fafafa',
              border: '1px solid #eceff1',
              borderRadius: 8,
            }}
          >
            <span style={{ width: 28, height: 28, borderRadius: 6, background: entry.color, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
            <span>{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LegendTab;
