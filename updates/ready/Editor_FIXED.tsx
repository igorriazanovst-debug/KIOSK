/**
 * Editor Component - ИСПРАВЛЕНО
 * НЕ создаёт проект пока нет авторизации
 */

import React, { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { apiClient } from '../services/api-client';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import PropertiesPanel from './PropertiesPanel';
import WidgetLibrary from './WidgetLibrary';
import './Editor.css';

const Editor: React.FC = () => {
  const { project, createProject } = useEditorStore();

  useEffect(() => {
    // ИСПРАВЛЕНО: Создаём проект ТОЛЬКО если есть авторизация
    const initProject = async () => {
      if (!project && apiClient.isAuthenticated()) {
        try {
          await createProject('Новый проект', { width: 1920, height: 1080 });
        } catch (error) {
          console.error('[Editor] Failed to create project:', error);
        }
      }
    };

    initProject();
  }, [project, createProject]);

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { 
        undo, 
        redo, 
        copy, 
        paste, 
        cut, 
        deleteWidget, 
        selectedWidgetIds, 
        pendingWidget, 
        clearPendingWidget 
      } = useEditorStore.getState();

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

      // Delete - удалить выделенные виджеты
      if (e.key === 'Delete') {
        e.preventDefault();
        selectedWidgetIds.forEach(id => deleteWidget(id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ИСПРАВЛЕНО: Показываем загрузку если нет авторизации
  if (!apiClient.isAuthenticated()) {
    return (
      <div className="editor-loading">
        <p>Требуется авторизация...</p>
        <p style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
          Нажмите кнопку "Войти" в панели инструментов
        </p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="editor-loading">
        <p>Загрузка редактора...</p>
      </div>
    );
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
