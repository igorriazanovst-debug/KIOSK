// packages/editor-web/src/components/ChronolinePropertiesSection.tsx
// Панель свойств виджета «Хронолиния» в редакторе.
//
// Важно: здесь настраивается только внешний вид/поведение виджета на канвасе.
// Сами хронолинии (события, атрибуты, медиа) редактируются локально на
// устройстве после установки — этот виджет не хранит их в projectData
// сервера. См. widgetType.ts и Хронолайнер_vs_KIOSK_анализ.md (раздел 8).
//
// Хук (галерея шаблонов, Фаза 7) вызывается ДО раннего return — порядок
// вызова хуков обязан быть одинаковым на каждом рендере независимо от
// widget.type (в отличие от NavigationPropertiesSection.tsx, где этот
// инвариант нарушен).

import React, { useState } from 'react';
import type { Widget } from '../types';
import {
  CHRONOLINE_WIDGET_TYPE,
  ChronolineWidgetProperties,
} from '@kiosk/shared';
import ChronolineEditorModal from './ChronolineEditorModal';

interface Props {
  widget: Widget;
  onPropertiesChange: (key: string, value: any) => void;
  onUpdateWidget: (updates: Partial<Widget>) => void;
}

const ChronolinePropertiesSection: React.FC<Props> = ({ widget, onPropertiesChange }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);

  if (widget.type !== CHRONOLINE_WIDGET_TYPE) return null;

  const props = widget.properties as Partial<ChronolineWidgetProperties>;

  return (
    <div className="property-section">
      <h4>🕒 Хронолиния</h4>

      <div className="property-field">
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', padding: '8px', marginBottom: 8 }}
          onClick={() => setGalleryOpen(true)}
        >
          🕒 Посмотреть примеры шаблонов
        </button>
      </div>
      {galleryOpen && <ChronolineEditorModal onClose={() => setGalleryOpen(false)} />}

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
