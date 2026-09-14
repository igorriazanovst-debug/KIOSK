// packages/shared/src/inophone/model/resources.ts
// Раскладка файлов пакета контента «Инофон» и проверка комплектности.
//
// ПУТЬ ВЫВОДИТСЯ ИЗ ИДЕНТИФИКАТОРА, а не хранится в данных. Хранить путь
// вторым источником значит получить расхождение при первом же переименовании,
// и именно поэтому в схеме у перевода лежит признак `hasAudio`, а не строка.
//
// ПРОВЕРКА КОМПЛЕКТНОСТИ НАЗЫВАЕТ НЕДОСТАЮЩЕЕ ПОИМЁННО. У эталона проверить
// комплектность по файлам нельзя вовсе: башкирский лежит в коде, остальные
// языки в XML, и чтение XML даёт неверный ответ. Здесь источник один, а отчёт
// обязан говорить «нет звука для bed на языке fr», а не «пакет неполон»:
// второе бесполезно для того, кто собирает три тысячи переводов.

import type { InophoneLibrary } from './schema';
import { LANGUAGE_CODES, type LanguageCode } from './languages';

export const SCENE_IMAGE_DIR = 'img/scenes';
export const CONCEPT_IMAGE_DIR = 'img/concepts';
export const AUDIO_DIR = 'audio';

/** Подложка сцены */
export function sceneImagePath(sceneId: string): string {
  return `${SCENE_IMAGE_DIR}/${sceneId}.svg`;
}

/** Иллюстрация понятия для словаря */
export function conceptImagePath(conceptId: string): string {
  return `${CONCEPT_IMAGE_DIR}/${conceptId}.svg`;
}

/**
 * Произношение слова на языке.
 *
 * Язык — каталогом, а не суффиксом в имени: так добавление языка не трогает
 * ни одного существующего файла, а удаление языка сводится к удалению одного
 * каталога. У эталона язык вшит в имя файла (`0001bak.mp3`), и вычистить язык
 * из поставки там означает пройти по всем 2650 файлам.
 */
export function conceptAudioPath(conceptId: string, code: LanguageCode): string {
  return `${AUDIO_DIR}/${code}/${conceptId}.mp3`;
}

export interface CompletenessReport {
  /** Сколько понятий имеет написание на всех шести языках */
  fullyTranslated: number;
  /** Сколько понятий имеет озвучку на всех шести языках */
  fullyVoiced: number;
  /** Недостающие файлы — поимённо, но с потолком: список на тысячи строк никто не читает */
  missingFiles: string[];
  missingCount: number;
  /** Файлы в пакете, которых не ждёт ни одна сущность */
  extraFiles: string[];
  /** Сколько озвучек не хватает по каждому языку — это и есть картина по языкам */
  audioGapByLanguage: Record<LanguageCode, number>;
  ok: boolean;
}

const MAX_LISTED = 20;

/**
 * Комплектность пакета относительно списка файлов на диске.
 *
 * `present` — множество путей, уже имеющихся в пакете, в тех же терминах, что
 * возвращают функции выше. Функция намеренно НЕ ходит в файловую систему:
 * домен обязан быть проверяем тестом без диска, а собрать список файлов умеет
 * и сборщик пакета, и рантайм при старте.
 */
export function checkCompleteness(
  lib: InophoneLibrary,
  present: ReadonlySet<string>
): CompletenessReport {
  const expected = new Set<string>();
  const missing: string[] = [];
  const gap = Object.fromEntries(LANGUAGE_CODES.map((c) => [c, 0])) as Record<LanguageCode, number>;

  let fullyTranslated = 0;
  let fullyVoiced = 0;

  for (const scene of lib.scenes) {
    const p = sceneImagePath(scene.id);
    expected.add(p);
    if (!present.has(p)) missing.push(p);
  }

  for (const concept of lib.concepts) {
    if (concept.hasPicture) {
      const p = conceptImagePath(concept.id);
      expected.add(p);
      if (!present.has(p)) missing.push(p);
    }

    let translated = 0;
    let voiced = 0;
    for (const code of LANGUAGE_CODES) {
      const t = concept.translations[code];
      if (t && t.text.length > 0) translated += 1;
      if (!t?.hasAudio) {
        // Озвучки нет и она не заявлена — это не отсутствующий файл, а
        // незаписанный звук. Разница существенна: первое чинит сборщик,
        // второе — диктор
        gap[code] += 1;
        continue;
      }
      voiced += 1;
      const p = conceptAudioPath(concept.id, code);
      expected.add(p);
      if (!present.has(p)) missing.push(p);
    }
    if (translated === LANGUAGE_CODES.length) fullyTranslated += 1;
    if (voiced === LANGUAGE_CODES.length) fullyVoiced += 1;
  }

  const extra = [...present].filter((p) => !expected.has(p));

  return {
    fullyTranslated,
    fullyVoiced,
    missingFiles: missing.slice(0, MAX_LISTED),
    missingCount: missing.length,
    extraFiles: extra.slice(0, MAX_LISTED),
    audioGapByLanguage: gap,
    ok: missing.length === 0 && extra.length === 0,
  };
}

/**
 * Соответствие количественным требованиям ТЗ.
 *
 * Проверяется ровно то, что написано в строках 95, 96 и 97, и отдельно —
 * НАСКОЛЬКО БЛИЗКО к границе. У эталона 5 тем при требовании «≥5» и 32 сцены
 * при «≥31»: любое выбракованное на приёмке сразу ломает соответствие, и
 * разбор назвал это риском. Отчёт обязан показывать запас, а не только
 * «выполнено».
 */
export interface QuotaReport {
  words: { have: number; need: number; ok: boolean; spare: number };
  scenes: { have: number; need: number; ok: boolean; spare: number };
  themes: { have: number; need: number; ok: boolean; spare: number };
  ok: boolean;
}

export const QUOTA_WORDS = 350;
export const QUOTA_SCENES = 31;
export const QUOTA_THEMES = 5;

export function checkQuotas(lib: InophoneLibrary): QuotaReport {
  // Слово засчитывается, только если у него есть написание на ВСЕХ шести
  // языках: ТЗ строки 95 требует именно этого, а не просто наличия записи
  const words = lib.concepts.filter((c) =>
    LANGUAGE_CODES.every((code) => (c.translations[code]?.text.length ?? 0) > 0)
  ).length;

  const row = (have: number, need: number) => ({
    have,
    need,
    ok: have >= need,
    spare: have - need,
  });

  const w = row(words, QUOTA_WORDS);
  const s = row(lib.scenes.length, QUOTA_SCENES);
  const t = row(lib.themes.length, QUOTA_THEMES);
  return { words: w, scenes: s, themes: t, ok: w.ok && s.ok && t.ok };
}
