import { create } from 'zustand';
import { Project, Widget, EditorState } from '../types';

interface EditorStore extends EditorState {
  // Проект
  createProject: (name: string, canvas: { width: number; height: number }) => void;
  loadProject: (project: Project) => void;
  updateProject: (updates: Partial<Project>) => void;
  
  // Виджеты
  addWidget: (widget: Widget) => void;
  setPendingWidget: (type: string, defaultProps: any) => void;
  clearPendingWidget: () => void;
  addWidgetAtPosition: (x: number, y: number) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  deleteWidget: (id: string) => void;
  duplicateWidget: (id: string) => void;
  
  // Выделение
  selectWidget: (id: string, addToSelection?: boolean) => void;
  clearSelection: () => void;
  
  // История (Undo/Redo)
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Буфер обмена
  copy: () => void;
  paste: () => void;
  cut: () => void;
  
  // Настройки редактора
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
}

const createEmptyProject = (name: string, canvas: { width: number; height: number }): Project => ({
  version: '1.0.0',
  name,
  canvas: {
    width: canvas.width,
    height: canvas.height,
    backgroundColor: '#ffffff'
  },
  widgets: [],
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
});

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: null,
  selectedWidgetIds: [],
  clipboard: [],
  history: {
    past: [],
    future: []
  },
  zoom: 1,
  gridEnabled: true,
  snapToGrid: true,
  gridSize: 20,
  gridLineWidth: 1,
  gridColor: '#333333',
  pendingWidget: null,

  // Проект
  createProject: (name, canvas) => {
    const project = createEmptyProject(name, canvas);
    set({ project, selectedWidgetIds: [], history: { past: [], future: [] } });
  },

  loadProject: (project) => {
    set({ project, selectedWidgetIds: [], history: { past: [], future: [] } });
  },

  updateProject: (updates) => {
    const { project } = get();
    if (!project) return;
    
    set({
      project: {
        ...project,
        ...updates,
        metadata: {
          ...project.metadata,
          updatedAt: new Date().toISOString()
        }
      }
    });
  },

  // Виджеты
  addWidget: (widget) => {
    const { project } = get();
    if (!project) return;
    
    get().saveToHistory();
    set({
      project: {
        ...project,
        widgets: [...project.widgets, widget],
        metadata: {
          ...project.metadata,
          updatedAt: new Date().toISOString()
        }
      }
    });
  },

  setPendingWidget: (type, defaultProps) => {
    set({ pendingWidget: { type, defaultProps } });
  },

  clearPendingWidget: () => {
    set({ pendingWidget: null });
  },

  addWidgetAtPosition: (x, y) => {
    const { pendingWidget, project, snapToGrid, gridSize } = get();
    if (!pendingWidget || !project) return;

    // Применяем привязку к сетке если включена
    let finalX = x;
    let finalY = y;
    
    if (snapToGrid) {
      finalX = Math.round(x / gridSize) * gridSize;
      finalY = Math.round(y / gridSize) * gridSize;
    }

    // Центрируем виджет относительно точки клика
    // Размеры по умолчанию для разных типов виджетов
    const defaultSizes: Record<string, { width: number; height: number }> = {
      shape: { width: 200, height: 200 },
      button: { width: 200, height: 60 },
      text: { width: 300, height: 100 },
      image: { width: 300, height: 200 },
      video: { width: 640, height: 360 },
      menu: { width: 600, height: 40 }
    };
    
    const defaultSize = defaultSizes[pendingWidget.type] || { width: 200, height: 100 };
    const width = pendingWidget.defaultProps.width || defaultSize.width;
    const height = pendingWidget.defaultProps.height || defaultSize.height;
    
    finalX = finalX - width / 2;
    finalY = finalY - height / 2;

    // Убираем width/height из properties, они должны быть только на уровне виджета
    const { width: _, height: __, ...cleanProps } = pendingWidget.defaultProps;

    // Создаём виджет
    const widget = {
      id: `widget-${Date.now()}-${Math.random()}`,
      type: pendingWidget.type,
      x: Math.max(0, finalX),
      y: Math.max(0, finalY),
      width,
      height,
      zIndex: 0,  // По умолчанию 0
      properties: cleanProps
    };

    get().addWidget(widget);
    get().clearPendingWidget();
  },

  updateWidget: (id, updates) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        widgets: project.widgets.map(w => 
          w.id === id ? { ...w, ...updates } : w
        ),
        metadata: {
          ...project.metadata,
          updatedAt: new Date().toISOString()
        }
      }
    });
  },

  deleteWidget: (id) => {
    const { project } = get();
    if (!project) return;
    
    get().saveToHistory();
    set({
      project: {
        ...project,
        widgets: project.widgets.filter(w => w.id !== id),
        metadata: {
          ...project.metadata,
          updatedAt: new Date().toISOString()
        }
      },
      selectedWidgetIds: get().selectedWidgetIds.filter(wId => wId !== id)
    });
  },

  duplicateWidget: (id) => {
    const { project } = get();
    if (!project) return;

    const widget = project.widgets.find(w => w.id === id);
    if (!widget) return;

    const newWidget = {
      ...widget,
      id: `widget-${Date.now()}`,
      x: widget.x + 20,
      y: widget.y + 20
    };

    get().addWidget(newWidget);
  },

  // Выделение
  selectWidget: (id, addToSelection = false) => {
    const { selectedWidgetIds } = get();
    
    if (addToSelection) {
      if (selectedWidgetIds.includes(id)) {
        set({ selectedWidgetIds: selectedWidgetIds.filter(wId => wId !== id) });
      } else {
        set({ selectedWidgetIds: [...selectedWidgetIds, id] });
      }
    } else {
      set({ selectedWidgetIds: [id] });
    }
  },

  clearSelection: () => {
    set({ selectedWidgetIds: [] });
  },

  // История
  saveToHistory: () => {
    const { project, history } = get();
    if (!project) return;

    set({
      history: {
        past: [...history.past, project],
        future: []
      }
    });
  },

  undo: () => {
    const { history, project } = get();
    if (history.past.length === 0 || !project) return;

    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);

    set({
      project: previous,
      history: {
        past: newPast,
        future: [project, ...history.future]
      }
    });
  },

  redo: () => {
    const { history, project } = get();
    if (history.future.length === 0 || !project) return;

    const next = history.future[0];
    const newFuture = history.future.slice(1);

    set({
      project: next,
      history: {
        past: [...history.past, project],
        future: newFuture
      }
    });
  },

  // Буфер обмена
  copy: () => {
    const { project, selectedWidgetIds } = get();
    if (!project) return;

    const selectedWidgets = project.widgets.filter(w => 
      selectedWidgetIds.includes(w.id)
    );
    
    set({ clipboard: selectedWidgets });
  },

  paste: () => {
    const { clipboard, project } = get();
    if (!project || clipboard.length === 0) return;

    const newWidgets = clipboard.map(w => ({
      ...w,
      id: `widget-${Date.now()}-${Math.random()}`,
      x: w.x + 20,
      y: w.y + 20
    }));

    get().saveToHistory();
    set({
      project: {
        ...project,
        widgets: [...project.widgets, ...newWidgets]
      },
      selectedWidgetIds: newWidgets.map(w => w.id)
    });
  },

  cut: () => {
    const { selectedWidgetIds } = get();
    get().copy();
    selectedWidgetIds.forEach(id => get().deleteWidget(id));
  },

  // Настройки редактора
  setZoom: (zoom) => set({ zoom }),
  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setGridSize: (gridSize: number) => set({ gridSize }),
  setGridLineWidth: (gridLineWidth: number) => set({ gridLineWidth }),
  setGridColor: (gridColor: string) => set({ gridColor }),

  // Блокировка виджетов
  lockWidget: (id: string) => {
    const { project } = get();
    if (!project) return;
    
    get().updateWidget(id, { locked: true });
  },

  unlockWidget: (id: string) => {
    const { project } = get();
    if (!project) return;
    
    get().updateWidget(id, { locked: false });
  },

  toggleLockWidget: (id: string) => {
    const { project } = get();
    if (!project) return;
    
    const widget = project.widgets.find(w => w.id === id);
    if (widget) {
      get().updateWidget(id, { locked: !widget.locked });
    }
  },

  // Z-index управление
  bringToFront: (id: string) => {
    const { project } = get();
    if (!project) return;
    
    const maxZIndex = Math.max(...project.widgets.map(w => w.zIndex || 0), 0);
    get().updateWidget(id, { zIndex: maxZIndex + 1 });
  },

  sendToBack: (id: string) => {
    const { project } = get();
    if (!project) return;
    
    // Устанавливаем в 0 (самый задний план), не используем отрицательные значения
    get().updateWidget(id, { zIndex: 0 });
    
    // Поднимаем все остальные виджеты на 1
    const updatedWidgets = project.widgets.map(w => 
      w.id === id ? { ...w, zIndex: 0 } : { ...w, zIndex: (w.zIndex || 0) + 1 }
    );
    
    set({
      project: {
        ...project,
        widgets: updatedWidgets,
        metadata: {
          ...project.metadata,
          updatedAt: new Date().toISOString()
        }
      }
    });
  },

  bringForward: (id: string) => {
    const { project } = get();
    if (!project) return;
    
    const widget = project.widgets.find(w => w.id === id);
    if (widget) {
      const currentZ = widget.zIndex || 0;
      get().updateWidget(id, { zIndex: currentZ + 1 });
    }
  },

  sendBackward: (id: string) => {
    const { project } = get();
    if (!project) return;
    
    const widget = project.widgets.find(w => w.id === id);
    if (widget) {
      const currentZ = widget.zIndex || 0;
      // Не опускаем ниже 0
      get().updateWidget(id, { zIndex: Math.max(0, currentZ - 1) });
    }
  }
}));
