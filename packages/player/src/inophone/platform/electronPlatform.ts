// packages/player/src/inophone/platform/electronPlatform.ts
// Реализация платформы для Windows-сборки плеера (Electron) — единственная
// продакшен-реализация в этом пакете.
//
// Данные занятия — в главном процессе через namespace inophoneAPI
// (preload.js): рендерер файловой системы не видит, и ради виджета это не
// меняется. Файлы контента — своим привилегированным протоколом.
//
// ХОСТ В URL ОБЯЗАТЕЛЬНО НЕПУСТОЙ ("asset"): схема регистрируется как
// standard, и WHATWG-парсер при пустом host утаскивает начало пути в host.
// У виджета natcom это стоило того, что ни один ресурс библиотеки не грузился,
// и баг не был виден, потому что клики работали и без картинок.

import type { InophonePlatform } from './InophonePlatform.ts';
import type { InophoneApi } from '../types.ts';

/** Протокол поставочного контента; регистрируется в main.js */
export const INOPHONE_ASSET_SCHEME = 'inophonelib';

export function createElectronPlatform(api: InophoneApi): InophonePlatform {
  return {
    kind: 'electron',
    assetUrl: (assetPath: string) =>
      `${INOPHONE_ASSET_SCHEME}://asset/${encodeURIComponent(assetPath)}`,
    getContext: () => api.getContext(),
    getLibrary: () => api.getLibrary(),
    listProfiles: () => api.listProfiles(),
    createProfile: (name) => api.createProfile(name),
    deleteProfile: (id) => api.deleteProfile(id),
    getSettings: () => api.getSettings(),
    saveSettings: (settings) => api.saveSettings(settings),
    getStatistics: () => api.getStatistics(),
    recordSession: (profileId, sceneId, byLanguage) =>
      api.recordSession(profileId, sceneId, byLanguage),
    clearStatistics: (profileId) => api.clearStatistics(profileId),
  };
}
