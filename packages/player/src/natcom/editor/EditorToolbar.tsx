// packages/player/src/natcom/editor/EditorToolbar.tsx
// Аналог EditorButtonGroup оригинала (СПЕЦИФИКАЦИЯ, раздел 4.2) - режимы
// drag/transform/edit/play + Отменить/Сохранить/Сохранить как. Заголовок
// проекта редактируется в шапке - как у оригинала.

import React from 'react';
import type { EditorMode } from './Workspace';
import './editor.css';

interface EditorToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  canUndo: boolean;
  onUndo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  isSaving: boolean;
  hasSelection: boolean;
  onFlip: () => void;
  onDelete: () => void;
  onBack: () => void;
}

const MODES: { key: EditorMode; label: string }[] = [
  { key: 'drag', label: 'Перемещение' },
  { key: 'transform', label: 'Трансформация' },
  { key: 'edit', label: 'Правка' },
  { key: 'play', label: 'Просмотр' },
];

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  title,
  onTitleChange,
  mode,
  onModeChange,
  canUndo,
  onUndo,
  onSave,
  onSaveAs,
  isSaving,
  hasSelection,
  onFlip,
  onDelete,
  onBack,
}) => {
  return (
    <div className="natcom-editor-toolbar">
      <button className="natcom-editor-toolbar__back" onClick={onBack}>
        ← Главная
      </button>
      <input
        className="natcom-editor-toolbar__title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Название презентации"
      />
      <div className="natcom-editor-toolbar__modes">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`natcom-editor-toolbar__mode ${mode === m.key ? 'natcom-editor-toolbar__mode--active' : ''}`}
            onClick={() => onModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {hasSelection && mode !== 'play' && (
        <div className="natcom-editor-toolbar__selection-actions">
          <button onClick={onFlip}>Отразить</button>
          <button onClick={onDelete}>Удалить</button>
        </div>
      )}
      <div className="natcom-editor-toolbar__actions">
        <button onClick={onUndo} disabled={!canUndo}>
          Отменить
        </button>
        <button onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button onClick={onSaveAs} disabled={isSaving}>
          Сохранить как…
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
