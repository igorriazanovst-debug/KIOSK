// packages/shared/src/words/game/session.ts
// Движок партии: построение шагов, отбор вариантов ответа, очерёдность
// игроков, проверка ответа. Чистые функции без DOM и Electron — весь модуль
// тестируется как обычный TS.
//
// Состояние партии неизменяемое: answer() возвращает НОВОЕ состояние, а не
// правит переданное. Это не догма ради догмы — рантайм на React хранит
// состояние в useState, и мутация на месте не вызвала бы перерисовку.
//
// roundId — идентификатор партии. Он нужен не для статистики, а чтобы
// отбрасывать запоздалую озвучку: реплика предыдущей партии, начатая до
// выхода в меню, догоняет следующую и произносит чужое слово. У эталона ОС3
// ровно этот механизм назван roomId — приём неочевидный, но необходимый.

import type { WordsLevel } from '../widgetProperties';
import { WORDS_USER_LEVEL } from '../widgetProperties';
import { isUserWordId } from '../model/schema';

export type StepLevel = WordsLevel | typeof WORDS_USER_LEVEL;

/** Один шаг партии: что загадано и из чего выбирать */
export interface GameStep {
  level: StepLevel;
  targetWordId: string;
  /** Варианты на экране, включая загаданный; порядок — тот, в котором рисуются */
  optionWordIds: string[];
}

/** Итог по слову у одного игрока */
export interface WordResult {
  solved: boolean;
  /** Сколько раз ошибся на этом шаге */
  errors: number;
}

/**
 * Пошаговый счёт игрока. Считается отдельно от results, а не выводится из
 * них: слово может повториться в партии (слов в теме меньше, чем шагов), и
 * тогда результаты по нему сливаются — по ним уже не восстановить, сколько
 * именно ШАГОВ было пройдено без ошибки, а достижение считается именно по
 * шагам.
 */
export interface PlayerTally {
  /** Закрытых шагов */
  completed: number;
  /** Из них пройденных с первой попытки */
  flawless: number;
  /** Всего ошибок за партию */
  errors: number;
}

export interface GameSession {
  readonly roundId: string;
  readonly themeId: string;
  /** Игроки в порядке хода */
  readonly playerIds: string[];
  readonly stepsPerPlayer: number;
  /** Шаги, разложенные по игрокам */
  readonly steps: Readonly<Record<string, GameStep[]>>;
  /** Чей сейчас ход и какой по счёту его шаг */
  readonly playerIndex: number;
  readonly stepIndex: number;
  /** Номер попытки в текущем шаге, начиная с 0 */
  readonly attempt: number;
  /** Ошибок в текущем шаге */
  readonly errorsInStep: number;
  /** Уже отвергнутые варианты текущего шага — с экрана убираются */
  readonly rejectedWordIds: string[];
  readonly results: Readonly<Record<string, Record<string, WordResult>>>;
  readonly tally: Readonly<Record<string, PlayerTally>>;
  readonly finished: boolean;
}

export type Rng = () => number;

export interface BuildSessionOptions {
  roundId: string;
  themeId: string;
  playerIds: string[];
  /** Слова темы — из них выбирается загаданное */
  themeWordIds: string[];
  /** Дополнительный запас на дистракторы, когда своих слов в теме мало */
  fallbackWordIds?: string[];
  stepsPerPlayer: number;
  optionsPerStep: number;
  /** Уровень слова: переопределения педагога уже применены вызывающим кодом */
  levelOf: (wordId: string) => StepLevel;
  rng?: Rng;
}

export class GameSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameSetupError';
  }
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Загаданные слова на все шаги игрока. Слов в теме почти всегда меньше, чем
 * шагов (у эталона темы по 10–21 слову при 20 шагах), поэтому список
 * перемешивается и повторяется — но так, чтобы внутри одного прохода слово не
 * повторялось: подряд одно и то же ребёнку не показывается.
 */
function pickTargets(themeWordIds: string[], stepsPerPlayer: number, rng: Rng): string[] {
  const targets: string[] = [];
  while (targets.length < stepsPerPlayer) {
    const pass = shuffled(themeWordIds, rng);
    // Внутри одного прохода повторов нет по построению, но на СТЫКЕ проходов
    // последнее слово предыдущего может совпасть с первым следующего — и
    // ребёнок увидит одно и то же слово два шага подряд. Разводим их обменом
    // с соседом: это дешевле, чем перемешивать проход заново, и не зацикливается.
    const previous = targets[targets.length - 1];
    if (previous !== undefined && pass[0] === previous && pass.length > 1) {
      [pass[0], pass[1]] = [pass[1], pass[0]];
    }
    targets.push(...pass);
  }
  return targets.slice(0, stepsPerPlayer);
}

