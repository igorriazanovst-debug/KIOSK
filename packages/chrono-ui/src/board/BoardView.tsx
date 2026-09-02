// packages/player/src/chrono/board/BoardView.tsx
// Рабочая область доски: линии времени + шкала снизу, пан/зум жестами.
// Интерфейс жестов — @use-gesture/react (решение спайка 0.4, план Фаза 0.4):
// пан/зум по колесу мыши уже реализованы и типобезопасны; pinch-зум пальцами
// сознательно не включён в этот проход — на сенсорном экране/доске он ведёт
// себя иначе, чем в описании API, а живого экрана для проверки в этом
// окружении нет (та же оговорка, что и у остальной Фазы 3/1) — доделывается
// отдельно, с проверкой на реальном touch-устройстве.
//
// Заголовки линий — ОТДЕЛЬНАЯ колонка вне пиксельного пространства
// viewport (не наложены поверх него): viewport.widthPx обязан совпадать с
// шириной реальной области, где рисуются события и шкала, иначе позиции,
// посчитанные через axisYearsToPx, разъедутся с тем, что видно на экране.
// Поэтому имя линии и дорожка событий — в разных колонках flex-раскладки,
// а не сайдбар-оверлей поверх общей ширины.

import React, { useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { durationBetween, formatDuration, type ChronoInterval, type ChronoMedia, type ChronoTimeline, type Viewport } from '@kiosk/shared';
import ScaleRuler from './ScaleRuler.js';
import OverviewScale from './OverviewScale.js';
import EventNode from './EventNode.js';
import CompareStrip from './CompareStrip.js';
import FilterPanel, { type AttributeOption } from './FilterPanel.js';
import { eventPixelBounds, isEventVisible } from './eventPosition.js';
import { panViewport, zoomViewportAtPoint } from './boardViewport.js';
import { previewDraggedInterval, previewResizedInterval } from './eventDrag.js';
import { matchesEventFilter, isFilterActive, EMPTY_EVENT_FILTER, type EventFilter } from './eventFilter.js';
import './BoardView.css';

export interface BoardViewProps {
  timelines: ChronoTimeline[];
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
  /** Кнопка добавления линии в сайдбаре не рендерится, если не передан (только просмотр) */
  onAddTimeline?: () => void;
  onDeleteTimeline?: (timelineId: string) => void;
  /** Кнопка «⚙» (управление атрибутами линии) не рендерится, если не передан */
  onOpenTimelineSettings?: (timelineId: string) => void;
  /** Перетаскивание/растягивание событий включено, только если передан (только просмотр иначе) */
  onEventMoved?: (timelineId: string, eventId: string, newInterval: ChronoInterval) => void;
  /** Кнопка «+ событие» на дорожке не рендерится, если не передан */
  onAddEventRequested?: (timelineId: string) => void;
  /** Кнопка «Вставить» на дорожке - показывается только когда есть непустой буфер обмена (не передан = нет буфера или нет прав) */
  onPasteEvent?: (timelineId: string) => void;
  /** Каталог медиа проекта - для реальных превью у событий с видом «картинка»/«карточка» вместо заглушки */
  mediaCatalog?: ChronoMedia[];
  getMediaUrl?: (media: ChronoMedia) => string;
}

const TIMELINE_ROW_HEIGHT = 60;
const SCALE_RULER_HEIGHT = 40;
const OVERVIEW_HEIGHT = 46;
const WHEEL_ZOOM_STEP = 1.15;

const BoardView: React.FC<BoardViewProps> = ({
  timelines,
  viewport,
  onViewportChange,
  selectedEventId,
  onSelectEvent,
  onAddTimeline,
  onDeleteTimeline,
  onOpenTimelineSettings,
  onEventMoved,
  onAddEventRequested,
  onPasteEvent,
  mediaCatalog,
  getMediaUrl,
}) => {
  const trackAreaRef = useRef<HTMLDivElement>(null);
  // Эфемерное состояние взаимодействия, как и сам viewport - не часть
  // ChronoProject, не сохраняется (см. CompareStrip.tsx).
  const [compareStripAxisYears, setCompareStripAxisYears] = useState<number | null>(null);

  // Измерение промежутка между двумя событиями, В ТОМ ЧИСЛЕ с разных линий
  // (строка 35 ТЗ - именно на этом эталон спотыкался, см. chronoDuration.ts).
  // anchor/target - id событий, не привязаны к конкретной линии - поиск при
  // отрисовке идёт по ВСЕМ timelines, не по одной активной.
  const [measuring, setMeasuring] = useState(false);
  const [measureAnchorId, setMeasureAnchorId] = useState<string | null>(null);
  const [measureTargetId, setMeasureTargetId] = useState<string | null>(null);

  const toggleMeasuring = () => {
    setMeasuring((m) => !m);
    setMeasureAnchorId(null);
    setMeasureTargetId(null);
  };

  const handleEventClick = (eventId: string) => {
    if (!measuring) {
      onSelectEvent(eventId);
      return;
    }
    // Третий клик после того, как обе стороны уже выбраны - начинаем
    // измерение заново с этого события как нового якоря, а не добавляем
    // третью точку (измерение всегда между ровно двумя событиями).
    if (measureAnchorId === null || measureTargetId !== null) {
      setMeasureAnchorId(eventId);
      setMeasureTargetId(null);
      return;
    }
    if (eventId === measureAnchorId) return;
    setMeasureTargetId(eventId);
  };

  const findEventById = (id: string | null) => {
    if (!id) return undefined;
    for (const t of timelines) {
      const event = t.events.find((e) => e.id === id);
      if (event) return { event, timeline: t };
    }
    return undefined;
  };

  const measureAnchor = findEventById(measureAnchorId);
  const measureTarget = findEventById(measureTargetId);
  const measureResult =
    measureAnchor && measureTarget
      ? formatDuration(durationBetween(measureAnchor.event.interval.start, measureTarget.event.interval.start))
      : null;

  // Поиск/фильтр по тексту/дате/атрибутам (Фаза 6, последний пункт плана) -
  // тоже эфемерное состояние взаимодействия, не сохраняется в проект.
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<EventFilter>(EMPTY_EVENT_FILTER);
  const filterActive = isFilterActive(filter);

  const attributeOptions: AttributeOption[] = timelines.flatMap((t) =>
    t.attributes.map((a) => ({ id: a.id, label: `${a.name} («${t.name}»)` }))
  );

  const totalEventCount = timelines.reduce((sum, t) => sum + t.events.length, 0);
  const matchingEventCount = timelines.reduce(
    (sum, t) => sum + t.events.filter((e) => matchesEventFilter(e, filter)).length,
    0
  );

  useGesture(
    {
      onDrag: ({ delta: [dx], pinching, cancel }) => {
        if (pinching) {
          cancel();
          return;
        }
        onViewportChange(panViewport(viewport, -dx));
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        const rect = trackAreaRef.current?.getBoundingClientRect();
        const clientX = 'clientX' in event ? (event as WheelEvent).clientX : viewport.widthPx / 2;
        const pxAnchor = rect ? clientX - rect.left : viewport.widthPx / 2;
        const scaleFactor = dy < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
        onViewportChange(zoomViewportAtPoint(viewport, pxAnchor, scaleFactor));
      },
    },
    {
      target: trackAreaRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true },
    }
  );

  return (
    <div className="chrono-board">
      <div className="chrono-board__sidebar">
        {timelines.map((timeline) => (
          <div
            key={timeline.id}
            className="chrono-board__timeline-name"
            // FR-034 ТЗ ("собственные стили отображения линий") - пока
            // единственный параметр стиля, акцентная полоса цвета линии
            // слева от названия и вдоль всей дорожки (см. ниже) - способ
            // отличить линии друг от друга без чтения подписи.
            style={{ height: TIMELINE_ROW_HEIGHT, borderLeft: timeline.color ? `3px solid ${timeline.color}` : undefined }}
          >
            <span className="chrono-board__timeline-name-text">{timeline.name}</span>
            {onOpenTimelineSettings && (
              <button
                type="button"
                className="chrono-board__timeline-settings"
                title="Атрибуты линии"
                onClick={() => onOpenTimelineSettings(timeline.id)}
              >
                ⚙
              </button>
            )}
            {onDeleteTimeline && (
              <button
                type="button"
                className="chrono-board__timeline-delete"
                title="Удалить линию"
                onClick={() => onDeleteTimeline(timeline.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {onAddTimeline && (
          <button type="button" className="chrono-board__add-timeline" onClick={onAddTimeline}>
            + Линия
          </button>
        )}
        <div className="chrono-board__sidebar-spacer" style={{ height: SCALE_RULER_HEIGHT + OVERVIEW_HEIGHT }} />
      </div>

      <div className="chrono-board__main" style={{ width: viewport.widthPx }}>
        <div className="chrono-board__track-area" ref={trackAreaRef} onClick={() => onSelectEvent(null)}>
          <button
            type="button"
            className={`chrono-board__compare-toggle${compareStripAxisYears !== null ? ' chrono-board__compare-toggle--active' : ''}`}
            title="Полоса сравнения"
            onClick={(e) => {
              e.stopPropagation();
              setCompareStripAxisYears((current) => (current === null ? viewport.centerAxisYears : null));
            }}
          >
            📏
          </button>
          <button
            type="button"
            className={`chrono-board__measure-toggle${measuring ? ' chrono-board__measure-toggle--active' : ''}`}
            title="Измерить промежуток между двумя событиями"
            onClick={(e) => {
              e.stopPropagation();
              toggleMeasuring();
            }}
          >
            📐
          </button>
          <button
            type="button"
            className={`chrono-board__filter-toggle${filterActive ? ' chrono-board__filter-toggle--active' : ''}`}
            title="Поиск и фильтр"
            onClick={(e) => {
              e.stopPropagation();
              setFilterOpen((o) => !o);
            }}
          >
            🔍
          </button>
          {filterActive && (
            <div className="chrono-board__filter-indicator" onClick={(e) => e.stopPropagation()}>
              Применены фильтры: {matchingEventCount} из {totalEventCount}
              <button type="button" onClick={() => setFilter(EMPTY_EVENT_FILTER)}>
                Сбросить
              </button>
            </div>
          )}
          {filterOpen && (
            <FilterPanel filter={filter} onChange={setFilter} attributeOptions={attributeOptions} onClose={() => setFilterOpen(false)} />
          )}
          {measuring && (
            <div className="chrono-board__measure-panel" onClick={(e) => e.stopPropagation()}>
              {!measureAnchor && 'Выберите первое событие'}
              {measureAnchor && !measureTarget && `«${measureAnchor.event.name}» — выберите второе событие`}
              {measureAnchor && measureTarget && (
                <>
                  «{measureAnchor.event.name}» — «{measureTarget.event.name}»: <strong>{measureResult}</strong>
                </>
              )}
            </div>
          )}
          {compareStripAxisYears !== null && (
            <CompareStrip
              axisYears={compareStripAxisYears}
              viewport={viewport}
              onMove={setCompareStripAxisYears}
              onRemove={() => setCompareStripAxisYears(null)}
            />
          )}
          {timelines.map((timeline) => (
            <div
              key={timeline.id}
              className="chrono-board__timeline-track"
              // Тот же цвет линии, что и в сайдбаре - лёгкий тон фона
              // дорожки (не сплошная заливка), чтобы не спорить по
              // контрасту с самими событиями.
              style={{
                height: TIMELINE_ROW_HEIGHT,
                backgroundColor: timeline.color ? `color-mix(in srgb, ${timeline.color} 10%, transparent)` : undefined,
              }}
            >
              {onAddEventRequested && (
                <button
                  type="button"
                  className="chrono-board__add-event"
                  title="Добавить событие"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEventRequested(timeline.id);
                  }}
                >
                  +
                </button>
              )}
              {onPasteEvent && (
                <button
                  type="button"
                  className="chrono-board__paste-event"
                  title="Вставить событие из буфера обмена"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPasteEvent(timeline.id);
                  }}
                >
                  📋
                </button>
              )}
              {timeline.events
                .filter((event) => isEventVisible(event.interval, viewport))
                .filter((event) => matchesEventFilter(event, filter))
                .map((event) => (
                  <EventNode
                    key={event.id}
                    event={event}
                    bounds={eventPixelBounds(event.interval, viewport)}
                    selected={measuring ? event.id === measureAnchorId || event.id === measureTargetId : event.id === selectedEventId}
                    onSelect={handleEventClick}
                    draggable={!!onEventMoved && !measuring}
                    onDragEnd={(eventId, deltaPx) => {
                      const newInterval = previewDraggedInterval(event.interval, deltaPx, viewport);
                      onEventMoved?.(timeline.id, eventId, newInterval);
                    }}
                    onResizeEnd={(eventId, edge, deltaPx) => {
                      const newInterval = previewResizedInterval(event.interval, edge, deltaPx, viewport);
                      onEventMoved?.(timeline.id, eventId, newInterval);
                    }}
                    defaultMedia={
                      event.defaultMediaId ? mediaCatalog?.find((m) => m.id === event.defaultMediaId) : undefined
                    }
                    getMediaUrl={getMediaUrl}
                  />
                ))}
            </div>
          ))}
        </div>

        <ScaleRuler viewport={viewport} heightPx={SCALE_RULER_HEIGHT} />
        <OverviewScale
          timelines={timelines}
          viewport={viewport}
          onViewportChange={onViewportChange}
          widthPx={viewport.widthPx}
          heightPx={OVERVIEW_HEIGHT}
        />
      </div>
    </div>
  );
};

export default BoardView;
