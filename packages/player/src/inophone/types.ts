// packages/player/src/inophone/types.ts
// Контракт моста «рендерер ↔ главный процесс» для виджета «Инофон» (Тип 4).
//
// Форма ответа — {ok, data|error}, как у wordsAPI и alphabetAPI: в рендерер
// уходит готовый текст для педагога, а не стек. Рендерер никогда не получает
// исключение из IPC и не обязан его ловить.
//
// РУЧЕК ЗАМЕТНО МЕНЬШЕ, чем у Типов 2 и 3, и это не недоделка. У «Инофона» по
// ТЗ нет редактора контента педагога: набор сцен и словарь поставляются с
// приложением. Нет своего контента — нет ни пароля педагога, ни импорта
// комплектов, ни выбора картинок с диска.

import type { inophone } from '@kiosk/shared';

/**
 * Код языка — ИЗ ПРОСТРАНСТВА ИМЁН домена, а не плоским импортом. Имя
 * `LanguageCode` слишком общее, чтобы висеть в корне пакета: пятый виджет с
 * языками молча затёр бы его при `export *`.
 */
export type LanguageCode = inophone.LanguageCode;

export type InophoneLibrary = ReturnType<typeof inophone.parseInophoneLibrary>;
export type InophoneSettings = ReturnType<typeof inophone.parseInophoneSettings>;
export type InophoneStatistics = ReturnType<typeof inophone.parseInophoneStatistics>;
export type CompletenessReport = ReturnType<typeof inophone.checkCompleteness>;
export type QuotaReport = ReturnType<typeof inophone.checkQuotas>;
export type GeometryReport = ReturnType<typeof inophone.checkGeometry>;

/** Итог партии по языкам: [верно, всего] на каждый изучаемый язык */
export type TallyByLanguage = Partial<Record<LanguageCode, readonly [number, number]>>;

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

export interface InophoneContext {
  baseDir: string;
  /** Данные легли не в общий каталог машины, а в userData — нет прав на запись */
  isFallback: boolean;
  hasLibrary: boolean;
  libraryError: string | null;
  /**
   * Отчёты о комплектности и квотах ТЗ приходят ВМЕСТЕ с контекстом, а не по
   * отдельному запросу: они считаются один раз при старте главного процесса и
   * нужны не игре, а диагностике — педагог должен понимать, почему слово
   * молчит, а администратор — что доставить.
   */
  completeness: CompletenessReport | null;
  /** Неоднозначная разметка сцен: наложившиеся контуры и вышедшие за край */
  geometry: GeometryReport | null;
  quotas: QuotaReport | null;
}

/** Ровно то, что выставляет preload.js в window.inophoneAPI */
export interface InophoneApi {
  getContext(): Promise<IpcResult<InophoneContext>>;
  getLibrary(): Promise<IpcResult<InophoneLibrary | null>>;
  listProfiles(): Promise<IpcResult<Profile[]>>;
  createProfile(name: string): Promise<IpcResult<Profile[]>>;
  deleteProfile(profileId: string): Promise<IpcResult<Profile[]>>;
  getSettings(): Promise<IpcResult<InophoneSettings>>;
  saveSettings(settings: Partial<InophoneSettings>): Promise<IpcResult<InophoneSettings>>;
  getStatistics(): Promise<IpcResult<InophoneStatistics>>;
  /** Итог партии пишется ПО ЯЗЫКАМ: в этом весь смысл сводки у пособия по языкам */
  recordSession(
    profileId: string,
    sceneId: string,
    byLanguage: TallyByLanguage
  ): Promise<IpcResult<InophoneStatistics>>;
  clearStatistics(profileId: string): Promise<IpcResult<InophoneStatistics>>;
}

declare global {
  interface Window {
    inophoneAPI?: InophoneApi;
  }
}
