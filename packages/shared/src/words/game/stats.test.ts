import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProfile, summarizeSession } from './stats';
import { buildSession, answer, currentStep } from './session';
import type { GameSession, StepLevel } from './session';

const THEMES = ['digits', 'pets', 'transport', 'food'];

test('сводка по профилю: пройдено тем, ступени, прогресс', () => {
  const summary = summarizeProfile('p1', { digits: 'gold', pets: 'silver' }, THEMES);
  assert.equal(summary.themesCompleted, 2);
  assert.equal(summary.themesTotal, 4);
  assert.equal(summary.goldCount, 1);
  assert.deepEqual(summary.byTier, { wooden: 0, silver: 1, gold: 1 });
  assert.equal(summary.progress, 0.5);
});

test('профиль без достижений: нули, а не падение', () => {
  const summary = summarizeProfile('p1', undefined, THEMES);
  assert.equal(summary.themesCompleted, 0);
  assert.equal(summary.progress, 0);
});

test('достижение по исчезнувшей теме не учитывается', () => {
  // Контент обновился, тема из поставки ушла, запись осталась — показывать
  // педагогу прогресс по несуществующей теме нельзя
  const summary = summarizeProfile('p1', { digits: 'gold', 'старая-тема': 'gold' }, THEMES);
  assert.equal(summary.themesCompleted, 1);
  assert.equal(summary.goldCount, 1);
});

test('мусорная ступень в файле достижений игнорируется', () => {
  const summary = summarizeProfile('p1', { digits: 'platinum' as never }, THEMES);
  assert.equal(summary.themesCompleted, 0);
});

test('пустой список тем не делит на ноль', () => {
  const summary = summarizeProfile('p1', { digits: 'gold' }, []);
  assert.equal(summary.themesTotal, 0);
  assert.equal(summary.progress, 0);
});

test('итоги партии идут в порядке хода игроков, а не по убыванию результата', () => {
  // Экран итогов — обратная связь каждому, а не соревнование
  let s: GameSession = buildSession({
    roundId: 'r1',
    themeId: 'digits',
    playerIds: ['Аня', 'Боря'],
    themeWordIds: ['0000', '0001', '0002', '0003'],
    stepsPerPlayer: 2,
    optionsPerStep: 3,
    levelOf: () => 0 as StepLevel,
    rng: () => 0.5,
  });

  // Аня ошибается один раз, Боря проходит чисто
  const wrong = currentStep(s)!.optionWordIds.find((id) => id !== currentStep(s)!.targetWordId)!;
  s = answer(s, wrong).session;
  while (!s.finished) {
    s = answer(s, currentStep(s)!.targetWordId).session;
  }

  const rows = summarizeSession(s);
  assert.deepEqual(
    rows.map((r) => r.playerId),
    ['Аня', 'Боря'],
  );
  assert.equal(rows[0].errors, 1);
  assert.equal(rows[1].errors, 0);
  assert.equal(rows[1].accuracy, 1);
});

test('итоги партии, в которой никто не сделал ни шага', () => {
  const s = buildSession({
    roundId: 'r1',
    themeId: 'digits',
    playerIds: ['p1'],
    themeWordIds: ['0000'],
    stepsPerPlayer: 1,
    optionsPerStep: 1,
    levelOf: () => 0 as StepLevel,
    rng: () => 0.5,
  });
  assert.deepEqual(summarizeSession(s), [
    { playerId: 'p1', completed: 0, flawless: 0, errors: 0, accuracy: 0 },
  ]);
});
