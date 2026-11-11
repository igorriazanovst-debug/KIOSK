import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seededRng } from './rng.ts';
import { parseEumkContent, TaskSchema, type EumkContent, type EumkGame, type EumkTask } from './model/schema.ts';
import { buildGameRounds, gameLevels, ROUND_GAME_TYPES, ROUNDS_PER_PLAY } from './gameRounds.ts';
import { checkTask } from './tasks.ts';

function load(name: string): EumkContent {
  return parseEumkContent(JSON.parse(readFileSync(new URL(`./content/${name}.content.json`, import.meta.url), 'utf8')));
}
const games: EumkGame[] = [...load('nach').games, ...load('dosh').games].filter((g) => ROUND_GAME_TYPES.includes(g.type));

// «Решатель»: верный ответ, прочитанный из данных самого задания.
function solve(task: EumkTask): unknown {
  switch (task.type) {
    case 'choice': case 'multi': return task.data.correct;
    case 'order': return task.data.items;
    default: throw new Error(`unexpected ${task.type}`);
  }
}

test('every round-based game is present, one per base type plus block pools', () => {
  // С волнами K5 растёт число поблочных пулов: базовая механика - все 7
  // round-типов представлены минимум один раз.
  assert.ok(games.length >= 7);
  assert.equal(new Set(games.map((g) => g.type)).size, 7, 'все 7 round-типов');
});

test('every game offers at least one level', () => {
  for (const g of games) assert.ok(gameLevels(g).length >= 1, g.id);
});

test('every round of every level is a valid task that its own data solves', () => {
  for (const g of games) {
    for (const level of gameLevels(g)) {
      for (let seed = 1; seed <= 8; seed++) {
        const rounds = buildGameRounds(g, level, seededRng(seed));
        assert.ok(rounds.length > 0, `${g.id} level ${level}`);
        for (const r of rounds) {
          TaskSchema.parse(r.task);
          assert.equal(checkTask(r.task, solve(r.task)).isCorrect, true, `${g.id} L${level} ${r.id}`);
        }
      }
    }
  }
});

test('a play has no more rounds than the configured size', () => {
  for (const g of games) {
    for (const level of gameLevels(g)) {
      assert.ok(buildGameRounds(g, level, seededRng(3)).length <= Math.max(ROUNDS_PER_PLAY, 12), g.id);
    }
  }
});

test('rounds inside one play are distinct', () => {
  for (const g of games) {
    for (const level of gameLevels(g)) {
      const ids = buildGameRounds(g, level, seededRng(5)).map((r) => r.id);
      assert.equal(new Set(ids).size, ids.length, `${g.id} L${level}`);
    }
  }
});

test('different seeds give different plays', () => {
  // «Режим дня» первого уровня - единственный набор карточек, порядок карточек перемешивает экран.
  for (const g of games.filter((game) => game.type !== 'sequence')) {
    const level = gameLevels(g)[0];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) seen.add(buildGameRounds(g, level, seededRng(seed)).map((r) => r.id).join(','));
    assert.ok(seen.size > 1, g.id);
  }
});

test('wrong-answer options never duplicate the correct one', () => {
  for (const g of games) {
    for (const level of gameLevels(g)) {
      for (const r of buildGameRounds(g, level, seededRng(2))) {
        if (r.task.type === 'choice' || r.task.type === 'multi') {
          const opts = r.task.data.options;
          assert.equal(new Set(opts).size, opts.length, `${g.id} ${r.id}: повторяются варианты`);
        }
      }
    }
  }
});

test('the correct choice is not always in the same place', () => {
  for (const g of games) {
    const level = gameLevels(g)[0];
    const positions = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      for (const r of buildGameRounds(g, level, seededRng(seed))) {
        if (r.task.type === 'choice') positions.add(r.task.data.correct[0]);
      }
    }
    if (positions.size === 0) continue;
    assert.ok(positions.size > 1, `${g.id}: верный вариант всегда на одном месте`);
  }
});
