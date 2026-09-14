// packages/shared/src/inophone/game/session.ts
// Партия виджета «Инофон» (Тип 4): тренировка и соревнование.
//
// ТЗ строка 89 описывает три режима, и это самое подробное требование всей
// спецификации:
//   обучение     — все объекты подсвечены, партии нет вовсе;
//   тренировка   — подсветки нет, программа называет объект, ученик его ищет;
//   соревнование — то же для двух и более игроков, в конце статистика.
//
// ОБУЧЕНИЕ СЮДА НЕ ВХОДИТ НАМЕРЕННО. Там нет ни загаданного слова, ни счёта,
// ни хода: ребёнок просто щёлкает по сцене и слушает. Заводить для него
// «партию из нуля вопросов» значило бы тащить через весь движок состояние,
// которого у режима нет.
//
// СОСТОЯНИЕ НЕИЗМЕНЯЕМОЕ: answer() возвращает новое, а не правит переданное.
// Причина прикладная — рантайм держит состояние в useState, и правка на месте
// не вызвала бы перерисовку. Так же сделано в Типах 2 и 3.

import type { InophoneLibrary, Scene } from '../model/schema';
import { dealTurnTargets, playerIndexForTurn } from '../../utils/turnDeal';

export type InophoneMode = 'training' | 'challenge';

/** Верхняя граница из ТЗ строки 89: «для двух и более пользователей» */
export const MAX_PLAYERS = 4;

export interface PlayerTally {
  /** Верных ответов */
  success: number;
  /** Неверных */
  fail: number;
}

export interface InophoneSession {
  readonly roundId: string;
  readonly mode: InophoneMode;
  readonly sceneId: string;
  readonly playerIds: readonly string[];
  /** Сколько вопросов достаётся каждому игроку */
  readonly questionsPerPlayer: number;
  /** Загаданные понятия по игрокам, в порядке их ходов */
  readonly questions: Readonly<Record<string, readonly string[]>>;
  readonly playerIndex: number;
  readonly questionIndex: number;
  readonly tally: Readonly<Record<string, PlayerTally>>;
  /**
   * Результат последнего ответа. Нужен экрану, чтобы показать его секунду
   * перед следующим ходом — у эталона ровно так, и это единственная пауза в
   * игре. null — ответа ещё не было либо пауза кончилась.
   */
  readonly lastAnswerCorrect: boolean | null;
  readonly finished: boolean;
}

export class SessionSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionSetupError';
  }
}

export interface BuildSessionOptions {
  roundId: string;
  mode: InophoneMode;
  sceneId: string;
  playerIds: string[];
  questionsPerPlayer: number;
  rng: () => number;
}

/** Понятия сцены — из них и только из них берутся задания */
export function sceneConceptIds(scene: Scene): string[] {
  return scene.hotspots.map((h) => h.conceptId);
}

export function findScene(library: InophoneLibrary, sceneId: string): Scene {
  const scene = library.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new SessionSetupError(`сцены ${sceneId} нет в пакете контента`);
  return scene;
}

export function buildInophoneSession(
  library: InophoneLibrary,
  options: BuildSessionOptions
): InophoneSession {
  const { roundId, mode, sceneId, playerIds, questionsPerPlayer, rng } = options;

  if (playerIds.length === 0) throw new SessionSetupError('в партии нужен хотя бы один игрок');
  if (playerIds.length > MAX_PLAYERS) {
    throw new SessionSetupError(`игроков не может быть больше ${MAX_PLAYERS}`);
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new SessionSetupError('идентификаторы игроков повторяются');
  }
  // ТЗ строка 89: соревнование — «для двух и более пользователей». Эталон
  // проверяет это же и уводит на экран учётных записей; здесь отказ явный,
  // потому что молча превратить соревнование в тренировку — худшее из решений
  if (mode === 'challenge' && playerIds.length < 2) {
    throw new SessionSetupError('в соревновании должно быть не меньше двух игроков');
  }
  if (questionsPerPlayer < 1) throw new SessionSetupError('в партии нужен хотя бы один вопрос');

  const scene = findScene(library, sceneId);
  const pool = sceneConceptIds(scene);
  if (pool.length === 0) {
    throw new SessionSetupError(`на сцене ${sceneId} нет размеченных объектов`);
  }

  const questions: Record<string, string[]> = {};
  const tally: Record<string, PlayerTally> = {};
  for (const id of playerIds) {
    questions[id] = [];
    tally[id] = { success: 0, fail: 0 };
  }

  // Раздача общая с Типами 2 и 3 (utils/turnDeal): в круге у игроков разные
  // задания, и одному игроку одно задание не выпадает двумя его ходами
  // подряд. Своей копии правила здесь нет намеренно — три копии одного
  // алгоритма разъедутся молча, а раздача при этом не падает, она просто
  // становится хуже.
  const turns = playerIds.length * questionsPerPlayer;
  const targets = dealTurnTargets(pool, { turns, players: playerIds.length, rng });
  targets.forEach((conceptId, turn) => {
    questions[playerIds[playerIndexForTurn(turn, playerIds.length)]].push(conceptId);
  });

  return {
    roundId,
    mode,
    sceneId,
    playerIds,
    questionsPerPlayer,
    questions,
    playerIndex: 0,
    questionIndex: 0,
    tally,
    lastAnswerCorrect: null,
    finished: false,
  };
}

