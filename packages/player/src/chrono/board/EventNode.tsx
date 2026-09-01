// packages/player/src/chrono/board/EventNode.tsx
// Событие на доске в одном из 4 видов детализации (строка 29 ТЗ):
// компактно (символьный), флажок (текстовый), картинка (иллюстративный),
// карточка (текстово-иллюстративный). Позиционирование — через уже
// готовый eventPosition.ts (Фаза 2 toRange + axisYearsToPx), сам компонент
// только раскладывает вид по DOM.
//
// Превью для видов "картинка"/"карточка" - реальное изображение из
// локальной медиатеки (Фаза 5, chronomedia:// в electron/main.js), если у
// события есть defaultMediaId и медиа - картинка; для аудио/видео и
// событий совсем без медиа - иконка-заглушка (полноценное
// аудио/видео-превью внутри узла доски, не только в карточке события,
// выходит за рамки этого прохода).

import React, { useState } from 'react';
import { useDrag } from '@use-gesture/react';
import type { ChronoMedia, EventView, TimelineEvent } from '@kiosk/shared';
import type { EventPixelBounds } from './eventPosition.ts';
import type { ResizeEdge } from './eventDrag.ts';
import './EventNode.css';

export interface EventNodeProps {
  event: TimelineEvent;
  bounds: EventPixelBounds;
  selected: boolean;
  onSelect: (eventId: string) => void;
  /** Разрешено ли перетаскивание/растягивание (за флагом localEditingEnabled, как и остальное редактирование) */
  draggable?: boolean;
  /** Вызывается один раз по окончании жеста с итоговой дельтой в пикселях - решение о применении/сохранении принимает вызывающий код */
  onDragEnd?: (eventId: string, deltaPx: number) => void;
  /** Растягивание конкретного края интервала - открытый конец (end===null) ручки справа не получает */
  onResizeEnd?: (eventId: string, edge: ResizeEdge, deltaPx: number) => void;
  /** Запись основного медиа события (по event.defaultMediaId) - undefined, если медиа нет или не найдено в каталоге */
  defaultMedia?: ChronoMedia;
  getMediaUrl?: (media: ChronoMedia) => string;
}

const MIN_HEIGHT_PX = 28;
/** Ручки resize не показываются на событиях уже, чем это - иначе они перекрывают друг друга */
const MIN_WIDTH_FOR_HANDLES_PX = 16;
const HANDLE_WIDTH_PX = 8;

type Interaction = null | { kind: 'move'; px: number } | { kind: 'resize'; edge: ResizeEdge; px: number };

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

interface MediaViewProps {
  event: TimelineEvent;
  defaultMedia?: ChronoMedia;
  getMediaUrl?: (media: ChronoMedia) => string;
}

function thumbContent(defaultMedia: ChronoMedia | undefined, getMediaUrl: ((media: ChronoMedia) => string) | undefined) {
  if (defaultMedia && getMediaUrl && defaultMedia.mimeType.startsWith('image/')) {
    return <img src={getMediaUrl(defaultMedia)} alt="" />;
  }
  if (defaultMedia?.mimeType.startsWith('video/')) return '🎬';
  if (defaultMedia?.mimeType.startsWith('audio/')) return '🎵';
  return '🖼';
}

function ViewImage({ event, defaultMedia, getMediaUrl }: MediaViewProps) {
  return (
    <div className="chrono-event-node__image">
      <div className="chrono-event-node__image-thumb">{thumbContent(defaultMedia, getMediaUrl)}</div>
      <span className="chrono-event-node__image-label">{event.name}</span>
    </div>
  );
}

function ViewCard({ event, defaultMedia, getMediaUrl }: MediaViewProps) {
  return (
    <div className="chrono-event-node__card">
      <div className="chrono-event-node__card-thumb">{thumbContent(defaultMedia, getMediaUrl)}</div>
      <div className="chrono-event-node__card-body">
        <div className="chrono-event-node__card-title">{event.name}</div>
        {event.place && <div className="chrono-event-node__card-place">{event.place}</div>}
      </div>
    </div>
  );
}

const VIEW_COMPONENTS: Record<EventView, React.FC<MediaViewProps>> = {
  compact: ViewCompact,
  flag: ViewFlag,
  image: ViewImage,
  card: ViewCard,
};

const EventNode: React.FC<EventNodeProps> = ({
  event,
  bounds,
  selected,
  onSelect,
  draggable,
  onDragEnd,
  onResizeEnd,
  defaultMedia,
  getMediaUrl,
}) => {
  const ViewComponent = VIEW_COMPONENTS[event.view];
  // Живое смещение во время жеста (перетаскивание целиком или растягивание
  // одного края) - применяется поверх canonical bounds (посчитанных
  // родителем из фактического интервала), сбрасывается, как только родитель
  // пересчитает bounds из уже применённого интервала.
  const [interaction, setInteraction] = useState<Interaction>(null);

  const bindDrag = useDrag(
    ({ movement: [mx], last, event: nativeEvent }) => {
      // Не даём жесту всплыть до панорамирования доски (BoardView слушает
      // pointerdown/move на всей области дорожек) - иначе перетаскивание
      // события одновременно двигало бы весь видимый диапазон.
      nativeEvent.stopPropagation();

      setInteraction(last ? null : { kind: 'move', px: mx });
      if (last && mx !== 0) {
        onDragEnd?.(event.id, mx);
      }
    },
    { enabled: !!draggable, filterTaps: true }
  );

  const bindResizeStart = useDrag(
    ({ movement: [mx], last, event: nativeEvent }) => {
      nativeEvent.stopPropagation();
      setInteraction(last ? null : { kind: 'resize', edge: 'start', px: mx });
      if (last && mx !== 0) onResizeEnd?.(event.id, 'start', mx);
    },
    { enabled: !!draggable, filterTaps: true }
  );

  const bindResizeEnd = useDrag(
    ({ movement: [mx], last, event: nativeEvent }) => {
      nativeEvent.stopPropagation();
      setInteraction(last ? null : { kind: 'resize', edge: 'end', px: mx });
      if (last && mx !== 0) onResizeEnd?.(event.id, 'end', mx);
    },
    { enabled: !!draggable, filterTaps: true }
  );

  const canShowHandles = draggable && bounds.width >= MIN_WIDTH_FOR_HANDLES_PX;
  const showEndHandle = canShowHandles && event.interval.end !== null;

  let left = bounds.left;
  let width = Math.max(bounds.width, 2);
  if (interaction?.kind === 'move') {
    left += interaction.px;
  } else if (interaction?.kind === 'resize' && interaction.edge === 'start') {
    left += interaction.px;
    width = Math.max(width - interaction.px, 2);
  } else if (interaction?.kind === 'resize' && interaction.edge === 'end') {
    width = Math.max(width + interaction.px, 2);
  }

  return (
    <div
      className={`chrono-event-node chrono-event-node--${event.view}${selected ? ' chrono-event-node--selected' : ''}${draggable ? ' chrono-event-node--draggable' : ''}`}
      style={{ left, width, minHeight: MIN_HEIGHT_PX }}
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
      <ViewComponent event={event} defaultMedia={defaultMedia} getMediaUrl={getMediaUrl} />
      {canShowHandles && (
        <div className="chrono-event-node__handle chrono-event-node__handle--start" style={{ width: HANDLE_WIDTH_PX }} {...bindResizeStart()} />
      )}
      {showEndHandle && (
        <div className="chrono-event-node__handle chrono-event-node__handle--end" style={{ width: HANDLE_WIDTH_PX }} {...bindResizeEnd()} />
      )}
    </div>
  );
};

export default EventNode;
