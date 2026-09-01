// packages/player/src/chrono/board/EventNode.tsx
// Событие на доске в одном из 4 видов детализации (строка 29 ТЗ):
// компактно (символьный), флажок (текстовый), картинка (иллюстративный),
// карточка (текстово-иллюстративный). Позиционирование — через уже
// готовый eventPosition.ts (Фаза 2 toRange + axisYearsToPx), сам компонент
// только раскладывает вид по DOM.
//
// Медиатека (Фаза 5) ещё не построена — превью для видов "картинка"/
// "карточка" сейчас placeholder-иконка, не реальное изображение с диска.
// Это сознательный, явно обозначенный пробел, не тихая заглушка.

import React, { useState } from 'react';
import { useDrag } from '@use-gesture/react';
import type { EventView, TimelineEvent } from '@kiosk/shared';
import type { EventPixelBounds } from './eventPosition.ts';
import './EventNode.css';

export interface EventNodeProps {
  event: TimelineEvent;
  bounds: EventPixelBounds;
  selected: boolean;
  onSelect: (eventId: string) => void;
  /** Разрешено ли перетаскивание (за флагом localEditingEnabled, как и остальное редактирование) */
  draggable?: boolean;
  /** Вызывается один раз по окончании жеста с итоговой дельтой в пикселях - решение о применении/сохранении принимает вызывающий код */
  onDragEnd?: (eventId: string, deltaPx: number) => void;
}

const MIN_HEIGHT_PX = 28;

function ViewCompact({ event }: { event: TimelineEvent }) {
  return (
    <div className="chrono-event-node__compact" style={{ backgroundColor: event.color || '#4a90e2' }} title={event.name} />
  );
}

function ViewFlag({ event }: { event: TimelineEvent }) {
  return (
    <div className="chrono-event-node__flag">
      <div className="chrono-event-node__flag-tab" style={{ backgroundColor: event.color || '#4a90e2' }} />
      <span className="chrono-event-node__flag-label" style={{ color: event.fontColor }}>
        {event.name}
      </span>
    </div>
  );
}

function ViewImage({ event }: { event: TimelineEvent }) {
  const hasMedia = !!event.defaultMediaId;
  return (
    <div className="chrono-event-node__image">
      <div className="chrono-event-node__image-thumb" aria-hidden={!hasMedia}>
        {hasMedia ? null /* Фаза 5: реальное превью из локальной медиатеки */ : '🖼'}
      </div>
      <span className="chrono-event-node__image-label">{event.name}</span>
    </div>
  );
}

function ViewCard({ event }: { event: TimelineEvent }) {
  const hasMedia = !!event.defaultMediaId;
  return (
    <div className="chrono-event-node__card">
      <div className="chrono-event-node__card-thumb" aria-hidden={!hasMedia}>
        {hasMedia ? null : '🖼'}
      </div>
      <div className="chrono-event-node__card-body">
        <div className="chrono-event-node__card-title">{event.name}</div>
        {event.place && <div className="chrono-event-node__card-place">{event.place}</div>}
      </div>
    </div>
  );
}

const VIEW_COMPONENTS: Record<EventView, React.FC<{ event: TimelineEvent }>> = {
  compact: ViewCompact,
  flag: ViewFlag,
  image: ViewImage,
  card: ViewCard,
};

const EventNode: React.FC<EventNodeProps> = ({ event, bounds, selected, onSelect, draggable, onDragEnd }) => {
  const ViewComponent = VIEW_COMPONENTS[event.view];
  // Живое смещение во время жеста - применяется поверх canonical bounds
  // (посчитанных родителем из фактического интервала), сбрасывается в 0,
  // как только родитель пересчитает bounds из уже сдвинутого интервала.
  const [dragOffsetPx, setDragOffsetPx] = useState(0);

  const bindDrag = useDrag(
    ({ movement: [mx], last, event: nativeEvent }) => {
      // Не даём жесту всплыть до панорамирования доски (BoardView слушает
      // pointerdown/move на всей области дорожек) - иначе перетаскивание
      // события одновременно двигало бы весь видимый диапазон.
      nativeEvent.stopPropagation();

      setDragOffsetPx(last ? 0 : mx);
      if (last && mx !== 0) {
        onDragEnd?.(event.id, mx);
      }
    },
    { enabled: !!draggable, filterTaps: true }
  );

  return (
    <div
      className={`chrono-event-node chrono-event-node--${event.view}${selected ? ' chrono-event-node--selected' : ''}${draggable ? ' chrono-event-node--draggable' : ''}`}
      style={{
        left: bounds.left,
        width: Math.max(bounds.width, 2),
        minHeight: MIN_HEIGHT_PX,
        transform: dragOffsetPx ? `translateX(${dragOffsetPx}px)` : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(event.id);
      }}
      {...(draggable ? bindDrag() : {})}
    >
      <ViewComponent event={event} />
    </div>
  );
};

export default EventNode;
