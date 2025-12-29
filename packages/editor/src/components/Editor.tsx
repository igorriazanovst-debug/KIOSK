import React, { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import PropertiesPanel from './PropertiesPanel';
import WidgetLibrary from './WidgetLibrary';
import './Editor.css';

const Editor: React.FC = () => {
  const { project, createProject } = useEditorStore();

  useEffect(() => {
    // Создаем начальный проект, если его нет
    if (!project) {
      try {
        createProject('Новый проект', { width: 1920, height: 1080 });
      } catch (error) {
        console.error('Failed to create project:', error);
      }
    }
  }, []);

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { undo, redo, copy, paste, cut, deleteWidget, selectedWidgetIds, pendingWidget, clearPendingWidget } = useEditorStore.getState();

      // Escape - отменить добавление виджета
      if (e.key === 'Escape' && pendingWidget) {
        e.preventDefault();
        clearPendingWidget();
        return;
      }

      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Ctrl/Cmd + Shift + Z или Ctrl/Cmd + Y - Redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
      }

      // Ctrl/Cmd + C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copy();
      }

      // Ctrl/Cmd + V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        paste();
      }

      // Ctrl/Cmd + X - Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        cut();
      }

      // Delete - удалить выделенные виджеты (Backspace отключен для безопасности)
      if (e.key === 'Delete') {
        e.preventDefault();
        selectedWidgetIds.forEach(id => deleteWidget(id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!project) {
    return <div className="editor-loading">Загрузка редактора...</div>;
  }

  return (
    <div className="editor">
      <Toolbar />
      <div className="editor-main">
        <WidgetLibrary />
        <Canvas />
        <PropertiesPanel />
      </div>
    </div>
  );
};

export default Editor;
