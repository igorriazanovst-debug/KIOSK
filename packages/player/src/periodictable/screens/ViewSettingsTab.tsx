// packages/player/src/periodictable/screens/ViewSettingsTab.tsx
import React from 'react';
import type { ViewSettings } from '../viewSettingsStorage.ts';
import { TREND_PROPERTY_LABEL_RU } from '../trendColor.ts';
import type { TrendProperty } from '../viewTypes.ts';

interface Props {
  settings: ViewSettings;
  onChange: (s: ViewSettings) => void;
}

const selectStyle: React.CSSProperties = {
  fontSize: 15,
  padding: '8px 10px',
  border: '1px solid #cfd8dc',
  borderRadius: 8,
  background: '#fff',
  minWidth: 220,
};

const ROW: React.FC<{ htmlFor: string; label: string; children: React.ReactNode }> = ({ htmlFor, label, children }) => (
  <div style={{ padding: '10px 14px', background: '#fafafa', border: '1px solid #eceff1', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
    <label htmlFor={htmlFor} style={{ fontWeight: 'bold', color: '#37474f', minWidth: 160 }}>{label}</label>
    {children}
  </div>
);

const ViewSettingsTab: React.FC<Props> = ({ settings, onChange }) => (
  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <ROW htmlFor="periodictable-view-settings-form" label="Форма таблицы">
      <select
        id="periodictable-view-settings-form"
        value={settings.tableForm}
        onChange={(e) => onChange({ ...settings, tableForm: e.target.value as ViewSettings['tableForm'] })}
        style={selectStyle}
      >
        <option value="short">Короткопериодная</option>
        <option value="iupac">Длиннопериодная (IUPAC)</option>
      </select>
    </ROW>
    <ROW htmlFor="periodictable-view-settings-color" label="Цветовая индикация">
      <select
        id="periodictable-view-settings-color"
        value={settings.colorIndication}
        onChange={(e) => onChange({ ...settings, colorIndication: e.target.value as ViewSettings['colorIndication'] })}
        style={selectStyle}
      >
        <option value="none">Отсутствует</option>
        <option value="class">Классы элементов</option>
        <option value="electronType">Электронный тип</option>
        <option value="oxideCharacter">Характер оксидов и гидроксидов</option>
        <option value="trend">Тренды (числовой градиент)</option>
      </select>
    </ROW>
    {settings.colorIndication === 'trend' && (
      <ROW htmlFor="periodictable-view-settings-trend-property" label="Какое свойство">
        <select
          id="periodictable-view-settings-trend-property"
          value={settings.trendProperty}
          onChange={(e) => onChange({ ...settings, trendProperty: e.target.value as TrendProperty })}
          style={selectStyle}
        >
          {(Object.keys(TREND_PROPERTY_LABEL_RU) as TrendProperty[]).map((prop) => (
            <option key={prop} value={prop}>
              {TREND_PROPERTY_LABEL_RU[prop]}
            </option>
          ))}
        </select>
      </ROW>
    )}
    <ROW htmlFor="periodictable-view-settings-highlight" label="Подсветка">
      <select
        id="periodictable-view-settings-highlight"
        value={settings.highlight}
        onChange={(e) => onChange({ ...settings, highlight: e.target.value as ViewSettings['highlight'] })}
        style={selectStyle}
      >
        <option value="none">Нет</option>
        <option value="metal">Металлы</option>
        <option value="nonmetal">Неметаллы</option>
        <option value="metalloid">Металлоиды</option>
        <option value="s">s-элементы</option>
        <option value="p">p-элементы</option>
        <option value="d">d-элементы</option>
        <option value="f">f-элементы</option>
        <option value="acidic">Кислотный характер оксидов</option>
        <option value="basic">Основной характер оксидов</option>
        <option value="amphoteric">Амфотерный характер оксидов</option>
      </select>
    </ROW>
  </div>
);

export default ViewSettingsTab;
