// packages/editor-web/src/components/ChronolinePreview.tsx
// Только просмотр готового проекта «Хронолинии» (Фаза 7): контент по-прежнему
// создаётся исключительно на устройстве (см. ChronolineWidget.tsx,
// ChronolinePropertiesSection.tsx) — этот компонент не даёт добавлять/менять
// линии, события или медиа, он лишь показывает, как проект будет выглядеть.
// Доска — общий с player read-only код из @kiosk/chrono-ui (см.
// Хронолайнер_план_реализации.md, Фаза 7): здесь НЕ передаются
// onAddTimeline/onDeleteTimeline/onEventMoved/onAddEventRequested/onPasteEvent —
// без них BoardView сама не рисует ни одного элемента управления редактированием.

import React, { useState } from 'react';
import type { ChronoProject, Viewport } from '@kiosk/shared';
import BoardView from '@kiosk/chrono-ui/board/BoardView';
import { computeInitialViewport } from '@kiosk/chrono-ui/board/initialViewport';

export interface ChronolinePreviewProps {
  project: ChronoProject;
  widthPx?: number;
}

const DEFAULT_WIDTH_PX = 720;

const ChronolinePreview: React.FC<ChronolinePreviewProps> = ({ project, widthPx = DEFAULT_WIDTH_PX }) => {
  const [viewport, setViewport] = useState<Viewport>(() => computeInitialViewport(project, widthPx));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  return (
    <BoardView
      timelines={project.timelines}
      viewport={viewport}
      onViewportChange={setViewport}
      selectedEventId={selectedEventId}
      onSelectEvent={setSelectedEventId}
    />
  );
};

export default ChronolinePreview;
