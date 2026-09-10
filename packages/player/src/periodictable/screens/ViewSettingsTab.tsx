// packages/player/src/periodictable/screens/ViewSettingsTab.tsx
import React from 'react';
import type { ViewSettings } from '../viewSettingsStorage.ts';

interface Props {
  settings: ViewSettings;
  onChange: (s: ViewSettings) => void;
}

const ViewSettingsTab: React.FC<Props> = ({ settings, onChange }) => (
  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div>
      <label>Форма таблицы: </label>
      <select value={settings.tableForm} onChange={(e) => onChange({ ...settings, tableForm: e.target.value as ViewSettings['tableForm'] })}>
        <option value="short">Короткопериодная</option>
        <option value="iupac">Длиннопериодная (IUPAC)</option>
      </select>
    </div>
    <div>
      <label>Цветовая индикация: </label>
      <select value={settings.colorIndication} onChange={(e) => onChange({ ...settings, colorIndication: e.target.value as ViewSettings['colorIndication'] })}>
        <option value="none">Отсутствует</option>
        <option value="class">Классы элементов</option>
        <option value="electronType">Электронный тип</option>
        <option value="oxideCharacter">Характер оксидов и гидроксидов</option>
      </select>
    </div>
    <div>
      <label>Подсветка: </label>
      <select value={settings.highlight} onChange={(e) => onChange({ ...settings, highlight: e.target.value as ViewSettings['highlight'] })}>
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
    </div>
  </div>
);

export default ViewSettingsTab;
