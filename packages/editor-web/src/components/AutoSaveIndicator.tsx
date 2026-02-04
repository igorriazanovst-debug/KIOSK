/**
 * AutoSave Indicator Component
 * Показывает статус сохранения: idle, saving, saved, error
 */

import React from 'react';
import { Cloud, CloudOff, Loader, Check, AlertCircle } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import './AutoSaveIndicator.css';

export const AutoSaveIndicator: React.FC = () => {
  const { isSaving, lastSaved, saveError } = useEditorStore();

  // Определяем статус
  const getStatus = () => {
    if (saveError) return 'error';
    if (isSaving) return 'saving';
    if (lastSaved) return 'saved';
    return 'idle';
  };

  const status = getStatus();

  // Форматирование времени последнего сохранения
  const formatLastSaved = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 10) return 'Только что';
    if (seconds < 60) return `${seconds} сек назад`;
    if (minutes === 1) return '1 мин назад';
    if (minutes < 60) return `${minutes} мин назад`;
    
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderContent = () => {
    switch (status) {
      case 'saving':
        return (
          <>
            <Loader size={16} className="spinner" />
            <span>Сохранение...</span>
          </>
        );

      case 'saved':
        return (
          <>
            <Check size={16} />
            <span>Сохранено {lastSaved && formatLastSaved(lastSaved)}</span>
          </>
        );

      case 'error':
        return (
          <>
            <AlertCircle size={16} />
            <span title={saveError || undefined}>Ошибка сохранения</span>
          </>
        );

      case 'idle':
      default:
        return (
          <>
            <Cloud size={16} />
            <span>Не сохранено</span>
          </>
        );
    }
  };

  return (
    <div className={`autosave-indicator status-${status}`}>
      {renderContent()}
    </div>
  );
};

export default AutoSaveIndicator;
