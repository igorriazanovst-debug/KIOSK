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
import { addTimeline, deleteTimeline } from '@kiosk/shared';
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

  const project = state.project;

  const persist = (updated: ChronoProject) => {
    setState({ status: 'ready', project: updated });
    window.chronoAPI?.saveProjectData(updated.id, updated).catch((err: unknown) => {
      // Показ содержимого не должен падать из-за сбоя сохранения - ошибка
      // просто остаётся в консоли; полноценная обработка (баннер, повтор)
      // придёт вместе с автосохранением.
      console.error('[Хронолиния] Не удалось сохранить проект:', err);
    });
  };

  const handleAddTimeline = () => {
    const name = window.prompt('Название линии', '')?.trim();
    if (!name) return;
    persist(addTimeline(project, crypto.randomUUID(), name));
  };

  const handleDeleteTimeline = (timelineId: string) => {
    const timeline = project.timelines.find((t) => t.id === timelineId);
    if (!timeline) return;
    if (!window.confirm(`Удалить линию «${timeline.name}» со всеми событиями?`)) return;
    persist(deleteTimeline(project, timelineId));
  };

  return (
    <div className={`chronoline-runtime chronoline-runtime--theme-${properties.theme}`} style={{ width, height }}>
      <BoardView
        timelines={project.timelines}
        viewport={viewport}
        onViewportChange={setViewport}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        onAddTimeline={properties.localEditingEnabled ? handleAddTimeline : undefined}
        onDeleteTimeline={properties.localEditingEnabled ? handleDeleteTimeline : undefined}
      />
    </div>
  );
};

export default ChronolineRuntime;
