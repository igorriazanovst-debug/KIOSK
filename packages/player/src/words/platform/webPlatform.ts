// packages/player/src/words/platform/webPlatform.ts
// Реализация платформы для запуска рантайма в обычном браузере.
//
// ЭТО НЕ ОСНОВА ANDROID-СБОРКИ. Android реализуется отдельным нативным
// приложением (решение пользователя от 08.09.2026), и этот файл к нему
// отношения не имеет. Его назначение — разработка и проверка: экраны и
// игровой цикл можно гонять в браузере, не поднимая Electron, что заметно
// дешевле при отладке. Продакшен-потребителя у него сейчас нет.
//
// Отличия от Electron ровно два, и оба заперты здесь:
//  • файлы контента адресуются обычными относительными путями — пакет
//    words-library кладётся рядом с index.html при сборке;
//  • данные занятия хранятся в Storage браузера, а не в файлах на диске.
//
// Правила (имя игрока, монотонность достижений, судьба достижений удалённого
// игрока) берутся из @kiosk/shared — те же, что использует Electron-сборка.
//
// ОГРАНИЧЕНИЕ: localStorage может быть очищен браузером. Для отладочного
// режима это приемлемо; в продакшене этот файл не используется.

import type { WordsLibrary, WordsSettings, AwardTier, UserWord, UserSet } from '@kiosk/shared';
import {
  parseWordsLibrary,
  sanitizeProfiles,
  applyCreateProfile,
  applyDeleteProfile,
  applySaveScore,
  applyCreateUserWord,
  applyUpdateUserWord,
  applyDeleteUserWord,
  applyCreateSet,
  applyUpdateSet,
  applyDeleteSet,
} from '@kiosk/shared';
import type { WordsPlatform } from './WordsPlatform.ts';
import type {
  IpcResult,
  Profile,
  ScoreBook,
  WordsContext,
  UserWordDraft,
  SetDraft,
  PickedMedia,
  StoredMedia,
} from '../types.ts';

/** Куда сборка кладёт пакет контента относительно index.html */
export const WEB_LIBRARY_ROOT = 'words-library';

const KEY_PROFILES = 'kiosk-words:profiles';
const KEY_SETTINGS = 'kiosk-words:settings';
const KEY_SCORES = 'kiosk-words:scores';
const KEY_USER_WORDS = 'kiosk-words:user-words';
const KEY_SETS = 'kiosk-words:sets';

const DEFAULT_SETTINGS: WordsSettings = {
  schemaVersion: 1,
  volume: 70,
  device: 'tablet',
  levelOverrides: {},
};

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function fail<T>(err: unknown): IpcResult<T> {
  const message =
    err instanceof Error ? err.message : 'Не удалось выполнить операцию с данными занятия';
  return { ok: false, error: message };
}

/**
 * Хранилище браузера. Обёрнуто, потому что доступ к нему может БРОСАТЬ
 * (приватный режим, запрет данных сайта), а не просто вернуть пусто — и
 * занятие из-за этого падать не должно.
 */
interface KeyValue {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
}

function browserStorage(storage: Storage): KeyValue {
  return {
    read(key) {
      const raw = storage.getItem(key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error('Данные занятия в этом браузере повреждены');
      }
    },
    write(key, value) {
      storage.setItem(key, JSON.stringify(value));
    },
  };
}

/** Хранилище в памяти — когда браузер запретил доступ к постоянному */
function memoryStorage(): KeyValue {
  const map = new Map<string, unknown>();
  return {
    read: (key) => map.get(key),
    write: (key, value) => void map.set(key, value),
  };
}

function pickStorage(): { kv: KeyValue; persistent: boolean } {
  try {
    const probe = '__kiosk_words_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return { kv: browserStorage(window.localStorage), persistent: true };
  } catch {
    return { kv: memoryStorage(), persistent: false };
  }
}

export interface WebPlatformOptions {
  /** Корень пакета контента; по умолчанию рядом с index.html */
  libraryRoot?: string;
  /** Для тестов: подменяемое хранилище и загрузчик */
  storage?: KeyValue;
  fetchJson?: (url: string) => Promise<unknown>;
  /** Для тестов: генератор идентификаторов */
  newId?: () => string;
  /** Идентификаторы поставочных слов — для проверки состава комплекта */
  libraryWordIds?: string[];
}

