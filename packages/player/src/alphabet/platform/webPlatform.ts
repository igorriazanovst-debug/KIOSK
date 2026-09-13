// packages/player/src/alphabet/platform/webPlatform.ts
// Реализация платформы для запуска рантайма в обычном браузере.
//
// ЭТО НЕ ОСНОВА ANDROID-СБОРКИ. Android — отдельное нативное приложение
// (решение пользователя от 08.09.2026). Назначение этого файла — разработка:
// экраны и игровой цикл гоняются в браузере без Electron, что заметно дешевле
// при отладке. Продакшен-потребителя у него нет.
//
// Отличия от Electron ровно два, и оба заперты здесь:
//  • файлы контента адресуются обычными относительными путями;
//  • данные занятия лежат в Storage браузера, а не в файлах на диске.
//
// Правила профилей и слияние статистики берутся из @kiosk/shared — те же, что
// использует Electron-сборка. Если они разойдутся, разойдётся поведение, и
// отладка в браузере перестанет что-либо доказывать.
//
// ОГРАНИЧЕНИЕ: Storage браузера может быть очищен. Для отладки приемлемо.

import {
  sanitizeProfiles,
  applyCreateProfile,
  alphabet,
  DEFAULT_TEACHER_PASSWORD,
  assertPasswordAcceptable,
} from '@kiosk/shared';
import type { AlphabetPlatform } from './AlphabetPlatform.ts';
import type {
  AlphabetContext,
  AlphabetLibrary,
  AlphabetSettings,
  IpcResult,
  LetterAnswer,
  Profile,
  Statistics,
} from '../types.ts';

/** Куда сборка кладёт пакет контента относительно index.html */
export const WEB_LIBRARY_ROOT = 'alphabet-library';

const KEY_PROFILES = 'kiosk-alphabet:profiles';
const KEY_SETTINGS = 'kiosk-alphabet:settings';
const KEY_STATISTICS = 'kiosk-alphabet:statistics';
const KEY_PASSWORD = 'kiosk-alphabet:password';
const KEY_CONTENT = 'kiosk-alphabet:content';

export interface KeyValueStorage {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
}

export interface WebPlatformOptions {
  storage?: KeyValueStorage;
  newId?: () => string;
  /** Пакет контента; в отладке его может не быть — это не ошибка */
  library?: AlphabetLibrary | null;
}

function browserStorage(): KeyValueStorage {
  return {
    read: (key) => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? undefined : JSON.parse(raw);
      } catch {
        // Приватный режим, отключённые куки, повреждённая запись — всё это
        // «данных нет», а не повод уронить приложение
        return undefined;
      }
    },
    write: (key, value) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* переполнение или запрет записи — отладочный режим переживёт */
      }
    },
  };
}

const ok = <T>(data: T): IpcResult<T> => ({ ok: true, data });
const fail = <T>(error: string): IpcResult<T> => ({ ok: false, error });

function guard<T>(action: () => T): IpcResult<T> {
  try {
    return ok(action());
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Не удалось выполнить операцию');
  }
}

