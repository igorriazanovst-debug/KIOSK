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
//
// Локальная авторизация (Фаза 4, auth.js): один пароль на устройство,
// защищает РЕДАКТИРОВАНИЕ, не просмотр - доска остаётся видимой всем,
// пока не задан пароль или пока сессия не разблокирована. canEdit ниже -
// это localEditingEnabled (свойство виджета) И (пароль не задан ИЛИ уже
// разблокировано в этой сессии), тот же флаг, что раньше просто был
// editingEnabled, теперь с дополнительным условием.
//
// ВАЖНО (правка по итогам security-review): canEdit - это UX-решение, не
// граница авторизации. Настоящая проверка живёт в main-процессе
// (ipc.js/sessionLock.js) и срабатывает на каждый мутирующий IPC-вызов
// независимо от того, что решил рендерер - React-состояние `unlocked`
// здесь только ЗЕРКАЛИТ серверную сессию (инициализируется из
// getAuthStatus, синхронизируется опросом раз в минуту, откатывается
// назад при ошибке "LOCKED:" от main-процесса), а не является
// источником истины.

import React, { useEffect, useRef, useState } from 'react';
import type { ChronoProject, ChronolineWidgetProperties, TimelineEvent, Viewport } from '@kiosk/shared';
import {
  addTimeline,
  deleteTimeline,
  addEvent,
  updateEvent,
  deleteEvent,
  addMedia,
  addAttributeDef,
  renameAttributeDef,
  deleteAttributeDef,
  setTimelineColor,
  type AttributeDef,
} from '@kiosk/shared';
import BoardView, { type BoardViewProps } from '@kiosk/chrono-ui/board/BoardView';
import { computeInitialViewport } from '@kiosk/chrono-ui/board/initialViewport';
import AddEventForm, { type AddEventFormResult } from './AddEventForm.tsx';
import EventDetailCard, { type EventDetailPatch } from './EventDetailCard.tsx';
import TimelineSettings from './TimelineSettings.tsx';
import { mediaUrl } from './media.ts';
import PasswordPrompt, {
  type PasswordPromptMode,
  type PasswordSubmitValues,
  type PasswordPromptResult,
  type ResetChallengeInfo,
} from './PasswordPrompt.tsx';
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
const AUTH_STATUS_POLL_MS = 60_000;
const VIEWPORT_SAVE_DEBOUNCE_MS = 1_000;
const LOCKED_ERROR_MARKER = 'LOCKED:';

function isLockedError(err: unknown): boolean {
  return err instanceof Error && err.message.includes(LOCKED_ERROR_MARKER);
}

/**
 * FR-014 ТЗ: масштаб/центр экрана - часть "параметров отображения",
 * которые проект обязан сохранять. Если сохранённого viewport нет (проект
 * создан до этого поля, или ни разу не сохранялся после открытия) -
 * пересчитываем заново по содержимому, как и раньше.
 */
