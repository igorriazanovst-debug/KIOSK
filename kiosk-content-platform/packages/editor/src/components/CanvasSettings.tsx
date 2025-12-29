import React, { useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { Monitor, X } from 'lucide-react';
import './CanvasSettings.css';

interface CanvasPreset {
  name: string;
  width: number;
  height: number;
  ratio: string;
  category: string;
}

const canvasPresets: CanvasPreset[] = [
  // Мониторы (Desktop)
  { name: 'HD (1280×720)', width: 1280, height: 720, ratio: '16:9', category: 'Мониторы' },
  { name: 'Full HD (1920×1080)', width: 1920, height: 1080, ratio: '16:9', category: 'Мониторы' },
  { name: 'WUXGA (1920×1200)', width: 1920, height: 1200, ratio: '16:10', category: 'Мониторы' },
  { name: '2K QHD (2560×1440)', width: 2560, height: 1440, ratio: '16:9', category: 'Мониторы' },
  { name: '4K UHD (3840×2160)', width: 3840, height: 2160, ratio: '16:9', category: 'Мониторы' },
  { name: 'Ultrawide (2560×1080)', width: 2560, height: 1080, ratio: '21:9', category: 'Мониторы' },
  { name: 'Super Ultrawide (3440×1440)', width: 3440, height: 1440, ratio: '21:9', category: 'Мониторы' },
  
  // Планшеты
  { name: 'iPad (2048×1536)', width: 2048, height: 1536, ratio: '4:3', category: 'Планшеты' },
  { name: 'iPad Pro 11" (2388×1668)', width: 2388, height: 1668, ratio: '~4:3', category: 'Планшеты' },
  { name: 'iPad Pro 12.9" (2732×2048)', width: 2732, height: 2048, ratio: '4:3', category: 'Планшеты' },
  { name: 'Samsung Tab (2560×1600)', width: 2560, height: 1600, ratio: '16:10', category: 'Планшеты' },
  
  // Смартфоны (Вертикальные)
  { name: 'iPhone (1170×2532)', width: 1170, height: 2532, ratio: '19.5:9', category: 'Смартфоны' },
  { name: 'Samsung (1080×2400)', width: 1080, height: 2400, ratio: '20:9', category: 'Смартфоны' },
  { name: 'Pixel (1080×2340)', width: 1080, height: 2340, ratio: '19.5:9', category: 'Смартфоны' },
  
  // Сенсорные панели / Digital Signage
  { name: 'Вертикальная панель (1080×1920)', width: 1080, height: 1920, ratio: '9:16', category: 'Digital Signage' },
  { name: 'Горизонтальная панель (1920×1080)', width: 1920, height: 1080, ratio: '16:9', category: 'Digital Signage' },
  { name: 'Квадратная панель (1080×1080)', width: 1080, height: 1080, ratio: '1:1', category: 'Digital Signage' },
];

interface CanvasSettingsProps {
  onClose: () => void;
}

const CanvasSettings: React.FC<CanvasSettingsProps> = ({ onClose }) => {
  const { project, updateProject } = useEditorStore();
  
  const [customWidth, setCustomWidth] = useState(project?.canvas.width || 1920);
  const [customHeight, setCustomHeight] = useState(project?.canvas.height || 1080);
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');

  if (!project) return null;

  // Получаем размер текущего экрана
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // Вычисляем соотношение сторон текущего экрана
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const screenGcd = gcd(screenWidth, screenHeight);
  const screenRatio = `${screenWidth / screenGcd}:${screenHeight / screenGcd}`;

  // Добавляем текущий экран в начало списка пресетов
  const screenPreset: CanvasPreset = { 
    name: `Текущий экран (${screenWidth}×${screenHeight})`, 
    width: screenWidth, 
    height: screenHeight, 
    ratio: screenRatio, 
    category: 'Текущий экран' 
  };
  
  const allPresets = [screenPreset, ...canvasPresets];

  const categories = ['Все', 'Текущий экран', ...Array.from(new Set(canvasPresets.map(p => p.category)))];
  
  const filteredPresets = selectedCategory === 'Все' 
    ? allPresets 
    : selectedCategory === 'Текущий экран'
    ? [screenPreset]
    : canvasPresets.filter(p => p.category === selectedCategory);

  const handlePresetClick = (preset: CanvasPreset) => {
    updateProject({
      canvas: {
        ...project.canvas,
        width: preset.width,
        height: preset.height
      }
    });
  };

  const handleCustomSize = () => {
    if (customWidth < 100 || customHeight < 100) {
      alert('Минимальный размер холста: 100×100');
      return;
    }
    if (customWidth > 10000 || customHeight > 10000) {
      alert('Максимальный размер холста: 10000×10000');
      return;
    }

    updateProject({
      canvas: {
        ...project.canvas,
        width: customWidth,
        height: customHeight
      }
    });
  };

  return (
    <div className="canvas-settings-overlay" onClick={onClose}>
      <div className="canvas-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="canvas-settings-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={20} />
            <h3>Размер холста</h3>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="canvas-settings-content">
          {/* Текущий размер */}
          <div className="current-size">
            <div className="size-label">Текущий размер:</div>
            <div className="size-value">
              {project.canvas.width} × {project.canvas.height} px
            </div>
          </div>

          {/* Категории */}
          <div className="categories">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-button ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Пресеты */}
          <div className="presets-grid">
            {filteredPresets.map((preset, index) => (
              <button
                key={index}
                className={`preset-button ${
                  project.canvas.width === preset.width && 
                  project.canvas.height === preset.height 
                    ? 'active' 
                    : ''
                }`}
                onClick={() => handlePresetClick(preset)}
              >
                <div className="preset-name">{preset.name}</div>
                <div className="preset-info">
                  <span className="preset-ratio">{preset.ratio}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Пользовательский размер */}
          <div className="custom-size">
            <h4>Пользовательский размер</h4>
            <div className="custom-size-inputs">
              <div className="input-group">
                <label>Ширина (px)</label>
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                  min={100}
                  max={10000}
                />
              </div>
              <div className="multiply">×</div>
              <div className="input-group">
                <label>Высота (px)</label>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                  min={100}
                  max={10000}
                />
              </div>
              <button className="btn-primary" onClick={handleCustomSize}>
                Применить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasSettings;
