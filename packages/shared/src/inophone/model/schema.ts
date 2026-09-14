// packages/shared/src/inophone/model/schema.ts
// Формат пакета контента виджета «Инофон» (Тип 4) и его разбор.
//
// ОДИН ИСТОЧНИК НА ВСЕ ЯЗЫКИ. У эталона башкирский лежит в коде, а остальные
// языки — в data.xml, и проверка комплектности по файлам даёт НЕВЕРНЫЙ
// результат: читая XML, башкирского не находишь вовсе. Здесь все шесть языков
// лежат в одном месте, поэтому комплектность проверяется по тому же файлу, из
// которого приложение читает контент.
//
// ХОТСПОТЫ — ДАННЫЕ, А НЕ КОМПОНЕНТЫ. У эталона 445 сгенерированных .vue с
// SVG-контурами: сцену нельзя поправить без пересборки, а сборка раздута до
// 8,6 МБ кода. Здесь контур объекта — строка `points` в координатах viewBox
// сцены. Педагог или художник правит сцену, не трогая код.

import { z } from 'zod';
import { LANGUAGE_CODES, isLanguageCode, type LanguageCode } from './languages';

/**
 * Ключи языковых словарей проверяются НЕ схемой, а разбором ниже.
 *
 * z.record с ключом-перечислением отвергает неполный набор сам, но сообщением
 * вида «invalid keys»: в нём нет ни понятия, ни языка. Эти сообщения читает
 * тот, кто собирает контент из трёх с лишним тысяч переводов, и «у понятия bed
 * нет перевода на язык ba» экономит ему час против «ошибка валидации».
 */

export const INOPHONE_SCHEMA_VERSION = 1 as const;

/**
 * Идентификатор внутри пакета: строчная латиница, цифры и «_».
 *
 * Отдельная проверка на форму пользовательского идентификатора, как в Типе 3,
 * здесь не нужна — своего контента у педагога в этом виджете нет. Если он
 * появится, правило добавится сюда же, а не в соседний файл.
 */
export const InophoneIdSchema = z
  .string()
  .regex(/^[a-z0-9_]{1,40}$/, 'идентификатор — строчная латиница, цифры и «_»');

/** Перевод понятия на один язык: написание и признак наличия озвучки */
export const TranslationSchema = z.object({
  /** Написание на этом языке. Пустая строка недопустима — это «перевода нет» */
  text: z.string().min(1).max(120),
  /**
   * Есть ли запись произношения. Именно ПРИЗНАК, а не путь: путь выводится из
   * идентификатора слова и кода языка (см. resources.ts), и хранить его
   * вторым источником значило бы получить расхождение при первом же
   * переименовании.
   */
  hasAudio: z.boolean(),
});
export type Translation = z.infer<typeof TranslationSchema>;

/**
 * Понятие словаря: одно и то же на шести языках.
 *
 * ВСЕ ШЕСТЬ ЯЗЫКОВ ОБЯЗАТЕЛЬНЫ. ТЗ строка 95 требует написание на всех
 * языках; язык, у которого перевода нет, — это не «пока не сделали», а
 * несобранный пакет, и схема обязана это ловить. Озвучка при этом
 * необязательна: для четырёх языков из шести на машине разработки синтеза
 * нет, и `hasAudio: false` — честное состояние, а не ошибка формата.
 */
export const ConceptSchema = z.object({
  id: InophoneIdSchema,
  /** Иллюстрация понятия в словаре; сцена рисует его на своей подложке */
  hasPicture: z.boolean(),
  translations: z.record(z.string(), TranslationSchema),
});
export type Concept = z.infer<typeof ConceptSchema>;

/**
 * Интерактивная область на сцене (ТЗ строка 86).
 *
 * `points` — контур многоугольника в координатах viewBox сцены, как в
 * атрибуте SVG polygon: «x1,y1 x2,y2 …». Прямоугольник описывается четырьмя
 * точками и не требует отдельного вида: два способа задать область породили
 * бы два пути отрисовки и проверки попадания.
 */
export const HotspotSchema = z.object({
  /** Какое понятие словаря здесь изображено */
  conceptId: InophoneIdSchema,
  points: z
    .string()
    .regex(
      /^\d+(\.\d+)?,\d+(\.\d+)?( \d+(\.\d+)?,\d+(\.\d+)?)+$/,
      'контур — пары «x,y» через пробел, минимум две точки'
    ),
});
export type Hotspot = z.infer<typeof HotspotSchema>;

/** Сцена: подложка и объекты на ней (ТЗ строка 96) */
export const SceneSchema = z.object({
  id: InophoneIdSchema,
  /** Название сцены на всех языках — заголовок виден в интерфейсе */
  titles: z.record(z.string(), z.string().min(1).max(120)),
  /** Размер системы координат хотспотов; подложка масштабируется под него */
  viewBox: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  hotspots: z.array(HotspotSchema),
});
export type Scene = z.infer<typeof SceneSchema>;

