// Игра «Концентрация внимания»: поиск знака или слова среди похожих и
// таблица Шульте. Чистая логика без DOM; время считает экран.

import { pickWithoutRepeat, shuffled, type Rng } from './rng.ts';

export interface AttentionLevel {
  id: number;
  name: string;
  mode: 'find_symbol' | 'find_word' | 'schulte';
  grid: { cols: number; rows: number };
  targetCount: number;
  trapShare?: number;
  timeLimitSec: number;
  showTargetSec?: number;
  errorPenaltySec: number;
  symbolSet?: string;
  wordSet?: string;
  numbersFrom?: number;
  numbersTo?: number;
}

interface StarRule { maxErrors: number; maxTimeShare: number }

export interface AttentionData {
  levels: AttentionLevel[];
  symbolSets: {
    letters_distinct?: { pool: string[] };
    letters_confusable?: { confusablePairs: [string, string][] };
  } & Record<string, unknown>;
  wordSets: { word_traps?: { target: string; traps: string[] }[] };
  scoring: { stars3: StarRule; stars2: StarRule; stars1: StarRule };
}

export interface AttentionCell {
  id: number;
  text: string;
  isTarget: boolean;
  isTrap: boolean;
}

export interface AttentionBoard {
  // Что искать: знак или слово; для таблицы Шульте - пустая строка.
  target: string;
  cells: AttentionCell[];
}

export function attentionLevels(data: AttentionData): AttentionLevel[] {
  return data.levels;
}

function neighbours(a: number, b: number, cols: number): boolean {
  const dr = Math.abs(Math.floor(a / cols) - Math.floor(b / cols));
  const dc = Math.abs((a % cols) - (b % cols));
  return dr <= 1 && dc <= 1;
}

// Цели случайно, но не в соседних клетках (включая диагонали).
function placeTargets(total: number, cols: number, count: number, rng: Rng): number[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const chosen: number[] = [];
    for (const cell of shuffled(Array.from({ length: total }, (_, i) => i), rng)) {
      if (chosen.length === count) break;
      if (chosen.every((c) => !neighbours(c, cell, cols))) chosen.push(cell);
    }
    if (chosen.length === count) return chosen;
  }
  throw new Error('Не удалось разместить цели: сетка слишком мала для заданного числа целей');
}

function pickSearchSet(level: AttentionLevel, data: AttentionData, rng: Rng): { target: string; traps: string[]; fillers: string[] } {
  if (level.mode === 'find_word') {
    const sets = data.wordSets.word_traps ?? [];
    const chosen = pickWithoutRepeat(sets, 1, rng)[0];
    const others = sets.filter((s) => s !== chosen);
    return { target: chosen.target, traps: chosen.traps, fillers: others.map((s) => s.target) };
  }
  if (level.symbolSet === 'letters_confusable') {
    const [a, b] = pickWithoutRepeat(data.symbolSets.letters_confusable?.confusablePairs ?? [], 1, rng)[0];
    const swap = rng() < 0.5;
    const target = swap ? b : a;
    const trap = swap ? a : b;
    const pool = data.symbolSets.letters_distinct?.pool ?? [];
    return { target, traps: [trap], fillers: pool.filter((l) => l !== target && l !== trap) };
  }
  const pool = data.symbolSets.letters_distinct?.pool ?? [];
  const target = pickWithoutRepeat(pool, 1, rng)[0];
  return { target, traps: [], fillers: pool.filter((l) => l !== target) };
}

function buildSearchBoard(level: AttentionLevel, data: AttentionData, rng: Rng): AttentionBoard {
  const total = level.grid.cols * level.grid.rows;
  const { target, traps, fillers } = pickSearchSet(level, data, rng);
  const targetCells = new Set(placeTargets(total, level.grid.cols, level.targetCount, rng));
  const others = total - level.targetCount;
  const trapCount = traps.length === 0 ? 0 : Math.round((level.trapShare ?? 0) * others);

  const filler = (): string => fillers[Math.floor(rng() * fillers.length)];
  const otherTexts = shuffled([
    ...Array.from({ length: trapCount }, (_, i) => ({ text: traps[i % traps.length], isTrap: true })),
    ...Array.from({ length: others - trapCount }, () => ({ text: filler(), isTrap: false })),
  ], rng);

  let next = 0;
  const cells: AttentionCell[] = Array.from({ length: total }, (_, id) => {
    if (targetCells.has(id)) return { id, text: target, isTarget: true, isTrap: false };
    const other = otherTexts[next++];
    return { id, text: other.text, isTarget: false, isTrap: other.isTrap };
  });
  return { target, cells };
}

function buildSchulteBoard(level: AttentionLevel, rng: Rng): AttentionBoard {
  const from = level.numbersFrom ?? 1;
  const to = level.numbersTo ?? from + level.grid.cols * level.grid.rows - 1;
  const numbers = shuffled(Array.from({ length: to - from + 1 }, (_, i) => from + i), rng);
  return {
    target: '',
    cells: numbers.map((n, id) => ({ id, text: String(n), isTarget: false, isTrap: false })),
  };
}

export function buildAttentionBoard(level: AttentionLevel, data: AttentionData, rng: Rng): AttentionBoard {
  return level.mode === 'schulte' ? buildSchulteBoard(level, rng) : buildSearchBoard(level, data, rng);
}

// ---------- Ход игры ----------

export interface AttentionPlay {
  board: AttentionBoard;
  level: AttentionLevel;
  found: number[];
  wrong: number[];
  errors: number;
  finished: boolean;
}

export function startPlay(board: AttentionBoard, level: AttentionLevel): AttentionPlay {
  return { board, level, found: [], wrong: [], errors: 0, finished: false };
}

function goalCount(play: AttentionPlay): number {
  return play.level.mode === 'schulte' ? play.board.cells.length : play.level.targetCount;
}

export function tapCell(play: AttentionPlay, cellId: number): AttentionPlay {
  if (play.finished || play.found.includes(cellId) || play.wrong.includes(cellId)) return play;
  const cell = play.board.cells.find((c) => c.id === cellId);
  if (!cell) return play;

  const isHit = play.level.mode === 'schulte'
    ? Number(cell.text) === (play.level.numbersFrom ?? 1) + play.found.length
    : cell.isTarget;

  if (!isHit) {
    // В таблице Шульте неверное нажатие можно повторить позже, поэтому клетку не блокируем.
    const wrong = play.level.mode === 'schulte' ? play.wrong : [...play.wrong, cellId];
    return { ...play, wrong, errors: play.errors + 1 };
  }
  const found = [...play.found, cellId];
  return { ...play, found, finished: found.length === goalCount(play) };
}

export function effectiveSeconds(elapsedSeconds: number, errors: number, level: AttentionLevel): number {
  return elapsedSeconds + errors * level.errorPenaltySec;
}

export interface PlayOutcome {
  errors: number;
  seconds: number;
  finished: boolean;
}

export function starsFor(outcome: PlayOutcome, level: AttentionLevel, data: AttentionData): 0 | 1 | 2 | 3 {
  if (!outcome.finished) return 0;
  if (!(level.timeLimitSec > 0)) return 0;
  const share = effectiveSeconds(outcome.seconds, outcome.errors, level) / level.timeLimitSec;
  const fits = (rule: StarRule) => outcome.errors <= rule.maxErrors && share <= rule.maxTimeShare;
  if (fits(data.scoring.stars3)) return 3;
  if (fits(data.scoring.stars2)) return 2;
  if (fits(data.scoring.stars1)) return 1;
  return 0;
}
