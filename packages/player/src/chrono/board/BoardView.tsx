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

import React, { useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import type { ChronoInterval, ChronoTimeline, Viewport } from '@kiosk/shared';
import ScaleRuler from './ScaleRuler.tsx';
import OverviewScale from './OverviewScale.tsx';
import EventNode from './EventNode.tsx';
import { eventPixelBounds, isEventVisible } from './eventPosition.ts';
import { panViewport, zoomViewportAtPoint } from './boardViewport.ts';
import { previewDraggedInterval, previewResizedInterval } from './eventDrag.ts';
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
  /** Перетаскивание/растягивание событий включено, только если передан (только просмотр иначе) */
  onEventMoved?: (timelineId: string, eventId: string, newInterval: ChronoInterval) => void;
  /** Кнопка «+ событие» на дорожке не рендерится, если не передан */
  onAddEventRequested?: (timelineId: string) => void;
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
  onEventMoved,
  onAddEventRequested,
}) => {
  const trackAreaRef = useRef<HTMLDivElement>(null);

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
          <div key={timeline.id} className="chrono-board__timeline-name" style={{ height: TIMELINE_ROW_HEIGHT }}>
            <span className="chrono-board__timeline-name-text">{timeline.name}</span>
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
          {timelines.map((timeline) => (
            <div key={timeline.id} className="chrono-board__timeline-track" style={{ height: TIMELINE_ROW_HEIGHT }}>
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
              {timeline.events
                .filter((event) => isEventVisible(event.interval, viewport))
                .map((event) => (
                  <EventNode
                    key={event.id}
                    event={event}
                    bounds={eventPixelBounds(event.interval, viewport)}
                    selected={event.id === selectedEventId}
                    onSelect={(id) => onSelectEvent(id)}
                    draggable={!!onEventMoved}
                    onDragEnd={(eventId, deltaPx) => {
                      const newInterval = previewDraggedInterval(event.interval, deltaPx, viewport);
                      onEventMoved?.(timeline.id, eventId, newInterval);
                    }}
                    onResizeEnd={(eventId, edge, deltaPx) => {
                      const newInterval = previewResizedInterval(event.interval, edge, deltaPx, viewport);
                      onEventMoved?.(timeline.id, eventId, newInterval);
                    }}
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
