// packages/player/src/natcom/editor/EditorScreen.tsx
// Экран Editor виджета «Конструктор природных сообществ» (Тип5_бэклог.md,
// Эпик 7): загружает презентацию, держит историю изменений (history.ts
// Хронолайнера - тот же generic-паттерн initHistory/push/undo/redo),
// собирает Workspace/ObjectRibbon/EditorToolbar/ObjectEditPanel.
//
// "Доска" измеряется реальным размером контейнера (ResizeObserver) - не
// фиксированный аспект, см. Workspace.tsx.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NatComLibrary, NatComProject, ProjectObject } from '@kiosk/shared';
import { toFractionalRect, toPixelRect } from '@kiosk/shared';
import { initHistory, pushHistory, undo, canUndo, type History } from '../../chrono/history';
import PromptDialog from '../../chrono/PromptDialog';
import Workspace, { type EditorMode } from './Workspace';
import EditorToolbar from './EditorToolbar';
import ObjectRibbon from './ObjectRibbon';
import ObjectEditPanel from './ObjectEditPanel';
import { resolveMediaUrl } from '../mediaUrl';
import './editor.css';

const DEFAULT_OBJECT_SIZE_FRACTION = 0.12;
const MIN_BOARD_SIZE = 1;

interface EditorScreenProps {
  projectId: string;
  library: NatComLibrary;
  onBack: () => void;
}

function clampFraction(value: number, sizeFraction: number): number {
  return Math.min(Math.max(value, 0), Math.max(0, 1 - sizeFraction));
}

