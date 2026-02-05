/**
 * EditorPage Component
 * Главная страница редактора с защитой от неактивности
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '../components/Editor';
import { useActivityTimeout } from '../hooks/useActivityTimeout';
import { apiClient } from '../services/api-client';
import { logger } from '../utils/logger';
import { useEditorStore } from '../stores/editorStore';
import './EditorPage.css';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 минут

export const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { project, saveProject } = useEditorStore();
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Обработчик таймаута неактивности
   */
  const handleInactivityTimeout = useCallback(async () => {
    logger.warn('Inactivity timeout - attempting to save project before logout');
    
    // Попытаться сохранить проект перед выходом
    if (project) {
      setIsSaving(true);
      try {
        await saveProject();
        logger.info('Project saved successfully before logout');
      } catch (error) {
        logger.error('Failed to save project before logout', error);
      } finally {
        setIsSaving(false);
      }
    }

    // Выход и редирект
    apiClient.logout();
    navigate('/login', { replace: true });
  }, [project, saveProject, navigate]);

  /**
   * Мониторинг активности
   */
  useActivityTimeout({
    timeout: INACTIVITY_TIMEOUT,
    onTimeout: handleInactivityTimeout
  });

  /**
   * Слушать события logout
   */
  useEffect(() => {
    const handleLogout = () => {
      logger.info('Logout event received - redirecting to login');
      navigate('/login', { replace: true });
    };

    const handleUnauthorized = () => {
      logger.warn('Unauthorized event received - redirecting to login');
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [navigate]);

  return (
    <div className="editor-page">
      {isSaving && (
        <div className="saving-overlay">
          <div className="saving-message">
            <div className="spinner" />
            <span>Сохранение проекта перед выходом...</span>
          </div>
        </div>
      )}
      <Editor />
    </div>
  );
};

export default EditorPage;
