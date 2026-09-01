import './fonts.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import Player from './Player';
import './index.css';
import type { ChronoProject } from '@kiosk/shared';

interface ChronoProjectManifest {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// Расширяем Window для TypeScript
declare global {
  interface Window {
    electronAPI?: {
      getProject: () => Promise<any>;
      openProject: () => Promise<any>;
      toggleFullscreen: () => Promise<boolean>;
      closeApp: () => Promise<void>;
      onLoadProject: (callback: (project: any) => void) => void;
      checkActivationNeeded: () => Promise<{ needed: boolean }>;
      activateWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
      onShowActivation: (callback: (data: any) => void) => void;
      onUpdateAvailable: (callback: (data: { currentVersion: number; newVersion: number }) => void) => void;
      onUpdateApplied: (callback: (data: { version: number }) => void) => void;
      verifyUpdatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
      applyUpdate: () => Promise<{ success: boolean; error?: string }>;
    };
    /** Виджет «Хронолиния» — локальное хранилище проектов на устройстве (packages/player/electron/chrono) */
    chronoAPI?: {
      listProjects: () => Promise<ChronoProjectManifest[]>;
      createProject: (name: string) => Promise<ChronoProjectManifest>;
      renameProject: (projectId: string, newName: string) => Promise<ChronoProjectManifest>;
      deleteProject: (projectId: string) => Promise<{ success: boolean }>;
      loadProjectData: (projectId: string) => Promise<ChronoProject>;
      saveProjectData: (projectId: string, data: ChronoProject) => Promise<ChronoProject>;
    };
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Player />
  </React.StrictMode>
);
