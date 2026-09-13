// packages/shared/src/alphabet/game/wordCompleting.ts
// Этап 2 — «Закончи слово».
//
// Показана иллюстрация и слово, набранное слогами, КРОМЕ последнего; звучит
// запись «без последнего слога» — начало слова. Внизу восемь слогов, верный
// один. У эталона: картинка «мальчик», набрано МАЛЬ, варианты ЛАД ЧИК ЩЁ МО
// КСИ Э РАН ТОК, верный ЧИК.
//
// В том примере видно важное: среди вариантов НЕТ слога МАЛЬ, то есть уже
// набранные слоги слова в дистракторы не попадают. Это не подсказка — ребёнок
// и так видит их в ячейках, — а снятие бессмысленного варианта: положить МАЛЬ
// второй раз нельзя ни по какому правилу игры.

import type { AlphabetLibrary } from '../model/schema';
import { shuffled } from './random';
import type { Rng } from './random';
import { QuestionBuildError } from './letterShow';

export const SYLLABLE_OPTIONS = 8;

export interface WordCompletingQuestion {
  readonly stage: 'wordCompleting';
  readonly wordId: string;
  /** Слоги, уже стоящие в ячейках, по порядку */
  readonly shownSyllableIds: readonly string[];
  /** Верный ответ — последний слог слова */
  readonly answerSyllableId: string;
  /** Панель слогов в порядке отрисовки */
  readonly optionSyllableIds: readonly string[];
}

export function buildWordCompletingQuestion(
  library: AlphabetLibrary,
  wordId: string,
  rng: Rng,
  optionCount: number = SYLLABLE_OPTIONS
): WordCompletingQuestion {
  const word = library.words.find((w) => w.id === wordId);
  if (!word) throw new QuestionBuildError(`слова «${wordId}» нет в пакете`);
  if (word.syllableIds.length < 2) {
    throw new QuestionBuildError(`у односложного слова «${word.name}» нечего убирать`);
  }
  if (!word.hasWithoutLastSyllable) {
    // Без этой записи этап вырождается: звучало бы слово целиком вместе с
    // ответом, который ребёнок должен найти сам
    throw new QuestionBuildError(`у слова «${word.name}» нет записи без последнего слога`);
  }

  const answerSyllableId = word.syllableIds[word.syllableIds.length - 1];
  const shownSyllableIds = word.syllableIds.slice(0, -1);

  const own = new Set(word.syllableIds);
  const pool = library.syllables.filter((s) => !own.has(s.id));

  const options = new Set<string>([answerSyllableId]);
  const wanted = Math.max(1, optionCount);
  for (const syllable of shuffled(pool, rng)) {
    if (options.size >= wanted) break;
    options.add(syllable.id);
  }

  return {
    stage: 'wordCompleting',
    wordId,
    shownSyllableIds,
    answerSyllableId,
    optionSyllableIds: shuffled([...options], rng),
  };
}
