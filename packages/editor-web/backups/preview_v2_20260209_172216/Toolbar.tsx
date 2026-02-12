/**
 * Toolbar Component - ВЕРСИЯ 3.0 + Projects Management
 * Без LoginDialog, с информацией о пользователе и кнопкой выхода
 * + Управление проектами через ProjectsDialog
 */

import React, { useState, useEffect } from 'react';
// Router navigation removed - using window.location instead
import { 
  Save, 
  FolderOpen, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Grid, 
  Magnet,
  Play,
  User,
  LogOut
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { apiClient } from '../services/api-client';
import { logger } from '../utils/logger';
import AutoSaveIndicator from './AutoSaveIndicator';
import ProjectsDialog from './ProjectsDialog';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
  const { project, savePreviewSnapshot } = useEditorStore();
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const {
    project,
    history,
    zoom,
    gridEnabled,
    snapToGrid,
    undo,
    redo,
    setZoom,
    toggleGrid,
    toggleSnapToGrid,
    saveProject
  } = useEditorStore();

  // User info
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);

  useEffect(() => {
    const orgData = apiClient.getOrganizationData();
    setOrganizationName(orgData.name);
    setPlan(orgData.plan);
  }, []);

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.1, 0.1));
  };

  const handleLogout = () => {
    if (confirm('Вы уверены что хотите выйти?')) {
      logger.info('User initiated logout');
      apiClient.logout();
      window.location.href = "/login";
    }
  };

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;


  const handlePreview = async () => {
    if (!project) {
      alert('Нет открытого проекта для предпросмотра');
      return;
    }

    setPreviewLoading(true);

    try {
      console.log('[Toolbar] Starting preview...');
      
      const snapshotId = await savePreviewSnapshot();
      
      const previewUrl = `/preview?projectId=${snapshotId}`;
      const previewWindow = window.open(
        previewUrl,
        'KioskPreview',
        'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
      );

      if (!previewWindow) {
        alert('Не удалось открыть окно предпросмотра. Проверьте настройки блокировки всплывающих окон.');
      } else {
        console.log('[Toolbar] Preview window opened');
      }
    } catch (error: any) {
      console.error('[Toolbar] Preview error:', error);
      alert(`Ошибка предпросмотра: ${error.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };
  return (
    <>
      <div className="toolbar">
        <div className="toolbar-section">
          {/* Logo */}
          <div className="toolbar-logo">
            <span className="logo-text">Kiosk Editor</span>
          </div>

          <div className="toolbar-divider" />

          {/* File operations */}
          <button 
            className="toolbar-btn" 
            onClick={() => saveProject()}
            disabled={!project}
            title="Сохранить (Ctrl+S)"
          >
            <Save size={18} />
          </button>

          <button 
            className="toolbar-btn" 
            onClick={() => setShowProjectsDialog(true)}
            disabled={!project}
            title="Мои проекты"
          >
            <FolderOpen size={18} />
          </button>

          <div className="toolbar-divider" />

          {/* History */}
          <button 
            className="toolbar-btn" 
            onClick={undo}
            disabled={!canUndo}
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>

          <button 
            className="toolbar-btn" 
            onClick={redo}
            disabled={!canRedo}
            title="Вернуть (Ctrl+Shift+Z)"
          >
            <Redo2 size={18} />
          </button>

          <div className="toolbar-divider" />

          {/* Zoom */}
          <button 
            className="toolbar-btn" 
            onClick={handleZoomOut}
            disabled={zoom <= 0.1}
            title="Уменьшить (Ctrl+-)"
          >
            <ZoomOut size={18} />
          </button>

          <span className="toolbar-zoom">{Math.round(zoom * 100)}%</span>

          <button 
            className="toolbar-btn" 
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            title="Увеличить (Ctrl++)"
          >
            <ZoomIn size={18} />
          </button>

          <div className="toolbar-divider" />

          {/* Grid */}
          <button 
            className={`toolbar-btn ${gridEnabled ? 'active' : ''}`}
            onClick={toggleGrid}
            title="Показать сетку"
          >
            <Grid size={18} />
          </button>

          <button 
            className={`toolbar-btn ${snapToGrid ? 'active' : ''}`}
            onClick={toggleSnapToGrid}
            title="Привязка к сетке"
          >
            <Magnet size={18} />
          </button>
        </div>

        {/* Right section */}
        <div className="toolbar-section">
          {/* AutoSave Indicator */}
          {project && <AutoSaveIndicator />}

          <div className="toolbar-divider" />

          {/* User info */}
          {organizationName && (
            <div className="toolbar-user-info">
              <User size={16} />
              <span className="user-org">{organizationName}</span>
              {plan && <span className="user-plan">{plan}</span>}
            </div>
          )}

          {/* Logout */}
          <button 
            className="toolbar-btn logout-btn"
            onClick={handleLogout}
            title="Выйти"
          >
            <LogOut size={18} />
          </button>

          <div className="toolbar-divider" />

          {/* Preview */}
          <button 
          <button
            className="toolbar-btn preview-btn"
            disabled={!project || previewLoading}
            onClick={handlePreview}
            title="Предпросмотр"
          >
            <Play size={18} />
            <span>{previewLoading ? 'Загрузка...' : 'Предпросмотр'}</span>
          </button>
            <span>Предпросмотр</span>
          </button>
        </div>
      </div>

      {/* Projects Dialog */}
      {showProjectsDialog && (
        <ProjectsDialog
          onClose={() => setShowProjectsDialog(false)}
        />
      )}
    </>
  );
};

export default Toolbar;
