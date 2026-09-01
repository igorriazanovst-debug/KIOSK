// packages/player/src/chrono/ChronolineRuntime.tsx
// Точка входа виджета «Хронолиния» в реальном плеере — тот же паттерн
// подключения, что у NavigationRuntime в switch(widget.type) (Player.tsx).
//
// В отличие от навигации, контент (хронолинии/события) НЕ приходит из
// widget.properties — он живёт локально на устройстве (см.
// widgetProperties.ts). Здесь MVP-упрощение: один активный проект на
// устройство — самый недавно изменённый (listProjects уже сортирует
// "свежий сверху"), при первом запуске создаётся автоматически. Полноценный
// переключатель нескольких локальных проектов — отдельная UI-задача более
// поздней фазы, не блокирует показ содержимого.
//
// Это ТОЛЬКО чтение и отображение (пан/зум интерактивны, содержимое — нет):
// создание/редактирование событий (useEventDrag, история, автосохранение)
// ещё не реализовано, будет отдельным приращением Фазы 3.

import React, { useEffect, useState } from 'react';
import type { ChronoProject, ChronolineWidgetProperties, Viewport } from '@kiosk/shared';
import BoardView from './board/BoardView.tsx';
import { computeInitialViewport } from './board/initialViewport.ts';
import './ChronolineRuntime.css';

interface Props {
  properties: ChronolineWidgetProperties;
  width: number;
  height: number;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }
  | { status: 'ready'; project: ChronoProject };

async function loadOrCreateProject(defaultName: string): Promise<ChronoProject> {
  const existing = await window.chronoAPI!.listProjects();
  const projectId = existing.length > 0 ? existing[0].id : (await window.chronoAPI!.createProject(defaultName)).id;
  return window.chronoAPI!.loadProjectData(projectId);
}

const ChronolineRuntime: React.FC<Props> = ({ properties, width, height }) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!window.chronoAPI) {
      setState({ status: 'unavailable' });
      return;
    }

    let cancelled = false;
    loadOrCreateProject(properties.title || 'Хронолиния')
      .then((project) => {
        if (cancelled) return;
        setState({ status: 'ready', project });
        setViewport(computeInitialViewport(project, width));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="chronoline-runtime chronoline-runtime--message" style={{ width, height }}>
        Загрузка…
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div className="chronoline-runtime chronoline-runtime--message" style={{ width, height }}>
        «Хронолиния» доступна только в установленном приложении на устройстве
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="chronoline-runtime chronoline-runtime--message chronoline-runtime--error" style={{ width, height }}>
        Не удалось загрузить локальный проект: {state.message}
      </div>
    );
  }

  if (!viewport) return null;

  return (
    <div className={`chronoline-runtime chronoline-runtime--theme-${properties.theme}`} style={{ width, height }}>
      <BoardView
        timelines={state.project.timelines}
        viewport={viewport}
        onViewportChange={setViewport}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
      />
    </div>
  );
};

export default ChronolineRuntime;
