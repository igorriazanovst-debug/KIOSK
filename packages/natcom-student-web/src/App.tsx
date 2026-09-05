// packages/natcom-student-web/src/App.tsx
// Веб-клиент ученика (Тип5_бэклог.md, Эпик 8.1, T5-074/075): подключается к
// встроенному серверу (Тип5_план_реализации.md, раздел 1) по тому же
// origin, откуда сам загружен - никакого адреса вводить не нужно, страница
// уже открыта по IP учительского ПК.
//
// Поток: подключиться по socket.io -> join (ёмкость, Эпик 4) -> если принят,
// узнать текущую активную презентацию (GET /api/active-project) и следить
// за 'activeProjectChanged' (педагог открыл/закрыл экран «Плеер», Эпик 8).

import React, { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { NatComLibrary, NatComProject } from '@kiosk/shared';
import StudentStage from './StudentStage';
import StudentDetailCard from './StudentDetailCard';
import { resolveMediaUrl } from './mediaUrl';
import './app.css';

type JoinState = 'connecting' | 'accepted' | 'rejected';

const App: React.FC = () => {
  const [library, setLibrary] = useState<NatComLibrary | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [joinState, setJoinState] = useState<JoinState>('connecting');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<NatComProject | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [boardSize, setBoardSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetch('/api/library')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Библиотека недоступна'))))
      .then(setLibrary)
      .catch((err) => setLibraryError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    const socket = io({ reconnection: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', {}, (ack: { accepted: boolean; reason?: string }) => {
        setJoinState(ack.accepted ? 'accepted' : 'rejected');
      });
    });

    socket.on('activeProjectChanged', (payload: { projectId: string | null }) => {
      setActiveProjectId(payload.projectId);
      setSelectedObjectId(null);
    });

    fetch('/api/active-project')
      .then((r) => r.json())
      .then((payload: { projectId: string | null }) => setActiveProjectId(payload.projectId))
      .catch(() => {});

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(activeProjectId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Презентация недоступна'))))
      .then((loaded) => {
        if (!cancelled) setProject(loaded);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  useEffect(() => {
    const onResize = () => setBoardSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (libraryError) {
    return <div className="student-app__message">Ошибка: {libraryError}</div>;
  }
  if (joinState === 'rejected') {
    return <div className="student-app__message">Класс заполнен — попробуйте подключиться позже.</div>;
  }
  if (!library || joinState === 'connecting') {
    return <div className="student-app__message">Подключение…</div>;
  }
  if (!activeProjectId || !project) {
    return <div className="student-app__message">Ожидание презентации от учителя…</div>;
  }

  const background = library.backgrounds.find((b) => b.id === project.backgroundId);
  const backgroundUrl = resolveMediaUrl(library, background?.imageMediaId);
  const selectedObject = project.objects.find((o) => o.id === selectedObjectId) ?? null;

  return (
    <div className="student-app">
      <StudentStage
        library={library}
        backgroundUrl={backgroundUrl}
        objects={project.objects}
        boardWidthPx={boardSize.width}
        boardHeightPx={boardSize.height}
        onObjectClick={setSelectedObjectId}
      />
      {selectedObject && (
        <StudentDetailCard library={library} object={selectedObject} onClose={() => setSelectedObjectId(null)} />
      )}
    </div>
  );
};

export default App;
