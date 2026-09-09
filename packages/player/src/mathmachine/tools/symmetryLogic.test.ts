import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSymmetryPuzzle, checkSymmetryAnswer } from './symmetryLogic.ts';

function fixedRng(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

test('generateSymmetryPuzzle is deterministic given a fixed rng', () => {
  const a = generateSymmetryPuzzle(fixedRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]));
  const b = generateSymmetryPuzzle(fixedRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]));
  assert.deepEqual(a, b);
});

test('generateSymmetryPuzzle always produces 3 features and a tray of 5 items (3 correct + 2 decoys)', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let s = seed;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const puzzle = generateSymmetryPuzzle(rng);
    assert.equal(puzzle.features.length, 3);
    assert.equal(puzzle.trayItems.length, 5);
    assert.equal(puzzle.trayItems.filter((t) => !t.isDecoy).length, 3);
    assert.equal(puzzle.trayItems.filter((t) => t.isDecoy).length, 2);
  }
});

test('generateSymmetryPuzzle never gives a decoy that accidentally matches a real feature', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let s = seed;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const puzzle = generateSymmetryPuzzle(rng);
    for (const decoy of puzzle.trayItems.filter((t) => t.isDecoy)) {
      const matches = puzzle.features.some((f) => f.radius === decoy.radius && f.colorId === decoy.colorId);
      assert.equal(matches, false, 'a decoy that matches a real feature would be indistinguishable from a correct piece');
    }
  }
});

test('checkSymmetryAnswer accepts placing each correct tray item into its matching slot', () => {
  const puzzle = {
    features: [{ y: 0.25, radius: 10, colorId: 0 }, { y: 0.5, radius: 16, colorId: 1 }, { y: 0.75, radius: 22, colorId: 2 }],
    trayItems: [
      { y: 0.5, radius: 16, colorId: 1, isDecoy: false },
      { y: 0, radius: 28, colorId: 3, isDecoy: true },
      { y: 0.25, radius: 10, colorId: 0, isDecoy: false },
      { y: 0.75, radius: 22, colorId: 2, isDecoy: false },
      { y: 0, radius: 10, colorId: 3, isDecoy: true },
    ],
  };
  // slot0 needs radius10/color0 -> trayItems[2]; slot1 needs radius16/color1 -> trayItems[0]; slot2 needs radius22/color2 -> trayItems[3]
  assert.equal(checkSymmetryAnswer(puzzle, [2, 0, 3]), true);
});

test('checkSymmetryAnswer rejects a decoy placed in a slot', () => {
  const puzzle = {
    features: [{ y: 0.25, radius: 10, colorId: 0 }, { y: 0.5, radius: 16, colorId: 1 }, { y: 0.75, radius: 22, colorId: 2 }],
    trayItems: [
      { y: 0.5, radius: 16, colorId: 1, isDecoy: false },
      { y: 0, radius: 28, colorId: 3, isDecoy: true },
      { y: 0.25, radius: 10, colorId: 0, isDecoy: false },
      { y: 0.75, radius: 22, colorId: 2, isDecoy: false },
      { y: 0, radius: 10, colorId: 3, isDecoy: true },
    ],
  };
  assert.equal(checkSymmetryAnswer(puzzle, [1, 0, 3]), false); // slot0 got a decoy
});

test('checkSymmetryAnswer rejects incomplete or duplicate placement', () => {
  const puzzle = {
    features: [{ y: 0.25, radius: 10, colorId: 0 }, { y: 0.5, radius: 16, colorId: 1 }, { y: 0.75, radius: 22, colorId: 2 }],
    trayItems: [
      { y: 0.5, radius: 16, colorId: 1, isDecoy: false },
      { y: 0, radius: 28, colorId: 3, isDecoy: true },
      { y: 0.25, radius: 10, colorId: 0, isDecoy: false },
      { y: 0.75, radius: 22, colorId: 2, isDecoy: false },
      { y: 0, radius: 10, colorId: 3, isDecoy: true },
    ],
  };
  assert.equal(checkSymmetryAnswer(puzzle, [2, null, 3]), false);
  assert.equal(checkSymmetryAnswer(puzzle, [2, 2, 3]), false);
});
