// packages/player/src/periodictable/quizEngine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestion, checkAnswer } from './quizEngine.ts';
import type { PeriodicElement } from './model/schema.ts';

function fakeElement(atomicNumber: number): PeriodicElement {
  return {
    atomicNumber,
    symbol: `E${atomicNumber}`,
    nameRu: `Элемент${atomicNumber}`,
    nameLatin: `Element${atomicNumber}`,
    atomicMass: atomicNumber,
    period: 1,
    groupIupac: 1,
    isLanthanide: false,
    isActinide: false,
    elementClass: 'nonmetal',
    electronType: 's',
    electronConfiguration: '1s1',
    naturalOccurrence: '',
    physicalStateNormal: '',
    crystalLattice: '',
    allotropes: '',
    stableIsotopes: '',
    electrochemicalSeriesPosition: null,
    density: null,
    meltingPointK: null,
    boilingPointK: null,
    oxideCharacter: 'none',
    electronegativityPauling: null,
    oxidationStates: '',
    photo: null,
  } as PeriodicElement;
}

// Детерминированный rng из фиксированной последовательности — каждый вызов
// возвращает следующее число по кругу, тест сам знает, что вернётся.
function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const ELEMENTS = Array.from({ length: 10 }, (_, i) => fakeElement(i + 1));

test('generateQuestion produces exactly 4 options including the correct answer', () => {
  const q = generateQuestion(ELEMENTS, sequenceRng([0.1, 0.3, 0.5, 0.05, 0.15, 0.25, 0.4]));
  assert.equal(q.options.length, 4);
  assert.ok(q.options.includes(q.correctAnswer));
});

test('generateQuestion never picks the same field for prompt and answer', () => {
  for (let seed = 0; seed < 20; seed++) {
    const q = generateQuestion(ELEMENTS, sequenceRng([seed / 20, 0.33, 0.66, 0.1, 0.2, 0.3, 0.4]));
    assert.notEqual(q.promptField, q.answerField);
  }
});

test('generateQuestion options contain no duplicates', () => {
  const q = generateQuestion(ELEMENTS, sequenceRng([0.9, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  const unique = new Set(q.options);
  assert.equal(unique.size, 4);
});

test('generateQuestion throws when fewer than 4 elements are available', () => {
  assert.throws(() => generateQuestion(ELEMENTS.slice(0, 3)));
});

test('checkAnswer returns true only for the correct answer', () => {
  const q = generateQuestion(ELEMENTS, sequenceRng([0.1, 0.3, 0.5, 0.05, 0.15, 0.25, 0.4]));
  assert.equal(checkAnswer(q, q.correctAnswer), true);
  const wrongOption = q.options.find((o) => o !== q.correctAnswer);
  assert.equal(checkAnswer(q, wrongOption!), false);
});