export function createWebPlatform(options: WebPlatformOptions = {}): AlphabetPlatform {
  const storage = options.storage ?? browserStorage();
  const newId = options.newId ?? (() => `p${Math.random().toString(16).slice(2, 18)}`);
  const library = options.library ?? null;

  const profiles = (): Profile[] => sanitizeProfiles(storage.read(KEY_PROFILES) ?? []);
  const statistics = (): Statistics => alphabet.parseStatistics(storage.read(KEY_STATISTICS) ?? {});
  const content = () => alphabet.parseUserContent(storage.read(KEY_CONTENT) ?? {});

  return {
    kind: 'web',
    assetUrl: (assetPath: string) => `${WEB_LIBRARY_ROOT}/${assetPath}`,
    // В браузере файлов нет: редактор контента здесь не работает, и это
    // честнее, чем притворяться. Отладочный режим нужен для игрового цикла
    userMediaUrl: (fileName: string) => `${WEB_LIBRARY_ROOT}/user/${fileName}`,

    async getContext(): Promise<IpcResult<AlphabetContext>> {
      return ok({
        baseDir: 'browser storage',
        isFallback: false,
        hasLibrary: !!library,
        libraryError: library ? null : 'Пакет учебного контента не подключён в этом режиме',
      });
    },

    async getLibrary() {
      if (!library) return fail<AlphabetLibrary>('Пакет учебного контента не подключён');
      return ok(library);
    },

    async listProfiles() {
      return guard(() => profiles());
    },

    async createProfile(name: string) {
      return guard(() => {
        const { profiles: next, created } = applyCreateProfile(
          profiles(),
          name,
          newId(),
          new Date().toISOString()
        );
        storage.write(KEY_PROFILES, next);
        return created;
      });
    },

    async deleteProfile(profileId: string) {
      return guard(() => {
        const current = profiles();
        const remaining = current.filter((p) => p.id !== profileId);
        if (remaining.length === current.length) throw new Error('Такого игрока нет в списке');
        storage.write(KEY_PROFILES, remaining);
        storage.write(KEY_STATISTICS, alphabet.clearUserStatistics(statistics(), profileId));
        return remaining;
      });
    },

    async getSettings() {
      return guard(() => {
        const raw = storage.read(KEY_SETTINGS);
        if (!raw || typeof raw !== 'object') return { ...alphabet.DEFAULT_ALPHABET_SETTINGS };
        try {
          return alphabet.parseAlphabetSettings({
            ...alphabet.DEFAULT_ALPHABET_SETTINGS,
            ...(raw as object),
          });
        } catch {
          return { ...alphabet.DEFAULT_ALPHABET_SETTINGS };
        }
      });
    },

    async saveSettings(settings: Partial<AlphabetSettings>) {
      return guard(() => {
        const checked = alphabet.parseAlphabetSettings({
          ...alphabet.DEFAULT_ALPHABET_SETTINGS,
          ...settings,
        });
        storage.write(KEY_SETTINGS, checked);
        return checked;
      });
    },

    async getStatistics() {
      return guard(() => statistics());
    },

    async saveSession(profileId: string, answers: LetterAnswer[]) {
      return guard(() => {
        const next = alphabet.mergeSessionStatistics(statistics(), profileId, answers);
        storage.write(KEY_STATISTICS, next);
        return next[profileId] ?? {};
      });
    },

    async clearStatistics(profileId: string) {
      return guard(() => {
        const next = alphabet.clearUserStatistics(statistics(), profileId);
        storage.write(KEY_STATISTICS, next);
        return next;
      });
    },

    // ── Пароль педагога ─────────────────────────────────────────────────
    // В ОТЛАДОЧНОМ РЕЖИМЕ ПАРОЛЬ ХРАНИТСЯ ОТКРЫТО, а не хешем. Это не
    // недосмотр: в Electron проверка идёт в главном процессе именно для
    // того, чтобы пароль не лежал в бандле страницы, а здесь бандл и
    // хранилище — одно и то же, и хеширование создавало бы ложное
    // впечатление, будто защита работает. Продакшен-потребителя у этого
    // файла нет; если появится, пароль обязан уехать за границу процесса.
    async checkTeacherPassword(password: string) {
      return guard(() => {
        const stored = storage.read(KEY_PASSWORD);
        const expected = typeof stored === 'string' ? stored : DEFAULT_TEACHER_PASSWORD;
        return String(password) === expected;
      });
    },

    async setTeacherPassword(password: string) {
      return guard(() => {
        const value = assertPasswordAcceptable(password);
        storage.write(KEY_PASSWORD, value);
        return { isDefault: value === DEFAULT_TEACHER_PASSWORD };
      });
    },

    async teacherPasswordState() {
      return guard(() => {
        const stored = storage.read(KEY_PASSWORD);
        return { isDefault: typeof stored !== 'string' || stored === DEFAULT_TEACHER_PASSWORD };
      });
    },

    // ── Контент педагога ────────────────────────────────────────────────
    // Правила те же (из @kiosk/shared), хранилище другое. Медиа и записи
    // голоса в браузере НЕ поддерживаются: здесь нет ни файловой системы, ни
    // границы процессов, и подделывать их значило бы отлаживать не то, что
    // работает в продакшене.
    async getUserContent() {
      return guard(() => content());
    },

    async wordReadiness() {
      return guard(() => {
        const c = content();
        const out: Record<string, ReturnType<typeof alphabet.checkUserWordReadiness>> = {};
        for (const word of c.words) {
          out[word.id] = alphabet.checkUserWordReadiness(word, {
            hasImage: !!word.imageFile,
            hasWholeAudio: false,
            syllablesWithAudio: new Set<string>(),
          });
        }
        return out;
      });
    },

    async createSyllable(draft) {
      return guard(() => {
        const c = content();
        const { syllables, created } = alphabet.applyCreateSyllable(c.syllables, draft, newId());
        storage.write(KEY_CONTENT, { ...c, syllables });
        return created;
      });
    },

    async deleteSyllable(syllableId) {
      return guard(() => {
        const c = content();
        const syllables = alphabet.applyDeleteSyllable(c.syllables, c.words, syllableId);
        storage.write(KEY_CONTENT, { ...c, syllables });
        return syllables;
      });
    },

    async createUserWord(draft) {
      return guard(() => {
        const c = content();
        const all = [...(library?.syllables ?? []), ...c.syllables];
        const { words, created } = alphabet.applyCreateWord(c.words, all, draft, newId());
        storage.write(KEY_CONTENT, { ...c, words });
        return created;
      });
    },

    async updateUserWord(wordId, draft) {
      return guard(() => {
        const c = content();
        const all = [...(library?.syllables ?? []), ...c.syllables];
        const { words, updated } = alphabet.applyUpdateWord(c.words, all, wordId, draft);
        storage.write(KEY_CONTENT, { ...c, words });
        return updated;
      });
    },

    async deleteUserWord(wordId) {
      return guard(() => {
        const c = content();
        const { words, sets } = alphabet.applyDeleteWord(c.words, c.sets, wordId);
        const next = { ...c, words, sets };
        storage.write(KEY_CONTENT, next);
        return next;
      });
    },

    async createSet(draft) {
      return guard(() => {
        const c = content();
        const all = [...(library?.words ?? []), ...c.words];
        const { sets, created } = alphabet.applyCreateSet(c.sets, all, draft, newId());
        storage.write(KEY_CONTENT, { ...c, sets });
        return created;
      });
    },

    async updateSet(setId, draft) {
      return guard(() => {
        const c = content();
        const all = [...(library?.words ?? []), ...c.words];
        const { sets, updated } = alphabet.applyUpdateSet(c.sets, all, setId, draft);
        storage.write(KEY_CONTENT, { ...c, sets });
        return updated;
      });
    },

    async deleteSet(setId) {
      return guard(() => {
        const c = content();
        const sets = alphabet.applyDeleteSet(c.sets, setId);
        storage.write(KEY_CONTENT, { ...c, sets });
        return sets;
      });
    },

    async pickWordImage() {
      return fail<{ fileName: string } | null>('В браузере картинки не добавляются');
    },

    async saveVoice() {
      return fail<string>('В браузере запись голоса не поддерживается');
    },

    async deleteVoice() {
      return fail<boolean>('В браузере запись голоса не поддерживается');
    },
  };
}
