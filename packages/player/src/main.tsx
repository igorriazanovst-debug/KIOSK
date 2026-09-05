import './fonts.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import Player from './Player';
import './index.css';
import type { ChronoProject, ChronoMedia, NatComProject, NatComLibrary } from '@kiosk/shared';

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
      getAuthStatus: () => Promise<{ isPasswordSet: boolean; unlocked: boolean; locked: boolean; retryAfterMs: number }>;
      verifyPassword: (password: string) => Promise<{ success: boolean; locked: boolean; retryAfterMs: number }>;
      changePassword: (
        newPassword: string,
        currentPassword?: string
      ) => Promise<{ success: boolean; locked: boolean; retryAfterMs: number }>;
      lockEditing: () => Promise<{ success: boolean }>;
      getResetChallenge: () => Promise<{
        available: boolean;
        buildCode?: string;
        challenge?: string;
        locked: boolean;
        retryAfterMs: number;
      }>;
      resetWithCode: (
        code: string,
        newPassword: string
      ) => Promise<{ success: boolean; locked: boolean; retryAfterMs: number }>;
      pickMediaFile: () => Promise<string | null>;
      importMedia: (projectId: string, sourceFilePath: string) => Promise<ChronoMedia>;
      exportProject: (projectId: string) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
      importProject: () => Promise<ChronoProjectManifest | null>;
      deleteMedia: (projectId: string, media: { sha256: string; fileName: string }) => Promise<{ success: boolean }>;
    };
    /** Виджет «Конструктор природных сообществ» — встроенный локальный сервер и хранилище презентаций (packages/player/electron/natcom) */
    natcomAPI?: {
      getServerInfo: () => Promise<{ port: number | null; addresses: string[] }>;
      getContext: () => Promise<{ ownerId: string; organizationId: string }>;
      setActiveProject: (projectId: string | null) => Promise<void>;
      getLibrary: () => Promise<NatComLibrary | null>;
      listProjects: () => Promise<NatComProject[]>;
      createProject: (params: { title: string; backgroundId: string; ownerId: string; organizationId: string }) => Promise<NatComProject>;
      loadProject: (projectId: string) => Promise<NatComProject>;
      saveProject: (projectId: string, data: NatComProject) => Promise<NatComProject>;
      deleteProject: (projectId: string) => Promise<{ success: boolean }>;
      exportProject: (projectId: string) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
      importProject: (context: { ownerId: string; organizationId: string }) => Promise<NatComProject | null>;
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
