import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateChainPuzzle,
  checkChainAnswers,
  buildNumberPaletteValues,
  SHAPE_POOL,
  LETTER_POOL,
  TOY_POOL,
  type ChainPuzzle,
} from './chainLogic.ts';

test('generateChainPuzzle is deterministic given a fixed rng', () => {
  const puzzle = generateChainPuzzle(() => 0);
  assert.deepEqual(puzzle, { category: 'number', values: ['12', '9', '6', '3', '0'], blankIndices: [2] });
});

test('generateChainPuzzle always keeps number-category values within 0..30 with a constant step', () => {
  for (let i = 0; i < 200; i++) {
    const puzzle = generateChainPuzzle(Math.random);
    assert.ok(puzzle.values.length >= 5 && puzzle.values.length <= 7);
    assert.ok(puzzle.blankIndices.length === 1 || puzzle.blankIndices.length === 2);
    assert.equal(new Set(puzzle.blankIndices).size, puzzle.blankIndices.length);
    for (const idx of puzzle.blankIndices) {
      assert.ok(idx > 0 && idx < puzzle.values.length - 1);
    }
    if (puzzle.category === 'number') {
      const nums = puzzle.values.map(Number);
      const step = nums[1] - nums[0];
      assert.notEqual(step, 0);
      for (const n of nums) assert.ok(n >= 0 && n <= 30);
      for (let k = 1; k < nums.length; k++) {
        assert.equal(nums[k] - nums[k - 1], step);
      }
    } else {
      const pool = puzzle.category === 'shape' ? SHAPE_POOL : puzzle.category === 'letter' ? LETTER_POOL : TOY_POOL;
      for (const v of puzzle.values) assert.ok((pool as readonly string[]).includes(v));
    }
  }
});

test('checkChainAnswers marks each blank correct only on exact match', () => {
  const puzzle: ChainPuzzle = { category: 'number', values: ['2', '4', '6', '8', '10'], blankIndices: [2, 4] };
  const result = checkChainAnswers(puzzle, { 2: '6', 4: '9' });
  assert.deepEqual(result, { 2: true, 4: false });
});

test('checkChainAnswers treats a missing placement as incorrect', () => {
  const puzzle: ChainPuzzle = { category: 'letter', values: ['А', 'Б', 'А', 'Б', 'А'], blankIndices: [1] };
  const result = checkChainAnswers(puzzle, {});
  assert.deepEqual(result, { 1: false });
});

test('buildNumberPaletteValues always includes 0-9 plus any correct two-digit blank values', () => {
  const puzzle: ChainPuzzle = { category: 'number', values: ['20', '23', '26', '29'], blankIndices: [1, 3] };
  const tiles = buildNumberPaletteValues(puzzle);
  assert.deepEqual(tiles, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '23', '29']);
});

test('buildNumberPaletteValues returns the base digits for non-number categories', () => {
  const puzzle: ChainPuzzle = { category: 'shape', values: ['circle', 'square', 'circle'], blankIndices: [1] };
  assert.deepEqual(buildNumberPaletteValues(puzzle), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
});