/**
 * Варианты ответа для шага: загаданное слово плюс дистракторы. Дистракторы
 * берутся сначала из своей темы (они ближе по смыслу — выбор сложнее и
 * осмысленнее), и только когда своих не хватает, добираются из запаса.
 */
function pickOptions(
  targetWordId: string,
  themeWordIds: string[],
  fallbackWordIds: string[],
  optionsPerStep: number,
  rng: Rng
): string[] {
  const wanted = Math.max(1, optionsPerStep);
  const options = new Set<string>([targetWordId]);

  for (const candidate of shuffled(themeWordIds, rng)) {
    if (options.size >= wanted) break;
    options.add(candidate);
  }
  for (const candidate of shuffled(fallbackWordIds, rng)) {
    if (options.size >= wanted) break;
    options.add(candidate);
  }

  return shuffled([...options], rng);
}

export function buildSession(options: BuildSessionOptions): GameSession {
  const {
    roundId,
    themeId,
    playerIds,
    themeWordIds,
    fallbackWordIds = [],
    stepsPerPlayer,
    optionsPerStep,
    levelOf,
    rng = Math.random,
  } = options;

  if (playerIds.length === 0) throw new GameSetupError('session needs at least one player');
  if (new Set(playerIds).size !== playerIds.length) {
    throw new GameSetupError('player ids must be unique');
  }
  if (themeWordIds.length === 0) throw new GameSetupError('session needs at least one word');
  if (stepsPerPlayer < 1) throw new GameSetupError('stepsPerPlayer must be at least 1');

  const steps: Record<string, GameStep[]> = {};
  const results: Record<string, Record<string, WordResult>> = {};
  const tally: Record<string, PlayerTally> = {};

  for (const playerId of playerIds) {
    const targets = pickTargets(themeWordIds, stepsPerPlayer, rng);
    steps[playerId] = targets.map((targetWordId) => ({
      level: levelOf(targetWordId),
      targetWordId,
      optionWordIds: pickOptions(targetWordId, themeWordIds, fallbackWordIds, optionsPerStep, rng),
    }));
    results[playerId] = {};
    tally[playerId] = { completed: 0, flawless: 0, errors: 0 };
  }

  return {
    roundId,
    themeId,
    playerIds,
    stepsPerPlayer,
    steps,
    playerIndex: 0,
    stepIndex: 0,
    attempt: 0,
    errorsInStep: 0,
    rejectedWordIds: [],
    results,
    tally,
    finished: false,
  };
}

/** Кто сейчас ходит */
export function currentPlayerId(session: GameSession): string {
  return session.playerIds[session.playerIndex];
}

/** Текущий шаг, либо null если партия закончена */
export function currentStep(session: GameSession): GameStep | null {
  if (session.finished) return null;
  return session.steps[currentPlayerId(session)][session.stepIndex] ?? null;
}

/** Варианты, которые сейчас на экране: без уже отвергнутых */
export function visibleOptions(session: GameSession): string[] {
  const step = currentStep(session);
  if (!step) return [];
  const rejected = new Set(session.rejectedWordIds);
  return step.optionWordIds.filter((id) => !rejected.has(id));
}

export type AnswerOutcome = 'correct' | 'wrong' | 'ignored';

export interface AnswerResult {
  session: GameSession;
  outcome: AnswerOutcome;
  /**
   * Какой сценарий озвучки проигрывать. Пользовательское слово озвучивается
   * иначе, чем поставочное: у него нет фразовых вариантов, есть только запись
   * педагога (тот же приём, что scenario9Say у эталона).
   */
  scenario: 'level0' | 'level1' | 'level2' | 'userWord' | 'none';
}

const SCENARIO_BY_LEVEL: Record<StepLevel, AnswerResult['scenario']> = {
  0: 'level0',
  1: 'level1',
  2: 'level2',
  9: 'userWord',
};

