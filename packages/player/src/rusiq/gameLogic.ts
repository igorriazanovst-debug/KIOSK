// Чистая игровая логика викторины «РусIQ» — без DOM, без React. Балл
// убывает пропорционально остатку времени (спека, разд. 5): чем быстрее
// верный ответ, тем ближе к полной цене вопроса.

import type { RusiqQuestion } from './model/schema.ts';

export function scoreForAnswer(price: number, timeSeconds: number, elapsedSeconds: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  const remainingFraction = Math.max(0, (timeSeconds - elapsedSeconds) / timeSeconds);
  return Math.round(price * remainingFraction);
}

export function nextTurn(currentPlayerIndex: number, playerCount: number): number {
  return (currentPlayerIndex + 1) % playerCount;
}

/**
 * Разбивает пул вопросов на непересекающиеся наборы по playerCount игроков,
 * по questionsPerPlayer вопросов каждому — ни один вопрос не повторяется
 * между игроками в рамках одной игры. Порядок в пуле перемешивается через
 * rng (по умолчанию Math.random) для случайного, но при фиксированном rng —
 * детерминированного результата (нужно для тестов и для брутфорс-подбора
 * контента, если понадобится).
 */
export function assignQuestions(
  pool: RusiqQuestion[],
  playerCount: number,
  questionsPerPlayer: number,
  rng: () => number = Math.random,
): RusiqQuestion[][] {
  const totalNeeded = playerCount * questionsPerPlayer;
  if (pool.length < totalNeeded) {
    throw new Error(`Not enough questions in pool: need ${totalNeeded}, have ${pool.length}`);
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result: RusiqQuestion[][] = [];
  for (let p = 0; p < playerCount; p++) {
    result.push(shuffled.slice(p * questionsPerPlayer, (p + 1) * questionsPerPlayer));
  }
  return result;
}

export interface RusiqAnswerEvent {
  playerIndex: number;
  score: number;
  correct: boolean;
}

export interface RusiqPlayerSummary {
  name: string;
  score: number;
  correctCount: number;
  totalCount: number;
}

export function summarizeResults(playerNames: string[], answers: RusiqAnswerEvent[]): RusiqPlayerSummary[] {
  return playerNames.map((name, index) => {
    const own = answers.filter((a) => a.playerIndex === index);
    return {
      name,
      score: own.reduce((sum, a) => sum + a.score, 0),
      correctCount: own.filter((a) => a.correct).length,
      totalCount: own.length,
    };
  });
}
