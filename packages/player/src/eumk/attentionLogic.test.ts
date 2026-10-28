import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seededRng } from './rng.ts';
import { parseEumkContent } from './model/schema.ts';
import {
  attentionLevels, buildAttentionBoard, startPlay, tapCell, starsFor, effectiveSeconds, type AttentionLevel, type AttentionData,
} from './attentionLogic.ts';

const content = parseEumkContent(JSON.parse(readFileSync(new URL('./content/nach.content.json', import.meta.url), 'utf8')));
const game = content.games.find((g) => g.type === 'attention')!;
const data = game.data as unknown as AttentionData;
const levels = attentionLevels(data);

test('there are four levels, one per mode', () => {
  assert.deepEqual(levels.map((l) => l.mode), ['find_symbol', 'find_symbol', 'find_word', 'schulte']);
});

function neighbours(a: number, b: number, cols: number): boolean {
  const dr = Math.abs(Math.floor(a / cols) - Math.floor(b / cols));
  const dc = Math.abs((a % cols) - (b % cols));
  return dr <= 1 && dc <= 1;
}

test('each board fills the grid exactly', () => {
  for (const level of levels) {
    const board = buildAttentionBoard(level, data, seededRng(1));
    assert.equal(board.cells.length, level.grid.cols * level.grid.rows);
  }
});

test('search boards contain exactly targetCount targets and show the same text for all of them', () => {
  for (const level of levels.filter((l) => l.mode !== 'schulte')) {
    for (let seed = 1; seed <= 20; seed++) {
      const board = buildAttentionBoard(level, data, seededRng(seed));
      const targets = board.cells.filter((c) => c.isTarget);
      assert.equal(targets.length, level.targetCount);
      assert.ok(targets.every((t) => t.text === board.target));
    }
  }
});

test('non-target cells never show the target text', () => {
  for (const level of levels.filter((l) => l.mode !== 'schulte')) {
    for (let seed = 1; seed <= 20; seed++) {
      const board = buildAttentionBoard(level, data, seededRng(seed));
      assert.ok(board.cells.filter((c) => !c.isTarget).every((c) => c.text !== board.target), `${level.name} seed ${seed}`);
    }
  }
});

test('targets are never in neighbouring cells', () => {
  for (const level of levels.filter((l) => l.mode !== 'schulte')) {
    for (let seed = 1; seed <= 20; seed++) {
      const board = buildAttentionBoard(level, data, seededRng(seed));
      const idx = board.cells.map((c, i) => (c.isTarget ? i : -1)).filter((i) => i >= 0);
      for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
        assert.ok(!neighbours(idx[a], idx[b], level.grid.cols), `${level.name} seed ${seed}`);
      }
    }
  }
});

test('traps appear in roughly the configured share of the other cells', () => {
  const level = levels[1];
  const board = buildAttentionBoard(level, data, seededRng(4));
  const others = board.cells.filter((c) => !c.isTarget);
  const traps = others.filter((c) => c.isTrap).length;
  assert.equal(traps, Math.round(level.trapShare! * others.length));
});

test('schulte holds each number once, from numbersFrom to numbersTo', () => {
  const level = levels[3];
  const board = buildAttentionBoard(level, data, seededRng(2));
  const texts = board.cells.map((c) => Number(c.text)).sort((a, b) => a - b);
  assert.deepEqual(texts, Array.from({ length: 16 }, (_, i) => i + 1));
});

test('schulte demands ascending order: a wrong number is an error', () => {
  const level = levels[3];
  const board = buildAttentionBoard(level, data, seededRng(2));
  let play = startPlay(board, level);
  const byNumber = (n: number) => board.cells.find((c) => c.text === String(n))!.id;
  play = tapCell(play, byNumber(2));
  assert.equal(play.errors, 1);
  assert.equal(play.found.length, 0);
  play = tapCell(play, byNumber(1));
  assert.equal(play.found.length, 1);
  play = tapCell(play, byNumber(2));
  assert.equal(play.found.length, 2);
});

test('finding every target finishes the play', () => {
  const level = levels[0];
  const board = buildAttentionBoard(level, data, seededRng(7));
  let play = startPlay(board, level);
  for (const c of board.cells.filter((cell) => cell.isTarget)) play = tapCell(play, c.id);
  assert.equal(play.finished, true);
  assert.equal(play.errors, 0);
});

test('a miss counts as an error and a repeated tap does nothing', () => {
  const level = levels[0];
  const board = buildAttentionBoard(level, data, seededRng(7));
  let play = startPlay(board, level);
  const miss = board.cells.find((c) => !c.isTarget)!;
  play = tapCell(play, miss.id);
  assert.equal(play.errors, 1);
  const hit = board.cells.find((c) => c.isTarget)!;
  play = tapCell(play, hit.id);
  const again = tapCell(play, hit.id);
  assert.deepEqual(again, play);
});

test('effectiveSeconds adds the penalty per error', () => {
  const level: AttentionLevel = { ...levels[0], errorPenaltySec: 3 };
  assert.equal(effectiveSeconds(10, 2, level), 16);
});

test('starsFor follows the scoring thresholds', () => {
  const level = levels[0];
  assert.equal(starsFor({ errors: 0, seconds: 30, finished: true }, level, data), 3);
  assert.equal(starsFor({ errors: 2, seconds: 30, finished: true }, level, data), 2);
  assert.equal(starsFor({ errors: 4, seconds: 30, finished: true }, level, data), 1);
  assert.equal(starsFor({ errors: 6, seconds: 30, finished: true }, level, data), 0);
  assert.equal(starsFor({ errors: 0, seconds: 59, finished: true }, level, data), 1);
  assert.equal(starsFor({ errors: 0, seconds: 10, finished: false }, level, data), 0);
});

test('starsFor gives 0 stars instead of NaN when the time limit is missing', () => {
  const level = { ...levels[0], timeLimitSec: 0 };
  assert.equal(starsFor({ errors: 0, seconds: 1, finished: true }, level, data), 0);
});
