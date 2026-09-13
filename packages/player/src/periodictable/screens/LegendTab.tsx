// packages/player/src/periodictable/screens/LegendTab.tsx
import React, { useMemo } from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import type { ColorIndicationMode, TrendProperty } from '../viewTypes.ts';
import { CLASS_COLOR, ELECTRON_TYPE_COLOR, OXIDE_COLOR } from '../colorPalette.ts';
import { computeTrendRange, TREND_PROPERTY_LABEL_RU } from '../trendColor.ts';

interface Props {
  colorIndication: ColorIndicationMode;
  // Нужны только для режима 'trend' (посчитать реальный диапазон значений
  // для подписей мин/макс на градиентной полосе) — необязательные, чтобы
  // не тащить их в каждый другой вызов LegendTab.
  elements?: PeriodicElement[];
  trendProperty?: TrendProperty;
}

// Цвета — из colorPalette.ts (та же карта, что TableScreen.tsx красит
// ячейки), не отдельные hex-литералы: раньше эти два файла независимо
// хранили одинаковые значения, и ничто не мешало им разойтись при правке
// одного без другого.
const LEGEND_ENTRIES: Record<Exclude<ColorIndicationMode, 'none' | 'trend'>, { color: string; label: string }[]> = {
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
const MODE_LABEL_RU: Record<Exclude<ColorIndicationMode, 'none' | 'trend'>, string> = {
  class: 'Классы элементов',
  electronType: 'Электронный тип',
  oxideCharacter: 'Характер оксидов и гидроксидов',
};

const LegendTab: React.FC<Props> = ({ colorIndication, elements, trendProperty }) => {
  // Диапазон для подписей мин/макс под градиентной полосой — считается
  // всегда (хук должен вызываться безусловно), но реально используется
  // только веткой 'trend' ниже.
  const trendRange = useMemo(
    () => (elements && trendProperty ? computeTrendRange(elements, trendProperty) : { min: 0, max: 0 }),
    [elements, trendProperty]
  );

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

  if (colorIndication === 'trend') {
    // Градиент, не дискретные образцы: подписи — реальные мин/макс по 118
    // элементам (посчитаны выше, computeTrendRange), не выдуманные круглые
    // числа. Серая метка отдельно поясняет цвет "нет данных" — у части
    // свойств (плотность/электроотрицательность) он встречается у
    // нескольких элементов (см. schema.ts, nullable-поля).
    const label = trendProperty ? TREND_PROPERTY_LABEL_RU[trendProperty] : '';
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 'bold', fontSize: 15, color: '#0d47a1' }}>Легенда: Тренды — {label}</div>
          <div style={{ fontSize: 13, color: '#607d8b', marginTop: 2 }}>
            Цвет плитки показывает значение свойства относительно других элементов.
          </div>
        </div>
        <div
          style={{
            height: 24,
            borderRadius: 12,
            background: 'linear-gradient(to right, #42a5f5, #ffee58, #ef5350)',
            border: '1px solid rgba(0,0,0,0.1)',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#455a64', marginTop: 6 }}>
          <span>{trendRange.min}</span>
          <span>{trendRange.max}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '8px 10px', background: '#fafafa', border: '1px solid #eceff1', borderRadius: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: '#cfd8dc', border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
          <span>Нет данных для этого элемента</span>
        </div>
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
