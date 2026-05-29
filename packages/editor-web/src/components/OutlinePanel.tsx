import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { Eye, EyeOff, Lock, Unlock, Trash2 } from 'lucide-react';
import './OutlinePanel.css';

const OutlinePanel: React.FC = () => {
  const { project, selectedWidgetIds, selectWidget, updateWidget, deleteWidget } = useEditorStore();

  if (!project) return null;

  // Получаем иконку для типа виджета
  const getWidgetIcon = (type: string): string => {
    const icons: Record<string, string> = {
      navigation: '🧭',
      shape: '🔷',
      rectangle: '🔷',
      text: '📝',
      button: '🔘',
      image: '🖼️',
      video: '🎬',
      menu: '🍔',
      browser: '🌐',
      'browser-menu': '🌐',
      'browser-content': '📄'
    };
    return icons[type] || '⬜';
  };

  // Получаем название виджета
  const getWidgetLabel = (widget: any): string => {
    if (widget.properties.text) {
      const text = widget.properties.text.substring(0, 20);
      return text.length < widget.properties.text.length ? `${text}...` : text;
    }
    if (widget.properties.items) {
      return `Меню (${widget.properties.items.length} пунктов)`;
    }
    return widget.type.charAt(0).toUpperCase() + widget.type.slice(1);
  };

  // Сортируем виджеты по z-index
  const sortedWidgets = [...project.widgets].sort((a, b) => {
    return (b.zIndex || 0) - (a.zIndex || 0);
  });

  return (
    <div className="outline-panel">
      <div className="outline-header">
        <h3>Структура</h3>
        <span className="outline-count">{project.widgets.length} виджетов</span>
      </div>

      <div className="outline-list">
        {sortedWidgets.length === 0 ? (
          <div className="outline-empty">
            <p>Нет виджетов</p>
            <span>Добавьте виджеты из библиотеки</span>
          </div>
        ) : (
          sortedWidgets.map((widget) => {
            const isSelected = selectedWidgetIds.includes(widget.id);
            const isLocked = widget.locked || false;
            const isVisible = (widget as any).visible !== false;

            return (
              <div
                key={widget.id}
                className={`outline-item ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${!isVisible ? 'invisible' : ''}`}
                onClick={() => selectWidget(widget.id, false)}
              >
                <div className="outline-item-main">
                  <span className="outline-icon">{getWidgetIcon(widget.type)}</span>
                  <div className="outline-info">
                    <span className="outline-label">{getWidgetLabel(widget)}</span>
                    <span className="outline-meta">
                      {widget.width}×{widget.height} • z:{widget.zIndex || 0}
                    </span>
                  </div>
                </div>

                <div className="outline-actions" onClick={(e) => e.stopPropagation()}>
                  {/* Видимость */}
                  <button
                    className={`outline-action-btn ${!isVisible ? 'hidden-btn' : ''}`}
                    onClick={() => updateWidget(widget.id, { visible: !isVisible } as any)}
                    title={isVisible ? 'Скрыть' : 'Показать'}
                  >
                    {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>

                  {/* Блокировка */}
                  <button
                    className="outline-action-btn"
                    onClick={() => {
                      updateWidget(widget.id, { locked: !isLocked });
                    }}
                    title={isLocked ? 'Разблокировать' : 'Заблокировать'}
                  >
                    {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>

                  {/* Удаление */}
                  <button
                    className="outline-action-btn delete"
                    onClick={() => {
                      if (window.confirm(`Удалить виджет "${getWidgetLabel(widget)}"?`)) {
                        deleteWidget(widget.id);
                      }
                    }}
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OutlinePanel;
