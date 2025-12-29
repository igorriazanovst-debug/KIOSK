import React, { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import './GridSettings.css';

const GridSettings: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { gridSize, gridLineWidth, gridColor, setGridSize, setGridLineWidth, setGridColor } = useEditorStore();

  return (
    <div className="grid-settings">
      <button
        className="btn-icon"
        onClick={() => setIsOpen(!isOpen)}
        title="Настройки сетки"
      >
        <Settings size={18} />
      </button>

      {isOpen && (
        <div className="grid-settings-modal">
          <div className="grid-settings-header">
            <h3>Настройки сетки</h3>
            <button className="btn-icon" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="grid-settings-content">
            <div className="setting-field">
              <label>Шаг сетки (px)</label>
              <input
                type="number"
                value={gridSize}
                onChange={(e) => setGridSize(Math.max(5, parseInt(e.target.value) || 10))}
                min={5}
                max={100}
              />
            </div>

            <div className="setting-field">
              <label>Толщина линий (px)</label>
              <input
                type="number"
                value={gridLineWidth}
                onChange={(e) => setGridLineWidth(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={5}
              />
            </div>

            <div className="setting-field">
              <label>Цвет линий</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={gridColor}
                  onChange={(e) => setGridColor(e.target.value)}
                  style={{ width: '60px', height: '32px' }}
                />
                <input
                  type="text"
                  value={gridColor}
                  onChange={(e) => setGridColor(e.target.value)}
                  placeholder="#333333"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="setting-presets">
              <label>Быстрые настройки:</label>
              <div className="preset-buttons">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setGridSize(10);
                    setGridLineWidth(1);
                    setGridColor('#333333');
                  }}
                >
                  Мелкая
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setGridSize(20);
                    setGridLineWidth(1);
                    setGridColor('#444444');
                  }}
                >
                  Средняя
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setGridSize(50);
                    setGridLineWidth(2);
                    setGridColor('#555555');
                  }}
                >
                  Крупная
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridSettings;