export function createWebPlatform(options: WebPlatformOptions = {}): WordsPlatform {
  const root = options.libraryRoot ?? WEB_LIBRARY_ROOT;
  const picked = options.storage ? { kv: options.storage, persistent: true } : pickStorage();
  const kv = picked.kv;
  const fetchJson =
    options.fetchJson ?? (async (url: string) => (await fetch(url)).json());
  const newId =
    options.newId ??
    (() =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  const readProfiles = (): Profile[] => sanitizeProfiles(kv.read(KEY_PROFILES));
  const readUserWords = (): UserWord[] => {
    const raw = kv.read(KEY_USER_WORDS);
    return Array.isArray(raw) ? (raw as UserWord[]) : [];
  };
  const readSets = (): UserSet[] => {
    const raw = kv.read(KEY_SETS);
    return Array.isArray(raw) ? (raw as UserSet[]) : [];
  };
  const knownIds = (library?: WordsLibrary): Set<string> => {
    const ids = new Set<string>(options.libraryWordIds ?? []);
    for (const w of readUserWords()) ids.add(w.id);
    return ids;
  };
  let seq = 0;
  const nextUserWordId = () => `u${(++seq).toString(16).padStart(16, '0')}`;
  const readScores = (): ScoreBook => {
    const raw = kv.read(KEY_SCORES);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as ScoreBook) : {};
  };

  return {
    kind: 'web',

    assetUrl: (assetPath: string) => `${root}/assets/${assetPath}`,
    userMediaUrl: (fileName: string) => `user-media/${fileName}`,

    async getContext(): Promise<IpcResult<WordsContext>> {
      return ok({
        baseDir: picked.persistent ? 'хранилище браузера' : 'память (данные не сохранятся)',
        isFallback: !picked.persistent,
        hasLibrary: true,
        libraryError: null,
      });
    },

    async getLibrary(): Promise<IpcResult<WordsLibrary>> {
      try {
        const raw = await fetchJson(`${root}/index.json`);
        return ok(parseWordsLibrary(raw));
      } catch (err) {
        return fail(err);
      }
    },

    async listProfiles(): Promise<IpcResult<Profile[]>> {
      try {
        return ok(readProfiles());
      } catch (err) {
        return fail(err);
      }
    },

    async createProfile(name: string): Promise<IpcResult<Profile>> {
      try {
        const { profiles, created } = applyCreateProfile(
          readProfiles(),
          name,
          newId(),
          new Date().toISOString()
        );
        kv.write(KEY_PROFILES, profiles);
        return ok(created);
      } catch (err) {
        return fail(err);
      }
    },

    async deleteProfile(id: string): Promise<IpcResult<Profile[]>> {
      try {
        const { profiles, scores } = applyDeleteProfile(readProfiles(), readScores(), id);
        kv.write(KEY_PROFILES, profiles);
        kv.write(KEY_SCORES, scores);
        return ok(profiles);
      } catch (err) {
        return fail(err);
      }
    },

    async getSettings(): Promise<IpcResult<WordsSettings>> {
      try {
        const raw = kv.read(KEY_SETTINGS);
        if (!raw || typeof raw !== 'object') return ok({ ...DEFAULT_SETTINGS });
        return ok({ ...DEFAULT_SETTINGS, ...(raw as WordsSettings) });
      } catch (err) {
        return fail(err);
      }
    },

    async saveSettings(settings: WordsSettings): Promise<IpcResult<WordsSettings>> {
      try {
        kv.write(KEY_SETTINGS, settings);
        return ok(settings);
      } catch (err) {
        return fail(err);
      }
    },

    async getScores(): Promise<IpcResult<ScoreBook>> {
      try {
        return ok(readScores());
      } catch (err) {
        return fail(err);
      }
    },

    async saveScore(
      profileId: string,
      themeId: string,
      tier: AwardTier
    ): Promise<IpcResult<{ changed: boolean; tier: AwardTier }>> {
      try {
        const result = applySaveScore(readScores(), profileId, themeId, tier);
        if (result.changed) kv.write(KEY_SCORES, result.scores);
        return ok({ changed: result.changed, tier: result.tier });
      } catch (err) {
        return fail(err);
      }
    },

    // ── Контент педагога ──────────────────────────────────────────────
    // Слова и комплекты работают: правила те же, из @kiosk/shared. А вот
    // ФАЙЛЫ в отладочном режиме недоступны — в браузере нет ни системного
    // диалога, ни каталога данных. Честный отказ лучше половинчатой
    // реализации, которая в продакшене всё равно не используется.

    async listUserWords(): Promise<IpcResult<UserWord[]>> {
      try { return ok(readUserWords()); } catch (err) { return fail(err); }
    },

    async createUserWord(draft: UserWordDraft): Promise<IpcResult<UserWord>> {
      try {
        const { words, created } = applyCreateUserWord(readUserWords(), draft, nextUserWordId());
        kv.write(KEY_USER_WORDS, words);
        return ok(created);
      } catch (err) { return fail(err); }
    },

    async updateUserWord(id: string, draft: UserWordDraft): Promise<IpcResult<UserWord>> {
      try {
        const { words, updated } = applyUpdateUserWord(readUserWords(), id, draft);
        kv.write(KEY_USER_WORDS, words);
        return ok(updated);
      } catch (err) { return fail(err); }
    },

    async deleteUserWord(id: string) {
      try {
        const { words, sets, affectedSetIds } = applyDeleteUserWord(readUserWords(), readSets(), id);
        kv.write(KEY_USER_WORDS, words);
        kv.write(KEY_SETS, sets);
        return ok({ words, sets, affectedSetIds });
      } catch (err) { return fail(err); }
    },

    async listSets(): Promise<IpcResult<UserSet[]>> {
      try { return ok(readSets()); } catch (err) { return fail(err); }
    },

    async createSet(draft: SetDraft): Promise<IpcResult<UserSet>> {
      try {
        const { sets, created } = applyCreateSet(readSets(), draft, `set-${++seq}`, knownIds());
        kv.write(KEY_SETS, sets);
        return ok(created);
      } catch (err) { return fail(err); }
    },

    async updateSet(id: string, draft: SetDraft): Promise<IpcResult<UserSet>> {
      try {
        const { sets, updated } = applyUpdateSet(readSets(), id, draft, knownIds());
        kv.write(KEY_SETS, sets);
        return ok(updated);
      } catch (err) { return fail(err); }
    },

    async deleteSet(id: string): Promise<IpcResult<UserSet[]>> {
      try {
        const sets = applyDeleteSet(readSets(), id);
        kv.write(KEY_SETS, sets);
        return ok(sets);
      } catch (err) { return fail(err); }
    },

    async pickMediaFile(): Promise<IpcResult<PickedMedia>> {
      return { ok: false, error: 'Добавление файлов доступно только в приложении на устройстве' };
    },

    async saveRecording(): Promise<IpcResult<StoredMedia>> {
      return { ok: false, error: 'Запись доступна только в приложении на устройстве' };
    },
  };
}
