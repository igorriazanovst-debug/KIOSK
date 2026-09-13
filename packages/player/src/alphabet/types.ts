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

  // Контент педагога (ТЗ строки 76-78)
  getUserContent(): Promise<IpcResult<UserContent>>;
  wordReadiness(): Promise<IpcResult<Record<string, WordReadiness>>>;
  createSyllable(draft: UserSyllableDraft): Promise<IpcResult<Syllable>>;
  deleteSyllable(syllableId: string): Promise<IpcResult<Syllable[]>>;
  createUserWord(draft: UserWordDraft): Promise<IpcResult<Word>>;
  updateUserWord(wordId: string, draft: UserWordDraft): Promise<IpcResult<Word>>;
  deleteUserWord(wordId: string): Promise<IpcResult<UserContent>>;
  createSet(draft: SetDraft): Promise<IpcResult<WordSet>>;
  updateSet(setId: string, draft: SetDraft): Promise<IpcResult<WordSet>>;
  deleteSet(setId: string): Promise<IpcResult<WordSet[]>>;
  /** Путь к файлу границу не пересекает: диалог открывает главный процесс */
  pickWordImage(): Promise<IpcResult<{ fileName: string } | null>>;
  saveVoice(kind: VoiceKind, id: string, bytes: Uint8Array): Promise<IpcResult<string>>;
  deleteVoice(kind: VoiceKind, id: string): Promise<IpcResult<boolean>>;

  /** Обмен комплектами (ТЗ строка 77). null — диалог закрыли, это не ошибка */
  exportSet(setId: string): Promise<IpcResult<ExportReport | null>>;
  importSet(): Promise<IpcResult<ImportReport | null>>;
}

export interface ExportReport {
  title: string;
  words: number;
  ownWords: number;
  files: number;
}

export interface ImportReport {
  set: WordSet;
  /** Название занято — комплект переименован, а не отвергнут */
  renamed: boolean;
  words: number;
  ownWords: number;
  syllables: number;
  voices: number;
  /** Поставочные слова, которых нет на этом устройстве */
  dropped: string[];
}

/** Три рода записей на слово — ровно то, что требует ТЗ строка 76 */
export type VoiceKind = 'word' | 'bgn' | 'syllable';

export type Word = AlphabetLibrary['words'][number];
export type Syllable = AlphabetLibrary['syllables'][number];
export type WordSet = AlphabetLibrary['sets'][number];

export interface UserContent {
  words: Word[];
  syllables: Syllable[];
  sets: WordSet[];
}

export type WordReadiness = ReturnType<typeof alphabet.checkUserWordReadiness>;
export type UserWordDraft = Parameters<typeof alphabet.applyCreateWord>[2];
export type UserSyllableDraft = Parameters<typeof alphabet.applyCreateSyllable>[1];
export type SetDraft = Parameters<typeof alphabet.applyCreateSet>[2];

declare global {
  interface Window {
    alphabetAPI?: AlphabetApi;
  }
}
