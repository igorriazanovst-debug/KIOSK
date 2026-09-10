// Панель свойств виджета «Таблица Менделеева» в редакторе — заголовок +
// PIN «режима учителя» (спека, разд. 5). Контент справочника не
// редактируется через эту панель — он встроен и неизменен (спека, разд. 2).

import React from 'react';
import type { Widget } from '../types';
import { PERIODICTABLE_WIDGET_TYPE, PeriodicTableWidgetProperties } from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const PeriodicTablePropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== PERIODICTABLE_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<PeriodicTableWidgetProperties>;

  return (
    <div className="property-section">
      <h4>Таблица Менделеева</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Таблица Менделеева"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>

      <div className="property-field">
        <label>PIN «режима учителя» (4 цифры)</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={props.teacherPin || ''}
          placeholder="0000"
          onChange={(e) => onPropertiesChange('teacherPin', e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </div>
    </div>
  );
};

export default PeriodicTablePropertiesSection;
