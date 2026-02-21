import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { Square, Type, Image, Video, MousePointer, Menu, Globe } from 'lucide-react';
import OutlinePanel from './OutlinePanel';
import './WidgetLibrary.css';

const WidgetLibrary: React.FC = () => {
  const { addWidget, project } = useEditorStore();

  const widgetTypes = [
    {
      type: 'shape',
      name: 'Фигура',
      icon: Square,
      defaultProps: {
        shapeType: 'rectangle',
        fillColor: '#4a90e2',
        strokeColor: '#2c3e50',
        strokeWidth: 0,
        cornerRadius: 0,
        opacity: 1
      }
    },
    {
      type: 'button',
      name: 'Кнопка',
      icon: MousePointer,
      defaultProps: {
        text: 'Нажми меня',
        backgroundColor: '#4a90e2',
        textColor: '#ffffff'
      }
    },
    {
      type: 'text',
      name: 'Текст',
      icon: Type,
      defaultProps: {
        text: 'Введите текст',
        fontSize: 24,
        color: '#000000'
      }
    },
    {
      type: 'image',
      name: 'Изображение',
      icon: Image,
      defaultProps: {
        src: ''
      }
    },
    {
      type: 'video',
      name: 'Видео',
      icon: Video,
      defaultProps: {
        src: '',
        autoplay: false,
        loop: false
      }
    },

    {
      type: 'menu',
      name: 'Меню',
      icon: Menu,
      defaultProps: {
        orientation: 'horizontal',
        items: [
          { id: '1', label: 'Главная' },
          { id: '2', label: 'О нас' },
          { id: '3', label: 'Услуги', children: [
            { id: '3-1', label: 'Услуга 1' },
            { id: '3-2', label: 'Услуга 2' }
          ]},
          { id: '4', label: 'Контакты' }
        ],
        backgroundColor: '#2c3e50',
        textColor: '#ffffff',
        hoverColor: '#34495e',
        fontSize: 16,
        fontFamily: 'Arial',
        itemPadding: 16,
        submenuBackgroundColor: '#34495e',
        submenuTextColor: '#ffffff',
        borderWidth: 0,
        borderColor: '#000000',
        itemHeight: 40
      }
    }
  ];

  const handleAddWidget = (type: string, defaultProps: any) => {
    if (!project) return;

    const { setPendingWidget } = useEditorStore.getState();
    setPendingWidget(type, defaultProps);
  };

  return (
    <div className="widget-library panel">
      <div className="widget-library-header">
        <h3>Виджеты</h3>
      </div>
      <div className="widget-library-content">
        {widgetTypes.map(widgetType => {
          const Icon = widgetType.icon;
          return (
            <button
              key={widgetType.type}
              className="widget-item"
              onClick={() => handleAddWidget(widgetType.type, widgetType.defaultProps)}
              title={`Добавить ${widgetType.name}`}
            >
              <Icon size={24} />
              <span>{widgetType.name}</span>
            </button>
          );
        })}
      </div>
      <div className="widget-library-footer">
        <button
          className="btn-secondary"
          style={{ width: '100%', fontSize: '12px', marginBottom: '6px', background: '#1a3a52', color: '#7ec8e3', borderColor: '#2a5a72' }}
          onClick={() => {
            if (!project) return;
            const { addWidget } = useEditorStore.getState();
            const browserId = Math.random().toString(36).substr(2, 9);
            const cx = Math.round(project.canvas.width / 2);
            const cy = Math.round(project.canvas.height / 2);
            const maxZ = project.widgets.reduce((m: number, w: any) => Math.max(m, w.zIndex || 0), 0);
            addWidget({
              id: `bm_${browserId}`,
              type: 'browser-menu',
              x: cx - 300,
              y: cy - 200,
              width: 200,
              height: 400,
              zIndex: maxZ + 1,
              properties: {
                browserId,
                orientation: 'vertical',
                menuBgColor: '#2c3e50',
                menuTextColor: '#ffffff',
                menuFontSize: 14,
                pages: [],
                contentBgColor: '#ffffff',
                menuPosition: 'top',
              }
            });
            addWidget({
              id: `bc_${browserId}`,
              type: 'browser-content',
              x: cx - 80,
              y: cy - 200,
              width: 500,
              height: 400,
              zIndex: maxZ + 2,
              properties: {
                browserId,
                contentBgColor: '#ffffff',
              }
            });
          }}
        >
          🌐 + Браузер (меню + контент)
        </button>
        <button className="btn-secondary" style={{ width: '100%', fontSize: '12px' }}>
          + Импорт виджета
        </button>
      </div>

      {/* Панель структуры под библиотекой */}
      <OutlinePanel />
    </div>
  );
};

export default WidgetLibrary;
