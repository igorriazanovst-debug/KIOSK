import React from 'react';
import { WidgetAction } from '../types';
import { Widget } from '../types';
import './ActionEditor.css';

interface ActionEditorProps {
  widget: Widget;
  onUpdate: (actions: WidgetAction[]) => void;
  allWidgets: Widget[];
}

const ActionEditor: React.FC<ActionEditorProps> = ({ widget, onUpdate, allWidgets }) => {
  const actions = widget.properties.actions || [];

  const addAction = () => {
    const newAction: WidgetAction = {
      type: 'url',
      url: ''
    };
    onUpdate([...actions, newAction]);
  };

  const updateAction = (index: number, updates: Partial<WidgetAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    onUpdate(newActions);
  };

  const removeAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    onUpdate(newActions);
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      url: '🔗 Открыть URL',
      page: '📄 Перейти на страницу',
      popup: '💬 Показать popup',
      widget_show: '👁️ Показать виджет',
      widget_hide: '🙈 Скрыть виджет',
      video_play: '▶️ Воспроизвести видео',
      video_stop: '⏸️ Остановить видео'
    };
    return labels[type] || type;
  };

  return (
    <div className="action-editor">
      <h4 style={{ marginBottom: '12px', fontSize: '12px', color: '#aaa' }}>
        Действия при клике
      </h4>

      {actions.length === 0 && (
        <div style={{ 
          padding: '16px', 
          background: '#252525', 
          borderRadius: '6px',
          textAlign: 'center',
          color: '#888',
          fontSize: '13px',
          marginBottom: '12px'
        }}>
          Нет действий. Добавьте действие ниже.
        </div>
      )}

      {actions.map((action, index) => (
        <div key={index} className="action-item">
          <div className="action-header">
            <span className="action-number">#{index + 1}</span>
            <button
              className="btn-danger-small"
              onClick={() => removeAction(index)}
              title="Удалить действие"
            >
              🗑️
            </button>
          </div>

          <div className="action-body">
            {/* Тип действия */}
            <div className="property-field">
              <label>Тип действия</label>
              <select
                value={action.type}
                onChange={(e) => updateAction(index, { type: e.target.value as any })}
              >
                <option value="url">🔗 Открыть URL</option>
                <option value="page">📄 Перейти на страницу</option>
                <option value="popup">💬 Показать popup</option>
                <option value="widget_show">👁️ Показать виджет</option>
                <option value="widget_hide">🙈 Скрыть виджет</option>
                <option value="video_play">▶️ Воспроизвести видео</option>
                <option value="video_stop">⏸️ Остановить видео</option>
              </select>
            </div>

            {/* Настройки URL */}
            {action.type === 'url' && (
              <>
                <div className="property-field">
                  <label>URL адрес</label>
                  <input
                    type="text"
                    value={action.url || ''}
                    onChange={(e) => updateAction(index, { url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="property-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={action.openInNewTab || false}
                      onChange={(e) => updateAction(index, { openInNewTab: e.target.checked })}
                    />
                    Открыть в новой вкладке
                  </label>
                </div>
              </>
            )}

            {/* Настройки страницы */}
            {action.type === 'page' && (
              <div className="property-field">
                <label>ID страницы</label>
                <input
                  type="text"
                  value={action.pageId || ''}
                  onChange={(e) => updateAction(index, { pageId: e.target.value })}
                  placeholder="page-1"
                />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Укажите ID страницы для перехода
                </div>
              </div>
            )}

            {/* Настройки popup */}
            {action.type === 'popup' && (
              <>
                <div className="property-field">
                  <label>Заголовок popup</label>
                  <input
                    type="text"
                    value={action.popupTitle || ''}
                    onChange={(e) => updateAction(index, { popupTitle: e.target.value })}
                    placeholder="Заголовок"
                  />
                </div>
                <div className="property-field">
                  <label>Содержимое popup</label>
                  <textarea
                    value={action.popupContent || ''}
                    onChange={(e) => updateAction(index, { popupContent: e.target.value })}
                    rows={4}
                    placeholder="Текст сообщения..."
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="property-field" style={{ flex: 1 }}>
                    <label>Ширина (px)</label>
                    <input
                      type="number"
                      value={action.popupWidth || 400}
                      onChange={(e) => updateAction(index, { popupWidth: parseInt(e.target.value) })}
                      min={200}
                      max={1000}
                    />
                  </div>
                  <div className="property-field" style={{ flex: 1 }}>
                    <label>Высота (px)</label>
                    <input
                      type="number"
                      value={action.popupHeight || 300}
                      onChange={(e) => updateAction(index, { popupHeight: parseInt(e.target.value) })}
                      min={150}
                      max={800}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Настройки показа/скрытия виджета */}
            {(action.type === 'widget_show' || action.type === 'widget_hide') && (
              <div className="property-field">
                <label>Целевой виджет</label>
                <select
                  value={action.targetWidgetId || ''}
                  onChange={(e) => updateAction(index, { targetWidgetId: e.target.value })}
                >
                  <option value="">Выберите виджет...</option>
                  {allWidgets
                    .filter(w => w.id !== widget.id)
                    .map(w => (
                      <option key={w.id} value={w.id}>
                        {w.type} - {w.id}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Настройки управления видео */}
            {(action.type === 'video_play' || action.type === 'video_stop') && (
              <div className="property-field">
                <label>Видео виджет</label>
                <select
                  value={action.targetWidgetId || ''}
                  onChange={(e) => updateAction(index, { targetWidgetId: e.target.value })}
                >
                  <option value="">Выберите видео...</option>
                  {allWidgets
                    .filter(w => w.type === 'video')
                    .map(w => (
                      <option key={w.id} value={w.id}>
                        Video - {w.id}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        className="btn-secondary"
        onClick={addAction}
        style={{ width: '100%', marginTop: '8px' }}
      >
        ➕ Добавить действие
      </button>
    </div>
  );
};

export default ActionEditor;
