/**
 * Toolbar Component - ВЕРСИЯ 2.0 ИСПРАВЛЕННАЯ
 * С интеграцией аутентификации и автосохранения
 */

import React, { useState, useEffect } from 'react';
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
  LogOut,
  Key
} from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { apiClient } from '../services/api-client';
import LoginDialog from './LoginDialog';
import AutoSaveIndicator from './AutoSaveIndicator';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
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

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // Проверка аутентификации при монтировании
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = apiClient.isAuthenticated();
      
      if (authenticated) {
        try {
          const valid = await apiClient.verifyToken();
          if (valid) {
            setIsAuthenticated(true);
            // TODO: Получить данные организации из токена или API
          } else {
            setIsAuthenticated(false);
          }
        } catch (error) {
          setIsAuthenticated(false);
        }
      } else {
        // Показать диалог входа если не авторизован
        setShowLoginDialog(true);
      }
    };

    checkAuth();

    // Слушать события выхода
    const handleLogout = () => {
      setIsAuthenticated(false);
      setOrganizationName(null);
      setPlan(null);
      setShowLoginDialog(true);
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:unauthorized', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:unauthorized', handleLogout);
    };
  }, []);

  const handleLoginSuccess = (orgName: string, planType: string) => {
    setIsAuthenticated(true);
    setOrganizationName(orgName);
    setPlan(planType);
    console.log('[Toolbar] Login successful:', orgName, planType);
  };

  const handleLogout = () => {
    if (confirm('Вы уверены что хотите выйти?')) {
      apiClient.logout();
      setIsAuthenticated(false);
      setOrganizationName(null);
      setPlan(null);
      setShowLoginDialog(true);
    }
  };

  const handleSave = async () => {
    if (!project) return;
    try {
      await saveProject();
    } catch (error) {
      console.error('[Toolbar] Save failed:', error);
      alert('Не удалось сохранить проект');
    }
  };

  const handleZoomIn = () => setZoom(zoom + 0.1);
  const handleZoomOut = () => setZoom(zoom - 0.1);
  const handleResetZoom = () => setZoom(1);

  return (
    <>
      <div className="toolbar">
        {/* Left section */}
        <div className="toolbar-section">
          {/* Auth section */}
          {isAuthenticated ? (
            <div className="auth-section authenticated">
              <div className="user-info">
                <User size={16} />
                <div className="user-details">
                  <span className="org-name">{organizationName || 'Organization'}</span>
                  <span className="plan-badge">{plan || 'BASIC'}</span>
                </div>
              </div>
              <button 
                className="toolbar-btn logout-btn" 
                onClick={handleLogout}
                title="Выйти"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              className="toolbar-btn login-btn" 
              onClick={() => setShowLoginDialog(true)}
              title="Войти"
            >
              <Key size={18} />
              <span>Войти</span>
            </button>
          )}

          <div className="toolbar-divider" />

          {/* File operations */}
          <button 
            className="toolbar-btn" 
            onClick={handleSave}
            disabled={!project || !isAuthenticated}
            title="Сохранить (Ctrl+S)"
          >
            <Save size={18} />
            <span>Сохранить</span>
          </button>

          <button 
            className="toolbar-btn" 
            disabled={!isAuthenticated}
            title="Открыть проект"
          >
            <FolderOpen size={18} />
            <span>Открыть</span>
          </button>
        </div>

        {/* Center section */}
        <div className="toolbar-section">
          {/* History */}
          <button 
            className="toolbar-btn" 
            onClick={undo}
            disabled={history.past.length === 0}
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>

          <button 
            className="toolbar-btn" 
            onClick={redo}
            disabled={history.future.length === 0}
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

          <button 
            className="toolbar-btn zoom-display" 
            onClick={handleResetZoom}
            title="Сбросить масштаб (Ctrl+0)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button 
            className="toolbar-btn" 
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            title="Увеличить (Ctrl+=)"
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
          {isAuthenticated && project && <AutoSaveIndicator />}

          <div className="toolbar-divider" />

          {/* Preview */}
          <button 
            className="toolbar-btn preview-btn" 
            disabled={!project}
            title="Предпросмотр"
          >
            <Play size={18} />
            <span>Предпросмотр</span>
          </button>
        </div>
      </div>

      {/* Login Dialog */}
      {showLoginDialog && (
        <LoginDialog 
          onClose={() => !isAuthenticated ? null : setShowLoginDialog(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </>
  );
};

export default Toolbar;
