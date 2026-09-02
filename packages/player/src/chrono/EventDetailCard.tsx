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
// Атрибуты (6 типов, строка 15 ТЗ) - значения редактируются здесь, ОПРЕДЕЛЕНИЯ
// (имя/тип/enumValues) - в TimelineSettings.tsx (линия, не событие). Тип
// eventLink (FR-032 ТЗ) - выпадающий список остальных событий проекта (по
// ВСЕМ линиям, не только текущей - строка 34 ТЗ прямо это требует) для
// добавления ссылки + список уже добавленных ссылок как кликабельные
// "чипы": клик переходит к тому событию (onNavigateToEvent, см.
// ChronolineRuntime.tsx - переключает selectedEventId, эта же карточка
// перемонтируется с key={event.id} на новые данные).
//
// Редактирование даты - НЕ инлайн-парсинг текущего значения (formatInterval
// не гарантированно распознаётся собственным parseChronoInput обратно для
// всех precision/веток), а отдельное поле "новая дата", которое явно
// заменяет интервал при заполнении и успешном разборе - тот же паттерн
// превью, что и в AddEventForm.tsx.

import React, { useMemo, useState } from 'react';
import {
  parseChronoInput,
  formatInterval,
  type AttributeDef,
  type AttributeValue,
  type ChronoMedia,
  type ChronoTimeline,
  type EventView,
  type ParseResult,
  type TimelineEvent,
} from '@kiosk/shared';
import { formatMomentPreview } from '@kiosk/chrono-ui/formatMomentPreview';
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
  mediaIds: string[];
  defaultMediaId: string | null;
  attributeValues: Record<string, AttributeValue>;
}

export interface EventLinkOption {
  id: string;
  name: string;
  timelineName: string;
}

export interface EventDetailCardProps {
  event: TimelineEvent;
  timeline: ChronoTimeline;
  canEdit: boolean;
  /** Каталог медиа проекта (project.media) - для отрисовки уже прикреплённых превью по id */
  mediaCatalog: ChronoMedia[];
  getMediaUrl: (media: ChronoMedia) => string;
  /** Все события проекта по всем линиям (для пикера eventLink) - текущее событие уже исключено вызывающим кодом */
  allEvents: EventLinkOption[];
  /** Переключает открытую карточку на другое событие (клик по чипу eventLink) */
  onNavigateToEvent: (eventId: string) => void;
  /** Открывает системный выбор файла, импортирует его в медиатеку проекта - возвращает id новой (или существующей при дедупе) записи, либо null при отмене/ошибке */
  onImportMedia: () => Promise<string | null>;
  onSave: (patch: EventDetailPatch) => void;
  onDelete: () => void;
  /** В буфер обмена доски (не привязан к линии - вставка возможна на любую другую линию проекта), не передан - кнопка не рендерится */
  onCopy?: () => void;
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

/** Один инпут на все 6 типов атрибутов (строка 15 ТЗ) - выбор конкретного элемента управления по attr.type */
function renderAttributeInput(
  attr: AttributeDef,
  value: AttributeValue | undefined,
  onChange: (value: AttributeValue) => void,
  readOnly: boolean,
  linkOptions: EventLinkOption[],
  onNavigateToEvent: (eventId: string) => void
) {
  switch (attr.type) {
    case 'string':
      return <input value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />;

    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          readOnly={readOnly}
        />
      );

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          disabled={readOnly}
          className="chrono-event-detail__checkbox"
        />
      );

    case 'enum':
      return (
        <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly}>
          <option value="">—</option>
          {(attr.enumValues ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );

    case 'set': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="chrono-event-detail__checkbox-set">
          {(attr.enumValues ?? []).map((v) => (
            <label key={v} className="chrono-event-detail__checkbox-set-item">
              <input
                type="checkbox"
                checked={selected.includes(v)}
                disabled={readOnly}
                onChange={(e) => onChange(e.target.checked ? [...selected, v] : selected.filter((s) => s !== v))}
              />
              {v}
            </label>
          ))}
        </div>
      );
    }

    case 'eventLink': {
      const ids = Array.isArray(value) ? value : [];
      const linked = ids.map((id) => ({ id, option: linkOptions.find((o) => o.id === id) }));
      // Уже добавленное событие не предлагаем добавить второй раз - тот же
      // id не может быть ссылкой на самого себя дважды.
      const available = linkOptions.filter((o) => !ids.includes(o.id));

      return (
        <div className="chrono-event-detail__event-links">
          {linked.length > 0 ? (
            <div className="chrono-event-detail__event-link-chips">
              {linked.map(({ id, option }) => (
                <span key={id} className="chrono-event-detail__event-link-chip">
                  <button
                    type="button"
                    className="chrono-event-detail__event-link-chip-nav"
                    onClick={() => onNavigateToEvent(id)}
                    title="Перейти к событию"
                  >
                    {option ? `${option.name} («${option.timelineName}»)` : id}
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      className="chrono-event-detail__event-link-chip-remove"
                      title="Убрать ссылку"
                      onClick={() => onChange(ids.filter((existing) => existing !== id))}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="chrono-event-detail__current-date">—</div>
          )}
          {!readOnly && available.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onChange([...ids, e.target.value]);
              }}
            >
              <option value="">+ Добавить ссылку на событие…</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} («{o.timelineName}»)
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }
  }
}

