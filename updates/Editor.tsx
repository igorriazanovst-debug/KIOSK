/**
 * Editor Component - ИСПРАВЛЕНО
 * НЕ создаёт проект пока нет авторизации
 */

import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { Toolbar } from './Toolbar';
import Canvas from './Canvas';
import { WidgetLibrary } from './WidgetLibrary';
import { PropertiesPanel } from './PropertiesPanel';
import './Editor.css';

const Editor: React.FC = () => {
  const [authRefresh, setAuthRefresh] = useState(0);
  
  const {
    project,
    selectedWidgetIds,
    copy,
    paste,
    cut,
    deleteWidget,
    undo,
    redo
  } = useEditorStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z - Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
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
      // Delete - удалить выделенные виджеты
      if (e.key === 'Delete') {
        e.preventDefault();
        selectedWidgetIds.forEach(id => deleteWidget(id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Слушаем события входа для обновления UI
  useEffect(() => {
    const handleLogin = () => {
      setAuthRefresh(prev => prev + 1);
    };
    
    window.addEventListener('auth:login', handleLogin);
    return () => window.removeEventListener('auth:login', handleLogin);
  }, []);

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
