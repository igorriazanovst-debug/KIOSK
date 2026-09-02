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
import type { ChronoProject, ChronolineWidgetProperties, TimelineEvent, ChronoMedia, Viewport } from '@kiosk/shared';
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
  setBackgroundMedia,
  deleteMedia,
  type AttributeDef,
} from '@kiosk/shared';
import BoardView, { type BoardViewProps } from '@kiosk/chrono-ui/board/BoardView';
import { computeInitialViewport } from '@kiosk/chrono-ui/board/initialViewport';
import AddEventForm, { type AddEventFormResult } from './AddEventForm.tsx';
import PromptDialog from './PromptDialog.tsx';
import EventDetailCard, { type EventDetailPatch } from './EventDetailCard.tsx';
import TimelineSettings from './TimelineSettings.tsx';
import MediaLibraryPanel from './MediaLibraryPanel.tsx';
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

// Замена window.prompt() (см. PromptDialog.tsx) - какое из трёх текстовых
// действий сейчас открыто, чтобы один общий обработчик submit знал, что
// делать со введённым значением.
type PromptRequest =
  | { kind: 'create-project' }
  | { kind: 'rename-project'; initialValue: string }
  | { kind: 'add-timeline' };

const TOOLBAR_HEIGHT = 36;
const SAVED_INDICATOR_FADE_MS = 2000;
// Ширина сайдбара имён линий - `@kiosk/chrono-ui`'s BoardView.css,
// `.chrono-board__sidebar { width: 140px }`. Не переиспользуем оттуда
// напрямую (там это чистое CSS-число, JS-константы нет) - дублирование
// зафиксировано явно здесь, а не спрятано. Без вычитания этой ширины
// `.chrono-board__main` (дорожки событий) рендерился на 140px шире
// реально видимой области - кнопка «+ добавить событие», закреплённая
// правым краем дорожки, оказывалась физически недостижима (обрезана
// overflow:hidden). Найдено вживую при первом реальном запуске в Electron.
const BOARD_SIDEBAR_WIDTH_PX = 140;
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
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryAdding, setMediaLibraryAdding] = useState(false);
  // FR-019 ТЗ ("одновременный просмотр... из не менее чем 2-х
  // хронологических линиях") - клик на событие ДОБАВЛЯЕТ его карточку к
  // уже открытым, не заменяет их (см. handleSelectEvent ниже). selectedEventId
  // остаётся отдельно - только для подсветки последней кликнутой отметки на
  // доске (BoardView не знает про множественный выбор карточек вообще).
  // Хук обязан стоять здесь, ДО ранних return (loading/unavailable/error/
  // !viewport) ниже по функции - иначе число вызванных хуков расходится
  // между рендером-заглушкой и обычным рендером (React error #310),
  // найдено вживую при первом реальном запуске в Electron.
  const [openCardEventIds, setOpenCardEventIds] = useState<string[]>([]);
  const [promptRequest, setPromptRequest] = useState<PromptRequest | null>(null);

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
        setViewport(resolveViewport(project, width - BOARD_SIDEBAR_WIDTH_PX));
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
    setViewport(resolveViewport(next, width - BOARD_SIDEBAR_WIDTH_PX));
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

  const handleCreateProject = () => setPromptRequest({ kind: 'create-project' });

  const handleRenameProject = () => setPromptRequest({ kind: 'rename-project', initialValue: project.name });

  const submitCreateProject = (name: string) => {
    window.chronoAPI
      ?.createProject(name)
      .then((created) => Promise.all([window.chronoAPI!.loadProjectData(created.id), window.chronoAPI!.listProjects()]))
      .then(([next, list]) => openProject(next, list))
      .catch((err: unknown) => handleMutatingIpcError(err, 'Не удалось создать проект'));
  };

  const submitRenameProject = (name: string) => {
    if (name === project.name) return;
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

  const handleAddTimeline = () => setPromptRequest({ kind: 'add-timeline' });

  const submitAddTimeline = (name: string) => {
    applyMutation(addTimeline(project, crypto.randomUUID(), name));
  };

  const handlePromptSubmit = (value: string) => {
    const request = promptRequest;
    setPromptRequest(null);
    if (!request) return;
    switch (request.kind) {
      case 'create-project':
        submitCreateProject(value);
        break;
      case 'rename-project':
        submitRenameProject(value);
        break;
      case 'add-timeline':
        submitAddTimeline(value);
        break;
    }
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
        color: result.color,
        fontColor: result.fontColor,
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

  const findEventInfo = (eventId: string) => {
    for (const timeline of project.timelines) {
      const event = timeline.events.find((e) => e.id === eventId);
      if (event) return { timeline, event };
    }
    return undefined;
  };

  const handleSelectEvent = (eventId: string | null) => {
    if (eventId === null) {
      setSelectedEventId(null);
      setOpenCardEventIds([]);
      return;
    }
    setSelectedEventId(eventId);
    setOpenCardEventIds((ids) => (ids.includes(eventId) ? ids : [...ids, eventId]));
  };

  const closeCard = (eventId: string) => setOpenCardEventIds((ids) => ids.filter((id) => id !== eventId));

  // FR-032 ТЗ: пикер ссылки на событие в EventDetailCard - по ВСЕМ линиям
  // проекта (строка 34 ТЗ), не только текущей. Одна и та же ОБЩАЯ
  // (неотфильтрованная) выборка передаётся всем одновременно открытым
  // карточкам - каждая карточка сама убирает из неё СВОЙ id (см.
  // EventDetailCard.tsx), т.к. у разных карточек он разный.
  const allEventsForLinking = project.timelines.flatMap((t) =>
    t.events.map((e) => ({ id: e.id, name: e.name, timelineName: t.name }))
  );

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

  // FR-035 ТЗ - единое фоновое изображение хронолинии, тот же
  // pick+import-поток, что и у медиа события (handleImportMediaForEvent),
  // только результат идёт в project.backgroundMediaId, а не в mediaIds
  // конкретного события.
  const backgroundMedia = project.backgroundMediaId
    ? project.media.find((m) => m.id === project.backgroundMediaId) ?? null
    : null;

  const handleSetBackgroundImage = async () => {
    const filePath = await window.chronoAPI?.pickMediaFile();
    if (!filePath) return;
    try {
      const imported = await window.chronoAPI!.importMedia(project.id, filePath);
      const { project: withMedia, media } = addMedia(project, imported);
      applyMutation(setBackgroundMedia(withMedia, media.id));
    } catch (err) {
      handleMutatingIpcError(err, 'Не удалось задать фоновое изображение');
    }
  };

  const handleClearBackgroundImage = () => applyMutation(setBackgroundMedia(project, null));

  // FR-020 ТЗ - добавление в медиатеку НЕ привязано к конкретному событию
  // (в отличие от handleImportMediaForEvent) - файл просто попадает в
  // project.media[], прикрепить его к событию можно позже через обычный
  // выбор в EventDetailCard.
  const handleAddLibraryMedia = async () => {
    const filePath = await window.chronoAPI?.pickMediaFile();
    if (!filePath) return;
    setMediaLibraryAdding(true);
    try {
      const imported = await window.chronoAPI!.importMedia(project.id, filePath);
      const { project: updatedProject } = addMedia(project, imported);
      applyMutation(updatedProject);
    } catch (err) {
      handleMutatingIpcError(err, 'Не удалось добавить файл в медиатеку');
    } finally {
      setMediaLibraryAdding(false);
    }
  };

  // Сначала убираем запись из content.json (обычный applyMutation - с тем
  // же индикатором/повтором, что и у любой другой правки), и только потом
  // физически удаляем файл - обратный порядок оставлял бы окно, где
  // content.json ссылается на уже не существующий файл.
  const handleDeleteLibraryMedia = (m: ChronoMedia) => {
    applyMutation(deleteMedia(project, m.id));
    window.chronoAPI?.deleteMedia(project.id, { sha256: m.sha256, fileName: m.fileName }).catch(() => {
      // Тихая деградация - осиротевший файл на диске не теряет пользовательский контент.
    });
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
              <button type="button" onClick={handleSetBackgroundImage} title="Задать фоновое изображение хронолинии">
                🖼 Фон
              </button>
              {backgroundMedia && (
                <button type="button" onClick={handleClearBackgroundImage} title="Убрать фоновое изображение">
                  🖼 ×
                </button>
              )}
              <button type="button" onClick={() => setMediaLibraryOpen(true)} title="Медиатека проекта">
                🗂 Медиатека
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
              {isPasswordSet ? (
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
              ) : (
                // Найдено вживую: пока пароль не задан, canEdit ВСЕГДА true
                // (редактирование разрешено без пароля) - точка входа в
                // установку пароля обязана быть здесь, в ветке
                // "редактирование разрешено", а не в противоположной ветке
                // "редактирование заблокировано" (там она была физически
                // недостижима: canEdit становится false только когда пароль
                // уже задан и сессия заблокирована - обратное состояние).
                <button
                  type="button"
                  className="chronoline-runtime__auth-button"
                  onClick={() => setPasswordPromptMode('setup')}
                  title="Установить пароль для локального редактирования"
                >
                  🔓 Установить пароль
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="chronoline-runtime__auth-button"
              onClick={() => setPasswordPromptMode('unlock')}
            >
              🔒 Разблокировать редактирование
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
          onSelectEvent={handleSelectEvent}
          onAddTimeline={canEdit ? handleAddTimeline : undefined}
          onDeleteTimeline={canEdit ? handleDeleteTimeline : undefined}
          onOpenTimelineSettings={canEdit ? setAttributeSettingsTimelineId : undefined}
          onEventMoved={canEdit ? handleEventMoved : undefined}
          onAddEventRequested={canEdit ? setAddEventTimelineId : undefined}
          onPasteEvent={canEdit && eventClipboard ? handlePasteEvent : undefined}
          mediaCatalog={project.media}
          getMediaUrl={(media) => mediaUrl(project.id, media)}
          backgroundImageUrl={backgroundMedia ? mediaUrl(project.id, backgroundMedia) : undefined}
        />
        {addEventTimeline && (
          <AddEventForm
            timelineName={addEventTimeline.name}
            onSubmit={handleAddEventSubmit}
            onCancel={() => setAddEventTimelineId(null)}
          />
        )}
        {openCardEventIds.length > 0 && (
          // FR-019 ТЗ - overlay/раскладка в ряд здесь, НЕ внутри
          // EventDetailCard (см. её заголовочный комментарий) - иначе 2+
          // одновременно открытые карточки рисовались бы каждая своим
          // полноэкранным overlay друг поверх друга.
          <div
            className="chrono-event-detail__overlay"
            onClick={() => {
              setSelectedEventId(null);
              setOpenCardEventIds([]);
            }}
          >
            <div className="chrono-event-detail__stack" onClick={(e) => e.stopPropagation()}>
              {openCardEventIds.map((eventId) => {
                const info = findEventInfo(eventId);
                if (!info) return null;
                return (
                  <EventDetailCard
                    key={eventId}
                    event={info.event}
                    timeline={info.timeline}
                    canEdit={canEdit}
                    mediaCatalog={project.media}
                    getMediaUrl={(media) => mediaUrl(project.id, media)}
                    allEvents={allEventsForLinking}
                    onNavigateToEvent={handleSelectEvent}
                    onImportMedia={handleImportMediaForEvent}
                    onSave={(patch) => {
                      applyMutation(updateEvent(project, info.timeline.id, info.event.id, patch));
                      closeCard(eventId);
                    }}
                    onDelete={() => {
                      if (!window.confirm(`Удалить событие «${info.event.name}»?`)) return;
                      applyMutation(deleteEvent(project, info.timeline.id, info.event.id));
                      closeCard(eventId);
                    }}
                    onCopy={canEdit ? () => setEventClipboard(info.event) : undefined}
                    onClose={() => closeCard(eventId)}
                  />
                );
              })}
            </div>
          </div>
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
        {mediaLibraryOpen && (
          <MediaLibraryPanel
            media={project.media}
            getMediaUrl={(m) => mediaUrl(project.id, m)}
            onAdd={handleAddLibraryMedia}
            adding={mediaLibraryAdding}
            onDelete={handleDeleteLibraryMedia}
            onClose={() => setMediaLibraryOpen(false)}
          />
        )}
        {promptRequest && (
          <PromptDialog
            title={
              promptRequest.kind === 'create-project'
                ? 'Название нового проекта'
                : promptRequest.kind === 'rename-project'
                  ? 'Новое название проекта'
                  : 'Название линии'
            }
            initialValue={promptRequest.kind === 'rename-project' ? promptRequest.initialValue : ''}
            onSubmit={handlePromptSubmit}
            onCancel={() => setPromptRequest(null)}
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
