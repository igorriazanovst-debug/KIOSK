import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accuracy, awardFor, awardForPlayer, upgradeAward, WORDS_AWARD_THRESHOLDS } from './achievements';
import { buildSession, answer, currentStep } from './session';
import type { GameSession, StepLevel } from './session';

test('доля безошибочных шагов считается от закрытых шагов', () => {
  assert.equal(accuracy({ completed: 10, flawless: 9, errors: 3 }), 0.9);
  assert.equal(accuracy({ completed: 0, flawless: 0, errors: 0 }), 0);
});

test('ступени присуждаются по порогам', () => {
  assert.equal(awardFor({ completed: 10, flawless: 10, errors: 0 }), 'gold');
  assert.equal(awardFor({ completed: 10, flawless: 9, errors: 1 }), 'gold');
  assert.equal(awardFor({ completed: 10, flawless: 8, errors: 2 }), 'silver');
  assert.equal(awardFor({ completed: 10, flawless: 7, errors: 4 }), 'silver');
  assert.equal(awardFor({ completed: 10, flawless: 6, errors: 9 }), 'wooden');
  assert.equal(awardFor({ completed: 10, flawless: 0, errors: 30 }), 'wooden');
});

test('без единого закрытого шага достижения нет вовсе', () => {
  // Вышел из партии сразу — это не «деревянная ступень за участие»
  assert.equal(awardFor({ completed: 0, flawless: 0, errors: 0 }), null);
});

test('пороги упорядочены по убыванию и покрывают весь диапазон', () => {
  const mins = WORDS_AWARD_THRESHOLDS.map((t) => t.minAccuracy);
  assert.deepEqual(mins, [...mins].sort((a, b) => b - a));
  assert.equal(mins[mins.length - 1], 0, 'нижняя ступень должна ловить любой результат');
});

test('обновление монотонное: результат можно только улучшить', () => {
  assert.equal(upgradeAward(null, 'wooden'), 'wooden');
  assert.equal(upgradeAward('wooden', 'silver'), 'silver');
  assert.equal(upgradeAward('silver', 'gold'), 'gold');
});

test('понижение ступени отклоняется', () => {
  // Один неудачный заход в конце дня не должен стирать заработанное золото
  assert.equal(upgradeAward('gold', 'silver'), null);
  assert.equal(upgradeAward('gold', 'wooden'), null);
  assert.equal(upgradeAward('silver', 'wooden'), null);
});

test('повтор той же ступени ничего не меняет', () => {
  assert.equal(upgradeAward('gold', 'gold'), null);
  assert.equal(upgradeAward('silver', 'silver'), null);
});

test('отсутствие заработанной ступени не трогает уже имеющуюся', () => {
  assert.equal(upgradeAward('gold', null), null);
  assert.equal(upgradeAward(null, null), null);
});

test('ступень по итогам реальной партии', () => {
  let s: GameSession = buildSession({
    roundId: 'r1',
    themeId: 'digits',
    playerIds: ['p1'],
    themeWordIds: ['0000', '0001', '0002', '0003'],
    stepsPerPlayer: 4,
    optionsPerStep: 3,
    levelOf: () => 0 as StepLevel,
    rng: () => 0.5,
  });

  while (!s.finished) {
    s = answer(s, currentStep(s)!.targetWordId).session;
  }

  assert.equal(awardForPlayer(s, 'p1'), 'gold');
  assert.equal(awardForPlayer(s, 'нет-такого-игрока'), null);
});
