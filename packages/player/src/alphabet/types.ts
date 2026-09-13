// packages/player/src/alphabet/types.ts
// Контракт моста «рендерер ↔ главный процесс» для виджета «АзбукоСлов».
//
// Форма ответа — {ok, data|error}, как у wordsAPI и natcomAPI: в рендерер
// уходит готовый текст для педагога, а не стек. Рендерер никогда не получает
// исключение из IPC и не обязан его ловить.

import type { alphabet } from '@kiosk/shared';

export type AlphabetLibrary = ReturnType<typeof alphabet.parseAlphabetLibrary>;
export type AlphabetSettings = ReturnType<typeof alphabet.parseAlphabetSettings>;
export type Statistics = ReturnType<typeof alphabet.parseStatistics>;
export type LetterAnswer = { letterNumber: number; correct: boolean };

export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
}

export interface AlphabetContext {
  baseDir: string;
  /** Данные легли не в общий каталог машины, а в userData — нет прав на запись */
  isFallback: boolean;
  hasLibrary: boolean;
  libraryError: string | null;
}

/** Ровно то, что выставляет preload.js в window.alphabetAPI */
export interface AlphabetApi {
  getContext(): Promise<IpcResult<AlphabetContext>>;
  getLibrary(): Promise<IpcResult<AlphabetLibrary>>;
  listProfiles(): Promise<IpcResult<Profile[]>>;
  createProfile(name: string): Promise<IpcResult<Profile>>;
  deleteProfile(profileId: string): Promise<IpcResult<Profile[]>>;
  getSettings(): Promise<IpcResult<AlphabetSettings>>;
  saveSettings(settings: Partial<AlphabetSettings>): Promise<IpcResult<AlphabetSettings>>;
  getStatistics(): Promise<IpcResult<Statistics>>;
  saveSession(profileId: string, answers: LetterAnswer[]): Promise<IpcResult<unknown>>;
  clearStatistics(profileId: string): Promise<IpcResult<Statistics>>;

  // Пароль педагога (ТЗ раздел 3). Наружу уходит только «подошёл или нет»:
  // ни пароль, ни его хеш границу процесса не пересекают
  checkTeacherPassword(password: string): Promise<IpcResult<boolean>>;
  setTeacherPassword(password: string): Promise<IpcResult<{ isDefault: boolean }>>;
  teacherPasswordState(): Promise<IpcResult<{ isDefault: boolean }>>;
}

declare global {
  interface Window {
    alphabetAPI?: AlphabetApi;
  }
}
