// packages/player/src/chrono/ChronolineRuntime.tsx
// Точка входа виджета «Хронолиния» в реальном плеере — тот же паттерн
// подключения, что у NavigationRuntime в switch(widget.type) (Player.tsx).
//
// В отличие от навигации, контент (хронолинии/события) НЕ приходит из
// widget.properties — он живёт локально на устройстве (см.
// widgetProperties.ts). При первом запуске на устройстве автоматически
// открывается самый недавно изменённый проект (listProjects уже сортирует
// "свежий сверху") либо создаётся новый, если ни одного ещё нет; переключение
// между несколькими локальными проектами, их создание/переименование/
// удаление - через выпадающий список в тулбаре (доступно только при
// localEditingEnabled, как и остальное редактирование - просмотровое
// устройство не должно давать посетителю музея случайно переключиться на
// чужой/пустой проект).
//
// Линии/события можно добавлять, перетаскивать, удалять - и теперь
// отменять/повторять (history.ts). Каждое изменение сохраняется на диск
// немедленно (без debounce) - для дискретных действий пользователя (клик
// "добавить", отпускание драга) этого достаточно; полноценный debounce +
// журнал восстановления после сбоя питания сознательно отложены (YAGNI) до
// появления непрерывного текстового редактирования (описание события,
// Фаза 5) - именно тогда сохранение на каждое нажатие клавиши станет
// реальной проблемой, а не гипотетической. Сейчас реальный пробел был не
// в частоте сохранений, а в их видимости: сбой saveProjectData раньше
// тихо оседал только в консоли - ниже это исправлено индикатором и
// повтором.

import React, { useEffect, useState } from 'react';
import type { ChronoProject, ChronolineWidgetProperties, Viewport } from '@kiosk/shared';
import { addTimeline, deleteTimeline, addEvent, updateEvent } from '@kiosk/shared';
import BoardView, { type BoardViewProps } from './board/BoardView.tsx';
import { computeInitialViewport } from './board/initialViewport.ts';
import AddEventForm, { type AddEventFormResult } from './AddEventForm.tsx';
import { initHistory, pushHistory, undo, redo, canUndo, canRedo, type History } from './history.ts';
import './ChronolineRuntime.css';

interface Props {
  properties: ChronolineWidgetProperties;
  width: number;
  height: number;
}

interface ProjectManifest {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }
  | { status: 'ready'; history: History<ChronoProject>; projectList: ProjectManifest[] };

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

const TOOLBAR_HEIGHT = 36;
const SAVED_INDICATOR_FADE_MS = 2000;

async function loadOrCreateProject(defaultName: string): Promise<{ project: ChronoProject; list: ProjectManifest[] }> {
  const existing = await window.chronoAPI!.listProjects();
  if (existing.length > 0) {
    const project = await window.chronoAPI!.loadProjectData(existing[0].id);
    return { project, list: existing };
  }
  const created = await window.chronoAPI!.createProject(defaultName);
  const project = await window.chronoAPI!.loadProjectData(created.id);
  return { project, list: [created] };
}

