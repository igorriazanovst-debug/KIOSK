// packages/editor-web/src/components/NatComPropertiesSection.tsx
// Панель свойств виджета «Конструктор природных сообществ» в редакторе.
//
// Единственный способ для педагога сменить порт встроенного сервера, если
// он занят другой программой (Тип5_бэклог.md, T5-112 - сообщение об этом
// уже показывается на экране виджета, T5-111 - установочная инструкция
// ссылается на этот же экран свойств). До этой секции у natcom-виджета не
// было НИКАКОГО способа изменить serverPort/maxClients/title после
// добавления на канвас - только заданные при создании NATCOM_DEFAULT_PROPS.

import React from 'react';
import type { Widget } from '../types';
import { NATCOM_WIDGET_TYPE, NatComWidgetProperties } from '@kiosk/shared';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
}

const NatComPropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  if (widget.type !== NATCOM_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<NatComWidgetProperties>;

  return (
    <div className="property-section">
      <h4>Конструктор природных сообществ</h4>

      <div className="property-field">
        <label>Заголовок виджета</label>
        <input
          type="text"
          value={props.title || ''}
          placeholder="Конструктор природных сообществ"
          onChange={(e) => onPropertiesChange('title', e.target.value)}
        />
      </div>

      <div className="property-field">
        <label>Порт встроенного сервера</label>
        <input
          type="number"
          min={1024}
          max={65535}
          value={props.serverPort ?? 33000}
          onChange={(e) => onPropertiesChange('serverPort', parseInt(e.target.value, 10) || 33000)}
        />
      </div>

      <div className="property-field">
        <label>Максимум одновременных подключений</label>
        <input
          type="number"
          min={1}
          max={200}
          value={props.maxClients ?? 31}
          onChange={(e) => onPropertiesChange('maxClients', parseInt(e.target.value, 10) || 31)}
        />
      </div>
    </div>
  );
};

export default NatComPropertiesSection;
