import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { Square, Type, Image, Video, MousePointer, Menu } from 'lucide-react';
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
