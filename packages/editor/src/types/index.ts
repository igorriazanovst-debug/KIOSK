import React from 'react';

// Базовый интерфейс виджета
export interface Widget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
  zIndex?: number;
  properties: Record<string, any>;
}

// Конфигурация холста
export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor?: string;
}

// Проект
export interface Project {
  version: string;
  name: string;
  canvas: CanvasConfig;
  widgets: Widget[];
  metadata?: {
    createdAt: string;
    updatedAt: string;
    author?: string;
  };
}

// Интерактивные действия виджетов
export interface WidgetAction {
  type: 'url' | 'page' | 'popup' | 'widget_show' | 'widget_hide' | 'video_play' | 'video_stop';
  // Для URL
  url?: string;
  openInNewTab?: boolean;
  // Для страницы
  pageId?: string;
  // Для popup
  popupTitle?: string;
  popupContent?: string;
  popupWidth?: number;
  popupHeight?: number;
  // Для управления виджетами
  targetWidgetId?: string;
}

export interface WidgetEvent {
  trigger: 'click' | 'hover';
  actions: WidgetAction[];
}

// Расширенный виджет с интерактивностью
export interface InteractiveWidget extends Widget {
  events?: WidgetEvent[];
}

// Плагин виджета
export interface WidgetPlugin {
  type: string;
  name: string;
  icon: string;
  category: 'basic' | 'media' | 'input' | 'custom';
  defaultProps: Record<string, any>;
  // Компонент для редактора
  EditorComponent: React.ComponentType<WidgetEditorProps>;
  // Компонент для runtime
  RuntimeComponent: React.ComponentType<WidgetRuntimeProps>;
  // Панель свойств
  PropertiesPanel: React.ComponentType<WidgetPropertiesPanelProps>;
}

// Props для компонентов виджетов
export interface WidgetEditorProps {
  widget: Widget;
  isSelected: boolean;
  onUpdate: (updates: Partial<Widget>) => void;
}

export interface WidgetRuntimeProps {
  widget: Widget;
  onEvent?: (event: WidgetEvent) => void;
}

export interface WidgetPropertiesPanelProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

// Состояние редактора
export interface EditorState {
  project: Project | null;
  selectedWidgetIds: string[];
  clipboard: Widget[];
  history: {
    past: Project[];
    future: Project[];
  };
  zoom: number;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  gridLineWidth: number;
  gridColor: string;
  pendingWidget: { type: string; defaultProps: any } | null;
}
