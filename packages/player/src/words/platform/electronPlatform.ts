// packages/player/src/words/platform/electronPlatform.ts
// Реализация платформы для Windows-сборки плеера (Electron) — единственная
// продакшен-реализация в этом пакете.
//
// Данные занятия — в главном процессе через namespace wordsAPI (preload.js):
// рендерер файловой системы не видит, и это не меняется ради виджета.
// Файлы контента — своим привилегированным протоколом wordslib://.
//
// ХОСТ В URL ОБЯЗАТЕЛЬНО НЕПУСТОЙ ("asset"): схема зарегистрирована как
// standard, и WHATWG-парсер при пустом host утаскивает начало пути в host.
// У виджета natcom это стоило того, что ни один ресурс библиотеки не грузился
// начиная с шестого эпика, и баг не был виден, потому что клики работали и
// без картинок (см. src/natcom/mediaUrl.ts).

import type { WordsPlatform } from './WordsPlatform.ts';
import type { WordsApi } from '../types.ts';

export function createElectronPlatform(api: WordsApi): WordsPlatform {
  return {
    kind: 'electron',
    assetUrl: (assetPath: string) => `wordslib://asset/${encodeURIComponent(assetPath)}`,
    userMediaUrl: (fileName: string) => `wordsuser://asset/${encodeURIComponent(fileName)}`,
    getContext: () => api.getContext(),
    getLibrary: () => api.getLibrary(),
    listProfiles: () => api.listProfiles(),
    createProfile: (name) => api.createProfile(name),
    deleteProfile: (id) => api.deleteProfile(id),
    getSettings: () => api.getSettings(),
    saveSettings: (settings) => api.saveSettings(settings),
    getScores: () => api.getScores(),
    saveScore: (profileId, themeId, tier) => api.saveScore(profileId, themeId, tier),
    listUserWords: () => api.listUserWords(),
    createUserWord: (draft) => api.createUserWord(draft),
    updateUserWord: (id, draft) => api.updateUserWord(id, draft),
    deleteUserWord: (id) => api.deleteUserWord(id),
    listSets: () => api.listSets(),
    createSet: (draft) => api.createSet(draft),
    updateSet: (id, draft) => api.updateSet(id, draft),
    deleteSet: (id) => api.deleteSet(id),
    pickMediaFile: (kind) => api.pickMediaFile(kind),
    saveRecording: (bytes) => api.saveRecording(bytes),
    exportSet: (setId) => api.exportSet(setId),
    importSet: () => api.importSet(),
  };
}
