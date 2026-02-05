/**
 * Editor Store - Zustand State Management
 * ВЕРСИЯ 2.0: Интеграция с License Server API
 * 
 * Изменения:
 * - Проекты сохраняются на сервер (не localStorage)
 * - Автосохранение каждые 3 минуты (debounced)
 * - JWT аутентификация
 * - Работа с медиафайлами через API
 */

import { create } from 'zustand';
import { apiClient, Project, CreateProjectData, UpdateProjectData } from '../services/api-client';

// ==================== TYPES ====================

interface Widget {
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

interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor?: string;
}

interface LocalProject {
  id?: string; // ID от сервера (опционально для новых проектов)
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

interface EditorState {
  // Проект
interface EditorState {
  // Проект
  project: LocalProject | null;
  projectId: string | null; // Server project ID
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: string | null;

  // Выделение
  selectedWidgetIds: string[];
  
  // Буфер обмена
  clipboard: Widget[];
  
  // История (Undo/Redo)
  history: {
    past: LocalProject[];
    future: LocalProject[];
  };
  
  // Настройки холста
  zoom: number;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  gridLineWidth: number;
  gridColor: string;
  
  // Pending widget (для добавления)
  pendingWidget: { type: string; defaultProps: any } | null;

  // ========== PROJECT ACTIONS ==========
  createProject: (name: string, canvas: CanvasConfig) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProjectMetadata: (updates: Partial<LocalProject>) => void;

  // ========== WIDGET ACTIONS ==========
  addWidget: (widget: Widget) => void;
  setPendingWidget: (type: string, defaultProps: any) => void;
  clearPendingWidget: () => void;
  addWidgetAtPosition: (x: number, y: number) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  deleteWidget: (id: string) => void;
  duplicateWidget: (id: string) => void;

  // ========== SELECTION ==========
  selectWidget: (id: string, addToSelection?: boolean) => void;
  clearSelection: () => void;

  // ========== HISTORY ==========
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;

  // ========== CLIPBOARD ==========
  copy: () => void;
  paste: () => void;
  cut: () => void;

  // ========== CANVAS SETTINGS ==========
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
}

// ==================== AUTO-SAVE ====================

let autoSaveTimer: NodeJS.Timeout | null = null;
let saveQueue: (() => Promise<void>) | null = null;

/**
 * Запустить автосохранение (debounced)
 */
function startAutoSave(saveFunction: () => Promise<void>, interval: number = 180000) {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(async () => {
    try {
      console.log('[Editor] Auto-saving project...');
      await saveFunction();
      console.log('[Editor] Auto-save completed');
    } catch (error) {
      console.error('[Editor] Auto-save failed:', error);
    }
  }, interval); // 3 минуты по умолчанию
}

/**
 * Остановить автосохранение
 */
function stopAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// ==================== STORE ====================

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  project: {
    version: '1.0.0',
    name: 'Новый проект',
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#1a1a1a'
    },
    widgets: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  projectId: null,
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  saveError: null,
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
  gridColor: '#e0e0e0',
  pendingWidget: null,

  // ========== PROJECT ACTIONS ==========