/** Тема, разбитая на сцены-подтемы (ТЗ строка 97) */
export const ThemeSchema = z.object({
  id: InophoneIdSchema,
  titles: z.record(z.string(), z.string().min(1).max(120)),
  sceneIds: z.array(InophoneIdSchema).min(1),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const InophoneLibrarySchema = z.object({
  schemaVersion: z.literal(INOPHONE_SCHEMA_VERSION),
  themes: z.array(ThemeSchema),
  scenes: z.array(SceneSchema),
  concepts: z.array(ConceptSchema),
});
export type InophoneLibrary = z.infer<typeof InophoneLibrarySchema>;

export class InophoneContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InophoneContentError';
  }
}

/**
 * Разбор пакета контента с проверками, которые схемой не выражаются.
 *
 * Ошибка называет КОНКРЕТНОЕ место, а не «пакет невалиден»: эти сообщения
 * читает не пользователь, а тот, кто собирает контент, и «сцена t01e03
 * ссылается на понятие, которого нет» экономит ему час против «ошибка
 * валидации».
 */
export function parseInophoneLibrary(raw: unknown): InophoneLibrary {
  const lib = InophoneLibrarySchema.parse(raw);

  const conceptIds = new Set<string>();
  for (const c of lib.concepts) {
    if (conceptIds.has(c.id)) throw new InophoneContentError(`понятие повторяется: ${c.id}`);
    conceptIds.add(c.id);
    for (const code of LANGUAGE_CODES) {
      if (!c.translations[code]) {
        throw new InophoneContentError(`у понятия ${c.id} нет перевода на язык ${code}`);
      }
    }
    for (const code of Object.keys(c.translations)) {
      if (!isLanguageCode(code)) {
        throw new InophoneContentError(`у понятия ${c.id} перевод на неизвестный язык ${code}`);
      }
    }
  }

  const sceneIds = new Set<string>();
  for (const s of lib.scenes) {
    if (sceneIds.has(s.id)) throw new InophoneContentError(`сцена повторяется: ${s.id}`);
    sceneIds.add(s.id);
    for (const code of LANGUAGE_CODES) {
      if (!s.titles[code]) {
        throw new InophoneContentError(`у сцены ${s.id} нет названия на языке ${code}`);
      }
    }
    const seen = new Set<string>();
    for (const h of s.hotspots) {
      if (!conceptIds.has(h.conceptId)) {
        throw new InophoneContentError(
          `сцена ${s.id} ссылается на понятие ${h.conceptId}, которого нет в словаре`
        );
      }
      // Два хотспота одного понятия на одной сцене сделали бы тренировку
      // нечестной: программа называет слово, а верных областей две, и вторая
      // засчитается как ошибка
      if (seen.has(h.conceptId)) {
        throw new InophoneContentError(
          `на сцене ${s.id} понятие ${h.conceptId} размечено дважды`
        );
      }
      seen.add(h.conceptId);
    }
  }

  const themeIds = new Set<string>();
  for (const t of lib.themes) {
    if (themeIds.has(t.id)) throw new InophoneContentError(`тема повторяется: ${t.id}`);
    themeIds.add(t.id);
    for (const code of LANGUAGE_CODES) {
      if (!t.titles[code]) {
        throw new InophoneContentError(`у темы ${t.id} нет названия на языке ${code}`);
      }
    }
    for (const id of t.sceneIds) {
      if (!sceneIds.has(id)) {
        throw new InophoneContentError(`тема ${t.id} ссылается на сцену ${id}, которой нет`);
      }
    }
  }

  // Сцена, не попавшая ни в одну тему, недостижима: до сцены доходят только
  // через тему. Это не «лишний файл», а потерянная работа художника
  const used = new Set(lib.themes.flatMap((t) => t.sceneIds));
  const orphan = lib.scenes.filter((s) => !used.has(s.id)).map((s) => s.id);
  if (orphan.length > 0) {
    throw new InophoneContentError(
      `сцены не входят ни в одну тему и недостижимы: ${orphan.join(', ')}`
    );
  }

  return lib;
}

/** Понятия, размеченные хотя бы на одной сцене, — только они играются */
export function playableConceptIds(lib: InophoneLibrary): Set<string> {
  return new Set(lib.scenes.flatMap((s) => s.hotspots.map((h) => h.conceptId)));
}

/** Перевод понятия на язык; null — понятия нет */
export function translationOf(
  lib: InophoneLibrary,
  conceptId: string,
  code: LanguageCode
): Translation | null {
  const concept = lib.concepts.find((c) => c.id === conceptId);
  return concept ? (concept.translations[code] ?? null) : null;
}

/**
 * Название темы или сцены на языке интерфейса.
 *
 * ЕСТЬ ЗАПАСНОЙ ВАРИАНТ, и это не послабление к данным. Названия хранятся на
 * всех языках, но набор языков растёт: добавив седьмой, мы получаем пакет, где
 * у сцен ещё нет нового названия, — и приложение обязано показать сцену, а не
 * пустую строку. Порядок отхода: запрошенный язык → русский → любой, какой
 * есть. Пустая строка возвращается только если названий нет вовсе, и это
 * видно глазом, а не прячется за «сцена 3».
 */
export function localTitle(
  titles: Record<string, string>,
  code: LanguageCode,
  fallback: LanguageCode = 'ru'
): string {
  return titles[code] ?? titles[fallback] ?? Object.values(titles)[0] ?? '';
}
