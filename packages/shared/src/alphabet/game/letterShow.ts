// packages/shared/src/alphabet/game/letterShow.ts
// Этап 1 — «Покажи букву».
//
// Звучит слово, показана иллюстрация, внизу панель букв: указать первую букву.
// На снимке эталона панель содержит ВОСЕМЬ букв (Е Ч З У К Ё М Ц при слове
// «Мясо»), а не весь алфавит — и это разумно: тридцать три кнопки на панели
// для ребёнка, который букв ещё не знает, превращают задание в перебор.
// Восемь — общее число вариантов на всех трёх этапах, повторяем.

import type { AlphabetLibrary } from '../model/schema';
import { firstLetterNumber } from '../model/graph';
import { shuffled } from './random';
import type { Rng } from './random';

/** Вариантов на панели — столько же, сколько слогов на этапах 2 и 3 */
export const LETTER_OPTIONS = 8;

export interface LetterShowQuestion {
  readonly stage: 'letterShow';
  readonly wordId: string;
  /** Верный ответ — номер первой буквы слова */
  readonly answerLetterNumber: number;
  /** Панель букв в порядке отрисовки; верная среди них ровно одна */
  readonly optionLetterNumbers: readonly number[];
}

export class QuestionBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionBuildError';
  }
}

/**
 * Собирает вопрос по заданному слову.
 *
 * Дистракторы берутся из всего алфавита пакета, а не только из букв, у
 * которых есть слова: на панели эталона стоит «Ё», а у неё слов всего две —
 * значит панель наполняется буквами как таковыми. Так и проще объяснить
 * ребёнку: панель это кусочек алфавита, а не витрина имеющегося контента.
 */
export function buildLetterShowQuestion(
  library: AlphabetLibrary,
  wordId: string,
  rng: Rng,
  optionCount: number = LETTER_OPTIONS
): LetterShowQuestion {
  const word = library.words.find((w) => w.id === wordId);
  if (!word) throw new QuestionBuildError(`слова «${wordId}» нет в пакете`);

  const answerLetterNumber = firstLetterNumber(word, library);
  if (answerLetterNumber === null) {
    throw new QuestionBuildError(`у слова «${word.name}» не определяется первая буква`);
  }

  const options = new Set<number>([answerLetterNumber]);
  const wanted = Math.max(1, optionCount);
  for (const letter of shuffled(library.letters, rng)) {
    if (options.size >= wanted) break;
    options.add(letter.number);
  }

  return {
    stage: 'letterShow',
    wordId,
    answerLetterNumber,
    optionLetterNumbers: shuffled([...options], rng),
  };
}

/** Буква, которой засчитывается результат вопроса */
export function letterShowScoredLetter(question: LetterShowQuestion): number {
  return question.answerLetterNumber;
}