  /**
   * Создать новый проект
   */
  createProject: async (name: string, canvas: CanvasConfig) => {
    set({ isLoading: true, saveError: null });

    try {
      // Создать локальный проект
      const localProject: LocalProject = {
        version: '1.0',
        name,
        canvas,
        widgets: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      // Сохранить на сервер
      const serverProject = await apiClient.createProject({
        name,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        canvasBackground: canvas.backgroundColor || '#1a1a1a',
        projectData: localProject
      });

      // Обновить state
      set({
        project: {
          ...localProject,
          id: serverProject.id
        },
        projectId: serverProject.id,
        isLoading: false,
        lastSaved: new Date(),
        history: { past: [], future: [] }
      });

      console.log('[Editor] Project created:', serverProject.id);

      // Запустить автосохранение
      startAutoSave(get().saveProject);

    } catch (error: any) {
      console.error('[Editor] Failed to create project:', error);
      set({ 
        isLoading: false, 
        saveError: error.message || 'Failed to create project' 
      });
      throw error;
    }
  },

  /**
   * Загрузить проект с сервера
   */
  loadProject: async (id: string) => {
    set({ isLoading: true, saveError: null });

    try {
      const serverProject = await apiClient.getProject(id);

      const localProject: LocalProject = {
        id: serverProject.id,
        version: '1.0',
        name: serverProject.name,
        canvas: {
          width: serverProject.canvasWidth,
          height: serverProject.canvasHeight,
          backgroundColor: serverProject.canvasBackground
        },
        widgets: serverProject.projectData?.widgets || [],
        metadata: {
          createdAt: serverProject.createdAt,
          updatedAt: serverProject.updatedAt
        }
      };

      set({
        project: localProject,
        projectId: serverProject.id,
        isLoading: false,
        lastSaved: new Date(serverProject.updatedAt),
        history: { past: [], future: [] }
      });

      console.log('[Editor] Project loaded:', id);

      // Запустить автосохранение
      startAutoSave(get().saveProject);

    } catch (error: any) {
      console.error('[Editor] Failed to load project:', error);
      set({ 
        isLoading: false, 
        saveError: error.message || 'Failed to load project' 
      });
      throw error;
    }
  },

  /**
   * Сохранить проект на сервер
   */
  saveProject: async () => {
    const { project, projectId, isSaving } = get();

    if (!project || !projectId) {
      console.warn('[Editor] No project to save');
      return;
    }

    if (isSaving) {
      console.warn('[Editor] Save already in progress');
      return;
    }

    set({ isSaving: true, saveError: null });

    try {
      await apiClient.updateProject(projectId, {
        name: project.name,
        projectData: project,
        canvasWidth: project.canvas.width,
        canvasHeight: project.canvas.height,
        canvasBackground: project.canvas.backgroundColor
      });

      set({ 
        isSaving: false, 
        lastSaved: new Date(),
        saveError: null
      });

      console.log('[Editor] Project saved:', projectId);

    } catch (error: any) {
      console.error('[Editor] Failed to save project:', error);
      set({ 
        isSaving: false, 
        saveError: error.message || 'Failed to save project' 
      });
      throw error;
    }
  },

  /**
   * Удалить проект
   */
  deleteProject: async (id: string) => {
    try {
      await apiClient.deleteProject(id);
      
      // Если удалили текущий проект - очистить state
      if (get().projectId === id) {
        set({
          project: {
    version: '1.0.0',
    name: 'Новый проект',
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#1a1a1a'
    },
    widgets: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
          projectId: null,
          selectedWidgetIds: [],
          history: { past: [], future: [] }
        });
        stopAutoSave();
      }

      console.log('[Editor] Project deleted:', id);

    } catch (error: any) {
      console.error('[Editor] Failed to delete project:', error);
      throw error;
    }
  },

  /**
   * Обновить метаданные проекта
   */
  updateProjectMetadata: (updates) => {
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

    // Запустить автосохранение
    startAutoSave(get().saveProject);
  },

  // ========== WIDGET ACTIONS ==========

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

    // Запустить автосохранение
    startAutoSave(get().saveProject);
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

    // Применяем привязку к сетке
    let finalX = x;
    let finalY = y;

    if (snapToGrid) {
      finalX = Math.round(x / gridSize) * gridSize;
      finalY = Math.round(y / gridSize) * gridSize;
    }

    // Размеры по умолчанию
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

    const { width: _, height: __, ...cleanProps } = pendingWidget.defaultProps;

    const widget = {
      id: `widget-${Date.now()}-${Math.random()}`,
      type: pendingWidget.type,
      x: Math.max(0, finalX),
      y: Math.max(0, finalY),
      width,
      height,
      zIndex: 0,
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

    // Запустить автосохранение
    startAutoSave(get().saveProject);
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

    // Запустить автосохранение
    startAutoSave(get().saveProject);
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

  // ========== SELECTION ==========

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

  // ========== HISTORY ==========

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

    // Запустить автосохранение
    startAutoSave(get().saveProject);
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

    // Запустить автосохранение
    startAutoSave(get().saveProject);
  },

  // ========== CLIPBOARD ==========

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

    // Запустить автосохранение
    startAutoSave(get().saveProject);
  },

  cut: () => {
    const { selectedWidgetIds } = get();
    get().copy();
    selectedWidgetIds.forEach(id => get().deleteWidget(id));
  },

  // ========== CANVAS SETTINGS ==========

  setZoom: (zoom) => {
    set({ zoom: Math.max(0.1, Math.min(5, zoom)) });
  },

  toggleGrid: () => {
    set((state) => ({ gridEnabled: !state.gridEnabled }));
  },

  toggleSnapToGrid: () => {
    set((state) => ({ snapToGrid: !state.snapToGrid }));
  },

  setGridSize: (size) => {
    set({ gridSize: Math.max(5, Math.min(100, size)) });
  }
}));

// Cleanup on unmount
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopAutoSave();
  });
}
