// packages/player/src/inophone/platform/webPlatform.ts
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

import { sanitizeProfiles, applyCreateProfile, inophone } from '@kiosk/shared';
import type { InophonePlatform } from './InophonePlatform.ts';
import type {
  InophoneContext,
  InophoneLibrary,
  InophoneSettings,
  InophoneStatistics,
  IpcResult,
  Profile,
  TallyByLanguage,
} from '../types.ts';

/** Куда сборка кладёт пакет контента относительно index.html */
export const WEB_LIBRARY_ROOT = 'inophone-library';

const KEY_PROFILES = 'kiosk-inophone:profiles';
const KEY_SETTINGS = 'kiosk-inophone:settings';
const KEY_STATISTICS = 'kiosk-inophone:statistics';

export interface KeyValueStorage {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
}

export interface WebPlatformOptions {
  storage?: KeyValueStorage;
  newId?: () => string;
  /** Пакет контента; в отладке его может не быть — это не ошибка */
  library?: InophoneLibrary | null;
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

const ok = <T,>(data: T): IpcResult<T> => ({ ok: true, data });
const fail = <T,>(error: string): IpcResult<T> => ({ ok: false, error });

function guard<T>(action: () => T): IpcResult<T> {
  try {
    return ok(action());
  } catch (err) {
    return fail<T>(err instanceof Error ? err.message : 'Не удалось выполнить операцию');
  }
}

export function createWebPlatform(options: WebPlatformOptions = {}): InophonePlatform {
  const storage = options.storage ?? browserStorage();
  const newId = options.newId ?? (() => `p${Math.random().toString(16).slice(2, 18)}`);
  const library = options.library ?? null;

  const profiles = (): Profile[] => sanitizeProfiles(storage.read(KEY_PROFILES) ?? []);
  const statistics = (): InophoneStatistics =>
    inophone.parseInophoneStatistics(storage.read(KEY_STATISTICS) ?? {});

  return {
    kind: 'web',
    assetUrl: (assetPath: string) => `${WEB_LIBRARY_ROOT}/${assetPath}`,

    async getContext(): Promise<IpcResult<InophoneContext>> {
      return ok({
        baseDir: 'browser storage',
        isFallback: false,
        hasLibrary: !!library,
        libraryError: library ? null : 'Пакет учебного контента не подключён в этом режиме',
        completeness: null,
        quotas: library ? inophone.checkQuotas(library) : null,
      });
    },

    async getLibrary() {
      return ok<InophoneLibrary | null>(library);
    },

    async listProfiles() {
      return guard(() => profiles());
    },

    /**
     * Возвращает ПОЛНЫЙ СПИСОК, а не созданную запись — тот же контракт, что
     * у Electron-стороны. Расхождение здесь было бы худшим видом ошибки:
     * отладка в браузере доказывала бы работу кода, который в сборке падает.
     */
    async createProfile(name: string) {
      return guard(() => {
        const { profiles: next } = applyCreateProfile(
          profiles(),
          name,
          newId(),
          new Date().toISOString()
        );
        storage.write(KEY_PROFILES, next);
        return next;
      });
    },

    async deleteProfile(profileId: string) {
      return guard(() => {
        const next = profiles().filter((p) => p.id !== profileId);
        storage.write(KEY_PROFILES, next);
        // Статистика уходит вместе с профилем — иначе новый профиль с тем же
        // именем однажды получил бы чужие результаты
        const stats = statistics();
        if (profileId in stats) {
          delete stats[profileId];
          storage.write(KEY_STATISTICS, stats);
        }
        return next;
      });
    },

    async getSettings() {
      return ok(inophone.parseInophoneSettings(storage.read(KEY_SETTINGS) ?? null));
    },

    async saveSettings(settings: Partial<InophoneSettings>) {
      return guard(() => {
        const clean = inophone.parseInophoneSettings(settings);
        storage.write(KEY_SETTINGS, clean);
        return clean;
      });
    },

    async getStatistics() {
      return ok(statistics());
    },

    async recordSession(profileId: string, sceneId: string, byLanguage: TallyByLanguage) {
      return guard(() => {
        const next = inophone.mergeStatistics(statistics(), profileId, sceneId, byLanguage);
        storage.write(KEY_STATISTICS, next);
        return next;
      });
    },

    async clearStatistics(profileId: string) {
      return guard(() => {
        const next = statistics();
        delete next[profileId];
        storage.write(KEY_STATISTICS, next);
        return next;
      });
    },
  };
}