/**
 * Проверка ответа. Поведение воспроизводит проверенное на эталоне: неверный
 * ответ увеличивает счётчик ошибок шага и убирает карточку с экрана, верный —
 * закрывает шаг и передаёт ход следующему игроку.
 *
 * Повторный клик по уже отвергнутой карточке и любой ответ после конца партии
 * игнорируются, а не считаются ошибкой: на сенсорной панели двойное касание —
 * норма, и штрафовать за него ребёнка нельзя.
 */
export function answer(session: GameSession, chosenWordId: string): AnswerResult {
  const step = currentStep(session);
  if (!step) return { session, outcome: 'ignored', scenario: 'none' };
  if (!step.optionWordIds.includes(chosenWordId)) {
    return { session, outcome: 'ignored', scenario: 'none' };
  }
  if (session.rejectedWordIds.includes(chosenWordId)) {
    return { session, outcome: 'ignored', scenario: 'none' };
  }

  const playerId = currentPlayerId(session);
  const scenario = SCENARIO_BY_LEVEL[step.level] ?? 'level0';

  if (chosenWordId !== step.targetWordId) {
    const errorsInStep = session.errorsInStep + 1;
    return {
      outcome: 'wrong',
      scenario,
      session: {
        ...session,
        attempt: session.attempt + 1,
        errorsInStep,
        rejectedWordIds: [...session.rejectedWordIds, chosenWordId],
        results: withResult(session.results, playerId, step.targetWordId, {
          solved: false,
          errors: 1,
        }),
        tally: bumpTally(session.tally, playerId, { errors: 1 }),
      },
    };
  }

  const results = withResult(session.results, playerId, step.targetWordId, {
    solved: true,
    errors: 0,
  });
  const tally = bumpTally(session.tally, playerId, {
    completed: 1,
    flawless: session.errorsInStep === 0 ? 1 : 0,
  });

  return {
    outcome: 'correct',
    scenario,
    session: advanceTurn({ ...session, results, tally }),
  };
}

function bumpTally(
  tally: Readonly<Record<string, PlayerTally>>,
  playerId: string,
  delta: Partial<PlayerTally>
): Record<string, PlayerTally> {
  const current = tally[playerId] ?? { completed: 0, flawless: 0, errors: 0 };
  return {
    ...tally,
    [playerId]: {
      completed: current.completed + (delta.completed ?? 0),
      flawless: current.flawless + (delta.flawless ?? 0),
      errors: current.errors + (delta.errors ?? 0),
    },
  };
}

function withResult(
  results: Readonly<Record<string, Record<string, WordResult>>>,
  playerId: string,
  wordId: string,
  result: WordResult
): Record<string, Record<string, WordResult>> {
  const previous = results[playerId]?.[wordId];
  // Слово может повториться в партии, когда слов в теме меньше, чем шагов:
  // накопленные ошибки прошлого показа не теряются.
  const merged: WordResult = previous
    ? { solved: previous.solved || result.solved, errors: previous.errors + result.errors }
    : result;
  return {
    ...results,
    [playerId]: { ...results[playerId], [wordId]: merged },
  };
}

/**
 * Передача хода. Ход поочерёдный: сначала по всем игрокам текущий шаг, затем
 * переход к следующему — так игроки за столом ходят по кругу, а не один
 * проходит всю партию, пока остальные ждут.
 */
function advanceTurn(session: GameSession): GameSession {
  const nextPlayerIndex = (session.playerIndex + 1) % session.playerIds.length;
  const wrapped = nextPlayerIndex === 0;
  const nextStepIndex = wrapped ? session.stepIndex + 1 : session.stepIndex;
  const finished = nextStepIndex >= session.stepsPerPlayer;

  return {
    ...session,
    playerIndex: finished ? session.playerIndex : nextPlayerIndex,
    stepIndex: nextStepIndex,
    attempt: 0,
    errorsInStep: 0,
    rejectedWordIds: [],
    finished,
  };
}

/** Досрочное завершение партии — выход в меню, а не «сдаться» */
export function interrupt(session: GameSession): GameSession {
  return { ...session, finished: true };
}

/** Уровень слова с учётом того, что своё слово всегда идёт по своему сценарию */
export function effectiveLevel(
  wordId: string,
  baseLevel: StepLevel,
  overrides: Readonly<Record<string, number>> = {}
): StepLevel {
  if (isUserWordId(wordId)) return WORDS_USER_LEVEL;
  const override = overrides[wordId];
  if (override === 0 || override === 1 || override === 2) return override;
  return baseLevel;
}