const EventDetailCard: React.FC<EventDetailCardProps> = ({
  event,
  timeline,
  canEdit,
  mediaCatalog,
  getMediaUrl,
  allEvents,
  onNavigateToEvent,
  onImportMedia,
  onSave,
  onDelete,
  onCopy,
  onClose,
}) => {
  const [name, setName] = useState(event.name);
  const [place, setPlace] = useState(event.place ?? '');
  const [sourcesText, setSourcesText] = useState((event.sources ?? []).join('\n'));
  const [description, setDescription] = useState(event.descriptionHtml ?? '');
  const [view, setView] = useState<EventView>(event.view);
  const [color, setColor] = useState(event.color ?? '#4a90e2');
  const [fontColor, setFontColor] = useState(event.fontColor ?? '#ffffff');
  const [newDateText, setNewDateText] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>(event.mediaIds);
  const [defaultMediaId, setDefaultMediaId] = useState<string | null>(event.defaultMediaId ?? null);
  const [mediaImporting, setMediaImporting] = useState(false);
  const [attributeValues, setAttributeValues] = useState<Record<string, AttributeValue>>(event.attributeValues);

  const setAttributeValue = (attrId: string, value: AttributeValue) =>
    setAttributeValues((prev) => ({ ...prev, [attrId]: value }));

  const attachedMedia = mediaIds
    .map((id) => mediaCatalog.find((m) => m.id === id))
    .filter((m): m is ChronoMedia => !!m);
  const defaultMedia = attachedMedia.find((m) => m.id === defaultMediaId);

  const handleImportMedia = async () => {
    setMediaImporting(true);
    try {
      const mediaId = await onImportMedia();
      if (mediaId) {
        setMediaIds((ids) => (ids.includes(mediaId) ? ids : [...ids, mediaId]));
        setDefaultMediaId((current) => current ?? mediaId);
      }
    } finally {
      setMediaImporting(false);
    }
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMediaIds((ids) => ids.filter((id) => id !== mediaId));
    setDefaultMediaId((current) => (current === mediaId ? null : current));
  };

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
      mediaIds,
      defaultMediaId,
      attributeValues,
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
          {canEdit ? 'Событие' : event.name} — «{timeline.name}»
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

        {defaultMedia && (defaultMedia.mimeType.startsWith('video/') || defaultMedia.mimeType.startsWith('audio/')) && (
          <div className="chrono-event-detail__field">
            <span>Просмотр</span>
            {defaultMedia.mimeType.startsWith('video/') ? (
              <video className="chrono-event-detail__preview-media" src={getMediaUrl(defaultMedia)} controls />
            ) : (
              <audio className="chrono-event-detail__preview-media" src={getMediaUrl(defaultMedia)} controls />
            )}
          </div>
        )}

        {(attachedMedia.length > 0 || canEdit) && (
          <div className="chrono-event-detail__field">
            <span>Медиа</span>
            <div className="chrono-event-detail__media-grid">
              {attachedMedia.map((media) => (
                <div
                  key={media.id}
                  className={`chrono-event-detail__media-thumb${media.id === defaultMediaId ? ' chrono-event-detail__media-thumb--default' : ''}`}
                  title={media.fileName}
                >
                  {media.mimeType.startsWith('image/') ? (
                    <img src={getMediaUrl(media)} alt={media.fileName} />
                  ) : (
                    <div className="chrono-event-detail__media-placeholder">{media.mimeType.startsWith('video/') ? '🎬' : '🎵'}</div>
                  )}
                  {canEdit && (
                    <div className="chrono-event-detail__media-actions">
                      <button type="button" title="Сделать основным" onClick={() => setDefaultMediaId(media.id)}>
                        ★
                      </button>
                      <button type="button" title="Открепить" onClick={() => handleRemoveMedia(media.id)}>
                        ×
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {canEdit && (
                <button type="button" className="chrono-event-detail__media-add" onClick={handleImportMedia} disabled={mediaImporting}>
                  {mediaImporting ? '…' : '+ Файл'}
                </button>
              )}
            </div>
          </div>
        )}

        {timeline.attributes.map((attr) => (
          <div key={attr.id} className="chrono-event-detail__field">
            <span>{attr.name}</span>
            {renderAttributeInput(attr, attributeValues[attr.id], (v) => setAttributeValue(attr.id, v), !canEdit, allEvents, onNavigateToEvent)}
          </div>
        ))}

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
          {onCopy && (
            <button type="button" onClick={onCopy} title="Скопировать в буфер обмена доски">
              📋 Копировать
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