function resolveViewport(project: ChronoProject, widthPx: number): Viewport {
  if (project.viewport) {
    return { centerAxisYears: project.viewport.centerAxisYears, spanAxisYears: project.viewport.spanAxisYears, widthPx };
  }
  return computeInitialViewport(project, widthPx);
}

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
  const [attributeSettingsTimelineId, setAttributeSettingsTimelineId] = useState<string | null>(null);
  // Буфер обмена НА УРОВНЕ ДОСКИ (не привязан к линии-источнику) - явное
  // решение плана: если бы буфер жил на линии, перенос события на другую
  // линию не работал бы, тот же дефект, что у эталона.
  const [eventClipboard, setEventClipboard] = useState<TimelineEvent | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [passwordPromptMode, setPasswordPromptMode] = useState<PasswordPromptMode | null>(null);
  const [resetInfo, setResetInfo] = useState<ResetChallengeInfo | null>(null);

  // Всегда свежая ссылка на текущий present - debounce-сохранение viewport
  // ниже не должно перетереть контентную правку, случившуюся уже ПОСЛЕ
  // того, как таймер был поставлен (замыкание useEffect иначе держало бы
  // историю на момент постановки таймера, не на момент его срабатывания).
  const historyRef = useRef<History<ChronoProject> | null>(null);
  historyRef.current = state.status === 'ready' ? state.history : null;

  useEffect(() => {
    if (saveStatus.kind !== 'saved') return;
    const timer = setTimeout(() => setSaveStatus({ kind: 'idle' }), SAVED_INDICATOR_FADE_MS);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  // FR-014 ТЗ: сохраняем масштаб/центр экрана - но НЕ немедленно на каждый
  // пиксель пана/зума (в отличие от контентных правок, см. заголовок
  // файла) - viewport меняется на каждый кадр жеста, немедленное
  // сохранение означало бы десятки полных перезаписей project.json в
  // секунду. Debounce, тихая деградация при ошибке - потеря сохранённого
  // масштаба не теряет пользовательский контент, не заслуживает того же
  // индикатора/повтора, что и saveStatus контентных правок.
  useEffect(() => {
    if (!viewport || !window.chronoAPI) return;
    const timer = setTimeout(() => {
      const current = historyRef.current?.present;
      if (!current) return;
      const saved = current.viewport;
      if (saved && saved.centerAxisYears === viewport.centerAxisYears && saved.spanAxisYears === viewport.spanAxisYears) {
        return;
      }
      window.chronoAPI!
        .saveProjectData(current.id, {
          ...current,
          viewport: { centerAxisYears: viewport.centerAxisYears, spanAxisYears: viewport.spanAxisYears },
        })
        .catch(() => {
          // Тихая деградация - см. комментарий выше.
        });
    }, VIEWPORT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport?.centerAxisYears, viewport?.spanAxisYears]);

  // Challenge запрашивается заново при каждом входе в режим 'reset' -
  // предыдущий challenge мог быть погашен успешным сбросом с другого
  // сеанса (одноразовый, см. resetCode.js).
  useEffect(() => {
    if (passwordPromptMode !== 'reset' || !window.chronoAPI) return;
    setResetInfo(null);
    window.chronoAPI.getResetChallenge().then(setResetInfo);
  }, [passwordPromptMode]);

  useEffect(() => {
    if (!window.chronoAPI) {
      setState({ status: 'unavailable' });
      return;
    }

    let cancelled = false;
    Promise.all([loadOrCreateProject(properties.title || 'Хронолиния'), window.chronoAPI.getAuthStatus()])
      .then(([{ project, list }, authStatus]) => {
        if (cancelled) return;
        setState({ status: 'ready', history: initHistory(project), projectList: list });
        setViewport(resolveViewport(project, width));
        setIsPasswordSet(authStatus.isPasswordSet);
        // Отражаем РЕАЛЬНОЕ состояние сессии в main-процессе, а не всегда
        // стартуем с false: если виджет размонтировался/смонтировался
        // заново (скрыть/показать), не перезапуская всё приложение,
        // сессия в main-процессе могла остаться разблокированной в
        // пределах таймаута бездействия (sessionLock.js) - незачем
        // заново показывать экран блокировки в этом случае.
        setUnlocked(authStatus.unlocked);
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

  // Синхронизация с сессией main-процесса, пока сессия разблокирована -
  // ловит автоблокировку по таймауту бездействия (sessionLock.js), не
  // только явные ошибки от следующего мутирующего вызова.
  useEffect(() => {
    if (!unlocked || !window.chronoAPI) return;
    const timer = setInterval(() => {
      window.chronoAPI?.getAuthStatus().then((status) => {
        if (!status.unlocked) setUnlocked(false);
      });
    }, AUTH_STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [unlocked]);

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
  const canEdit = editingEnabled && (!isPasswordSet || unlocked);

  const persistHistory = (nextHistory: History<ChronoProject>) => {
    setState({ status: 'ready', history: nextHistory, projectList: state.projectList });
    setSaveStatus({ kind: 'saving' });
    window.chronoAPI
      ?.saveProjectData(nextHistory.present.id, nextHistory.present)
      .then(() => setSaveStatus({ kind: 'saved' }))
      .catch((err: unknown) => {
        console.error('[Хронолиния] Не удалось сохранить проект:', err);
        // Сессия истекла в main-процессе (таймаут бездействия) между тем,
        // как отрисовался тулбар редактирования, и этим сохранением -
        // возвращаем UI в заблокированное состояние вместо того, чтобы
        // просто показать общую ошибку сохранения.
        if (isLockedError(err)) {
          setUnlocked(false);
          setSaveStatus({ kind: 'error', message: 'Сессия истекла - потребуется разблокировать снова' });
          return;
        }
        setSaveStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
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
    setViewport(resolveViewport(next, width));
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

  const handleMutatingIpcError = (err: unknown, fallbackMessage: string) => {
    console.error('[Хронолиния]', fallbackMessage, err);
    if (isLockedError(err)) {
      setUnlocked(false);
      window.alert('Сессия истекла - разблокируйте редактирование снова');
      return;
    }
    window.alert(fallbackMessage);
  };

  const handleCreateProject = () => {
    const name = window.prompt('Название нового проекта', '')?.trim();
    if (!name) return;
    window.chronoAPI
      ?.createProject(name)
      .then((created) => Promise.all([window.chronoAPI!.loadProjectData(created.id), window.chronoAPI!.listProjects()]))
      .then(([next, list]) => openProject(next, list))
      .catch((err: unknown) => handleMutatingIpcError(err, 'Не удалось создать проект'));
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
      .catch((err: unknown) => handleMutatingIpcError(err, 'Не удалось переименовать проект в каталоге'));
    applyMutation({ ...project, name });
  };

  const handleDeleteProject = () => {
    if (!window.confirm(`Удалить проект «${project.name}» целиком, со всеми линиями и событиями? Это необратимо.`)) return;
    window.chronoAPI
      ?.deleteProject(project.id)
      .then(() => loadOrCreateProject(properties.title || 'Хронолиния'))
      .then(({ project: next, list }) => openProject(next, list))
      .catch((err: unknown) => handleMutatingIpcError(err, 'Не удалось удалить проект'));
  };

  const handleExportProject = () => {
    window.chronoAPI
      ?.exportProject(project.id)
      .then((result) => {
        if (!result.success && !result.canceled) window.alert('Не удалось экспортировать проект');
      })
      .catch((err: unknown) => handleMutatingIpcError(err, 'Не удалось экспортировать проект'));
  };

  const handleImportProject = () => {
    window.chronoAPI
      ?.importProject()
      .then((manifest) => {
        if (!manifest) return; // диалог отменён
        return Promise.all([window.chronoAPI!.loadProjectData(manifest.id), window.chronoAPI!.listProjects()]).then(
          ([next, list]) => openProject(next, list)
        );
      })
      .catch((err: unknown) => handleMutatingIpcError(err, 'Не удалось импортировать проект - файл повреждён или не является архивом Хронолинии'));
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

  const handlePasswordSubmit = async (values: PasswordSubmitValues): Promise<PasswordPromptResult> => {
    if (passwordPromptMode === 'unlock') {
      return window.chronoAPI!.verifyPassword(values.password || '');
    }
    if (passwordPromptMode === 'setup') {
      return window.chronoAPI!.changePassword(values.newPassword || '');
    }
    if (passwordPromptMode === 'reset') {
      return window.chronoAPI!.resetWithCode(values.resetCode || '', values.newPassword || '');
    }
    return window.chronoAPI!.changePassword(values.newPassword || '', values.currentPassword);
  };

  const handlePasswordSuccess = () => {
    if (passwordPromptMode === 'unlock' || passwordPromptMode === 'setup' || passwordPromptMode === 'reset') {
      setUnlocked(true);
      setIsPasswordSet(true);
    }
    setPasswordPromptMode(null);
  };

  const handleLockEditing = () => {
    window.chronoAPI?.lockEditing().finally(() => setUnlocked(false));
  };

  const attributeSettingsTimeline = attributeSettingsTimelineId
    ? project.timelines.find((t) => t.id === attributeSettingsTimelineId)
    : null;

  const handleAddAttribute = (attr: AttributeDef) => {
    if (!attributeSettingsTimelineId) return;
    applyMutation(addAttributeDef(project, attributeSettingsTimelineId, attr));
  };

  const handleRenameAttribute = (attrId: string, name: string) => {
    if (!attributeSettingsTimelineId) return;
    applyMutation(renameAttributeDef(project, attributeSettingsTimelineId, attrId, name));
  };

  const handleDeleteAttribute = (attrId: string) => {
    if (!attributeSettingsTimelineId) return;
    applyMutation(deleteAttributeDef(project, attributeSettingsTimelineId, attrId));
  };

  const handleChangeTimelineColor = (color: string | undefined) => {
    if (!attributeSettingsTimelineId) return;
    applyMutation(setTimelineColor(project, attributeSettingsTimelineId, color));
  };

  const addEventTimeline = addEventTimelineId ? project.timelines.find((t) => t.id === addEventTimelineId) : null;

  const selectedEventInfo = (() => {
    if (!selectedEventId) return undefined;
    for (const timeline of project.timelines) {
      const event = timeline.events.find((e) => e.id === selectedEventId);
      if (event) return { timeline, event };
    }
    return undefined;
  })();

  // FR-032 ТЗ: пикер ссылки на событие в EventDetailCard - по ВСЕМ линиям
  // проекта (строка 34 ТЗ), не только текущей. Текущее событие исключается
  // здесь, а не в самой карточке - EventDetailCard не обязан знать, что
  // "себя саму" нельзя предлагать в списке, это забота вызывающего кода.
  const allEventsForLinking = project.timelines.flatMap((t) =>
    t.events.filter((e) => e.id !== selectedEventId).map((e) => ({ id: e.id, name: e.name, timelineName: t.name }))
  );

  const handleEventDetailSave = (patch: EventDetailPatch) => {
    if (!selectedEventInfo) return;
    applyMutation(updateEvent(project, selectedEventInfo.timeline.id, selectedEventInfo.event.id, patch));
    setSelectedEventId(null);
  };

  const handleEventDetailDelete = () => {
    if (!selectedEventInfo) return;
    if (!window.confirm(`Удалить событие «${selectedEventInfo.event.name}»?`)) return;
    applyMutation(deleteEvent(project, selectedEventInfo.timeline.id, selectedEventInfo.event.id));
    setSelectedEventId(null);
  };

  const handleCopyEvent = () => {
    if (!selectedEventInfo) return;
    setEventClipboard(selectedEventInfo.event);
  };

  // Вставка создаёт НОВОЕ событие (свежий id) с тем же содержимым, на ТУ ЖЕ
  // дату - пользователь затем перетаскивает копию, куда нужно (drag/resize
  // уже построены в Фазе 3, повторно решать "куда вставить по времени" не
  // нужно). Буфер не очищается после вставки - вставить на несколько линий
  // подряд обязано работать без повторного копирования.
  const handlePasteEvent = (timelineId: string) => {
    if (!eventClipboard) return;
    applyMutation(addEvent(project, timelineId, { ...eventClipboard, id: crypto.randomUUID() }));
  };

  // Файл копируется в медиатеку и добавляется в каталог проекта СРАЗУ по
  // выбору (не откладывается до "Сохранить" на карточке события) - это
  // отдельная, самостоятельная мутация с собственной записью в истории.
  // Если пользователь потом нажмёт "Отмена" на карточке, файл останется
  // прикреплённым к каталогу, но не привязанным ни к одному событию -
  // безвредный сирота, тот же компромисс, что и у большинства файловых
  // загрузчиков, не стоит того, чтобы городить отдельный "черновой" статус.
  const handleImportMediaForEvent = async (): Promise<string | null> => {
    const filePath = await window.chronoAPI?.pickMediaFile();
    if (!filePath) return null;
    try {
      const imported = await window.chronoAPI!.importMedia(project.id, filePath);
      const { project: updatedProject, media } = addMedia(project, imported);
      applyMutation(updatedProject);
      return media.id;
    } catch (err) {
      handleMutatingIpcError(err, 'Не удалось добавить файл');
      return null;
    }
  };

  const boardHeight = editingEnabled ? height - TOOLBAR_HEIGHT : height;

  return (
    <div className={`chronoline-runtime chronoline-runtime--theme-${properties.theme}`} style={{ width, height }}>
      {editingEnabled && (
        <div className="chronoline-runtime__toolbar" style={{ height: TOOLBAR_HEIGHT }}>
          {canEdit ? (
            <>
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
              <button type="button" onClick={handleExportProject} title="Экспортировать проект в файл">
                ⭳ Экспорт
              </button>
              <button type="button" onClick={handleImportProject} title="Импортировать проект из файла">
                ⭱ Импорт
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
              {isPasswordSet && (
                <>
                  <button
                    type="button"
                    className="chronoline-runtime__auth-button"
                    onClick={() => setPasswordPromptMode('change')}
                    title="Сменить пароль"
                  >
                    🔒 Сменить пароль
                  </button>
                  <button
                    type="button"
                    className="chronoline-runtime__auth-button"
                    onClick={handleLockEditing}
                    title="Заблокировать редактирование сейчас"
                  >
                    🔒 Заблокировать
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              type="button"
              className="chronoline-runtime__auth-button"
              onClick={() => setPasswordPromptMode(isPasswordSet ? 'unlock' : 'setup')}
            >
              {isPasswordSet ? '🔒 Разблокировать редактирование' : '🔓 Установить пароль'}
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
          onAddTimeline={canEdit ? handleAddTimeline : undefined}
          onDeleteTimeline={canEdit ? handleDeleteTimeline : undefined}
          onOpenTimelineSettings={canEdit ? setAttributeSettingsTimelineId : undefined}
          onEventMoved={canEdit ? handleEventMoved : undefined}
          onAddEventRequested={canEdit ? setAddEventTimelineId : undefined}
          onPasteEvent={canEdit && eventClipboard ? handlePasteEvent : undefined}
          mediaCatalog={project.media}
          getMediaUrl={(media) => mediaUrl(project.id, media)}
        />
        {addEventTimeline && (
          <AddEventForm
            timelineName={addEventTimeline.name}
            onSubmit={handleAddEventSubmit}
            onCancel={() => setAddEventTimelineId(null)}
          />
        )}
        {selectedEventInfo && (
          <EventDetailCard
            // Перемонтируем карточку при переходе по ссылке eventLink на
            // другое событие - её внутреннее состояние (name/place/... через
            // useState) иначе инициализировалось бы только один раз и не
            // подхватило бы данные нового события при смене одного и того
            // же React-элемента.
            key={selectedEventInfo.event.id}
            event={selectedEventInfo.event}
            timeline={selectedEventInfo.timeline}
            canEdit={canEdit}
            mediaCatalog={project.media}
            getMediaUrl={(media) => mediaUrl(project.id, media)}
            allEvents={allEventsForLinking}
            onNavigateToEvent={setSelectedEventId}
            onImportMedia={handleImportMediaForEvent}
            onSave={handleEventDetailSave}
            onDelete={handleEventDetailDelete}
            onCopy={canEdit ? handleCopyEvent : undefined}
            onClose={() => setSelectedEventId(null)}
          />
        )}
        {attributeSettingsTimeline && (
          <TimelineSettings
            timeline={attributeSettingsTimeline}
            onAddAttribute={handleAddAttribute}
            onRenameAttribute={handleRenameAttribute}
            onDeleteAttribute={handleDeleteAttribute}
            onChangeColor={handleChangeTimelineColor}
            onClose={() => setAttributeSettingsTimelineId(null)}
          />
        )}
        {passwordPromptMode && (
          <PasswordPrompt
            mode={passwordPromptMode}
            onSubmit={handlePasswordSubmit}
            onSuccess={handlePasswordSuccess}
            onCancel={() => setPasswordPromptMode(null)}
            onForgotPassword={passwordPromptMode === 'unlock' ? () => setPasswordPromptMode('reset') : undefined}
            resetInfo={resetInfo}
          />
        )}
      </div>
    </div>
  );
};

export default ChronolineRuntime;
