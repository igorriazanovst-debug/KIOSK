// packages/editor-web/src/components/ChronolinePropertiesSection.tsx
// Панель свойств виджета «Хронолиния» в редакторе.
//
// Важно: здесь настраивается только внешний вид/поведение виджета на канвасе.
// Сами хронолинии (события, атрибуты, медиа) редактируются локально на
// устройстве после установки — этот виджет не хранит их в projectData
// сервера. См. widgetType.ts и Хронолайнер_vs_KIOSK_анализ.md (раздел 8).
//
// Компонент не использует хуков — при widget.type !== CHRONOLINE_WIDGET_TYPE
// просто ничего не рендерит, без риска нарушить порядок вызова хуков между
// рендерами (в отличие от NavigationPropertiesSection.tsx, где ранний return
// стоит ДО вызовов useState/useEffect — жизнеспособно только пока эта секция
// не станет содержать собственное состояние).

import React from 'react';
import type { Widget } from '../types';
import {
  CHRONOLINE_WIDGET_TYPE,
  ChronolineWidgetProperties,
} from '../utils/chronoline/widgetType';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
  onUpdateWidget: (updates: Partial<Widget>) => void;
}

const ChronolinePropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== CHRONOLINE_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<ChronolineWidgetProperties>;

  return (
    <div className="property-section">
      <h4>🕒 Хронолиния</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Хронолиния"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>

      <div className="property-field">
        <label>Тема оформления</label>
        <select
          value={props.theme || 'light'}
          onChange={(e) => onPropertiesChange('theme', e.target.value)}
        >
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
      </div>

      <div className="property-field">
        <label>
          <input
            type="checkbox"
            checked={props.localEditingEnabled !== false}
            onChange={(e) => onPropertiesChange('localEditingEnabled', e.target.checked)}
          />
          {' '}Разрешить создание/редактирование хронолиний на устройстве
        </label>
      </div>

      <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
        Хронолинии, события и медиа создаются педагогом локально на устройстве
        после установки сборки — не здесь. Этот проект в редакторе не меняется.
      </p>
    </div>
  );
};

export default ChronolinePropertiesSection;
