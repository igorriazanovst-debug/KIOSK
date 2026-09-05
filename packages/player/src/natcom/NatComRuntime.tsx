// packages/player/src/natcom/NatComRuntime.tsx
// Экран виджета «Конструктор природных сообществ» (Тип 5) на самом
// учительском ПК, пока встроенный сервер (packages/player/electron/natcom/server.js)
// обслуживает браузеры остальных устройств школьной сети.
//
// Тип5_бэклог.md, T5-050: роутинг Home/Editor/Player/Help. Editor и Player -
// пока заглушки (Эпики 7/8 ещё не реализованы), Home и Help - рабочие
// (T5-051/T5-052).
//
// Что именно здесь должно быть дальше (пульт управления классом vs
// полноценный редактор/плеер) — открытый вопрос №11 плана, решается при
// проектировании Эпика 8 (клиент-плеер).

import React, { useCallback, useEffect, useState } from 'react';
import type { NatComWidgetProperties, NatComLibrary, NatComProject } from '@kiosk/shared';
import HomeScreen from './screens/HomeScreen';
import HelpScreen from './screens/HelpScreen';
import EditorScreen from './editor/EditorScreen';
import './NatComRuntime.css';

interface Props {
  properties: NatComWidgetProperties;
}

type View = 'home' | 'editor' | 'player' | 'help';

const NatComRuntime: React.FC<Props> = ({ properties }) => {
  const [view, setView] = useState<View>('home');
  const [serverInfo, setServerInfo] = useState<{ port: number | null; addresses: string[] } | null>(null);
  const [library, setLibrary] = useState<NatComLibrary | null>(null);
  const [context, setContext] = useState<{ ownerId: string; organizationId: string } | null>(null);
  const [projects, setProjects] = useState<NatComProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    if (!window.natcomAPI) return;
    setIsLoadingProjects(true);
    try {
      const list = await window.natcomAPI.listProjects();
      setProjects(list);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (!window.natcomAPI) return;
    let cancelled = false;
    window.natcomAPI.getServerInfo().then((info) => { if (!cancelled) setServerInfo(info); });
    window.natcomAPI.getLibrary().then((lib) => { if (!cancelled) setLibrary(lib); });
    window.natcomAPI.getContext().then((ctx) => { if (!cancelled) setContext(ctx); });
    refreshProjects();
    return () => { cancelled = true; };
  }, [refreshProjects]);

  // Возврат на Home (кнопка «Главная» из редактора, «Сохранить как…») может
  // означать, что список презентаций устарел - EditorScreen создаёт новую
  // презентацию через свой собственный window.natcomAPI.createProject(),
  // в обход handleCreate/refreshProjects этого компонента.
  useEffect(() => {
    if (view === 'home') refreshProjects();
  }, [view, refreshProjects]);

  const handleCreate = useCallback(async (title: string, backgroundId: string) => {
    if (!window.natcomAPI || !context) return;
    setIsCreating(true);
    try {
      await window.natcomAPI.createProject({
        title,
        backgroundId,
        ownerId: context.ownerId,
        organizationId: context.organizationId
      });
      await refreshProjects();
    } finally {
      setIsCreating(false);
    }
  }, [context, refreshProjects]);

  const handleDelete = useCallback(async (projectId: string) => {
    if (!window.natcomAPI) return;
    await window.natcomAPI.deleteProject(projectId);
    await refreshProjects();
  }, [refreshProjects]);

  const handleOpen = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setView('editor');
  }, []);

  const renderContent = () => {
    if (view === 'help') return <HelpScreen />;
    if (view === 'editor') {
      if (!activeProjectId || !library) {
        return (
          <div className="natcom-runtime__stub">
            <p>{!library ? 'Библиотека не загружена — редактор недоступен.' : 'Презентация не выбрана.'}</p>
          </div>
        );
      }
      return <EditorScreen key={activeProjectId} projectId={activeProjectId} library={library} onBack={() => setView('home')} />;
    }
    if (view === 'player') {
      return (
        <div className="natcom-runtime__stub">
          <p>Экран «Плеер» ещё в разработке.</p>
          <p className="natcom-runtime__stub-id">Презентация: {activeProjectId}</p>
        </div>
      );
    }
    return (
      <HomeScreen
        library={library}
        projects={projects}
        isLoading={isLoadingProjects}
        isCreating={isCreating}
        onCreate={handleCreate}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
    );
  };

  // Editor управляет своей собственной шапкой (заголовок проекта, кнопка
  // «Главная», режимы) - внешний natcom-runtime__bar только отнимал бы
  // высоту экрана без пользы.
  if (view === 'editor') {
    return <div className="natcom-runtime">{renderContent()}</div>;
  }

  return (
    <div className="natcom-runtime">
      <header className="natcom-runtime__bar">
        <h1 className="natcom-runtime__title">{properties.title || 'Конструктор природных сообществ'}</h1>
        <nav className="natcom-runtime__nav">
          <button
            className={`natcom-runtime__nav-button ${view === 'home' ? 'natcom-runtime__nav-button--active' : ''}`}
            onClick={() => setView('home')}
          >
            Главная
          </button>
          <button
            className={`natcom-runtime__nav-button ${view === 'help' ? 'natcom-runtime__nav-button--active' : ''}`}
            onClick={() => setView('help')}
          >
            Справка
          </button>
        </nav>
        {!window.natcomAPI ? (
          <span className="natcom-runtime__status natcom-runtime__status--error">Сервер недоступен</span>
        ) : serverInfo && serverInfo.addresses.length > 0 ? (
          <span className="natcom-runtime__status">
            <code>http://{serverInfo.addresses[0]}:{serverInfo.port}/</code>
          </span>
        ) : null}
      </header>
      {renderContent()}
    </div>
  );
};

export default NatComRuntime;
