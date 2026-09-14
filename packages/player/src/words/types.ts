// packages/player/src/words/types.ts
// Контракт между рантаймом виджета и главным процессом (namespace wordsAPI,
// см. electron/preload.js) плюс описание экранов.

import type {
  WordsLibrary,
  WordsSettings,
  AwardTier,
  UserWord,
  UserSet,
  WordImageOverrides,
} from '@kiosk/shared';

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
}

export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface WordsContext {
  baseDir: string;
  isFallback: boolean;
  hasLibrary: boolean;
  libraryError: string | null;
}

/** Достижения: профиль → тема → ступень */
export type ScoreBook = Record<string, Record<string, AwardTier>>;

export interface WordsApi {
  getContext(): Promise<IpcResult<WordsContext>>;
  getLibrary(): Promise<IpcResult<WordsLibrary>>;
  listProfiles(): Promise<IpcResult<Profile[]>>;
  createProfile(name: string): Promise<IpcResult<Profile>>;
  deleteProfile(id: string): Promise<IpcResult<Profile[]>>;
  getSettings(): Promise<IpcResult<WordsSettings>>;
  saveSettings(settings: WordsSettings): Promise<IpcResult<WordsSettings>>;
  getScores(): Promise<IpcResult<ScoreBook>>;
  saveScore(
    profileId: string,
    themeId: string,
    tier: AwardTier
  ): Promise<IpcResult<{ changed: boolean; tier: AwardTier }>>;

  // ── Контент педагога (ТЗ строки 55-57) ──────────────────────────────
  listUserWords(): Promise<IpcResult<UserWord[]>>;
  createUserWord(draft: UserWordDraft): Promise<IpcResult<UserWord>>;
  updateUserWord(id: string, draft: UserWordDraft): Promise<IpcResult<UserWord>>;
  deleteUserWord(id: string): Promise<IpcResult<{ words: UserWord[]; sets: UserSet[]; affectedSetIds: string[] }>>;
  listSets(): Promise<IpcResult<UserSet[]>>;
  createSet(draft: SetDraft): Promise<IpcResult<UserSet>>;
  updateSet(id: string, draft: SetDraft): Promise<IpcResult<UserSet>>;
  deleteSet(id: string): Promise<IpcResult<UserSet[]>>;
  /** Системный диалог выбора файла; путь в рендерер не возвращается */
  pickMediaFile(kind: 'image' | 'audio'): Promise<IpcResult<PickedMedia>>;
  /** Запись с микрофона: байты, а не путь */
  saveRecording(bytes: Uint8Array): Promise<IpcResult<StoredMedia>>;

  // ── Экспорт и импорт комплекта (ТЗ строка 56) ───────────────────────
  /** Системный диалог сохранения; файл пишет главный процесс */
  exportSet(setId: string): Promise<IpcResult<ExportedSet>>;
  /** Системный диалог открытия; архив разбирает главный процесс */
  importSet(): Promise<IpcResult<ImportedSet>>;

  // ── Пароль педагога (ТЗ раздел 3) ───────────────────────────────────
  /** Наружу отдаётся только «подошёл или нет» — ни пароля, ни хеша */
  checkTeacherPassword(password: string): Promise<IpcResult<{ ok: boolean }>>;
  setTeacherPassword(password: string): Promise<IpcResult<{ isDefault: boolean }>>;
  teacherPasswordState(): Promise<IpcResult<{ isDefault: boolean }>>;

  // ── Свои картинки для поставочных слов (ТЗ строка 42) ────────────────
  listWordImages(): Promise<IpcResult<WordImageOverrides>>;
  /** Системный диалог выбора картинки; путь в рендерер не возвращается */
  pickWordImage(wordId: string): Promise<IpcResult<PickedWordImage>>;
  /** Вернуть слову картинку из поставки */
  clearWordImage(wordId: string): Promise<IpcResult<WordImageOverrides>>;
}

export type PickedWordImage =
  | { canceled: true }
  | { canceled: false; fileName: string; overrides: WordImageOverrides };

export type ExportedSet =
  | { canceled: true }
  | {
      canceled: false;
      filePath: string;
      title: string;
      /** Слов в комплекте всего */
      words: number;
      /** Из них своих — они уехали вместе с файлами */
      ownWords: number;
      /** Файлов медиа в архиве */
      files: number;
    };

export type ImportedSet =
  | { canceled: true }
  | {
      canceled: false;
      set: UserSet;
      addedWords: number;
      reusedWords: number;
      /** Слова, не найденные на этом устройстве, — по названию или идентификатору */
      skippedWords: string[];
      words: UserWord[];
      sets: UserSet[];
    };

export interface UserWordDraft {
  name: string;
  imageFile: string | null;
  audioFile: string | null;
}

export interface SetDraft {
  title: string;
  wordIds: string[];
}

export interface StoredMedia {
  fileName: string;
  type: string;
  bytes: number;
}

export type PickedMedia = { canceled: true } | ({ canceled: false } & StoredMedia);

declare global {
  interface Window {
    wordsAPI?: WordsApi;
  }
}

/**
 * Экраны. Линейный сценарий с двумя ответвлениями — как у эталона:
 * меню → карта тем → (рассадка) → вводная сцена → партия → итоги.
 */
export type Screen =
  | { name: 'menu' }
  | { name: 'players' }
  | { name: 'settings' }
  | { name: 'map' }
  | { name: 'arrangement'; themeId: string }
  | { name: 'preview'; themeId: string }
  | { name: 'play'; themeId: string }
  | { name: 'score'; themeId: string }
  | { name: 'myWords' }
  | { name: 'wordEditor'; wordId: string | null }
  | { name: 'setEditor'; setId: string | null }
  | { name: 'wordImages' };

// Рассадка вокруг интерактивного стола ПЕРЕЕХАЛА В @kiosk/shared: то же
// правило нужно Типам 3 и 4, а третья копия разъехалась бы молча — она не
// падает, она просто сажает двух игроков рядом вместо «напротив». Здесь
// оставлен реэкспорт, чтобы экраны и тесты этого виджета не переписывать.
export { SEAT_ROTATIONS, SEAT_LABELS, seatsFor, seatRotationFor } from '@kiosk/shared';