const EditorScreen: React.FC<EditorScreenProps> = ({ projectId, library, onBack }) => {
  const [project, setProject] = useState<NatComProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [history, setHistory] = useState<History<ProjectObject[]> | null>(null);
  const [mode, setMode] = useState<EditorMode>('drag');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveAsPrompt, setShowSaveAsPrompt] = useState(false);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Callback-ref, не useRef+useEffect(-,[]) - на первом рендере (пока
  // project/history ещё не загружены) рендерится другая ветка JSX без этого
  // div вовсе, и эффект с пустыми deps успевает отработать ДО того, как
  // реальный узел появится - ResizeObserver навсегда остаётся не привязан.
  // Callback-ref вызывается именно в момент монтирования/размонтирования
  // узла, независимо от того, в каком рендере это произошло.
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
        if (cancelled) return;
        setProject(loaded);
        setTitle(loaded.title);
        setHistory(initHistory(loaded.objects));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить презентацию');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);


  const objects = history?.present ?? [];
  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? null;

  const applyObjects = useCallback((next: ProjectObject[]) => {
    setHistory((prev) => (prev ? pushHistory(prev, next) : prev));
  }, []);

  const handleAddObject = useCallback(
    (libraryObjectId: string, centerXFraction?: number, centerYFraction?: number) => {
      const size = DEFAULT_OBJECT_SIZE_FRACTION;
      const cx = centerXFraction ?? 0.5;
      const cy = centerYFraction ?? 0.5;
      const newObject: ProjectObject = {
        id: crypto.randomUUID(),
        libraryObjectId,
        xFraction: clampFraction(cx - size / 2, size),
        yFraction: clampFraction(cy - size / 2, size),
        widthFraction: size,
        heightFraction: size,
        rotation: 0,
        flip: false,
      };
      applyObjects([...objects, newObject]);
      setSelectedObjectId(newObject.id);
    },
    [objects, applyObjects]
  );

  const handleObjectMoved = useCallback(
    (id: string, xPx: number, yPx: number) => {
      if (boardSize.width < MIN_BOARD_SIZE || boardSize.height < MIN_BOARD_SIZE) return;
      const current = objects.find((o) => o.id === id);
      if (!current) return;
      const px = toPixelRect(current, boardSize.width, boardSize.height);
      const fractional = toFractionalRect({ x: xPx, y: yPx, width: px.width, height: px.height }, boardSize.width, boardSize.height);
      applyObjects(objects.map((o) => (o.id === id ? { ...o, ...fractional } : o)));
    },
    [objects, applyObjects, boardSize]
  );

  const handleObjectTransformed = useCallback(
    (id: string, xPx: number, yPx: number, widthPx: number, heightPx: number, rotation: number, flip: boolean) => {
      if (boardSize.width < MIN_BOARD_SIZE || boardSize.height < MIN_BOARD_SIZE) return;
      const fractional = toFractionalRect({ x: xPx, y: yPx, width: widthPx, height: heightPx }, boardSize.width, boardSize.height);
      applyObjects(objects.map((o) => (o.id === id ? { ...o, ...fractional, rotation, flip } : o)));
    },
    [objects, applyObjects, boardSize]
  );

  const handleFlipSelected = useCallback(() => {
    if (!selectedObjectId) return;
    applyObjects(objects.map((o) => (o.id === selectedObjectId ? { ...o, flip: !o.flip } : o)));
  }, [selectedObjectId, objects, applyObjects]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedObjectId) return;
    applyObjects(objects.filter((o) => o.id !== selectedObjectId));
    setSelectedObjectId(null);
  }, [selectedObjectId, objects, applyObjects]);

  const handleEditPanelChange = useCallback(
    (patch: Partial<Pick<ProjectObject, 'titleOverride' | 'descriptionOverride'>>) => {
      if (!selectedObjectId) return;
      applyObjects(objects.map((o) => (o.id === selectedObjectId ? { ...o, ...patch } : o)));
    },
    [selectedObjectId, objects, applyObjects]
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => (prev ? undo(prev) : prev));
  }, []);

  const handleSave = useCallback(async () => {
    if (!project || !window.natcomAPI) return;
    setIsSaving(true);
    try {
      const updated = { ...project, title, objects };
      const saved = await window.natcomAPI.saveProject(project.id, updated);
      setProject(saved);
    } catch (err) {
      window.alert('Не удалось сохранить: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  }, [project, title, objects]);

  const handleSaveAs = useCallback(
    async (newTitle: string) => {
      if (!project || !window.natcomAPI) return;
      setIsSaving(true);
      try {
        const created = await window.natcomAPI.createProject({
          title: newTitle,
          backgroundId: project.backgroundId,
          ownerId: project.ownerId,
          organizationId: project.organizationId,
        });
        await window.natcomAPI.saveProject(created.id, { ...created, objects });
        window.alert(`Презентация «${newTitle}» сохранена.`);
        onBack();
      } catch (err) {
        window.alert('Не удалось сохранить копию: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsSaving(false);
        setShowSaveAsPrompt(false);
      }
    },
    [project, objects, onBack]
  );

  if (loadError) {
    return (
      <div className="natcom-editor">
        <div className="natcom-editor-toolbar">
          <button className="natcom-editor-toolbar__back" onClick={onBack}>
            ← Главная
          </button>
        </div>
        <p style={{ padding: 24 }}>Ошибка загрузки: {loadError}</p>
      </div>
    );
  }

  if (!project || !history) {
    return <div className="natcom-editor" />;
  }

  const background = library.backgrounds.find((b) => b.id === project.backgroundId);
  const backgroundUrl = resolveMediaUrl(library, background?.imageMediaId);
  const boardReady = boardSize.width >= MIN_BOARD_SIZE && boardSize.height >= MIN_BOARD_SIZE;

  return (
    <div className="natcom-editor">
      <EditorToolbar
        title={title}
        onTitleChange={setTitle}
        mode={mode}
        onModeChange={(next) => {
          setMode(next);
          if (next === 'play') setSelectedObjectId(null);
        }}
        canUndo={canUndo(history)}
        onUndo={handleUndo}
        onSave={handleSave}
        onSaveAs={() => setShowSaveAsPrompt(true)}
        isSaving={isSaving}
        hasSelection={!!selectedObject}
        onFlip={handleFlipSelected}
        onDelete={handleDeleteSelected}
        onBack={onBack}
      />
      <div className="natcom-editor__body">
        <div className="natcom-editor__stage-column">
          <div className="natcom-workspace-wrapper" ref={wrapperCallbackRef}>
            {boardReady && (
              <Workspace
                library={library}
                backgroundUrl={backgroundUrl}
                objects={objects}
                mode={mode}
                selectedObjectId={selectedObjectId}
                boardWidthPx={boardSize.width}
                boardHeightPx={boardSize.height}
                onSelectObject={setSelectedObjectId}
                onObjectMoved={handleObjectMoved}
                onObjectTransformed={handleObjectTransformed}
                onDropNewObject={(libraryObjectId, xFraction, yFraction) =>
                  handleAddObject(libraryObjectId, xFraction, yFraction)
                }
              />
            )}
          </div>
          {mode !== 'play' && <ObjectRibbon library={library} onAddObject={(id) => handleAddObject(id)} />}
        </div>
        {mode === 'edit' && selectedObject && (
          <ObjectEditPanel library={library} object={selectedObject} onChange={handleEditPanelChange} />
        )}
      </div>
      {showSaveAsPrompt && (
        <PromptDialog
          title="Сохранить как…"
          initialValue={title}
          confirmLabel="Сохранить"
          onSubmit={handleSaveAs}
          onCancel={() => setShowSaveAsPrompt(false)}
        />
      )}
    </div>
  );
};

export default EditorScreen;
