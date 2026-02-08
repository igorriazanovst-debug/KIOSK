/**
 * CreateProjectDialog Component
 * Диалог создания нового проекта
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import './CreateProjectDialog.css';

interface CreateProjectDialogProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(1920);
  const [canvasHeight, setCanvasHeight] = useState(1080);
  const [creating, setCreating] = useState(false);
  
  const { createProject } = useEditorStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Введите название проекта');
      return;
    }

    try {
      setCreating(true);
      console.log('[CreateProjectDialog] Creating project:', name);
      
      await createProject(name.trim(), {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff'
      });

      console.log('[CreateProjectDialog] Project created successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('[CreateProjectDialog] Failed to create project:', error);
      alert('Не удалось создать проект');
    } finally {
      setCreating(false);
    }
  };

  const presets = [
    { name: 'Full HD (горизонтально)', width: 1920, height: 1080 },
    { name: 'Full HD (вертикально)', width: 1080, height: 1920 },
    { name: '4K (горизонтально)', width: 3840, height: 2160 },
    { name: 'HD (горизонтально)', width: 1280, height: 720 },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content create-project-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h2>Создать новый проект</h2>
          <button className="btn-icon" onClick={onClose} title="Закрыть">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            {/* Project Name */}
            <div className="form-field">
              <label htmlFor="project-name">Название проекта *</label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Мой проект"
                maxLength={100}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="form-field">
              <label htmlFor="project-description">Описание (необязательно)</label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание проекта..."
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Canvas Size */}
            <div className="form-section">
              <h3>Размер холста</h3>
              
              {/* Presets */}
              <div className="presets-grid">
                {presets.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`preset-btn ${
                      canvasWidth === preset.width && canvasHeight === preset.height
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => {
                      setCanvasWidth(preset.width);
                      setCanvasHeight(preset.height);
                    }}
                  >
                    <span className="preset-name">{preset.name}</span>
                    <span className="preset-size">{preset.width}×{preset.height}</span>
                  </button>
                ))}
              </div>

              {/* Custom Size */}
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="canvas-width">Ширина (px)</label>
                  <input
                    id="canvas-width"
                    type="number"
                    value={canvasWidth}
                    onChange={(e) => setCanvasWidth(parseInt(e.target.value) || 1920)}
                    min={320}
                    max={7680}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="canvas-height">Высота (px)</label>
                  <input
                    id="canvas-height"
                    type="number"
                    value={canvasHeight}
                    onChange={(e) => setCanvasHeight(parseInt(e.target.value) || 1080)}
                    min={240}
                    max={4320}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Создание...' : 'Создать проект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectDialog;
