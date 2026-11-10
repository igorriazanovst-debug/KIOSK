// Тесты Д-1: группировка игр по блокам теории для экрана «Игры». Логика -
// как у заданий в TasksScreen: блоки в учебном порядке, непустые; игры без
// привязки - в хвостовой группе «Другое». Фикстуры синтетические.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupGamesByBlock, OTHER_GAMES_TITLE } from './gameGroups.ts';

const blocks = [
  { id: 'b1', title: 'Блок первый' },
  { id: 'b2', title: 'Блок второй' },
];

function game(id: string, block = '') {
  return { id, title: `Игра ${id}`, block };
}

test('attributed games are grouped under their theory block in theory order', () => {
  const groups = groupGamesByBlock(blocks, [game('g2', 'b2'), game('g1', 'b1')]);
  assert.deepEqual(groups.map((g) => g.key), ['b1', 'b2']);
  assert.deepEqual(groups[0].games.map((g) => g.id), ['g1']);
  assert.deepEqual(groups[1].games.map((g) => g.id), ['g2']);
  assert.equal(groups[0].title, 'Блок первый');
});

test('games without a block land in the trailing «Другое» group', () => {
  const groups = groupGamesByBlock(blocks, [game('g1', 'b1'), game('свободная'), game('тоже свободная')]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[1], { key: 'other', title: OTHER_GAMES_TITLE, games: [game('свободная'), game('тоже свободная')] });
});

test('a block with no games is omitted', () => {
  const groups = groupGamesByBlock(blocks, [game('g2', 'b2')]);
  assert.deepEqual(groups.map((g) => g.key), ['b2']);
});

test('a game pointing at an unknown block goes to «Другое», not lost (defensive)', () => {
  // Схема контента такое отклоняет; группировка остаётся безопасной, как
  // аналогичная ветка у TasksScreen.
  const groups = groupGamesByBlock(blocks, [game('битая', 'нет-такого-блока')]);
  assert.deepEqual(groups.map((g) => g.key), ['other']);
});

test('no games means no groups at all, not even «Другое»', () => {
  assert.deepEqual(groupGamesByBlock(blocks, []), []);
});
