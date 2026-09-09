// Панель свойств виджета «Матемашка» в редакторе. Минимальный набор для
// Этапа 1 (спека, разд. 2) — контент авторизуется офлайн-скриптами, не через
// эту панель (тот же принцип, что у NatComPropertiesSection.tsx: реальная
// интерактивность живёт только в плеере).

import React from 'react';
import type { Widget } from '../types';
import { MATHMACHINE_WIDGET_TYPE, MathMachineWidgetProperties } from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const MathMachinePropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== MATHMACHINE_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<MathMachineWidgetProperties>;

  return (
    <div className="property-section">
      <h4>Матемашка</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Матемашка"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>
    </div>
  );
};

export default MathMachinePropertiesSection;
