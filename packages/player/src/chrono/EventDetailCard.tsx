// packages/player/src/chrono/EventDetailCard.tsx
// Карточка события - открывается по клику на событие для ВСЕХ (просмотр
// не защищён паролем, редактирование - да, тот же принцип, что и у всей
// доски). Без права редактирования поля просто readOnly - тот же JSX, не
// отдельная view-only ветка вёрстки.
//
// Описание - пока обычный textarea (plain text в TimelineEvent.descriptionHtml),
// НЕ RichTextEditor.tsx из editor-web: тот тянет @tiptap как React-дерево
// зависимостей, специфичных для editor-web-приложения (react-router и
// т.п.), а packages/shared (единственное место, куда player и editor-web
// оба уже подключены без дублирования - см. widgetProperties.ts, Фаза 3)
// принципиально не имеет React-зависимостей и не должно их получить ради
// одного компонента. Перенос RichTextEditor в переиспользуемый вид -
// отдельное архитектурное решение (нужен пакет компонентов или прямая
// связь player->editor-web, которой сейчас нет), сознательно не решается
// здесь мимоходом. Текущее ограничение задокументировано, не тихо
// проигнорировано.
//
// Атрибуты (6 типов, строка 15 ТЗ) НЕ отображаются в этой карточке -
// ни у одной линии пока нет определений атрибутов (нет UI для их
// создания), поэтому список всегда был бы пуст. Добавится вместе с
// управлением атрибутами линии.
//
// Редактирование даты - НЕ инлайн-парсинг текущего значения (formatInterval
// не гарантированно распознаётся собственным parseChronoInput обратно для
// всех precision/веток), а отдельное поле "новая дата", которое явно
// заменяет интервал при заполнении и успешном разборе - тот же паттерн
// превью, что и в AddEventForm.tsx.

import React, { useMemo, useState } from 'react';
import { parseChronoInput, formatInterval, type EventView, type ParseResult, type TimelineEvent } from '@kiosk/shared';
import { formatMomentPreview } from './formatMomentPreview.ts';
import './EventDetailCard.css';

export interface EventDetailPatch {
  name: string;
  place?: string;
  sources?: string[];
  descriptionHtml?: string;
  view: EventView;
  color?: string;
  fontColor?: string;
  interval?: TimelineEvent['interval'];
}

export interface EventDetailCardProps {
  event: TimelineEvent;
  timelineName: string;
  canEdit: boolean;
  onSave: (patch: EventDetailPatch) => void;
  onDelete: () => void;
  onClose: () => void;
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

const EventDetailCard: React.FC<EventDetailCardProps> = ({ event, timelineName, canEdit, onSave, onDelete, onClose }) => {
  const [name, setName] = useState(event.name);
  const [place, setPlace] = useState(event.place ?? '');
  const [sourcesText, setSourcesText] = useState((event.sources ?? []).join('\n'));
  const [description, setDescription] = useState(event.descriptionHtml ?? '');
  const [view, setView] = useState<EventView>(event.view);
  const [color, setColor] = useState(event.color ?? '#4a90e2');
  const [fontColor, setFontColor] = useState(event.fontColor ?? '#ffffff');
  const [newDateText, setNewDateText] = useState('');

  const parsedNewDate = useMemo<ParseResult>(
    () => (newDateText.trim() ? parseChronoInput(newDateText, { referenceDate: referenceDateNow() }) : { type: 'none' }),
    [newDateText]
  );

  const canSave = name.trim().length > 0 && (!newDateText.trim() || parsedNewDate.type !== 'none');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const patch: EventDetailPatch = {
      name: name.trim(),
      place: place.trim() || undefined,
      sources: sourcesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      descriptionHtml: description,
      view,
      color,
      fontColor,
    };

    if (newDateText.trim() && parsedNewDate.type !== 'none') {
      patch.interval =
        parsedNewDate.type === 'range'
          ? { start: parsedNewDate.start, end: parsedNewDate.end }
          : { start: parsedNewDate.moment, end: parsedNewDate.moment };
    }

    onSave(patch);
  };

  return (
    <div className="chrono-event-detail__overlay" onClick={onClose}>
      <form className="chrono-event-detail" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <h3 className="chrono-event-detail__title">
          {canEdit ? 'Событие' : event.name} — «{timelineName}»
        </h3>

        <label className="chrono-event-detail__field">
          <span>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} readOnly={!canEdit} />
        </label>

        <div className="chrono-event-detail__field">
          <span>Дата</span>
          <div className="chrono-event-detail__current-date">{formatInterval(event.interval)}</div>
          {canEdit && (
            <>
              <input
                value={newDateText}
                onChange={(e) => setNewDateText(e.target.value)}
                placeholder="Новая дата (оставьте пустым, чтобы не менять)"
              />
              {newDateText.trim() && (
                <span
                  className={`chrono-event-detail__parse-preview${parsedNewDate.type === 'none' ? ' chrono-event-detail__parse-preview--error' : ''}`}
                >
                  {formatMomentPreview(parsedNewDate)}
                </span>
              )}
            </>
          )}
        </div>

        <label className="chrono-event-detail__field">
          <span>Место</span>
          <input value={place} onChange={(e) => setPlace(e.target.value)} readOnly={!canEdit} />
        </label>

        <label className="chrono-event-detail__field">
          <span>Источники (по одному на строку)</span>
          <textarea rows={2} value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} readOnly={!canEdit} />
        </label>

        <label className="chrono-event-detail__field">
          <span>Описание</span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} readOnly={!canEdit} />
        </label>

        <label className="chrono-event-detail__field">
          <span>Вид</span>
          <select value={view} onChange={(e) => setView(e.target.value as EventView)} disabled={!canEdit}>
            {VIEW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {canEdit && (
          <div className="chrono-event-detail__colors">
            <label className="chrono-event-detail__field chrono-event-detail__field--inline">
              <span>Цвет</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
            <label className="chrono-event-detail__field chrono-event-detail__field--inline">
              <span>Цвет текста</span>
              <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} />
            </label>
          </div>
        )}

        <div className="chrono-event-detail__actions">
          {canEdit && (
            <button type="button" className="chrono-event-detail__delete" onClick={onDelete}>
              Удалить событие
            </button>
          )}
          <span className="chrono-event-detail__actions-spacer" />
          <button type="button" onClick={onClose}>
            {canEdit ? 'Отмена' : 'Закрыть'}
          </button>
          {canEdit && (
            <button type="submit" disabled={!canSave}>
              Сохранить
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default EventDetailCard;
