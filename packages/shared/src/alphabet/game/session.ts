// packages/shared/src/alphabet/game/session.ts
// Партия: N вопросов одного этапа, от одного до четырёх игроков, посегментная
// проверка, накопление результата.
//
// Состояние НЕИЗМЕНЯЕМОЕ: answer() возвращает новое, а не правит переданное.
// Причина прикладная, а не догматическая: рантайм держит состояние в useState,
// и правка на месте не вызвала бы перерисовку.
//
// Три этапа отличаются вопросом, но не ходом партии, поэтому движок один.
// Единственная асимметрия — этап 3, где вопрос состоит из нескольких ячеек:
// у вопроса появляется ВНУТРЕННИЙ индекс, и один вопрос даёт несколько
// записей в статистику. Этапы 1 и 2 — частный случай с одной ячейкой.

import type { AlphabetLibrary } from '../model/schema';
import { firstLetterNumber, wordsForCompleting, wordsForLetterShow, wordsForMaking } from '../model/graph';
import { shuffled } from './random';
import type { Rng } from './random';
import { buildLetterShowQuestion, LETTER_OPTIONS, QuestionBuildError } from './letterShow';
import type { LetterShowQuestion } from './letterShow';
import { buildWordCompletingQuestion, SYLLABLE_OPTIONS } from './wordCompleting';
import type { WordCompletingQuestion } from './wordCompleting';
import { buildWordMakeQuestion } from './wordMake';
import type { WordMakeQuestion } from './wordMake';

export type AlphabetStage = 'letterShow' | 'wordCompleting' | 'wordMake';

export type AlphabetQuestion = LetterShowQuestion | WordCompletingQuestion | WordMakeQuestion;

/** Одна засчитанная попытка по конкретной букве — сырьё для статистики */
export interface LetterAnswer {
  letterNumber: number;
  correct: boolean;
}

export interface QuestionResult {
  wordId: string;
  /** Закрыт ли вопрос целиком */
  solved: boolean;
  /** Сколько раз ошибся, пока закрывал */
  errors: number;
}

export interface PlayerTally {
  /** Закрытых вопросов */
  completed: number;
  /** Из них без единой ошибки */
  flawless: number;
  errors: number;
}

export interface AlphabetSession {
  readonly roundId: string;
  readonly stage: AlphabetStage;
  readonly playerIds: readonly string[];
  readonly questionsPerPlayer: number;
  readonly questions: Readonly<Record<string, readonly AlphabetQuestion[]>>;
  /** Чей ход и какой у него по счёту вопрос */
  readonly playerIndex: number;
  readonly questionIndex: number;
  /** Заполняемая ячейка внутри вопроса: этапы 1 и 2 не выходят за 0 */
  readonly cellIndex: number;
  readonly errorsInQuestion: number;
  /** Отвергнутые варианты ТЕКУЩЕЙ ячейки — с панели убираются */
  readonly rejected: readonly string[];
  readonly results: Readonly<Record<string, readonly QuestionResult[]>>;
  readonly answers: Readonly<Record<string, readonly LetterAnswer[]>>;
  readonly tally: Readonly<Record<string, PlayerTally>>;
  readonly finished: boolean;
}

export class SessionSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionSetupError';
  }
}

/** Верхняя граница из эталона: рассадка за интерактивным столом на 4 стороны */
export const MAX_PLAYERS = 4;

export interface BuildSessionOptions {
  roundId: string;
  stage: AlphabetStage;
  playerIds: string[];
  questionsPerPlayer: number;
  /** Слова, из которых набираются задания; пусто — берётся весь пакет */
  wordIds?: string[];
  optionCount?: number;
  rng: Rng;
}

/**
 * Слова, пригодные заданному этапу. Отбор делает именно движок, а не
 * вызывающий экран: односложное слово годится этапу 1 и не годится этапам 2 и
 * 3, и спрятать это правило в UI — верный способ однажды его потерять.
 */
export function eligibleWords(
  library: AlphabetLibrary,
  stage: AlphabetStage,
  optionCount: number = SYLLABLE_OPTIONS
): string[] {
  switch (stage) {
    case 'letterShow':
      return wordsForLetterShow(library).map((w) => w.id);
    case 'wordCompleting':
      return wordsForCompleting(library).map((w) => w.id);
    case 'wordMake':
      return wordsForMaking(library)
        .filter((w) => new Set(w.syllableIds).size <= optionCount)
        .map((w) => w.id);
  }
}

