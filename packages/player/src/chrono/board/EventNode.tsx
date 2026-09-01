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

import React from 'react';
import type { EventView, TimelineEvent } from '@kiosk/shared';
import type { EventPixelBounds } from './eventPosition.ts';
import './EventNode.css';

export interface EventNodeProps {
  event: TimelineEvent;
  bounds: EventPixelBounds;
  selected: boolean;
  onSelect: (eventId: string) => void;
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

const EventNode: React.FC<EventNodeProps> = ({ event, bounds, selected, onSelect }) => {
  const ViewComponent = VIEW_COMPONENTS[event.view];

  return (
    <div
      className={`chrono-event-node chrono-event-node--${event.view}${selected ? ' chrono-event-node--selected' : ''}`}
      style={{
        left: bounds.left,
        width: Math.max(bounds.width, 2),
        minHeight: MIN_HEIGHT_PX,
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
    >
      <ViewComponent event={event} />
    </div>
  );
};

export default EventNode;
