import React from 'react';
import { apiClient } from '../services/api-client';
import { useEditorStore } from '../stores/editorStore';
import ActionEditor from './ActionEditor';
import NavigationPropertiesSection from './NavigationPropertiesSection';
import './PropertiesPanel.css';
import RichTextEditor from './RichTextEditor';

const PropertiesPanel: React.FC = () => {
  const { project, selectedWidgetIds, updateWidget } = useEditorStore();

  if (!project) return null;

  const selectedWidget = selectedWidgetIds.length === 1 
    ? project.widgets.find(w => w.id === selectedWidgetIds[0])
    : null;

  const handlePropertyChange = (key: string, value: any) => {
    if (!selectedWidget) return;
    updateWidget(selectedWidget.id, { [key]: value });
  };

  const handlePropertiesChange = (key: string, value: any) => {
    if (!selectedWidget) return;
    updateWidget(selectedWidget.id, {
      properties: {
        ...selectedWidget.properties,
        [key]: value
      }
    });
  };

  if (!selectedWidget) {
    return (
      <div className="properties-panel panel">
        <div className="properties-header">
          <h3>Свойства</h3>
        </div>
        <div className="properties-empty">
          <p>Выберите виджет для редактирования</p>
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel panel">
      <div className="properties-header">
        <h3>Свойства</h3>
        <span className="widget-type-badge">{selectedWidget.type}</span>
      </div>

      <div className="properties-content">
        {/* Секция виджета навигации */}
        <NavigationPropertiesSection
          widget={selectedWidget}
          onPropertiesChange={handlePropertiesChange}
          onUpdateWidget={(updates) => updateWidget(selectedWidget.id, updates)}
        />

        {/* Основные свойства */}
        <div className="property-section">
          <h4>Позиция и размер</h4>
          
          <div className="property-row">
            <div className="property-field">
              <label>X</label>
              <input
                type="number"
                value={Math.round(selectedWidget.x)}
                onChange={(e) => handlePropertyChange('x', parseFloat(e.target.value))}
              />
            </div>
            <div className="property-field">
              <label>Y</label>
              <input
                type="number"
                value={Math.round(selectedWidget.y)}
                onChange={(e) => handlePropertyChange('y', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="property-row">
            <div className="property-field">
              <label>Ширина</label>
              <input
                type="number"
                value={Math.round(selectedWidget.width)}
                onChange={(e) => handlePropertyChange('width', parseFloat(e.target.value))}
                min={1}
              />
            </div>
            <div className="property-field">
              <label>Высота</label>
              <input
                type="number"
                value={Math.round(selectedWidget.height)}
                onChange={(e) => handlePropertyChange('height', parseFloat(e.target.value))}
                min={1}
              />
            </div>
          </div>

          <div className="property-field">
            <label>Поворот (градусы)</label>
            <input
              type="number"
              value={Math.round(selectedWidget.rotation || 0)}
              onChange={(e) => handlePropertyChange('rotation', parseFloat(e.target.value))}
            />
          </div>

          <div className="property-field">
            <label>Z-Index (порядок)</label>
            <input
              type="number"
              min="0"
              value={selectedWidget.zIndex || 0}
              onChange={(e) => handlePropertyChange('zIndex', Math.max(0, parseInt(e.target.value) || 0))}
            />
            <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  // const { bringToFront } = useEditorStore.getState();
// bringToFront(selectedWidget.id);
                }}
                style={{ flex: 1, fontSize: '11px', padding: '4px' }}
                title="На передний план"
              >
                ⬆️ Наверх
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  // const { sendToBack } = useEditorStore.getState();
// sendToBack(selectedWidget.id);
                }}
                style={{ flex: 1, fontSize: '11px', padding: '4px' }}
                title="На задний план"
              >
                ⬇️ Вниз
              </button>
            </div>
          </div>

          <div className="property-field" style={{ marginTop: '12px' }}>
            <button
              className={selectedWidget.locked ? 'btn-danger' : 'btn-secondary'}
              onClick={() => {
                // const { toggleLockWidget } = useEditorStore.getState();
                // toggleLockWidget(selectedWidget.id);
              }}
              style={{ width: '100%' }}
            >
              {selectedWidget.locked ? '🔒 Разблокировать' : '🔓 Заблокировать'}
            </button>
            {selectedWidget.locked && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                Заблокированный виджет нельзя перемещать и изменять размер
              </div>
            )}
          </div>
        </div>



        {/* Видимость — общее для всех виджетов */}
        <div className="property-section">
          <h4>Видимость</h4>
          <div className="property-field">
            <label>
              <input
                type="checkbox"
                checked={(selectedWidget as any).visible !== false}
                onChange={(e) => updateWidget(selectedWidget.id, { visible: e.target.checked } as any)}
              />
              Видимый по умолчанию
            </label>
          </div>
        </div>

        {/* Прозрачность — общее для всех виджетов */}
        <div className="property-section">
          <h4>Прозрачность</h4>
          <div className="property-field">
            <label>Прозрачность: {Math.round((selectedWidget.properties.opacity ?? 1) * 100)}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((selectedWidget.properties.opacity ?? 1) * 100)}
              onChange={(e) => handlePropertiesChange('opacity', parseInt(e.target.value) / 100)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Специфичные свойства виджета */}
        <div className="property-section">
          <h4>Параметры виджета</h4>
          

          {selectedWidget.type === 'browser' && (
            <>
              <h4>Локальный браузер</h4>
              <div className="property-field">
                <span style={{ fontSize: '12px', color: '#888' }}>
                  Страниц: {(selectedWidget.properties.pages || []).length}
                </span>
              </div>
              <div className="property-field">
                <label>Позиция меню</label>
                <select
                  value={selectedWidget.properties.menuPosition || 'top'}
                  onChange={(e) => handlePropertiesChange('menuPosition', e.target.value)}
                >
                  <option value="top">Сверху</option>
                  <option value="bottom">Снизу</option>
                  <option value="left">Слева</option>
                  <option value="right">Справа</option>
                </select>
              </div>
              <div className="property-field">
                <label>Цвет фона меню</label>
                <input type="color"
                  value={selectedWidget.properties.menuBgColor || '#2c3e50'}
                  onChange={(e) => handlePropertiesChange('menuBgColor', e.target.value)}
                />
              </div>
              <div className="property-field">
                <label>Цвет текста меню</label>
                <input type="color"
                  value={selectedWidget.properties.menuTextColor || '#ffffff'}
                  onChange={(e) => handlePropertiesChange('menuTextColor', e.target.value)}
                />
              </div>
              <div className="property-field">
                <label>Фон контента</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="color"
                    value={selectedWidget.properties.contentBgColor === 'transparent' ? '#ffffff' : (selectedWidget.properties.contentBgColor || '#ffffff')}
                    disabled={selectedWidget.properties.contentBgColor === 'transparent'}
                    onChange={(e) => handlePropertiesChange('contentBgColor', e.target.value)}
                  />
                  <label style={{ fontSize: '12px', color: '#aaa' }}>
                    <input type="checkbox"
                      checked={selectedWidget.properties.contentBgColor === 'transparent'}
                      onChange={(e) => handlePropertiesChange('contentBgColor', e.target.checked ? 'transparent' : '#ffffff')}
                    />{' '}Прозрачный
                  </label>
                </div>
              </div>
              <div className="property-field">
                <label>Размер шрифта</label>
                <input type="number" min={10} max={32}
                  value={selectedWidget.properties.menuFontSize || 14}
                  onChange={(e) => handlePropertiesChange('menuFontSize', Number(e.target.value))}
                />
              </div>
              <div className="property-field" style={{ marginTop: '8px' }}>
                <button
                  style={{
                    width: '100%', background: '#007acc', color: '#fff',
                    border: 'none', padding: '8px', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '13px'
                  }}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-browser-editor', {
                      detail: { widgetId: selectedWidget.id }
                    }));
                  }}
                >
                  ✏️ Редактировать страницы
                </button>
              </div>
            </>
          )}


              {/* === BROWSER-MENU === */}
              {selectedWidget.type === 'browser-menu' && (
                <>
                  <h4>Меню браузера</h4>
                  <div className="property-field">
                    <label>ID связи</label>
                    <input type="text" readOnly
                      value={selectedWidget.properties.browserId || ''}
                      style={{ fontSize: '11px', color: '#888' }}
                    />
                  </div>
                  <div className="property-field">
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      Страниц: {(selectedWidget.properties.pages || []).length}
                    </span>
                  </div>
                  <div className="property-field">
                    <label>Ориентация</label>
                    <select
                      value={selectedWidget.properties.orientation || 'vertical'}
                      onChange={(e) => handlePropertiesChange('orientation', e.target.value)}
                    >
                      <option value="vertical">Вертикальная</option>
                      <option value="horizontal">Горизонтальная</option>
                    </select>
                  </div>
                  <div className="property-field">
                    <label>Цвет фона меню</label>
                    <input type="color"
                      value={selectedWidget.properties.menuBgColor || '#2c3e50'}
                      onChange={(e) => handlePropertiesChange('menuBgColor', e.target.value)}
                    />
                  </div>
                  <div className="property-field">
                    <label>Цвет текста</label>
                    <input type="color"
                      value={selectedWidget.properties.menuTextColor || '#ffffff'}
                      onChange={(e) => handlePropertiesChange('menuTextColor', e.target.value)}
                    />
                  </div>
                  <div className="property-field">
                    <label>Размер шрифта</label>
                    <input type="number" min={10} max={32}
                      value={selectedWidget.properties.menuFontSize || 14}
                      onChange={(e) => handlePropertiesChange('menuFontSize', Number(e.target.value))}
                    />
                  </div>
                  <div className="property-field" style={{ marginTop: '8px' }}>
                    <button
                      style={{ width: '100%', background: '#007acc', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                      onClick={() => window.dispatchEvent(new CustomEvent('open-browser-editor', { detail: { widgetId: selectedWidget.id } }))}
                    >
                      ✏️ Редактировать страницы
                    </button>
                  </div>
                </>
              )}

              {/* === BROWSER-CONTENT === */}
              {selectedWidget.type === 'browser-content' && (
                <>
                  <h4>Контент браузера</h4>
                  <div className="property-field">
                    <label>ID связи</label>
                    <input type="text" readOnly
                      value={selectedWidget.properties.browserId || ''}
                      style={{ fontSize: '11px', color: '#888' }}
                    />
                  </div>
                  <div className="property-field">
                    <label>Фон контента</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="color"
                        value={selectedWidget.properties.contentBgColor === 'transparent' ? '#ffffff' : (selectedWidget.properties.contentBgColor || '#ffffff')}
                        disabled={selectedWidget.properties.contentBgColor === 'transparent'}
                        onChange={(e) => handlePropertiesChange('contentBgColor', e.target.value)}
                      />
                      <label style={{ fontSize: '12px', color: '#aaa' }}>
                        <input type="checkbox"
                          checked={selectedWidget.properties.contentBgColor === 'transparent'}
                          onChange={(e) => handlePropertiesChange('contentBgColor', e.target.checked ? 'transparent' : '#ffffff')}
                        />{' '}Прозрачный
                      </label>
                    </div>
                  </div>
                </>
              )}

          {selectedWidget.type === 'shape' && (
            <>
              <div className="property-field">
                <label>Тип фигуры</label>
                <select
                  value={selectedWidget.properties.shapeType || 'rectangle'}
                  onChange={(e) => handlePropertiesChange('shapeType', e.target.value)}
                >
                  <option value="rectangle">Прямоугольник</option>
                  <option value="circle">Круг</option>
                  <option value="ellipse">Эллипс</option>
                  <option value="triangle">Треугольник</option>
                  <option value="pentagon">Пятиугольник</option>
                  <option value="hexagon">Шестиугольник</option>
                  <option value="star">Звезда</option>
                  <option value="diamond">Ромб</option>
                  <option value="line">Линия</option>
                  <option value="arrow">Стрелка</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Заливка</h4>

              <div className="property-field">
                <label>Цвет заливки</label>
                <input
                  type="color"
                  value={selectedWidget.properties.fillColor || '#4a90e2'}
                  onChange={(e) => handlePropertiesChange('fillColor', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Прозрачность</label>
                <input
                  type="range"
                  value={(selectedWidget.properties.opacity || 1) * 100}
                  onChange={(e) => handlePropertiesChange('opacity', parseInt(e.target.value) / 100)}
                  min={0}
                  max={100}
                />
                <span style={{ fontSize: '11px', color: '#888' }}>
                  {Math.round((selectedWidget.properties.opacity || 1) * 100)}%
                </span>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Контур</h4>

              <div className="property-field">
                <label>Толщина контура</label>
                <input
                  type="number"
                  value={selectedWidget.properties.strokeWidth || 0}
                  onChange={(e) => handlePropertiesChange('strokeWidth', parseInt(e.target.value))}
                  min={0}
                  max={20}
                />
              </div>

              {selectedWidget.properties.strokeWidth > 0 && (
                <div className="property-field">
                  <label>Цвет контура</label>
                  <input
                    type="color"
                    value={selectedWidget.properties.strokeColor || '#2c3e50'}
                    onChange={(e) => handlePropertiesChange('strokeColor', e.target.value)}
                  />
                </div>
              )}

              {selectedWidget.properties.shapeType === 'rectangle' && (
                <div className="property-field">
                  <label>Скругление углов</label>
                  <input
                    type="number"
                    value={selectedWidget.properties.cornerRadius || 0}
                    onChange={(e) => handlePropertiesChange('cornerRadius', parseInt(e.target.value))}
                    min={0}
                    max={100}
                  />
                </div>
              )}
            </>
          )}

          {selectedWidget.type === 'button' && (
            <>
              {/* Стили кнопок */}
              <div className="property-field">
                <label>Стиль кнопки</label>
                <select
                  onChange={(e) => {
                    const styleName = e.target.value;
                    if (styleName === 'custom') return;
                    
                    // Загружаем стиль
                    import('../utils/buttonStyles').then(({ buttonStyles }) => {
                      const style = buttonStyles.find(s => s.name === styleName);
                      if (style) {
                        updateWidget(selectedWidget.id, {
                          properties: {
                            ...selectedWidget.properties,
                            ...style.properties
                          }
                        });
                      }
                    });
                  }}
                >
                  <option value="custom">Пользовательский</option>
                  <option value="По умолчанию">По умолчанию</option>
                  <option value="Основная">Основная (синяя с тенью)</option>
                  <option value="Успех">Успех (зелёная)</option>
                  <option value="Опасность">Опасность (красная)</option>
                  <option value="Контурная">Контурная</option>
                  <option value="Призрак">Призрак</option>
                  <option value="Градиент">Градиент</option>
                  <option value="Минимализм">Минимализм</option>
                  <option value="Неон">Неон</option>
                  <option value="Классика">Классика</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Текст</h4>

              <div className="property-field">
                <label>Текст кнопки</label>
                <input
                  type="text"
                  value={selectedWidget.properties.text || 'Button'}
                  onChange={(e) => handlePropertiesChange('text', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Размер шрифта</label>
                <input
                  type="number"
                  value={selectedWidget.properties.fontSize || 16}
                  onChange={(e) => handlePropertiesChange('fontSize', parseInt(e.target.value))}
                  min={8}
                  max={72}
                />
              </div>

              <div className="property-field">
                <label>Шрифт</label>
                <select
                  value={selectedWidget.properties.fontFamily || 'Arial'}
                  onChange={(e) => handlePropertiesChange('fontFamily', e.target.value)}
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>

              <div className="property-field">
                <label>Начертание</label>
                <select
                  value={selectedWidget.properties.fontWeight || 'normal'}
                  onChange={(e) => handlePropertiesChange('fontWeight', e.target.value)}
                >
                  <option value="normal">Обычный</option>
                  <option value="bold">Жирный</option>
                </select>
              </div>

              <div className="property-field">
                <label>Выравнивание</label>
                <select
                  value={selectedWidget.properties.textAlign || 'center'}
                  onChange={(e) => handlePropertiesChange('textAlign', e.target.value)}
                >
                  <option value="left">По левому краю</option>
                  <option value="center">По центру</option>
                  <option value="right">По правому краю</option>
                </select>
              </div>

              <div className="property-field">
                <label>Цвет текста</label>
                <input
                  type="color"
                  value={selectedWidget.properties.textColor || '#ffffff'}
                  onChange={(e) => handlePropertiesChange('textColor', e.target.value)}
                />
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Фон</h4>

              <div className="property-field">
                <label>Цвет фона</label>
                <input
                  type="color"
                  value={selectedWidget.properties.backgroundColor || '#2ecc71'}
                  onChange={(e) => handlePropertiesChange('backgroundColor', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Скругление углов</label>
                <input
                  type="number"
                  value={selectedWidget.properties.borderRadius || 8}
                  onChange={(e) => handlePropertiesChange('borderRadius', parseInt(e.target.value))}
                  min={0}
                  max={50}
                />
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Рамка</h4>

              <div className="property-field">
                <label>Толщина рамки</label>
                <input
                  type="number"
                  value={selectedWidget.properties.borderWidth || 0}
                  onChange={(e) => handlePropertiesChange('borderWidth', parseInt(e.target.value))}
                  min={0}
                  max={10}
                />
              </div>

              {selectedWidget.properties.borderWidth > 0 && (
                <>
                  <div className="property-field">
                    <label>Цвет рамки</label>
                    <input
                      type="color"
                      value={selectedWidget.properties.borderColor || '#000000'}
                      onChange={(e) => handlePropertiesChange('borderColor', e.target.value)}
                    />
                  </div>

                  <div className="property-field">
                    <label>Стиль рамки</label>
                    <select
                      value={selectedWidget.properties.borderStyle || 'solid'}
                      onChange={(e) => handlePropertiesChange('borderStyle', e.target.value)}
                    >
                      <option value="solid">Сплошная</option>
                      <option value="dashed">Штриховая</option>
                      <option value="dotted">Пунктирная</option>
                    </select>
                  </div>
                </>
              )}

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Тень</h4>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.shadowEnabled || false}
                    onChange={(e) => handlePropertiesChange('shadowEnabled', e.target.checked)}
                  />
                  Включить тень
                </label>
              </div>

              {selectedWidget.properties.shadowEnabled && (
                <>
                  <div className="property-field">
                    <label>Цвет тени</label>
                    <input
                      type="color"
                      value={selectedWidget.properties.shadowColor || '#000000'}
                      onChange={(e) => handlePropertiesChange('shadowColor', e.target.value)}
                    />
                  </div>

                  <div className="property-field">
                    <label>Размытие</label>
                    <input
                      type="number"
                      value={selectedWidget.properties.shadowBlur || 10}
                      onChange={(e) => handlePropertiesChange('shadowBlur', parseInt(e.target.value))}
                      min={0}
                      max={50}
                    />
                  </div>

                  <div className="property-row">
                    <div className="property-field">
                      <label>Смещение X</label>
                      <input
                        type="number"
                        value={selectedWidget.properties.shadowOffsetX || 0}
                        onChange={(e) => handlePropertiesChange('shadowOffsetX', parseInt(e.target.value))}
                        min={-50}
                        max={50}
                      />
                    </div>
                    <div className="property-field">
                      <label>Смещение Y</label>
                      <input
                        type="number"
                        value={selectedWidget.properties.shadowOffsetY || 4}
                        onChange={(e) => handlePropertiesChange('shadowOffsetY', parseInt(e.target.value))}
                        min={-50}
                        max={50}
                      />
                    </div>
                  </div>

                  <div className="property-field">
                    <label>Прозрачность</label>
                    <input
                      type="range"
                      value={(selectedWidget.properties.shadowOpacity || 0.3) * 100}
                      onChange={(e) => handlePropertiesChange('shadowOpacity', parseInt(e.target.value) / 100)}
                      min={0}
                      max={100}
                    />
                    <span style={{ fontSize: '11px', color: '#888' }}>
                      {Math.round((selectedWidget.properties.shadowOpacity || 0.3) * 100)}%
                    </span>
                  </div>
                </>
              )}

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Действия</h4>

              <ActionEditor
                widget={selectedWidget}
                onUpdate={(actions) => {
                  updateWidget(selectedWidget.id, {
                    properties: {
                      ...selectedWidget.properties,
                      actions
                    }
                  });
                }}
                allWidgets={project.widgets}
              />
            </>
          )}

          {selectedWidget.type === 'text' && (
            <>
              <div className="property-field">
                <label>Текст</label>
                <textarea
                  value={selectedWidget.properties.text || 'Text'}
                  onChange={(e) => handlePropertiesChange('text', e.target.value)}
                  rows={6}
                />
              </div>

              <div className="property-field">
                <label>Загрузить текстовый файл</label>
                <input
                  type="file"
                  accept=".txt,.pdf,.odt,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        // Динамический импорт утилиты
                        const { extractTextFromFile, loadRequiredLibraries } = await import('../utils/fileTextExtractor');
                        
                        // Загружаем библиотеки если нужно
                        loadRequiredLibraries();
                        
                        // Показываем индикатор загрузки
                        handlePropertiesChange('text', 'Загрузка файла...');
                        
                        // Извлекаем текст
                        const text = await extractTextFromFile(file);
                        
                        // Обновляем виджет
                        updateWidget(selectedWidget.id, {
                          properties: {
                            ...selectedWidget.properties,
                            text: text,
                            sourceFile: file.name
                          }
                        });
                      } catch (error) {
                        console.error('Error loading file:', error);
                        alert(`Ошибка: ${error instanceof Error ? error.message : 'Не удалось загрузить файл'}`);
                        handlePropertiesChange('text', 'Text');
                      }
                    }
                    e.target.value = '';
                  }}
                />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Поддерживаются: TXT, PDF, ODT, DOCX
                </div>
                {selectedWidget.properties.sourceFile && (
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                    📄 {selectedWidget.properties.sourceFile}
                  </div>
                )}
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Шрифт</h4>

              <div className="property-field">
                <label>Размер шрифта</label>
                <input
                  type="number"
                  value={selectedWidget.properties.fontSize || 16}
                  onChange={(e) => handlePropertiesChange('fontSize', parseInt(e.target.value))}
                  min={8}
                  max={144}
                />
              </div>

              <div className="property-field">
                <label>Семейство шрифта</label>
                <select
                  value={selectedWidget.properties.fontFamily || 'Arial'}
                  onChange={(e) => handlePropertiesChange('fontFamily', e.target.value)}
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                  <option value="Impact">Impact</option>
                </select>
              </div>

              <div className="property-field">
                <label>Начертание</label>
                <select
                  value={selectedWidget.properties.fontWeight || 'normal'}
                  onChange={(e) => handlePropertiesChange('fontWeight', e.target.value)}
                >
                  <option value="normal">Обычный</option>
                  <option value="bold">Жирный</option>
                </select>
              </div>

              <div className="property-field">
                <label>Стиль</label>
                <select
                  value={selectedWidget.properties.fontStyle || 'normal'}
                  onChange={(e) => handlePropertiesChange('fontStyle', e.target.value)}
                >
                  <option value="normal">Обычный</option>
                  <option value="italic">Курсив</option>
                </select>
              </div>

              <div className="property-field">
                <label>Декорация</label>
                <select
                  value={selectedWidget.properties.textDecoration || 'none'}
                  onChange={(e) => handlePropertiesChange('textDecoration', e.target.value)}
                >
                  <option value="none">Нет</option>
                  <option value="underline">Подчёркнутый</option>
                  <option value="line-through">Зачёркнутый</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Выравнивание</h4>

              <div className="property-field">
                <label>По горизонтали</label>
                <select
                  value={selectedWidget.properties.textAlign || 'left'}
                  onChange={(e) => handlePropertiesChange('textAlign', e.target.value)}
                >
                  <option value="left">По левому краю</option>
                  <option value="center">По центру</option>
                  <option value="right">По правому краю</option>
                </select>
              </div>

              <div className="property-field">
                <label>По вертикали</label>
                <select
                  value={selectedWidget.properties.verticalAlign || 'top'}
                  onChange={(e) => handlePropertiesChange('verticalAlign', e.target.value)}
                >
                  <option value="top">Сверху</option>
                  <option value="middle">По центру</option>
                  <option value="bottom">Снизу</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Цвета и фон</h4>

              <div className="property-field">
                <label>Цвет текста</label>
                <input
                  type="color"
                  value={selectedWidget.properties.textColor || '#000000'}
                  onChange={(e) => handlePropertiesChange('textColor', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Цвет фона</label>
                <input
                  type="color"
                  value={selectedWidget.properties.backgroundColor || '#ffffff'}
                  onChange={(e) => handlePropertiesChange('backgroundColor', e.target.value)}
                />
                <label style={{ marginTop: '4px', fontSize: '11px' }}>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.backgroundColor === 'transparent'}
                    onChange={(e) => handlePropertiesChange('backgroundColor', e.target.checked ? 'transparent' : '#ffffff')}
                  />
                  Прозрачный фон
                </label>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Дополнительно</h4>

              <div className="property-field">
                <label>Межстрочный интервал</label>
                <input
                  type="number"
                  value={selectedWidget.properties.lineHeight || 1.2}
                  onChange={(e) => handlePropertiesChange('lineHeight', parseFloat(e.target.value))}
                  min={0.5}
                  max={3}
                  step={0.1}
                />
              </div>

              <div className="property-field">
                <label>Отступ от края</label>
                <input
                  type="number"
                  value={selectedWidget.properties.padding || 8}
                  onChange={(e) => handlePropertiesChange('padding', parseInt(e.target.value))}
                  min={0}
                  max={50}
                />
              </div>
            </>
          )}

          {selectedWidget.type === 'image' && (
            <>
              <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '13px', fontWeight: 'bold' }}>Режим</h4>
              
              <div className="property-field">
                <label>
                  <input
                    type="radio"
                    name="imageMode"
                    checked={!selectedWidget.properties.galleryMode}
                    onChange={() => handlePropertiesChange('galleryMode', false)}
                  />
                  {' '}Одиночное изображение
                </label>
              </div>
              
              <div className="property-field">
                <label>
                  <input
                    type="radio"
                    name="imageMode"
                    checked={selectedWidget.properties.galleryMode || false}
                    onChange={() => {
                      handlePropertiesChange('galleryMode', true);
                      // Инициализируем sources если их нет
                      if (!selectedWidget.properties.sources) {
                        handlePropertiesChange('sources', []);
                      }
                    }}
                  />
                  {' '}Галерея изображений
                </label>
              </div>

              {!selectedWidget.properties.galleryMode && (
                <>
                  <div className="property-field">
                    <label>URL изображения</label>
                    <input
                      type="text"
                      value={selectedWidget.properties.src || ''}
                      onChange={(e) => handlePropertiesChange('src', e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  
                  <div className="property-field">
                    <label>Загрузить файл</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            if (result) {
                              updateWidget(selectedWidget.id, {
                                properties: {
                                  ...selectedWidget.properties,
                                  src: result,
                                  isLocalFile: true,
                                  fileName: file.name
                                }
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                    />
                    {selectedWidget.properties.isLocalFile && selectedWidget.properties.fileName && (
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        📁 {selectedWidget.properties.fileName}
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedWidget.properties.galleryMode && (
                <>
                  <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Источники (макс. 50)</h4>
                  
                  <div style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    padding: '8px',
                    marginBottom: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    {(selectedWidget.properties.sources || []).map((source: any, index: number) => (
                      <div key={source.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px',
                        padding: '6px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <span style={{ fontSize: '11px', color: '#666', minWidth: '20px' }}>
                          {index + 1}.
                        </span>
                        <span style={{ fontSize: '11px', color: source.type === 'url' ? '#007acc' : '#2ecc71' }}>
                          {source.type === 'url' ? '🌐' : '📷'}
                        </span>
                        <span style={{ 
                          flex: 1, 
                          fontSize: '11px', 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {source.value.length > 40 ? source.value.substring(0, 40) + '...' : source.value}
                        </span>
                        <button
                          onClick={() => {
                            const newSources = (selectedWidget.properties.sources || []).filter((_: any, i: number) => i !== index);
                            handlePropertiesChange('sources', newSources);
                          }}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            border: 'none',
                            background: '#e74c3c',
                            color: '#fff',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    
                    {(!selectedWidget.properties.sources || selectedWidget.properties.sources.length === 0) && (
                      <div style={{ textAlign: 'center', color: '#999', fontSize: '11px', padding: '20px' }}>
                        Нет изображений в галерее
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      id={`gallery-upload-${selectedWidget.id}`}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const currentSources = selectedWidget.properties.sources || [];
                        
                        if (currentSources.length + files.length > 50) {
                          alert('Максимум 50 изображений в галерее');
                          e.target.value = '';
                          return;
                        }

                        let loadedCount = 0;
                        const newSources: any[] = [];

                        files.forEach(file => {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            if (result) {
                              newSources.push({
                                id: `img-${Date.now()}-${Math.random()}`,
                                type: 'local',
                                value: result
                              });
                            }
                            loadedCount++;
                            
                            if (loadedCount === files.length) {
                              handlePropertiesChange('sources', [...currentSources, ...newSources]);
                            }
                          };
                          reader.readAsDataURL(file);
                        });

                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => {
                        document.getElementById(`gallery-upload-${selectedWidget.id}`)?.click();
                      }}
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: '11px', padding: '6px' }}
                    >
                      📷 Добавить файлы
                    </button>
                    
                    <button
                      onClick={() => {
                        const url = prompt('Введите URL изображения:');
                        if (url) {
                          const currentSources = selectedWidget.properties.sources || [];
                          if (currentSources.length >= 50) {
                            alert('Максимум 50 изображений в галерее');
                            return;
                          }
                          handlePropertiesChange('sources', [
                            ...currentSources,
                            {
                              id: `img-${Date.now()}-${Math.random()}`,
                              type: 'url',
                              value: url
                            }
                          ]);
                        }
                      }}
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: '11px', padding: '6px' }}
                    >
                      🌐 Добавить URL
                    </button>
                  </div>

                  <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Автопереключение</h4>
                  
                  <div className="property-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedWidget.properties.autoSwitch || false}
                        onChange={(e) => handlePropertiesChange('autoSwitch', e.target.checked)}
                      />
                      {' '}Включить автопереключение
                    </label>
                  </div>

                  {selectedWidget.properties.autoSwitch && (
                    <>
                      <div className="property-field">
                        <label>Интервал (секунды)</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={selectedWidget.properties.switchInterval || 3}
                          onChange={(e) => handlePropertiesChange('switchInterval', parseInt(e.target.value) || 3)}
                        />
                      </div>
                    </>
                  )}

                  <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Эффекты перехода</h4>
                  
                  <div className="property-field">
                    <label>Эффект</label>
                    <select
                      value={selectedWidget.properties.transition || 'fade'}
                      onChange={(e) => handlePropertiesChange('transition', e.target.value)}
                    >
                      <option value="none">Нет (мгновенно)</option>
                      <option value="fade">Затухание</option>
                      <option value="slide">Скольжение</option>
                      <option value="zoom">Увеличение</option>
                    </select>
                  </div>

                  <div className="property-field">
                    <label>Длительность (мс)</label>
                    <input
                      type="number"
                      min="100"
                      max="2000"
                      step="100"
                      value={selectedWidget.properties.transitionDuration || 500}
                      onChange={(e) => handlePropertiesChange('transitionDuration', parseInt(e.target.value) || 500)}
                    />
                  </div>

                  <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Контролы</h4>
                  
                  <div className="property-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedWidget.properties.showControls !== false}
                        onChange={(e) => handlePropertiesChange('showControls', e.target.checked)}
                      />
                      {' '}Показать стрелки
                    </label>
                  </div>

                  <div className="property-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedWidget.properties.showIndicators !== false}
                        onChange={(e) => handlePropertiesChange('showIndicators', e.target.checked)}
                      />
                      {' '}Показать индикаторы
                    </label>
                  </div>

                  <div className="property-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedWidget.properties.loop !== false}
                        onChange={(e) => handlePropertiesChange('loop', e.target.checked)}
                      />
                      {' '}Зацикливание
                    </label>
                  </div>
                </>
              )}

              <div className="property-field">
                <label>Тип заполнения</label>
                <select
                  value={selectedWidget.properties.objectFit || 'contain'}
                  onChange={(e) => handlePropertiesChange('objectFit', e.target.value)}
                >
                  <option value="contain">Пропорционально (вписать)</option>
                  <option value="cover">Заполнить весь виджет</option>
                  <option value="fill">Растянуть</option>
                  <option value="scale-down">Оригинальный размер</option>
                  <option value="adaptive">Адаптивный (изменить виджет)</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Форма обрезки</h4>
              
              <div className="property-field">
                <label>Форма</label>
                <select
                  value={selectedWidget.properties.clipShape || 'rectangle'}
                  onChange={(e) => handlePropertiesChange('clipShape', e.target.value)}
                >
                  <option value="rectangle">⬜ Прямоугольник</option>
                  <option value="circle">⚫ Круг</option>
                  <option value="ellipse">🔴 Эллипс</option>
                  <option value="triangle">🔺 Треугольник</option>
                  <option value="diamond">🔶 Ромб</option>
                  <option value="pentagon">⬢ Пятиугольник</option>
                  <option value="hexagon">⬡ Шестиугольник</option>
                  <option value="octagon">⭐ Восьмиугольник</option>
                  <option value="rounded-rectangle">🏷️ Закругленный прямоугольник</option>
                </select>
              </div>

              {selectedWidget.properties.clipShape === 'rounded-rectangle' && (
                <div className="property-field">
                  <label>Радиус углов (px)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={selectedWidget.properties.cornerRadius || 20}
                    onChange={(e) => handlePropertiesChange('cornerRadius', parseInt(e.target.value) || 20)}
                  />
                </div>
              )}

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Рамка</h4>
              
              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.borderEnabled || false}
                    onChange={(e) => handlePropertiesChange('borderEnabled', e.target.checked)}
                  />
                  Включить рамку
                </label>
              </div>

              {selectedWidget.properties.borderEnabled && (
                <>
                  <div className="property-field">
                    <label>Тип рамки</label>
                    <select
                      value={selectedWidget.properties.borderStyle || 'solid'}
                      onChange={(e) => handlePropertiesChange('borderStyle', e.target.value)}
                    >
                      <option value="solid">Сплошная</option>
                      <option value="dashed">Штриховая</option>
                      <option value="dotted">Пунктирная</option>
                      <option value="double">Двойная</option>
                    </select>
                  </div>

                  <div className="property-field">
                    <label>Толщина рамки (px)</label>
                    <input
                      type="number"
                      value={selectedWidget.properties.borderWidth || 2}
                      onChange={(e) => handlePropertiesChange('borderWidth', parseFloat(e.target.value))}
                      min={1}
                      max={20}
                    />
                  </div>

                  <div className="property-field">
                    <label>Цвет рамки</label>
                    <input
                      type="color"
                      value={selectedWidget.properties.borderColor || '#000000'}
                      onChange={(e) => handlePropertiesChange('borderColor', e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {selectedWidget.type === 'video' && (
            <>
              <div className="property-field">
                <label>Тип источника</label>
                <select
                  value={selectedWidget.properties.sourceType || 'url'}
                  onChange={(e) => handlePropertiesChange('sourceType', e.target.value)}
                >
                  <option value="url">URL / Файл</option>
                  <option value="rtsp">RTSP поток</option>
                </select>
              </div>

              {selectedWidget.properties.sourceType === 'rtsp' ? (
                <>
                  <div className="property-field">
                    <label>RTSP URL</label>
                    <input
                      type="text"
                      value={selectedWidget.properties.rtspUrl || ''}
                      onChange={(e) => handlePropertiesChange('rtspUrl', e.target.value)}
                      placeholder="rtsp://username:password@host:554/stream"
                    />
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                      Пример: rtsp://admin:12345@192.168.1.100:554/live
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="property-field">
                    <label>URL видео</label>
                    <input
                      type="text"
                      value={selectedWidget.properties.src || ''}
                      onChange={(e) => handlePropertiesChange('src', e.target.value)}
                      placeholder="https://example.com/video.mp4"
                    />
                  </div>
                  
                  <div className="property-field">
                    <label>Загрузить файл</label>
                    <input
                      type="file"
                      accept="video/*"
					  onChange={async (e) => {
					    const file = e.target.files?.[0];
					    if (file) {
						  const maxSize = 500 * 1024 * 1024; // 500 MB
						   if (file.size > maxSize) {
						     alert('⚠️ Файл слишком большой! Максимум 500 MB');
						     e.target.value = '';
						    return;
						   }
						
						   try {
						     console.log(`⏳ Загрузка видео (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);
						  
						     if (!project?.id) {
							   alert('❌ Сначала создайте или откройте проект');
							   e.target.value = '';
							   return;
						     }
						  
						     const result = await apiClient.uploadFile(project.id, file);
						  
						     if (result) {
							    updateWidget(selectedWidget.id, {
							    properties: {
								   ...selectedWidget.properties,
								   src: result.url,
								   isLocalFile: false,
								   fileName: file.name
							    }
							   });
							   alert('✅ Видео загружено на сервер!');
						     }
						   } catch (error: any) {
						     console.error('Upload error:', error);
						     alert('❌ Ошибка загрузки: ' + error.message);
						   }
						
   						   e.target.value = '';
					    }
					}}
                    />
                    {selectedWidget.properties.isLocalFile && selectedWidget.properties.fileName && (
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        📁 {selectedWidget.properties.fileName}
                      </div>
                    )}
                  </div>
                </>
              )}

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Отображение</h4>

              <div className="property-field">
                <label>Тип заполнения</label>
                <select
                  value={selectedWidget.properties.objectFit || 'contain'}
                  onChange={(e) => handlePropertiesChange('objectFit', e.target.value)}
                >
                  <option value="contain">Пропорционально (вписать)</option>
                  <option value="cover">Заполнить весь виджет</option>
                  <option value="fill">Растянуть</option>
                  <option value="scale-down">Оригинальный размер</option>
                  <option value="adaptive">Адаптивный (изменить виджет)</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Воспроизведение</h4>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.autoplay || false}
                    onChange={(e) => handlePropertiesChange('autoplay', e.target.checked)}
                  />
                  Автовоспроизведение
                </label>
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.loop || false}
                    onChange={(e) => handlePropertiesChange('loop', e.target.checked)}
                  />
                  Повтор (loop)
                </label>
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.muted !== false}
                    onChange={(e) => handlePropertiesChange('muted', e.target.checked)}
                  />
                  Без звука (muted)
                </label>
              </div>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.controls !== false}
                    onChange={(e) => handlePropertiesChange('controls', e.target.checked)}
                  />
                  Показывать элементы управления
                </label>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Рамка</h4>

              <div className="property-field">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties.borderEnabled || false}
                    onChange={(e) => handlePropertiesChange('borderEnabled', e.target.checked)}
                  />
                  Включить рамку
                </label>
              </div>

              {selectedWidget.properties.borderEnabled && (
                <>
                  <div className="property-field">
                    <label>Стиль рамки</label>
                    <select
                      value={selectedWidget.properties.borderStyle || 'solid'}
                      onChange={(e) => handlePropertiesChange('borderStyle', e.target.value)}
                    >
                      <option value="solid">Сплошная</option>
                      <option value="dashed">Штриховая</option>
                      <option value="dotted">Пунктирная</option>
                      <option value="double">Двойная</option>
                    </select>
                  </div>

                  <div className="property-field">
                    <label>Толщина рамки</label>
                    <input
                      type="number"
                      value={selectedWidget.properties.borderWidth || 2}
                      onChange={(e) => handlePropertiesChange('borderWidth', parseInt(e.target.value))}
                      min={1}
                      max={20}
                    />
                  </div>

                  <div className="property-field">
                    <label>Цвет рамки</label>
                    <input
                      type="color"
                      value={selectedWidget.properties.borderColor || '#000000'}
                      onChange={(e) => handlePropertiesChange('borderColor', e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {selectedWidget.type === 'menu' && (
            <>
              <div className="property-field">
                <label>Ориентация</label>
                <select
                  value={selectedWidget.properties.orientation || 'horizontal'}
                  onChange={(e) => handlePropertiesChange('orientation', e.target.value)}
                >
                  <option value="horizontal">Горизонтальная</option>
                  <option value="vertical">Вертикальная</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Внешний вид</h4>

              <div className="property-field">
                <label>Цвет фона</label>
                <input
                  type="color"
                  value={selectedWidget.properties.backgroundColor || '#2c3e50'}
                  onChange={(e) => handlePropertiesChange('backgroundColor', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Цвет текста</label>
                <input
                  type="color"
                  value={selectedWidget.properties.textColor || '#ffffff'}
                  onChange={(e) => handlePropertiesChange('textColor', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Цвет при наведении</label>
                <input
                  type="color"
                  value={selectedWidget.properties.hoverColor || '#34495e'}
                  onChange={(e) => handlePropertiesChange('hoverColor', e.target.value)}
                />
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Шрифт</h4>

              <div className="property-field">
                <label>Размер шрифта</label>
                <input
                  type="number"
                  value={selectedWidget.properties.fontSize || 16}
                  onChange={(e) => handlePropertiesChange('fontSize', parseInt(e.target.value))}
                  min={10}
                  max={32}
                />
              </div>

              <div className="property-field">
                <label>Семейство шрифта</label>
                <select
                  value={selectedWidget.properties.fontFamily || 'Arial'}
                  onChange={(e) => handlePropertiesChange('fontFamily', e.target.value)}
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Размеры</h4>

              <div className="property-field">
                <label>Высота пункта</label>
                <input
                  type="number"
                  value={selectedWidget.properties.itemHeight || 40}
                  onChange={(e) => handlePropertiesChange('itemHeight', parseInt(e.target.value))}
                  min={30}
                  max={100}
                />
              </div>

              <div className="property-field">
                <label>Отступ пункта</label>
                <input
                  type="number"
                  value={selectedWidget.properties.itemPadding || 16}
                  onChange={(e) => handlePropertiesChange('itemPadding', parseInt(e.target.value))}
                  min={8}
                  max={40}
                />
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Подменю</h4>

              <div className="property-field">
                <label>Цвет фона подменю</label>
                <input
                  type="color"
                  value={selectedWidget.properties.submenuBackgroundColor || '#34495e'}
                  onChange={(e) => handlePropertiesChange('submenuBackgroundColor', e.target.value)}
                />
              </div>

              <div className="property-field">
                <label>Цвет текста подменю</label>
                <input
                  type="color"
                  value={selectedWidget.properties.submenuTextColor || '#ffffff'}
                  onChange={(e) => handlePropertiesChange('submenuTextColor', e.target.value)}
                />
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Рамка</h4>

              <div className="property-field">
                <label>Толщина рамки</label>
                <input
                  type="number"
                  value={selectedWidget.properties.borderWidth || 0}
                  onChange={(e) => handlePropertiesChange('borderWidth', parseInt(e.target.value))}
                  min={0}
                  max={10}
                />
              </div>

              {selectedWidget.properties.borderWidth > 0 && (
                <div className="property-field">
                  <label>Цвет рамки</label>
                  <input
                    type="color"
                    value={selectedWidget.properties.borderColor || '#000000'}
                    onChange={(e) => handlePropertiesChange('borderColor', e.target.value)}
                  />
                </div>
              )}

              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>Пункты меню</h4>

              <div className="property-field">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const items = selectedWidget.properties.items || [];
                    const newItem = {
                      id: `item-${Date.now()}`,
                      label: 'Новый пункт'
                    };
                    updateWidget(selectedWidget.id, {
                      properties: {
                        ...selectedWidget.properties,
                        items: [...items, newItem]
                      }
                    });
                  }}
                  style={{ width: '100%' }}
                >
                  ➕ Добавить пункт
                </button>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {(selectedWidget.properties.items || []).map((item: any, index: number) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#252525',
                      padding: '12px',
                      marginBottom: '8px',
                      borderRadius: '6px',
                      border: '1px solid #333'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px', color: '#aaa' }}>Пункт {index + 1}</strong>
                      <button
                        className="btn-danger"
                        onClick={() => {
                          const items = selectedWidget.properties.items || [];
                          updateWidget(selectedWidget.id, {
                            properties: {
                              ...selectedWidget.properties,
                              items: items.filter((i: any) => i.id !== item.id)
                            }
                          });
                        }}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        🗑️ Удалить
                      </button>
                    </div>

                    <div className="property-field">
                      <label>Название</label>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => {
                          const items = [...(selectedWidget.properties.items || [])];
                          items[index] = { ...items[index], label: e.target.value };
                          updateWidget(selectedWidget.id, {
                            properties: {
                              ...selectedWidget.properties,
                              items
                            }
                          });
                        }}
                      />
                    </div>

                    {/* Действия пункта меню */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                        Действия при клике
                      </div>
                      <ActionEditor
                        widget={{ ...selectedWidget, id: item.id, properties: item }}
                        onUpdate={(actions) => {
                          const items = [...(selectedWidget.properties.items || [])];
                          items[index] = { ...items[index], actions };
                          updateWidget(selectedWidget.id, {
                            properties: {
                              ...selectedWidget.properties,
                              items
                            }
                          });
                        }}
                        allWidgets={project.widgets}
                      />
                    </div>

                    {/* Подпункты */}
                    <div style={{ marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid #444' }}>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                        Подпункты
                      </div>

                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const items = [...(selectedWidget.properties.items || [])];
                          const children = items[index].children || [];
                          items[index] = {
                            ...items[index],
                            children: [...children, {
                              id: `subitem-${Date.now()}`,
                              label: 'Подпункт'
                            }]
                          };
                          updateWidget(selectedWidget.id, {
                            properties: {
                              ...selectedWidget.properties,
                              items
                            }
                          });
                        }}
                        style={{ width: '100%', fontSize: '11px', padding: '6px', marginBottom: '8px' }}
                      >
                        ➕ Добавить подпункт
                      </button>

                      {(item.children || []).map((child: any, childIndex: number) => (
                        <div
                          key={child.id}
                          style={{
                            background: '#1e1e1e',
                            padding: '8px',
                            marginBottom: '6px',
                            borderRadius: '4px',
                            border: '1px solid #2a2a2a'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={child.label}
                              onChange={(e) => {
                                const items = [...(selectedWidget.properties.items || [])];
                                const children = [...(items[index].children || [])];
                                children[childIndex] = { ...children[childIndex], label: e.target.value };
                                items[index] = { ...items[index], children };
                                updateWidget(selectedWidget.id, {
                                  properties: {
                                    ...selectedWidget.properties,
                                    items
                                  }
                                });
                              }}
                              style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                            />
                            <button
                              className="btn-danger"
                              onClick={() => {
                                const items = [...(selectedWidget.properties.items || [])];
                                const children = items[index].children?.filter((c: any) => c.id !== child.id) || [];
                                items[index] = { ...items[index], children };
                                updateWidget(selectedWidget.id, {
                                  properties: {
                                    ...selectedWidget.properties,
                                    items
                                  }
                                });
                              }}
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ID виджета */}
        <div className="property-section">
          <div className="property-field">
            <label>ID</label>
            <input
              type="text"
              value={selectedWidget.id}
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