export function currentPlayerId(session: InophoneSession): string {
  return session.playerIds[session.playerIndex];
}

/** Загаданное сейчас понятие; null — партия окончена */
export function currentConceptId(session: InophoneSession): string | null {
  if (session.finished) return null;
  return session.questions[currentPlayerId(session)][session.questionIndex] ?? null;
}

export interface AnswerOutcome {
  session: InophoneSession;
  correct: boolean;
  sessionFinished: boolean;
}

/**
 * Ответ ученика: он указал объект на сцене (ТЗ строка 94).
 *
 * Проверка — прямое сравнение понятия нажатого объекта с загаданным, как у
 * эталона. ХОД ПЕРЕХОДИТ И ПРИ НЕВЕРНОМ ОТВЕТЕ: это не «покажи букву» из
 * Типа 3, где ребёнок подбирает из восьми вариантов и ошибка лишь убирает
 * один. Здесь вариантов столько, сколько объектов на сцене, и оставлять ход
 * до попадания значило бы позволить перебрать всю сцену.
 */
export function answer(session: InophoneSession, conceptId: string): AnswerOutcome {
  if (session.finished) {
    return { session, correct: false, sessionFinished: true };
  }
  const expected = currentConceptId(session);
  if (expected === null) {
    return { session, correct: false, sessionFinished: session.finished };
  }

  const playerId = currentPlayerId(session);
  const correct = conceptId === expected;
  const tally = {
    ...session.tally,
    [playerId]: {
      success: session.tally[playerId].success + (correct ? 1 : 0),
      fail: session.tally[playerId].fail + (correct ? 0 : 1),
    },
  };

  const nextPlayerIndex = (session.playerIndex + 1) % session.playerIds.length;
  const nextQuestionIndex =
    nextPlayerIndex === 0 ? session.questionIndex + 1 : session.questionIndex;
  const finished = nextQuestionIndex >= session.questionsPerPlayer;

  return {
    session: {
      ...session,
      playerIndex: finished ? session.playerIndex : nextPlayerIndex,
      questionIndex: finished ? session.questionIndex : nextQuestionIndex,
      tally,
      lastAnswerCorrect: correct,
      finished,
    },
    correct,
    sessionFinished: finished,
  };
}

/** Убрать показ результата — экран зовёт это по окончании паузы */
export function clearLastAnswer(session: InophoneSession): InophoneSession {
  return session.lastAnswerCorrect === null ? session : { ...session, lastAnswerCorrect: null };
}

export interface PlayerResult {
  playerId: string;
  success: number;
  fail: number;
  total: number;
  /** Доля верных, 0..1; при нуле ответов — null, а не ноль */
  share: number | null;
}

/**
 * Итоги партии (ТЗ строка 93).
 *
 * Доля верных у игрока без ответов — null, а НЕ ноль. Ноль читается как
 * «отвечал и всё неверно» — ровно противоположно правде. То же правило
 * принято в статистике Типа 3, и по той же причине.
 */
export function results(session: InophoneSession): PlayerResult[] {
  return session.playerIds.map((playerId) => {
    const t = session.tally[playerId];
    const total = t.success + t.fail;
    return {
      playerId,
      success: t.success,
      fail: t.fail,
      total,
      share: total === 0 ? null : t.success / total,
    };
  });
}

/**
 * Победители соревнования. Массив, а не один игрок: ничья возможна, и
 * показать одного «победителя» из двух с равным счётом — обман.
 */
export function winners(session: InophoneSession): string[] {
  const rows = results(session);
  const best = Math.max(...rows.map((r) => r.success));
  return rows.filter((r) => r.success === best).map((r) => r.playerId);
}
