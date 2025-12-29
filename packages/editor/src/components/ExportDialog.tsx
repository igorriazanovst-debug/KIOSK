import React, { useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { Download, Package, X } from 'lucide-react';
import './ExportDialog.css';

interface ExportDialogProps {
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onClose }) => {
  const { project } = useEditorStore();
  const [exportType, setExportType] = useState<'json' | 'player'>('json');
  const [exporting, setExporting] = useState(false);

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
    setExporting(true);
    
    // В реальной реализации здесь будет вызов API для генерации установщика
    // Пока просто экспортируем JSON
    setTimeout(() => {
      alert('Генерация установщика доступна только в desktop версии редактора.\n\nИспользуйте:\nnpm run build:player\n\nв директории packages/player');
      setExporting(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="export-overlay">
      <div className="export-dialog">
        <div className="export-header">
          <h2>Экспорт проекта</h2>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="export-body">
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
                  <div className="export-badge">Требуется desktop версия</div>
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
        </div>

        <div className="export-footer">
          <button className="btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            className="btn-primary"
            onClick={exportType === 'json' ? handleExportJSON : handleExportPlayer}
            disabled={exporting}
          >
            {exporting ? 'Экспорт...' : exportType === 'json' ? '💾 Экспортировать JSON' : '📦 Создать установщик'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
