// packages/player/src/chrono/AddEventForm.tsx
// Форма добавления события на линию - первый реальный потребитель
// parseChronoInput (Фаза 2) вне тестов на корпусе. Разбор даты - вживую,
// по мере ввода: превью распознанного результата (или честный отказ "не
// распознано") без отдельной кнопки "проверить", т.к. правила разбора уже
// быстрые чистые функции, а не сеть/IPC.

import React, { useMemo, useState } from 'react';
import { parseChronoInput, type ChronoInterval, type EventView, type ParseResult } from '@kiosk/shared';
import { formatMomentPreview } from '@kiosk/chrono-ui/formatMomentPreview';
import { EVENT_TEMPLATES } from './eventTemplates.ts';
import './AddEventForm.css';

export interface AddEventFormResult {
  name: string;
  interval: ChronoInterval;
  view: EventView;
  color?: string;
  fontColor?: string;
}

export interface AddEventFormProps {
  timelineName: string;
  onSubmit: (result: AddEventFormResult) => void;
  onCancel: () => void;
}

const VIEW_OPTIONS: { value: EventView; label: string }[] = [
  { value: 'compact', label: 'Компактно' },
  { value: 'flag', label: 'Флажок' },
  { value: 'image', label: 'Картинка' },
  { value: 'card', label: 'Карточка' },
];

function referenceDateNow() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const AddEventForm: React.FC<AddEventFormProps> = ({ timelineName, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [dateText, setDateText] = useState('');
  const [view, setView] = useState<EventView>('compact');
  const [color, setColor] = useState<string | undefined>(undefined);
  const [fontColor, setFontColor] = useState<string | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string>('default');

  const parsed = useMemo<ParseResult>(
    () => (dateText.trim() ? parseChronoInput(dateText, { referenceDate: referenceDateNow() }) : { type: 'none' }),
    [dateText]
  );

  const canSubmit = name.trim().length > 0 && parsed.type !== 'none';

  const handleApplyTemplate = (id: string) => {
    const template = EVENT_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    setTemplateId(id);
    setView(template.view);
    setColor(template.color);
    setFontColor(template.fontColor);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const interval: ChronoInterval =
      parsed.type === 'range' ? { start: parsed.start, end: parsed.end } : { start: parsed.moment, end: parsed.moment };

    onSubmit({ name: name.trim(), interval, view, color, fontColor });
  };

  return (
    <div className="chrono-add-event__overlay" onClick={onCancel}>
      <form className="chrono-add-event" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="chrono-add-event__title">Новое событие — «{timelineName}»</h3>

        <label className="chrono-add-event__field">
          <span>Название</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Название события" />
        </label>

        <label className="chrono-add-event__field">
          <span>Дата (по-русски)</span>
          <input
            value={dateText}
            onChange={(e) => setDateText(e.target.value)}
            placeholder="например: 22 июня 1941 или 65 млн лет назад"
          />
          <span className={`chrono-add-event__parse-preview${parsed.type === 'none' && dateText.trim() ? ' chrono-add-event__parse-preview--error' : ''}`}>
            {dateText.trim() ? formatMomentPreview(parsed) : ' '}
          </span>
        </label>

        <div className="chrono-add-event__field">
          <span>Шаблон оформления</span>
          <div className="chrono-add-event__templates">
            {EVENT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`chrono-add-event__template${template.id === templateId ? ' chrono-add-event__template--active' : ''}`}
                style={template.color ? { backgroundColor: template.color, color: template.fontColor } : undefined}
                onClick={() => handleApplyTemplate(template.id)}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <label className="chrono-add-event__field">
          <span>Вид</span>
          <select
            value={view}
            onChange={(e) => {
              setView(e.target.value as EventView);
              setTemplateId('');
            }}
          >
            {VIEW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="chrono-add-event__actions">
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            Добавить
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddEventForm;