const ChronolineRuntime: React.FC<Props> = ({ properties, width, height }) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [addEventTimelineId, setAddEventTimelineId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });

  useEffect(() => {
    if (saveStatus.kind !== 'saved') return;
    const timer = setTimeout(() => setSaveStatus({ kind: 'idle' }), SAVED_INDICATOR_FADE_MS);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    if (!window.chronoAPI) {
      setState({ status: 'unavailable' });
      return;
    }

    let cancelled = false;
    loadOrCreateProject(properties.title || 'Хронолиния')
      .then(({ project, list }) => {
        if (cancelled) return;
        setState({ status: 'ready', history: initHistory(project), projectList: list });
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

  const history = state.history;
  const project = history.present;
  const editingEnabled = properties.localEditingEnabled;

  const persistHistory = (nextHistory: History<ChronoProject>) => {
    setState({ status: 'ready', history: nextHistory, projectList: state.projectList });
    setSaveStatus({ kind: 'saving' });
    window.chronoAPI
      ?.saveProjectData(nextHistory.present.id, nextHistory.present)
      .then(() => setSaveStatus({ kind: 'saved' }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Хронолиния] Не удалось сохранить проект:', err);
        setSaveStatus({ kind: 'error', message });
      });
  };

  const applyMutation = (updated: ChronoProject) => persistHistory(pushHistory(history, updated));
  const handleUndo = () => persistHistory(undo(history));
  const handleRedo = () => persistHistory(redo(history));
  // Повтор не трогает undo-стек - это не новая правка, а попытка ещё раз
  // сохранить уже применённое present, которое не доехало до диска.
  const handleRetrySave = () => persistHistory(history);

  // Открытие другого локального проекта - своя, отдельная от истории
  // undo/redo правки текущего проекта, точка входа: новый проект получает
  // СВОЮ историю с чистого листа, а не продолжение старой.
  const openProject = (next: ChronoProject, list: ProjectManifest[]) => {
    setState({ status: 'ready', history: initHistory(next), projectList: list });
    setViewport(computeInitialViewport(next, width));
    setSelectedEventId(null);
    setAddEventTimelineId(null);
    setSaveStatus({ kind: 'idle' });
  };

  const handleSwitchProject = (projectId: string) => {
    if (projectId === project.id) return;
    window.chronoAPI
      ?.loadProjectData(projectId)
      .then((next) => openProject(next, state.projectList))
      .catch((err: unknown) => {
        console.error('[Хронолиния] Не удалось открыть проект:', err);
        window.alert('Не удалось открыть выбранный проект');
      });
  };

  const handleCreateProject = () => {
    const name = window.prompt('Название нового проекта', '')?.trim();
    if (!name) return;
    window.chronoAPI
      ?.createProject(name)
      .then((created) => Promise.all([window.chronoAPI!.loadProjectData(created.id), window.chronoAPI!.listProjects()]))
      .then(([next, list]) => openProject(next, list))
      .catch((err: unknown) => {
        console.error('[Хронолиния] Не удалось создать проект:', err);
        window.alert('Не удалось создать проект');
      });
  };

  const handleRenameProject = () => {
    const name = window.prompt('Новое название проекта', project.name)?.trim();
    if (!name || name === project.name) return;
    // Название проекта хранится в двух местах - манифест каталога
    // (project.json, используется в списке переключения) и content.json
    // (собственное поле модели ChronoProject). Держим оба в синхроне, а не
    // только один - иначе список проектов и заголовок на самой доске
    // молча разойдутся.
    window.chronoAPI
      ?.renameProject(project.id, name)
      .then((manifest) => {
        setState((prev) =>
          prev.status === 'ready'
            ? { ...prev, projectList: prev.projectList.map((p) => (p.id === manifest.id ? manifest : p)) }
            : prev
        );
      })
      .catch((err: unknown) => console.error('[Хронолиния] Не удалось переименовать проект в каталоге:', err));
    applyMutation({ ...project, name });
  };

  const handleDeleteProject = () => {
    if (!window.confirm(`Удалить проект «${project.name}» целиком, со всеми линиями и событиями? Это необратимо.`)) return;
    window.chronoAPI
      ?.deleteProject(project.id)
      .then(() => loadOrCreateProject(properties.title || 'Хронолиния'))
      .then(({ project: next, list }) => openProject(next, list))
      .catch((err: unknown) => {
        console.error('[Хронолиния] Не удалось удалить проект:', err);
        window.alert('Не удалось удалить проект');
      });
  };

  const handleAddTimeline = () => {
    const name = window.prompt('Название линии', '')?.trim();
    if (!name) return;
    applyMutation(addTimeline(project, crypto.randomUUID(), name));
  };

  const handleDeleteTimeline = (timelineId: string) => {
    const timeline = project.timelines.find((t) => t.id === timelineId);
    if (!timeline) return;
    if (!window.confirm(`Удалить линию «${timeline.name}» со всеми событиями?`)) return;
    applyMutation(deleteTimeline(project, timelineId));
  };

  const handleEventMoved: BoardViewProps['onEventMoved'] = (timelineId, eventId, newInterval) => {
    applyMutation(updateEvent(project, timelineId, eventId, { interval: newInterval }));
  };

  const handleAddEventSubmit = (result: AddEventFormResult) => {
    if (!addEventTimelineId) return;
    applyMutation(
      addEvent(project, addEventTimelineId, {
        id: crypto.randomUUID(),
        interval: result.interval,
        name: result.name,
        mediaIds: [],
        attributeValues: {},
        view: result.view,
        verticalPriority: 1000,
      })
    );
    setAddEventTimelineId(null);
  };

  const addEventTimeline = addEventTimelineId ? project.timelines.find((t) => t.id === addEventTimelineId) : null;
  const boardHeight = editingEnabled ? height - TOOLBAR_HEIGHT : height;

  return (
    <div className={`chronoline-runtime chronoline-runtime--theme-${properties.theme}`} style={{ width, height }}>
      {editingEnabled && (
        <div className="chronoline-runtime__toolbar" style={{ height: TOOLBAR_HEIGHT }}>
          <select
            className="chronoline-runtime__project-select"
            value={project.id}
            onChange={(e) => handleSwitchProject(e.target.value)}
            title="Локальный проект"
          >
            {state.projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleCreateProject} title="Новый проект">
            + Проект
          </button>
          <button type="button" onClick={handleRenameProject} title="Переименовать проект">
            ✎
          </button>
          <button type="button" onClick={handleDeleteProject} title="Удалить проект">
            🗑
          </button>
          <span className="chronoline-runtime__toolbar-separator" />
          <button type="button" onClick={handleUndo} disabled={!canUndo(history)} title="Отменить">
            ↶ Отменить
          </button>
          <button type="button" onClick={handleRedo} disabled={!canRedo(history)} title="Повторить">
            ↷ Повторить
          </button>
          <span className={`chronoline-runtime__save-status chronoline-runtime__save-status--${saveStatus.kind}`}>
            {saveStatus.kind === 'saving' && 'Сохранение…'}
            {saveStatus.kind === 'saved' && '✓ Сохранено'}
            {saveStatus.kind === 'error' && `⚠ Не сохранено: ${saveStatus.message}`}
          </span>
          {saveStatus.kind === 'error' && (
            <button type="button" onClick={handleRetrySave} className="chronoline-runtime__retry-save">
              Повторить сохранение
            </button>
          )}
        </div>
      )}
      <div className="chronoline-runtime__board" style={{ height: boardHeight }}>
        <BoardView
          timelines={project.timelines}
          viewport={viewport}
          onViewportChange={setViewport}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          onAddTimeline={editingEnabled ? handleAddTimeline : undefined}
          onDeleteTimeline={editingEnabled ? handleDeleteTimeline : undefined}
          onEventMoved={editingEnabled ? handleEventMoved : undefined}
          onAddEventRequested={editingEnabled ? setAddEventTimelineId : undefined}
        />
        {addEventTimeline && (
          <AddEventForm
            timelineName={addEventTimeline.name}
            onSubmit={handleAddEventSubmit}
            onCancel={() => setAddEventTimelineId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ChronolineRuntime;
