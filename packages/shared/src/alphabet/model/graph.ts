// packages/shared/src/alphabet/model/graph.ts
// Согласованность графа «буква → слово → слог».
//
// Схема проверяет форму записей, но не связи между ними. А ломаются именно
// связи: слово ссылается на слог, которого нет; слог — на несуществующую
// букву; буква перечисляет слово, которого в пакете уже нет. Для поставочного
// пакета это ошибка сборки, но педагог ЗАВОДИТ СВОИ слова и слоги прямо на
// устройстве, и там граф расходится в обычной работе — например, когда
// удаляют слог, который ещё используется словом.
//
// Поэтому проверка возвращает ОТЧЁТ, а не бросает исключение: вызывающий код
// сам решает, ошибка это сборки или предупреждение педагогу.
//
// Отдельно проверяется требование ТЗ строки 71 — «не менее 2 картинок на
// букву». Иллюстрация есть у каждого слова, поэтому требование сводится к
// «у каждой буквы не меньше двух слов». У эталона буквы Ё и Й стоят ровно на
// границе, и разбор прямо советует не повторять этот запас.

import type { AlphabetLibrary, Letter, Word } from './schema';

/** Минимум иллюстраций на букву по ТЗ (строка 71) */
export const MIN_ILLUSTRATIONS_PER_LETTER = 2;

export interface GraphIssue {
  /** Что именно не сходится — текст для человека */
  message: string;
  /** Куда смотреть */
  kind: 'word-syllable' | 'syllable-letter' | 'letter-word' | 'set-word' | 'word-letter';
}

export interface GraphReport {
  issues: GraphIssue[];
  consistent: boolean;
}

/**
 * Полная сверка связей. Порядок проверок — от частого к редкому, чтобы в
 * отчёте первым стояло то, что вероятнее сломано.
 */
export function checkGraph(library: AlphabetLibrary): GraphReport {
  const issues: GraphIssue[] = [];

  const syllableIds = new Set(library.syllables.map((s) => s.id));
  const wordIds = new Set(library.words.map((w) => w.id));
  const letterNumbers = new Set(library.letters.map((l) => l.number));

  for (const word of library.words) {
    for (const syllableId of word.syllableIds) {
      if (!syllableIds.has(syllableId)) {
        issues.push({
          kind: 'word-syllable',
          message: `слово «${word.name}» ссылается на несуществующий слог «${syllableId}»`,
        });
      }
    }
  }

  for (const syllable of library.syllables) {
    for (const number of syllable.letterNumbers) {
      if (!letterNumbers.has(number)) {
        issues.push({
          kind: 'syllable-letter',
          message: `слог «${syllable.name}» ссылается на букву №${number}, которой нет в алфавите`,
        });
      }
    }
  }

  for (const letter of library.letters) {
    for (const wordId of letter.wordIds) {
      if (!wordIds.has(wordId)) {
        issues.push({
          kind: 'letter-word',
          message: `буква «${letter.name}» перечисляет слово «${wordId}», которого нет в пакете`,
        });
      }
    }
  }

  for (const set of library.sets) {
    for (const wordId of set.wordIds) {
      if (!wordIds.has(wordId)) {
        issues.push({
          kind: 'set-word',
          message: `комплект «${set.title}» ссылается на слово «${wordId}», которого нет в пакете`,
        });
      }
    }
  }

  // Обратная связь: слово должно быть перечислено у своей первой буквы.
  // Без этого этап 1 («покажи букву») не найдёт для буквы заданий, хотя
  // подходящие слова в пакете есть.
  const byLetter = new Map<number, Set<string>>();
  for (const letter of library.letters) byLetter.set(letter.number, new Set(letter.wordIds));
  for (const word of library.words) {
    const number = firstLetterNumber(word, library);
    if (number === null) continue;
    if (!byLetter.get(number)?.has(word.id)) {
      const letter = library.letters.find((l) => l.number === number);
      issues.push({
        kind: 'word-letter',
        message: `слово «${word.name}» не перечислено у буквы «${letter?.name ?? number}»`,
      });
    }
  }

  return { issues, consistent: issues.length === 0 };
}

/**
 * Первая буква слова — через его первый слог. Берём из графа, а не из первой
 * буквы названия: у слова «Ёжик» название начинается с «Ё», и это совпадает,
 * но связь всё равно должна идти через слоги, иначе два источника правды
 * разойдутся на первом же исключении.
 */
export function firstLetterNumber(word: Word, library: AlphabetLibrary): number | null {
  const firstSyllableId = word.syllableIds[0];
  if (!firstSyllableId) return null;
  const syllable = library.syllables.find((s) => s.id === firstSyllableId);
  const number = syllable?.letterNumbers[0];
  return number ?? null;
}

export interface IllustrationReport {
  /** Буквы, у которых меньше требуемого числа слов */
  insufficient: Array<{ number: number; name: string; count: number }>;
  /** Буквы ровно на границе — формально проходят, но запаса нет */
  atMinimum: Array<{ number: number; name: string }>;
  ok: boolean;
}

/**
 * Проверка требования ТЗ строки 71.
 *
 * Отдельно выделяются буквы РОВНО НА ГРАНИЦЕ. Формально они требование
 * выполняют, но у эталона таких две (Ё и Й), и разбор прямо пишет: любое
 * сокращение контента ломает соответствие. Пусть это видно на сборке, а не
 * выясняется на приёмке.
 */
export function checkLetterIllustrations(
  library: AlphabetLibrary,
  minimum: number = MIN_ILLUSTRATIONS_PER_LETTER
): IllustrationReport {
  const insufficient: IllustrationReport['insufficient'] = [];
  const atMinimum: IllustrationReport['atMinimum'] = [];

  for (const letter of library.letters) {
    const count = letter.wordIds.length;
    if (count < minimum) {
      insufficient.push({ number: letter.number, name: letter.name, count });
    } else if (count === minimum) {
      atMinimum.push({ number: letter.number, name: letter.name });
    }
  }

  return { insufficient, atMinimum, ok: insufficient.length === 0 };
}

/** Слова, пригодные для этапа 2: нужен последний слог и запись без него */
export function wordsForCompleting(library: AlphabetLibrary): Word[] {
  return library.words.filter((w) => w.syllableIds.length >= 2 && w.hasWithoutLastSyllable);
}

/** Слова, пригодные для этапа 3: собирать имеет смысл от двух слогов */
export function wordsForMaking(library: AlphabetLibrary): Word[] {
  return library.words.filter((w) => w.syllableIds.length >= 2);
}

/** Слова, пригодные для этапа 1: нужна определимая первая буква */
export function wordsForLetterShow(library: AlphabetLibrary): Word[] {
  return library.words.filter((w) => firstLetterNumber(w, library) !== null);
}

/** Буква по номеру — частая операция, выносится сюда, чтобы не искать каждый раз */
export function letterByNumber(library: AlphabetLibrary, number: number): Letter | null {
  return library.letters.find((l) => l.number === number) ?? null;
}
