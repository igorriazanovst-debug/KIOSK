// packages/player/src/natcom/screens/HomeScreen.tsx
// Тип5_бэклог.md, T5-051: список презентаций (пока без учёта роли/организации -
// Эпик 5 ещё не реализован, см. открытый вопрос №3), создать новую, открыть.

import React, { useEffect, useState } from 'react';
import type { NatComLibrary, NatComProject } from '@kiosk/shared';
import './screens.css';

interface Props {
  library: NatComLibrary | null;
  projects: NatComProject[];
  isLoading: boolean;
  isCreating: boolean;
  isImporting: boolean;
  onCreate: (title: string, backgroundId: string) => Promise<void>;
  onOpenEditor: (projectId: string) => void;
  onOpenPlayer: (projectId: string) => void;
  onDelete: (projectId: string) => Promise<void>;
  onImport: () => Promise<void>;
  onExport: (projectId: string) => Promise<void>;
}

const HomeScreen: React.FC<Props> = ({
  library,
  projects,
  isLoading,
  isCreating,
  isImporting,
  onCreate,
  onOpenEditor,
  onOpenPlayer,
  onDelete,
  onImport,
  onExport,
}) => {
  const [title, setTitle] = useState('');
  const [backgroundId, setBackgroundId] = useState('');

  // library загружается асинхронно и приходит уже ПОСЛЕ первого рендера
  // HomeScreen — значение по умолчанию для select нужно проставить, когда
  // оно реально появится, не только один раз в useState-инициализаторе.
  useEffect(() => {
    if (library && !backgroundId) {
      setBackgroundId(library.backgrounds[0]?.id ?? '');
    }
  }, [library, backgroundId]);

  const canCreate = title.trim().length > 0 && backgroundId && !isCreating;

  const handleCreate = async () => {
    if (!canCreate) return;
    await onCreate(title.trim(), backgroundId);
    setTitle('');
  };

  return (
    <div className="natcom-screen">
      <section className="natcom-screen__panel">
        <h2 className="natcom-screen__heading">Новая презентация</h2>
        {!library ? (
          <p className="natcom-screen__hint natcom-screen__hint--error">
            Библиотека фонов/объектов не найдена — создание новой презентации недоступно.
          </p>
        ) : (
          <div className="natcom-screen__form">
            <input
              className="natcom-screen__input"
              type="text"
              placeholder="Название презентации"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
            />
            <select
              className="natcom-screen__input"
              value={backgroundId}
              onChange={(e) => setBackgroundId(e.target.value)}
              disabled={isCreating}
            >
              {library.backgrounds.map((bg) => (
                <option key={bg.id} value={bg.id}>{bg.name}</option>
              ))}
            </select>
            <button className="natcom-screen__button" onClick={handleCreate} disabled={!canCreate}>
              {isCreating ? 'Создание…' : 'Создать'}
            </button>
          </div>
        )}
        <button className="natcom-screen__import" onClick={onImport} disabled={isImporting}>
          {isImporting ? 'Импорт…' : 'Импортировать презентацию…'}
        </button>
      </section>

      <section className="natcom-screen__panel">
        <h2 className="natcom-screen__heading">Презентации</h2>
        {isLoading ? (
          <p className="natcom-screen__hint">Загрузка…</p>
        ) : projects.length === 0 ? (
          <p className="natcom-screen__hint">Пока нет ни одной презентации.</p>
        ) : (
          <ul className="natcom-screen__list">
            {projects.map((project) => (
              <li key={project.id} className="natcom-screen__list-item">
                <button className="natcom-screen__list-title" onClick={() => onOpenEditor(project.id)}>
                  {project.title || 'Без названия'}
                </button>
                <button
                  className="natcom-screen__list-play"
                  onClick={() => onOpenPlayer(project.id)}
                  title="Открыть в плеере"
                >
                  Плеер
                </button>
                <button
                  className="natcom-screen__list-export"
                  onClick={() => onExport(project.id)}
                  title="Экспортировать презентацию в файл"
                >
                  Экспорт
                </button>
                <button
                  className="natcom-screen__list-delete"
                  onClick={() => onDelete(project.id)}
                  title="Удалить презентацию"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default HomeScreen;