/**
 * Загаданные слова на все вопросы игрока. Пригодных слов обычно меньше, чем
 * вопросов, поэтому список перемешивается и повторяется — но на стыке двух
 * проходов одно и то же слово не встаёт двумя вопросами подряд.
 */
function pickTargets(wordIds: string[], count: number, rng: Rng): string[] {
  const targets: string[] = [];
  while (targets.length < count) {
    const pass = shuffled(wordIds, rng);
    const previous = targets[targets.length - 1];
    if (previous !== undefined && pass[0] === previous && pass.length > 1) {
      [pass[0], pass[1]] = [pass[1], pass[0]];
    }
    targets.push(...pass);
  }
  return targets.slice(0, count);
}

function buildQuestion(
  library: AlphabetLibrary,
  stage: AlphabetStage,
  wordId: string,
  rng: Rng,
  optionCount: number
): AlphabetQuestion {
  switch (stage) {
    case 'letterShow':
      return buildLetterShowQuestion(library, wordId, rng, optionCount);
    case 'wordCompleting':
      return buildWordCompletingQuestion(library, wordId, rng, optionCount);
    case 'wordMake':
      return buildWordMakeQuestion(library, wordId, rng, optionCount);
  }
}

export function buildAlphabetSession(
  library: AlphabetLibrary,
  options: BuildSessionOptions
): AlphabetSession {
  const { roundId, stage, playerIds, questionsPerPlayer, rng } = options;
  const optionCount =
    options.optionCount ?? (stage === 'letterShow' ? LETTER_OPTIONS : SYLLABLE_OPTIONS);

  if (playerIds.length === 0) throw new SessionSetupError('в партии нужен хотя бы один игрок');
  if (playerIds.length > MAX_PLAYERS) {
    throw new SessionSetupError(`игроков не может быть больше ${MAX_PLAYERS}`);
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new SessionSetupError('идентификаторы игроков повторяются');
  }
  if (questionsPerPlayer < 1) throw new SessionSetupError('в партии нужен хотя бы один вопрос');

  const eligible = eligibleWords(library, stage, optionCount);
  const pool = options.wordIds ? options.wordIds.filter((id) => eligible.includes(id)) : eligible;
  if (pool.length === 0) {
    // Это не «не повезло с рандомом», а несобираемая партия: сообщение должно
    // называть этап, иначе педагог не поймёт, какого контента не хватает
    throw new SessionSetupError(`для этапа «${stage}» в пакете нет подходящих слов`);
  }

  const questions: Record<string, AlphabetQuestion[]> = {};
  const results: Record<string, QuestionResult[]> = {};
  const answers: Record<string, LetterAnswer[]> = {};
  const tally: Record<string, PlayerTally> = {};

  for (const playerId of playerIds) {
    questions[playerId] = pickTargets(pool, questionsPerPlayer, rng).map((wordId) =>
      buildQuestion(library, stage, wordId, rng, optionCount)
    );
    results[playerId] = [];
    answers[playerId] = [];
    tally[playerId] = { completed: 0, flawless: 0, errors: 0 };
  }

  return {
    roundId,
    stage,
    playerIds,
    questionsPerPlayer,
    questions,
    playerIndex: 0,
    questionIndex: 0,
    cellIndex: 0,
    errorsInQuestion: 0,
    rejected: [],
    results,
    answers,
    tally,
    finished: false,
  };
}

export function currentPlayerId(session: AlphabetSession): string {
  return session.playerIds[session.playerIndex];
}

export function currentQuestion(session: AlphabetSession): AlphabetQuestion | null {
  if (session.finished) return null;
  return session.questions[currentPlayerId(session)][session.questionIndex] ?? null;
}

/** Сколько ячеек в вопросе: этапы 1 и 2 — одна, этап 3 — по слогу на ячейку */
export function cellCount(question: AlphabetQuestion): number {
  return question.stage === 'wordMake' ? question.answerSyllableIds.length : 1;
}

/** Что считается верным ответом для заданной ячейки — как строка-ключ варианта */
export function expectedKey(question: AlphabetQuestion, cellIndex: number): string {
  switch (question.stage) {
    case 'letterShow':
      return String(question.answerLetterNumber);
    case 'wordCompleting':
      return question.answerSyllableId;
    case 'wordMake':
      return question.answerSyllableIds[cellIndex];
  }
}

