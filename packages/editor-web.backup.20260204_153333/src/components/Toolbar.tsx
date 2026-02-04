import React, { useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { saveProjectToFile, loadProjectFromFile } from '../utils/projectUtils';
import GridSettings from './GridSettings';
import CanvasSettings from './CanvasSettings';
import Preview from './Preview';
import ExportDialog from './ExportDialog';
import { ServerSettings } from './ServerSettings';
import { TemplatesLibrary } from './TemplatesLibrary';
import { MediaLibrary } from './MediaLibrary';
import { DeviceManager } from './DeviceManager';
import { 
  Save, 
  FolderOpen, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut,
  Grid,
  Play,
  Settings,
  Monitor,
  Download,
  Library,
  Image,
  Smartphone
} from 'lucide-react';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const { 
    project, 
    undo, 
    redo, 
    history, 
    zoom, 
    setZoom,
    gridEnabled,
    toggleGrid,
    snapToGrid,
    toggleSnapToGrid,
    loadProject
  } = useEditorStore();

  const [showGridSettings, setShowGridSettings] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showDeviceManager, setShowDeviceManager] = useState(false);

  const handleSave = () => {
    if (project) {
      saveProjectToFile(project);
    }
  };

  const handleLoad = async () => {
    try {
      const loadedProject = await loadProjectFromFile();
      loadProject(loadedProject);
    } catch (error) {
      console.error('Failed to load project:', error);
      alert('Ошибка загрузки проекта');
    }
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.1, 0.1));
  };

  const handlePreview = () => {
    if (project) {
      setShowPreview(true);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <div className="toolbar-title">
          {project?.name || 'Без названия'}
        </div>
      </div>

      <div className="toolbar-section">
        <button 
          className="btn-icon" 
          onClick={handleSave}
          title="Сохранить (Ctrl+S)"
        >
          <Save size={18} />
        </button>
        <button 
          className="btn-icon" 
          onClick={handleLoad}
          title="Открыть (Ctrl+O)"
        >
          <FolderOpen size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button 
          className="btn-icon" 
          onClick={undo}
          disabled={history.past.length === 0}
          title="Отменить (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button 
          className="btn-icon" 
          onClick={redo}
          disabled={history.future.length === 0}
          title="Повторить (Ctrl+Shift+Z)"
        >
          <Redo2 size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button 
          className="btn-icon" 
          onClick={handleZoomOut}
          title="Уменьшить"
        >
          <ZoomOut size={18} />
        </button>
        <span className="zoom-indicator">
          {Math.round(zoom * 100)}%
        </span>
        <button 
          className="btn-icon" 
          onClick={handleZoomIn}
          title="Увеличить"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button 
          className="btn-icon" 
          onClick={() => setShowCanvasSettings(true)}
          title="Размер холста"
        >
          <Monitor size={18} />
        </button>
        <button 
          className={`btn-icon ${gridEnabled ? 'active' : ''}`}
          onClick={toggleGrid}
          title="Показать сетку"
        >
          <Grid size={18} />
        </button>
        <GridSettings />
        <label className="toolbar-checkbox">
          <input 
            type="checkbox" 
            checked={snapToGrid}
            onChange={toggleSnapToGrid}
          />
          Привязка к сетке
        </label>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-section">
        {/* Server Integration */}
        <ServerSettings />
        
        <button 
          className="btn-icon" 
          onClick={() => setShowTemplates(true)}
          title="Templates Library"
        >
          <Library size={18} />
        </button>
        
        <button 
          className="btn-icon" 
          onClick={() => setShowMediaLibrary(true)}
          title="Media Library"
        >
          <Image size={18} />
        </button>
        
        <button 
          className="btn-icon" 
          onClick={() => setShowDeviceManager(true)}
          title="Device Manager"
        >
          <Smartphone size={18} />
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-section">
        <button 
          className="btn" 
          onClick={handlePreview}
          title="Предпросмотр"
        >
          <Play size={18} />
          <span>Превью</span>
        </button>

        <button 
          className="btn" 
          onClick={() => setShowExportDialog(true)}
          title="Экспорт проекта"
        >
          <Download size={18} />
          <span>Экспорт</span>
        </button>
      </div>

      {/* Модальные окна */}
      {showCanvasSettings && (
        <CanvasSettings onClose={() => setShowCanvasSettings(false)} />
      )}

      {/* Превью */}
      {showPreview && project && (
        <Preview project={project} onClose={() => setShowPreview(false)} />
      )}

      {/* Экспорт */}
      {showExportDialog && (
        <ExportDialog onClose={() => setShowExportDialog(false)} />
      )}

      {/* Templates Library */}
      {showTemplates && (
        <TemplatesLibrary
          onClose={() => setShowTemplates(false)}
          onLoad={(template) => {
            loadProject(template.data);
          }}
        />
      )}

      {/* Media Library */}
      {showMediaLibrary && (
        <MediaLibrary
          onClose={() => setShowMediaLibrary(false)}
        />
      )}

      {/* Device Manager */}
      {showDeviceManager && (
        <DeviceManager onClose={() => setShowDeviceManager(false)} />
      )}
    </div>
  );
};

export default Toolbar;
