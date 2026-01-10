import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { Download, Package, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import './ExportDialog.css';

interface ExportDialogProps {
  onClose: () => void;
}

interface BuildLog {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onClose }) => {
  const { project } = useEditorStore();
  const [exportType, setExportType] = useState<'json' | 'player'>('json');
  const [exporting, setExporting] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildMessage, setBuildMessage] = useState('');
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [buildComplete, setBuildComplete] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Автоскролл логов вниз
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [buildLogs]);

  // Подписка на события сборки (только для Electron)
  useEffect(() => {
    if (typeof window.electronAPI === 'undefined' || !exporting) {
      return;
    }

    // Подписываемся на прогресс
    const unsubscribeProgress = window.electronAPI.onBuildProgress((data: { progress: number; message: string }) => {
      setBuildProgress(data.progress);
      setBuildMessage(data.message);
    });

    // Подписываемся на логи
    const unsubscribeLogs = window.electronAPI.onBuildLog((data: { message: string; type: string }) => {
      setBuildLogs(prev => [
        ...prev,
        {
          message: data.message,
          type: data.type as 'info' | 'success' | 'warning' | 'error',
          timestamp: new Date()
        }
      ]);
    });

    // Отписываемся при размонтировании
    return () => {
      unsubscribeProgress();
      unsubscribeLogs();
    };
  }, [exporting]);

  if (!project) return null;

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name || 'project'}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleExportPlayer = async () => {
    // Проверяем что мы в Electron
    if (typeof window.electronAPI === 'undefined' || !window.electronAPI.isElectron) {
      alert('Генерация установщика доступна только в desktop версии редактора.\n\nИспользуйте: npm run electron:dev или установленное приложение.');
      return;
    }

    setExporting(true);
    setBuildProgress(0);
    setBuildMessage('Начинаем сборку...');
    setBuildLogs([]);
    setBuildComplete(false);
    setBuildError(null);

    try {
      // Вызываем API сборки
      const result = await window.electronAPI.buildPlayerInstaller(project);

      if (result.success) {
        setBuildComplete(true);
        setBuildProgress(100);
        setBuildMessage('Сборка завершена!');
        setBuildLogs(prev => [
          ...prev,
          {
            message: `✅ Установщик создан: ${result.installerPath}`,
            type: 'success',
            timestamp: new Date()
          },
          {
            message: `📦 Размер: ${result.size}`,
            type: 'info',
            timestamp: new Date()
          }
        ]);
      } else {
        setBuildError(result.error || 'Неизвестная ошибка');
        setBuildLogs(prev => [
          ...prev,
          {
            message: `❌ Ошибка: ${result.error}`,
            type: 'error',
            timestamp: new Date()
          }
        ]);
      }
    } catch (error: any) {
      setBuildError(error.message || 'Ошибка при вызове сборки');
      setBuildLogs(prev => [
        ...prev,
        {
          message: `❌ Критическая ошибка: ${error.message}`,
          type: 'error',
          timestamp: new Date()
        }
      ]);
    } finally {
      setExporting(false);
    }
  };

  const resetBuild = () => {
    setBuildProgress(0);
    setBuildMessage('');
    setBuildLogs([]);
    setBuildComplete(false);
    setBuildError(null);
    setExporting(false);
  };

  // Проверяем доступность Electron API
  const isElectron = typeof window.electronAPI !== 'undefined' && window.electronAPI.isElectron;

  return (
    <div className="export-overlay">
      <div className="export-dialog">
        <div className="export-header">
          <h2>Экспорт проекта</h2>
          <button className="btn-close" onClick={onClose} disabled={exporting}>
            <X size={20} />
          </button>
        </div>

        <div className="export-body">
          {/* Если идёт сборка - показываем прогресс */}
          {exporting ? (
            <div className="build-progress-container">
              <div className="build-progress-header">
                <Loader className="spinner" size={24} />
                <h3>Создание установщика Player...</h3>
              </div>

              {/* Прогресс бар */}
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${buildProgress}%` }} />
                <span className="progress-text">{buildProgress}%</span>
              </div>
              <p className="progress-message">{buildMessage}</p>

              {/* Логи */}
              <div className="build-logs">
                <h4>Логи сборки:</h4>
                <div className="logs-content">
                  {buildLogs.map((log, index) => (
                    <div key={index} className={`log-entry log-${log.type}`}>
                      <span className="log-time">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          ) : buildComplete ? (
            /* Если сборка завершена успешно */
            <div className="build-complete-container">
              <div className="build-complete-header">
                <CheckCircle size={48} className="icon-success" />
                <h3>Установщик успешно создан!</h3>
              </div>
              <p>Player установщик готов к использованию.</p>
              <div className="build-complete-actions">
                <button className="btn-primary" onClick={resetBuild}>
                  Создать ещё один
                </button>
              </div>
            </div>
          ) : buildError ? (
            /* Если произошла ошибка */
            <div className="build-error-container">
              <div className="build-error-header">
                <AlertCircle size={48} className="icon-error" />
                <h3>Ошибка при создании установщика</h3>
              </div>
              <div className="error-message">{buildError}</div>
              <div className="build-logs">
                <h4>Логи ошибок:</h4>
                <div className="logs-content">
                  {buildLogs.filter(l => l.type === 'error' || l.type === 'warning').map((log, index) => (
                    <div key={index} className={`log-entry log-${log.type}`}>
                      <span className="log-time">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="build-error-actions">
                <button className="btn-primary" onClick={resetBuild}>
                  Попробовать снова
                </button>
              </div>
            </div>
          ) : (
            /* Выбор типа экспорта */
            <>
              <div className="export-option-group">
                <label className={`export-option ${exportType === 'json' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="exportType"
                    value="json"
                    checked={exportType === 'json'}
                    onChange={() => setExportType('json')}
                  />
                  <div className="export-option-content">
                    <div className="export-option-icon">
                      <Download size={32} />
                    </div>
                    <div className="export-option-info">
                      <h3>Файл проекта (.json)</h3>
                      <p>Экспорт проекта в JSON формате для загрузки в редакторе или плеере</p>
                      <ul>
                        <li>Быстрый экспорт</li>
                        <li>Можно редактировать</li>
                        <li>Требует плеер для запуска</li>
                      </ul>
                    </div>
                  </div>
                </label>

                <label className={`export-option ${exportType === 'player' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="exportType"
                    value="player"
                    checked={exportType === 'player'}
                    onChange={() => setExportType('player')}
                  />
                  <div className="export-option-content">
                    <div className="export-option-icon">
                      <Package size={32} />
                    </div>
                    <div className="export-option-info">
                      <h3>Установщик Windows (.exe)</h3>
                      <p>Создание standalone приложения с установщиком</p>
                      <ul>
                        <li>Готовое приложение</li>
                        <li>Не требует дополнительных программ</li>
                        <li>Автозапуск при включении (опция)</li>
                      </ul>
                      {!isElectron && (
                        <div className="export-badge">Требуется desktop версия</div>
                      )}
                    </div>
                  </div>
                </label>
              </div>

              <div className="export-info">
                <h4>📦 Информация о проекте</h4>
                <div className="export-info-grid">
                  <div><strong>Название:</strong> {project.name}</div>
                  <div><strong>Размер холста:</strong> {project.canvas.width}×{project.canvas.height}</div>
                  <div><strong>Виджетов:</strong> {project.widgets.length}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {!exporting && !buildComplete && !buildError && (
          <div className="export-footer">
            <button className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button
              className="btn-primary"
              onClick={exportType === 'json' ? handleExportJSON : handleExportPlayer}
            >
              {exportType === 'json' ? '💾 Экспортировать JSON' : '📦 Создать установщик'}
            </button>
          </div>
        )}

        {buildComplete && (
          <div className="export-footer">
            <button className="btn-primary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportDialog;