/**
 * Буква, которой засчитывается ответ.
 *
 * ЭТО НАШЕ РЕШЕНИЕ, а не воспроизведение эталона: по его артефактам видно
 * только, что статистика ведётся по буквам, но не какая буква отвечает за шаг
 * этапов 2 и 3, где ребёнок работает со слогами.
 *
 * Правило: один ответ — ровно одна буква. На этапе 1 это первая буква слова
 * (она и есть вопрос), на этапах 2 и 3 — первая буква слога, который сейчас
 * подбирают. Так записи всех трёх этапов складываются в один график, и ни
 * один ответ не размазывается по четырём буквам, раздувая счётчики.
 */
export function scoredLetter(
  library: AlphabetLibrary,
  question: AlphabetQuestion,
  cellIndex: number
): number | null {
  if (question.stage === 'letterShow') return question.answerLetterNumber;

  const syllableId = expectedKey(question, cellIndex);
  const syllable = library.syllables.find((s) => s.id === syllableId);
  const number = syllable?.letterNumbers[0];
  if (number !== undefined) return number;

  // Слог без букв — дефект пакета, который ловит checkGraph. Партию из-за
  // него не роняем: ответ просто не попадёт в статистику
  const word = library.words.find((w) => w.id === question.wordId);
  return word ? firstLetterNumber(word, library) : null;
}

export interface AnswerOutcome {
  session: AlphabetSession;
  correct: boolean;
  /** Вопрос закрыт этим ответом */
  questionFinished: boolean;
  sessionFinished: boolean;
}

/**
 * Ответ на текущую ячейку. `choice` — номер буквы на этапе 1, идентификатор
 * слога на этапах 2 и 3.
 *
 * Ошибка НЕ закрывает вопрос: вариант убирается с панели, ребёнок пробует
 * снова. Это разумно для дошкольника и совпадает с поведением эталона, где
 * ошибочный выбор подсвечивается, а ход остаётся за тем же игроком.
 */
export function answer(
  library: AlphabetLibrary,
  session: AlphabetSession,
  choice: string | number
): AnswerOutcome {
  if (session.finished) {
    return { session, correct: false, questionFinished: false, sessionFinished: true };
  }

  const question = currentQuestion(session);
  if (!question) {
    return { session, correct: false, questionFinished: false, sessionFinished: session.finished };
  }

  const playerId = currentPlayerId(session);
  const key = String(choice);
  const correct = key === expectedKey(question, session.cellIndex);

  const letterNumber = scoredLetter(library, question, session.cellIndex);
  const answers = { ...session.answers };
  if (letterNumber !== null) {
    answers[playerId] = [...session.answers[playerId], { letterNumber, correct }];
  }

  if (!correct) {
    return {
      session: {
        ...session,
        errorsInQuestion: session.errorsInQuestion + 1,
        rejected: session.rejected.includes(key) ? session.rejected : [...session.rejected, key],
        answers,
        tally: {
          ...session.tally,
          [playerId]: {
            ...session.tally[playerId],
            errors: session.tally[playerId].errors + 1,
          },
        },
      },
      correct: false,
      questionFinished: false,
      sessionFinished: false,
    };
  }

  const nextCell = session.cellIndex + 1;
  if (nextCell < cellCount(question)) {
    // Ячейка закрыта, вопрос нет: панель очищается от отказов предыдущей
    return {
      session: { ...session, cellIndex: nextCell, rejected: [], answers },
      correct: true,
      questionFinished: false,
      sessionFinished: false,
    };
  }

  const errors = session.errorsInQuestion;
  const results = {
    ...session.results,
    [playerId]: [...session.results[playerId], { wordId: question.wordId, solved: true, errors }],
  };
  const tally = {
    ...session.tally,
    [playerId]: {
      ...session.tally[playerId],
      completed: session.tally[playerId].completed + 1,
      flawless: session.tally[playerId].flawless + (errors === 0 ? 1 : 0),
    },
  };

  // Ход переходит следующему игроку; круг замыкается — номер вопроса растёт
  const nextPlayerIndex = (session.playerIndex + 1) % session.playerIds.length;
  const nextQuestionIndex =
    nextPlayerIndex === 0 ? session.questionIndex + 1 : session.questionIndex;
  const finished = nextQuestionIndex >= session.questionsPerPlayer;

  return {
    session: {
      ...session,
      playerIndex: finished ? session.playerIndex : nextPlayerIndex,
      questionIndex: finished ? session.questionIndex : nextQuestionIndex,
      cellIndex: 0,
      errorsInQuestion: 0,
      rejected: [],
      results,
      answers,
      tally,
      finished,
    },
    correct: true,
    questionFinished: true,
    sessionFinished: finished,
  };
}

export { QuestionBuildError };
