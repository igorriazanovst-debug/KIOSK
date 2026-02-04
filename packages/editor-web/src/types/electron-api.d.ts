// TypeScript типизация для Electron API в Editor

export interface BuildProgress {
  progress: number;
  message: string;
}

export interface BuildLog {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface BuildResult {
  success: boolean;
  installerPath?: string;
  size?: string;
  error?: string;
}

export interface SaveFileOptions {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  content: string;
}

export interface SaveFileResult {
  success: boolean;
  filePath?: string;
  error?: string;
  canceled?: boolean;
}

export interface OpenFileResult {
  success: boolean;
  content?: string;
  filePath?: string;
  error?: string;
  canceled?: boolean;
}

export interface SelectDirectoryResult {
  success: boolean;
  path?: string;
  canceled?: boolean;
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
}

export interface ElectronAPI {
  // Файловые операции
  saveFile: (data: SaveFileOptions) => Promise<SaveFileResult>;
  openFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<OpenFileResult>;
  selectDirectory: () => Promise<SelectDirectoryResult>;
  showMessage: (options: MessageBoxOptions) => Promise<any>;

  // Сборка Player установщика
  buildPlayerInstaller: (projectData: any) => Promise<BuildResult>;
  
  // События сборки
  onBuildProgress: (callback: (data: BuildProgress) => void) => () => void;
  onBuildLog: (callback: (data: BuildLog) => void) => () => void;

  // События меню
  onMenuNewProject: (callback: () => void) => void;
  onMenuOpenProject: (callback: () => void) => void;
  onMenuSaveProject: (callback: () => void) => void;
  onMenuExportJson: (callback: () => void) => void;
  onMenuExportPlayer: (callback: () => void) => void;

  // Проверка окружения
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
