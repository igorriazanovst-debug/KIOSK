// packages/player/src/chrono/board/FilterPanel.tsx
// Панель поиска/фильтра (Фаза 6, последний пункт плана: "по тексту/дате/
// атрибутам с видимым индикатором «применены фильтры»"). Даты - тот же
// паттерн разбора-с-превью, что и в AddEventForm.tsx/EventDetailCard.tsx,
// не инлайн-редактирование готовой даты.

import React, { useMemo, useState } from 'react';
import { parseChronoInput, type ParseResult } from '@kiosk/shared';
import { formatMomentPreview } from '../formatMomentPreview.ts';
import type { EventFilter } from './eventFilter.ts';
import './FilterPanel.css';

export interface AttributeOption {
  id: string;
  label: string;
}

export interface FilterPanelProps {
  filter: EventFilter;
  onChange: (filter: EventFilter) => void;
  attributeOptions: AttributeOption[];
  onClose: () => void;
}

function referenceDateNow() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filter, onChange, attributeOptions, onClose }) => {
  const [dateFromText, setDateFromText] = useState('');
  const [dateToText, setDateToText] = useState('');

  const parsedFrom: ParseResult = useMemo(
    () => (dateFromText.trim() ? parseChronoInput(dateFromText, { referenceDate: referenceDateNow() }) : { type: 'none' }),
    [dateFromText]
  );
  const parsedTo: ParseResult = useMemo(
    () => (dateToText.trim() ? parseChronoInput(dateToText, { referenceDate: referenceDateNow() }) : { type: 'none' }),
    [dateToText]
  );

  const applyDateFrom = () => {
    if (parsedFrom.type === 'moment') onChange({ ...filter, dateFrom: parsedFrom.moment });
    else if (parsedFrom.type === 'range') onChange({ ...filter, dateFrom: parsedFrom.start });
  };
  const applyDateTo = () => {
    if (parsedTo.type === 'moment') onChange({ ...filter, dateTo: parsedTo.moment });
    else if (parsedTo.type === 'range') onChange({ ...filter, dateTo: parsedTo.end });
  };

  return (
    <div className="chrono-filter-panel" onClick={(e) => e.stopPropagation()}>
      <div className="chrono-filter-panel__row">
        <input
          className="chrono-filter-panel__text"
          value={filter.text}
          onChange={(e) => onChange({ ...filter, text: e.target.value })}
          placeholder="Поиск по названию, месту, описанию…"
        />
      </div>

      <div className="chrono-filter-panel__row">
        <div className="chrono-filter-panel__date-field">
          <input
            value={dateFromText}
            onChange={(e) => setDateFromText(e.target.value)}
            onBlur={applyDateFrom}
            onKeyDown={(e) => e.key === 'Enter' && applyDateFrom()}
            placeholder="Дата от"
          />
          {filter.dateFrom && <span className="chrono-filter-panel__date-applied">✓ {formatMomentPreview({ type: 'moment', moment: filter.dateFrom })}</span>}
        </div>
        <div className="chrono-filter-panel__date-field">
          <input
            value={dateToText}
            onChange={(e) => setDateToText(e.target.value)}
            onBlur={applyDateTo}
            onKeyDown={(e) => e.key === 'Enter' && applyDateTo()}
            placeholder="Дата по"
          />
          {filter.dateTo && <span className="chrono-filter-panel__date-applied">✓ {formatMomentPreview({ type: 'moment', moment: filter.dateTo })}</span>}
        </div>
        {(filter.dateFrom || filter.dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFromText('');
              setDateToText('');
              onChange({ ...filter, dateFrom: null, dateTo: null });
            }}
          >
            Сбросить даты
          </button>
        )}
      </div>

      {attributeOptions.length > 0 && (
        <div className="chrono-filter-panel__row">
          <select
            value={filter.attributeId ?? ''}
            onChange={(e) => onChange({ ...filter, attributeId: e.target.value || null })}
          >
            <option value="">Атрибут…</option>
            {attributeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            value={filter.attributeValueText}
            onChange={(e) => onChange({ ...filter, attributeValueText: e.target.value })}
            placeholder="значение содержит…"
            disabled={!filter.attributeId}
          />
        </div>
      )}

      <div className="chrono-filter-panel__actions">
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
