// packages/shared/src/alphabet/game/wordMake.ts
// Этап 3 — «Составь слово».
//
// Отличие от этапа 2: пусты ВСЕ ячейки, слоги выбираются по порядку. У
// эталона: картинка «табурет», три пустые ячейки, панель РЕТ ШИК РУ ЖИ БУ ЧИЙ
// ЯЙ ТА — собрать нужно ТА-БУ-РЕТ.
//
// Из этого примера видно устройство панели: все слоги слова лежат на ней
// ОДНОВРЕМЕННО, вперемешку с дистракторами, и восемь — общее число, а не
// число дистракторов. Слово из трёх слогов получает пять дистракторов, слово
// из двух — шесть.
//
// Отсюда естественный предел: слово длиннее восьми слогов на такую панель не
// помещается. В русском языке это экзотика, и в пакете таких слов быть не
// должно, но отбор заданий обязан это проверять, а не падать на занятии.

import type { AlphabetLibrary } from '../model/schema';
import { shuffled } from './random';
import type { Rng } from './random';
import { QuestionBuildError } from './letterShow';
import { SYLLABLE_OPTIONS } from './wordCompleting';

export interface WordMakeQuestion {
  readonly stage: 'wordMake';
  readonly wordId: string;
  /** Верный порядок слогов — по нему проверяется каждая ячейка */
  readonly answerSyllableIds: readonly string[];
  /** Панель слогов в порядке отрисовки: все слоги слова плюс дистракторы */
  readonly optionSyllableIds: readonly string[];
}

export function buildWordMakeQuestion(
  library: AlphabetLibrary,
  wordId: string,
  rng: Rng,
  optionCount: number = SYLLABLE_OPTIONS
): WordMakeQuestion {
  const word = library.words.find((w) => w.id === wordId);
  if (!word) throw new QuestionBuildError(`слова «${wordId}» нет в пакете`);
  if (word.syllableIds.length < 2) {
    throw new QuestionBuildError(`односложное слово «${word.name}» нечего собирать`);
  }

  // Повторяющийся слог («на-нан»? у эталона такого нет, но своё слово педагога
  // может быть каким угодно) занимает на панели одну кнопку: Set это и делает
  const own = new Set(word.syllableIds);
  if (own.size > optionCount) {
    throw new QuestionBuildError(
      `слово «${word.name}» из ${own.size} разных слогов не помещается на панель из ${optionCount}`
    );
  }

  const pool = library.syllables.filter((s) => !own.has(s.id));
  const options = new Set<string>(own);
  for (const syllable of shuffled(pool, rng)) {
    if (options.size >= optionCount) break;
    options.add(syllable.id);
  }

  return {
    stage: 'wordMake',
    wordId,
    answerSyllableIds: word.syllableIds,
    optionSyllableIds: shuffled([...options], rng),
  };
}
