/**
 * BuildDialog — диалог сборки плеера Windows
 */
import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { apiClient } from '../services/api-client';
import { Package, Download, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import './BuildDialog.css';

interface BuildDialogProps {
  onClose: () => void;
}

interface BuildStatus {
  id: string;
  status: string;
  progress: number;
  message: string;
  download_url?: string;
  file_name?: string;
  file_size?: string;
  error?: string;
}

const BuildDialog: React.FC<BuildDialogProps> = ({ onClose }) => {
  const { project } = useEditorStore();
  
  const [appName, setAppName] = useState(project?.name || 'Kiosk Player');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  
  const [building, setBuilding] = useState(false);
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null);
  
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [pollTimer]);

  if (!project) return null;

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setIconPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBuild = async () => {
    setBuilding(true);
    setBuildStatus(null);

    try {
      // Формируем данные
      const formData = new FormData();
      formData.append('project', JSON.stringify(project));
      formData.append('appName', appName);
      formData.append('appId', 'com.kiosk.player');
      
      if (iconFile) {
        formData.append('icon', iconFile);
      }

      // Запускаем сборку
      const API_BASE = apiClient.getBaseUrl();
      const response = await fetch(`${API_BASE}/api/builds`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка запуска сборки');
      }

      const buildId = result.data.build_id;
      
      // Начинаем опрос статуса
      const timer = setInterval(async () => {
        try {
          const statusResp = await fetch(`${API_BASE}/api/builds/${buildId}`);
          const statusResult = await statusResp.json();
          
          if (statusResult.success) {
            setBuildStatus(statusResult.data);
            
            if (statusResult.data.status === 'completed' || statusResult.data.status === 'failed') {
              clearInterval(timer);
              setBuilding(false);
            }
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);

      setPollTimer(timer);
      
      // Ставим начальный статус
      setBuildStatus({
        id: buildId,
        status: 'queued',
        progress: 0,
        message: 'Запуск сборки...'
      });

    } catch (error: any) {
      console.error('Build error:', error);
      setBuildStatus({
        id: '',
        status: 'failed',
        progress: 0,
        message: error.message,
        error: error.message
      });
      setBuilding(false);
    }
  };

  const handleDownload = () => {
    if (buildStatus?.download_url) {
      const API_BASE = apiClient.getBaseUrl();
      window.open(`${API_BASE}${buildStatus.download_url}`, '_blank');
    }
  };

  const isCompleted = buildStatus?.status === 'completed';
  const isFailed = buildStatus?.status === 'failed';
  const isBuilding = building && !isCompleted && !isFailed;

  return (
    <div className="build-dialog-overlay" onClick={!isBuilding ? onClose : undefined}>
      <div className="build-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="build-dialog-header">
          <h2><Package size={20} /> Сборка плеера Windows</h2>
          {!isBuilding && (
            <button className="build-dialog-close" onClick={onClose}>×</button>
          )}
        </div>

        {/* Body */}
        <div className="build-dialog-body">
          {/* Информация о проекте */}
          <div className="build-project-info">
            <h4>Проект</h4>
            <div className="build-project-info-grid">
              <div>Название: <span>{project.name}</span></div>
              <div>Виджетов: <span>{project.widgets.length}</span></div>
              <div>Размер: <span>{project.canvas.width}×{project.canvas.height}</span></div>
            </div>
          </div>

          {/* Форма настроек (до сборки) */}
          {!buildStatus && (
            <>
              <div className="build-form-group">
                <label>Имя приложения</label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Kiosk Player"
                />
              </div>

              <div className="build-form-group">
                <label>Иконка приложения (.ico)</label>
                <div className="build-icon-upload">
                  <button 
                    className="build-icon-btn"
                    onClick={() => iconInputRef.current?.click()}
                  >
                    {iconFile ? 'Изменить' : 'Выбрать .ico файл'}
                  </button>
                  {iconPreview && (
                    <div className="build-icon-preview">
                      <img src={iconPreview} alt="icon" />
                    </div>
                  )}
                  {iconFile && (
                    <span className="build-icon-name">{iconFile.name}</span>
                  )}
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept=".ico"
                    onChange={handleIconSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Прогресс сборки */}
          {buildStatus && (
            <div className="build-progress-section">
              {isBuilding && (
                <>
                  <div className="build-progress-percent">{buildStatus.progress}%</div>
                  <div className="build-progress-bar-bg">
                    <div 
                      className="build-progress-bar-fill"
                      style={{ width: `${buildStatus.progress}%` }}
                    />
                  </div>
                  <div className="build-progress-status">
                    <Loader size={14} style={{ display: 'inline', marginRight: 6, animation: 'spin 1s linear infinite' }} />
                    {buildStatus.message}
                  </div>
                </>
              )}

              {isCompleted && (
                <div className="build-result">
                  <CheckCircle size={48} color="#48bb78" />
                  <div className="build-result-success">Установщик готов!</div>
                  <div className="build-result-info">
                    {buildStatus.file_name}<br />
                    Размер: {buildStatus.file_size}
                  </div>
                </div>
              )}

              {isFailed && (
                <div className="build-result">
                  <AlertCircle size={48} color="#f56565" />
                  <div className="build-result-error">
                    {buildStatus.error || buildStatus.message}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="build-dialog-footer">
          {!buildStatus && (
            <>
              <button className="build-btn build-btn-secondary" onClick={onClose}>
                Отмена
              </button>
              <button 
                className="build-btn build-btn-primary"
                onClick={handleBuild}
                disabled={!appName.trim()}
              >
                <Package size={16} /> Собрать .exe
              </button>
            </>
          )}

          {isBuilding && (
            <button className="build-btn build-btn-secondary" disabled>
              Сборка... ~2 мин
            </button>
          )}

          {isCompleted && (
            <>
              <button className="build-btn build-btn-secondary" onClick={onClose}>
                Закрыть
              </button>
              <button className="build-btn build-btn-success" onClick={handleDownload}>
                <Download size={16} /> Скачать .exe
              </button>
            </>
          )}

          {isFailed && (
            <>
              <button className="build-btn build-btn-secondary" onClick={onClose}>
                Закрыть
              </button>
              <button className="build-btn build-btn-primary" onClick={() => {
                setBuildStatus(null);
                setBuilding(false);
              }}>
                Попробовать снова
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuildDialog;
