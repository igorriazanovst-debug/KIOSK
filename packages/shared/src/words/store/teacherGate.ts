// packages/shared/src/words/store/teacherGate.ts
// Правила пароля педагога (ТЗ раздел 3 — разграничение прав).
//
// Пароль закрывает разделы, где меняют материалы и настройки занятия. До него
// эти разделы были за удержанием кнопки: удержание защищает от СЛУЧАЙНОГО
// попадания, но не от ребёнка, который увидел, как это делает педагог.
//
// ЧТО ЭТО ЗА ЗАЩИТА И ЧТО ЕЮ НЕ ЯВЛЯЕТСЯ. Это рубеж от детей на занятии, а не
// средство защиты данных. Каталог с данными лежит на том же устройстве и
// доступен любому, у кого есть доступ к файловой системе; пароль лишь не даёт
// открыть редактор мимо педагога. Поэтому здесь нет ни защиты от подбора, ни
// многократного хеширования — они создавали бы ложное впечатление стойкости.
//
// Сам пароль НЕ хранится: на диске лежит только его хеш, и наружу, в интерфейс,
// он не отдаётся вовсе — проверка идёт в главном процессе.

/** Пароль по умолчанию, пока педагог не задал свой */
export const DEFAULT_TEACHER_PASSWORD = '12345';

export const MIN_TEACHER_PASSWORD_LENGTH = 4;
export const MAX_TEACHER_PASSWORD_LENGTH = 32;

export class TeacherGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeacherGateError';
  }
}

/**
 * Проверка нового пароля перед сохранением. Требования намеренно мягкие:
 * педагог вводит его экранной клавиатурой на сенсорной панели, и требовать
 * заглавные буквы со спецсимволами здесь значило бы обменять реальное
 * удобство на воображаемую стойкость.
 */
export function assertPasswordAcceptable(password: string): string {
  const value = String(password ?? '');
  if (value.length < MIN_TEACHER_PASSWORD_LENGTH) {
    throw new TeacherGateError(`Пароль короче ${MIN_TEACHER_PASSWORD_LENGTH} символов`);
  }
  if (value.length > MAX_TEACHER_PASSWORD_LENGTH) {
    throw new TeacherGateError(`Пароль длиннее ${MAX_TEACHER_PASSWORD_LENGTH} символов`);
  }
  if (value.trim() !== value) {
    throw new TeacherGateError('Пароль не должен начинаться или заканчиваться пробелом');
  }
  return value;
}

/** Разделы, закрытые паролем */
export const GATED_SECTIONS = ['myWords', 'settings'] as const;
export type GatedSection = (typeof GATED_SECTIONS)[number];

export function isGatedSection(name: string): name is GatedSection {
  return (GATED_SECTIONS as readonly string[]).includes(name);
}
