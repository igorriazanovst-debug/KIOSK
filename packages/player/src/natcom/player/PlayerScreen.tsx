// packages/player/src/natcom/player/PlayerScreen.tsx
// Экран Player виджета (Тип5_бэклог.md, Эпик 8) - локальный, на устройстве
// педагога (открытый вопрос №11 плана решён 2026-09-05: тот же нативный
// NatComRuntime, без отдельного «пульта управления»). Полноэкранный
// read-only показ готовой презентации + карточка объекта по клику.
//
// НЕ веб-клиент ученика (браузер) - см. Эпик 8.1 бэклога, отдельная,
// технически иная задача (нет Electron IPC/protocol-хендлеров в браузере).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NatComLibrary, NatComProject } from '@kiosk/shared';
import PlayerStage from './PlayerStage';
import ObjectDetailCard from './ObjectDetailCard';
import { resolveMediaUrl } from '../mediaUrl';
import './player.css';

const MIN_BOARD_SIZE = 1;

interface PlayerScreenProps {
  projectId: string;
  library: NatComLibrary;
}

const PlayerScreen: React.FC<PlayerScreenProps> = ({ projectId, library }) => {
  const [project, setProject] = useState<NatComProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Callback-ref, не useRef+useEffect([]) - см. тот же баг/фикс, что в
  // EditorScreen.tsx (Эпик 7): на первом рендере (пока project не
  // загружен) этот div ещё не существует.
  const wrapperCallbackRef = useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setBoardSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, []);

  useEffect(() => {
    if (!window.natcomAPI) return;
    let cancelled = false;
    window.natcomAPI
      .loadProject(projectId)
      .then((loaded) => {
        if (!cancelled) setProject(loaded);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить презентацию');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Сообщает встроенному серверу, какую презентацию сейчас показывает
  // педагог - веб-клиент ученика (Эпик 8.1) читает это через
  // GET /api/active-project + событие 'activeProjectChanged'. Очищается
  // при уходе с экрана (Home/другая презентация) - иначе браузеры учеников
  // продолжали бы видеть уже закрытую презентацию.
  useEffect(() => {
    if (!window.natcomAPI) return;
    window.natcomAPI.setActiveProject(projectId);
    return () => {
      window.natcomAPI?.setActiveProject(null);
    };
  }, [projectId]);

  if (loadError) {
    return <p className="natcom-player__error">Ошибка загрузки: {loadError}</p>;
  }
  if (!project) {
    return <div className="natcom-player" />;
  }

  const background = library.backgrounds.find((b) => b.id === project.backgroundId);
  const backgroundUrl = resolveMediaUrl(library, background?.imageMediaId);
  const boardReady = boardSize.width >= MIN_BOARD_SIZE && boardSize.height >= MIN_BOARD_SIZE;
  const selectedObject = project.objects.find((o) => o.id === selectedObjectId) ?? null;

  return (
    <div className="natcom-player" ref={wrapperCallbackRef}>
      {boardReady && (
        <PlayerStage
          library={library}
          backgroundUrl={backgroundUrl}
          objects={project.objects}
          boardWidthPx={boardSize.width}
          boardHeightPx={boardSize.height}
          onObjectClick={setSelectedObjectId}
        />
      )}
      {selectedObject && (
        <ObjectDetailCard library={library} object={selectedObject} onClose={() => setSelectedObjectId(null)} />
      )}
    </div>
  );
};

export default PlayerScreen;
