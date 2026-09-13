// packages/player/src/alphabet/platform/electronPlatform.ts
// Реализация платформы для Windows-сборки плеера (Electron) — единственная
// продакшен-реализация в этом пакете.
//
// Данные занятия — в главном процессе через namespace alphabetAPI
// (preload.js): рендерер файловой системы не видит, и ради виджета это не
// меняется. Файлы контента — своим привилегированным протоколом.
//
// ХОСТ В URL ОБЯЗАТЕЛЬНО НЕПУСТОЙ ("asset"): схема регистрируется как
// standard, и WHATWG-парсер при пустом host утаскивает начало пути в host.
// У виджета natcom это стоило того, что ни один ресурс библиотеки не грузился,
// и баг не был виден, потому что клики работали и без картинок.

import type { AlphabetPlatform } from './AlphabetPlatform.ts';
import type { AlphabetApi } from '../types.ts';

/** Протокол поставочного контента; регистрируется в main.js в Фазе 7 */
export const ALPHABET_ASSET_SCHEME = 'alphabetlib';
/** Картинки и записи педагога — отдельная схема: поставочное read-only */
export const ALPHABET_USER_SCHEME = 'alphabetuser';

export function createElectronPlatform(api: AlphabetApi): AlphabetPlatform {
  return {
    kind: 'electron',
    assetUrl: (assetPath: string) =>
      `${ALPHABET_ASSET_SCHEME}://asset/${encodeURIComponent(assetPath)}`,
    userMediaUrl: (fileName: string) =>
      `${ALPHABET_USER_SCHEME}://asset/${encodeURIComponent(fileName)}`,
    getContext: () => api.getContext(),
    getLibrary: () => api.getLibrary(),
    listProfiles: () => api.listProfiles(),
    createProfile: (name) => api.createProfile(name),
    deleteProfile: (id) => api.deleteProfile(id),
    getSettings: () => api.getSettings(),
    saveSettings: (settings) => api.saveSettings(settings),
    getStatistics: () => api.getStatistics(),
    saveSession: (profileId, answers) => api.saveSession(profileId, answers),
    clearStatistics: (profileId) => api.clearStatistics(profileId),
    checkTeacherPassword: (password) => api.checkTeacherPassword(password),
    setTeacherPassword: (password) => api.setTeacherPassword(password),
    teacherPasswordState: () => api.teacherPasswordState(),
    getUserContent: () => api.getUserContent(),
    wordReadiness: () => api.wordReadiness(),
    createSyllable: (draft) => api.createSyllable(draft),
    deleteSyllable: (id) => api.deleteSyllable(id),
    createUserWord: (draft) => api.createUserWord(draft),
    updateUserWord: (id, draft) => api.updateUserWord(id, draft),
    deleteUserWord: (id) => api.deleteUserWord(id),
    createSet: (draft) => api.createSet(draft),
    updateSet: (id, draft) => api.updateSet(id, draft),
    deleteSet: (id) => api.deleteSet(id),
    pickWordImage: () => api.pickWordImage(),
    saveVoice: (kind, id, bytes) => api.saveVoice(kind, id, bytes),
    deleteVoice: (kind, id) => api.deleteVoice(kind, id),
  };
}
