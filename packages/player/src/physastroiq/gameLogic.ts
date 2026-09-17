// Чистая игровая логика викторины «ФизАстроIQ» — без DOM, без React. Балл
// убывает пропорционально остатку времени (ТЗ раздел 5, эталон разбор §5):
// чем быстрее верный ответ, тем ближе к полной цене вопроса. Логика
// идентична rusiq (та же линейка «ОС3 IQ», тот же механизм подсчёта) — см.
// план реализации `Тип11_ФизАстроIQ/ФизАстро_план_реализации.md` §1.

import type { PhysastroiqPoint, PhysastroiqQuestion } from './model/schema.ts';

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
  pool: PhysastroiqQuestion[],
  playerCount: number,
  questionsPerPlayer: number,
  rng: () => number = Math.random,
): PhysastroiqQuestion[][] {
  const totalNeeded = playerCount * questionsPerPlayer;
  if (pool.length < totalNeeded) {
    throw new Error(`Not enough questions in pool: need ${totalNeeded}, have ${pool.length}`);
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result: PhysastroiqQuestion[][] = [];
  for (let p = 0; p < playerCount; p++) {
    result.push(shuffled.slice(p * questionsPerPlayer, (p + 1) * questionsPerPlayer));
  }
  return result;
}

export interface PhysastroiqBoardTile {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isCorrect: boolean;
}

function tileKey(point: { x: number; y: number }): string {
  return `${Math.round(point.x)}_${Math.round(point.y)}`;
}

/**
 * Строит полный набор кликабельных тайлов игрового поля для одного вопроса.
 *
 * НАЙДЕННЫЙ БАГ (жалоба пользователя 2026-09-15 «только некоторые иконки
 * можно было прям нажать, хотя их в разы больше, список вообще не
 * менялся»): каждый вопрос уровня нарисован СВОЕЙ отдельной плиткой на
 * общей картинке уровня (Фаза 7 плана реализации — ~53-61 плитка на
 * уровень), но раньше кликабельными были только плитка ТЕКУЩЕГО вопроса +
 * 15 статичных generic-decoy — остальные ~40-60 нарисованных плиток
 * выглядели как варианты ответа, но не реагировали на клик вообще. Тот же
 * статичный набор из 15 decoy был единственным источником "неверных"
 * вариантов при ЛЮБОМ вопросе — отсюда и жалоба "пул ответов не меняется".
 *
 * Исправление: тайл КАЖДОГО вопроса уровня становится кликабельным
 * decoy-кандидатом для любого ДРУГОГО вопроса того же уровня — то, что
 * нарисовано на картинке, то и кликабельно, без каких-либо изменений в
 * самих изображениях/контенте (подтверждено сверкой: количество уникальных
 * координат на уровень 1:1 совпадает с числом видимых плиток на картинке,
 * коллизий координат нет ни на одном из 3 уровней).
 */
export function buildBoardTiles(
  question: PhysastroiqQuestion,
  levelQuestions: PhysastroiqQuestion[],
  genericDecoyPoints: PhysastroiqPoint[],
): PhysastroiqBoardTile[] {
  const correctKey = tileKey(question);
  const map = new Map<string, PhysastroiqBoardTile>();

  const addTile = (p: { x: number; y: number; width: number; height: number }) => {
    const key = tileKey(p);
    map.set(key, { key, x: p.x, y: p.y, width: p.width, height: p.height, isCorrect: key === correctKey });
  };

  for (const p of genericDecoyPoints) addTile(p);
  for (const p of levelQuestions) {
    if (p.id === question.id || p.level !== question.level) continue;
    addTile(p);
  }
  for (const p of question.decoyPoints) addTile(p);

  // Ставится последним и явно, а не полагается на порядок выше: если у
  // чужого вопроса/decoy-точки координаты случайно совпали бы с текущим
  // вопросом после округления, верный ответ обязан победить коллизию, а не
  // молча потеряться под decoy той же клетки.
  map.set(correctKey, { key: correctKey, x: question.x, y: question.y, width: question.width, height: question.height, isCorrect: true });

  return Array.from(map.values());
}

export interface PhysastroiqAnswerEvent {
  playerIndex: number;
  score: number;
  correct: boolean;
}

export interface PhysastroiqPlayerSummary {
  name: string;
  score: number;
  correctCount: number;
  totalCount: number;
}

export function summarizeResults(playerNames: string[], answers: PhysastroiqAnswerEvent[]): PhysastroiqPlayerSummary[] {
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
