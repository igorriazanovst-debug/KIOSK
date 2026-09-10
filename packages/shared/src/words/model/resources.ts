// packages/shared/src/words/model/resources.ts
// Раскладка файлов контента и проверка её комплектности.
//
// Идентификатор слова — ключ ко всему: он же имя файла иллюстрации, он же имя
// папки озвучки. Поэтому путь любого ресурса выводится из идентификатора
// одной функцией, и та же функция даёт список ОЖИДАЕМЫХ файлов, с которым
// сборка сверяет фактический состав пакета контента.
//
// Зачем это отдельным механизмом: в поставке эталона ОС3 не хватало двух mp3
// (items/1407/boy/4.mp3 и одного женского варианта слова 0502) — у двух слов
// было 10 файлов вместо 11. На работу это не влияло, потому что вариант
// выбирается случайно из имеющихся, и дефект дожил до продакшена незамеченным.
// Здесь несоответствие манифесту — ошибка сборки, а не предупреждение.

import type { AudioScheme, WordsLibrary } from './schema';

/** Все пути внутри пакета контента — POSIX-разделители, относительные от его корня */
export const WORDS_IMAGE_DIR = 'img/words';
export const WORDS_THEME_IMAGE_DIR = 'img/themes';
export const WORDS_AUDIO_DIR = 'media/words';
export const WORDS_THEME_AUDIO_DIR = 'media/themes';
export const WORDS_FINAL_SCENE_AUDIO_DIR = 'media/scenes-final';

/** Иллюстрация слова */
export function wordImagePath(wordId: string): string {
  return `${WORDS_IMAGE_DIR}/${wordId}.svg`;
}

/** Нейтральная запись слова — произносится само слово, без фразы */
export function wordNeutralAudioPath(wordId: string): string {
  return `${WORDS_AUDIO_DIR}/${wordId}/neutral.mp3`;
}

/** Фразовый вариант: слово внутри фразы, чтобы повторы не надоедали за партию */
export function wordPhraseAudioPath(wordId: string, voice: string, variant: number): string {
  return `${WORDS_AUDIO_DIR}/${wordId}/${voice}/${variant}.mp3`;
}

/** Все звуковые файлы, полагающиеся слову по схеме озвучки */
export function wordAudioPaths(wordId: string, scheme: AudioScheme): string[] {
  const paths: string[] = [];
  if (scheme.neutral) paths.push(wordNeutralAudioPath(wordId));
  for (const voice of scheme.voices) {
    for (let variant = 0; variant < scheme.phrasesPerVoice; variant++) {
      paths.push(wordPhraseAudioPath(wordId, voice, variant));
    }
  }
  return paths;
}

/** Сколько звуковых файлов приходится на одно слово при данной схеме */
export function audioFilesPerWord(scheme: AudioScheme): number {
  return (scheme.neutral ? 1 : 0) + scheme.voices.length * scheme.phrasesPerVoice;
}

/**
 * Обложка темы на экране выбора. SVG, а не растр: обложки показываются на
 * панелях от планшета до 4K-доски, и вектор снимает вопрос разрешения.
 */
export function themeCoverPath(themeId: string): string {
  return `${WORDS_THEME_IMAGE_DIR}/${themeId}.svg`;
}

/** Записана ли озвучка вообще — см. комментарий к voices в схеме */
export function schemeHasAudio(scheme: AudioScheme): boolean {
  return scheme.neutral || (scheme.voices.length > 0 && scheme.phrasesPerVoice > 0);
}

/** Вводная реплика темы (ТЗ строки 49 и 60) */
export function themeIntroAudioPath(themeId: string, voice: string): string {
  return `${WORDS_THEME_AUDIO_DIR}/${themeId}/${voice}.mp3`;
}

/** Озвучка финальной сцены темы */
export function themeFinalAudioPath(themeId: string): string {
  return `${WORDS_FINAL_SCENE_AUDIO_DIR}/${themeId}.mp3`;
}

/**
 * Полный список файлов, которые обязаны быть в пакете контента для этой
 * библиотеки. Порядок устойчив (слова в порядке объявления, внутри слова —
 * нейтральная запись, затем голоса и варианты), чтобы диффы отчёта сборки
 * читались глазами.
 */
export function expectedLibraryFiles(library: WordsLibrary): string[] {
  const files: string[] = [];

  const hasAudio = schemeHasAudio(library.audioScheme);

  for (const theme of library.themes) {
    files.push(themeCoverPath(theme.id));
    for (const voice of library.audioScheme.voices) {
      files.push(themeIntroAudioPath(theme.id, voice));
    }
    if (hasAudio) files.push(themeFinalAudioPath(theme.id));
  }

  for (const word of library.words) {
    files.push(wordImagePath(word.id));
    files.push(...wordAudioPaths(word.id, library.audioScheme));
  }

  return files;
}

export interface CompletenessReport {
  /** Файлы, которых не хватает — это ошибка сборки */
  missing: string[];
  /** Файлы в пакете, на которые никто не ссылается — мёртвый вес дистрибутива */
  unreferenced: string[];
  complete: boolean;
}

/**
 * Сверяет фактический состав пакета контента с тем, что требует библиотека.
 * `actualFiles` — пути относительно корня пакета, с любыми разделителями:
 * на Windows fs отдаёт «\», а манифест всегда в POSIX-форме.
 */
export function checkLibraryCompleteness(
  library: WordsLibrary,
  actualFiles: Iterable<string>
): CompletenessReport {
  const actual = new Set<string>();
  for (const file of actualFiles) {
    actual.add(file.replace(/\\/g, '/').replace(/^\.\//, ''));
  }

  const expected = expectedLibraryFiles(library);
  const expectedSet = new Set(expected);

  const missing = expected.filter((file) => !actual.has(file));
  const unreferenced = [...actual].filter((file) => !expectedSet.has(file)).sort();

  return { missing, unreferenced, complete: missing.length === 0 };
}

/**
 * Оценка веса контента для заданной схемы озвучки — вход для решения «сколько
 * записей на слово» (раздел 0.3 плана). Считает не по документации, а по
 * фактическим средним размерам файлов, которые замеряются на спайке.
 */
export interface ContentSizeEstimate {
  wordCount: number;
  themeCount: number;
  audioFileCount: number;
  imageBytes: number;
  audioBytes: number;
  totalBytes: number;
}

export function estimateContentSize(
  library: WordsLibrary,
  avg: { imageBytes: number; audioBytes: number; themeCoverBytes: number }
): ContentSizeEstimate {
  const wordCount = library.words.length;
  const themeCount = library.themes.length;
  const perWord = audioFilesPerWord(library.audioScheme);
  const themeAudioCount = themeCount * (library.audioScheme.voices.length + 1);
  const audioFileCount = wordCount * perWord + themeAudioCount;

  const imageBytes = wordCount * avg.imageBytes + themeCount * avg.themeCoverBytes;
  const audioBytes = audioFileCount * avg.audioBytes;

  return {
    wordCount,
    themeCount,
    audioFileCount,
    imageBytes,
    audioBytes,
    totalBytes: imageBytes + audioBytes,
  };
}
