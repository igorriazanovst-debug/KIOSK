/**
 * ProjectsDialog Component
 * Диалог управления проектами: список, создание, открытие, удаление
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, FolderOpen, Trash2, Search } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { apiClient } from '../services/api-client';
import CreateProjectDialog from './CreateProjectDialog';
import './ProjectsDialog.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  canvasWidth: number;
  canvasHeight: number;
  updatedAt: string;
  createdAt: string;
  tags?: string[];
  thumbnail?: string;
}

interface ProjectsDialogProps {
  onClose: () => void;
  onProjectLoaded?: () => void;
}

const ProjectsDialog: React.FC<ProjectsDialogProps> = ({ onClose, onProjectLoaded }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { loadProject, projectId } = useEditorStore();

  // Загрузка списка проектов
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProjects();
      console.log('[ProjectsDialog] Projects loaded:', response.projects.length);
      setProjects(response.projects);
    } catch (error) {
      console.error('[ProjectsDialog] Failed to load projects:', error);
      alert('Не удалось загрузить список проектов');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = async (id: string) => {
    try {
      console.log('[ProjectsDialog] Opening project:', id);
      await loadProject(id);
      onProjectLoaded?.();
      onClose();
    } catch (error) {
      console.error('[ProjectsDialog] Failed to open project:', error);
      alert('Не удалось открыть проект');
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Вы уверены что хотите удалить проект "${name}"?`)) {
      return;
    }

    try {
      console.log('[ProjectsDialog] Deleting project:', id);
      await apiClient.deleteProject(id);
      
      // Обновить список
      setProjects(projects.filter(p => p.id !== id));
      
      alert('Проект удалён');
    } catch (error) {
      console.error('[ProjectsDialog] Failed to delete project:', error);
      alert('Не удалось удалить проект');
    }
  };

  const handleProjectCreated = () => {
    setShowCreateDialog(false);
    loadProjects();
  };

  // Фильтрация проектов
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="dialog-overlay" onClick={onClose}>
        <div className="dialog-content projects-dialog" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="dialog-header">
            <h2>Мои проекты</h2>
            <button className="btn-icon" onClick={onClose} title="Закрыть">
              <X size={24} />
            </button>
          </div>

          {/* Toolbar */}
          <div className="projects-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Поиск проектов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              className="btn-primary" 
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus size={18} />
              <span>Создать проект</span>
            </button>
          </div>

          {/* Projects List */}
          <div className="projects-list">
            {loading ? (
              <div className="loading-state">
                <p>Загрузка проектов...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="empty-state">
                <FolderOpen size={48} />
                <p>{searchQuery ? 'Проекты не найдены' : 'У вас пока нет проектов'}</p>
                <button 
                  className="btn-primary" 
                  onClick={() => setShowCreateDialog(true)}
                >
                  Создать первый проект
                </button>
              </div>
            ) : (
              filteredProjects.map(project => (
                <div 
                  key={project.id} 
                  className={`project-card ${project.id === projectId ? 'active' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="project-thumbnail">
                    {project.thumbnail ? (
                      <img src={project.thumbnail} alt={project.name} />
                    ) : (
                      <div className="thumbnail-placeholder">
                        <FolderOpen size={32} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    {project.description && (
                      <p className="project-description">{project.description}</p>
                    )}
                    <div className="project-meta">
                      <span>{project.canvasWidth}×{project.canvasHeight}</span>
                      <span>•</span>
                      <span>{new Date(project.updatedAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                    {project.tags && project.tags.length > 0 && (
                      <div className="project-tags">
                        {project.tags.map((tag, i) => (
                          <span key={i} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="project-actions">
                    <button 
                      className="btn-primary"
                      onClick={() => handleOpenProject(project.id)}
                      title="Открыть проект"
                    >
                      <FolderOpen size={18} />
                      <span>Открыть</span>
                    </button>
                    <button 
                      className="btn-icon btn-danger"
                      onClick={() => handleDeleteProject(project.id, project.name)}
                      title="Удалить проект"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="dialog-footer">
            <p className="projects-count">
              Всего проектов: {projects.length}
            </p>
          </div>
        </div>
      </div>

      {/* Create Project Dialog */}
      {showCreateDialog && (
        <CreateProjectDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={handleProjectCreated}
        />
      )}
    </>
  );
};

export default ProjectsDialog;
