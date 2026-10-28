import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEumkContent } from './model/schema.ts';
import { seededRng } from './rng.ts';
import { observationData, scenesForLevel, observationLevels, tapScene, startScenePlay, sceneStars, type ObservationScene } from './observationLogic.ts';

const content = parseEumkContent(JSON.parse(readFileSync(new URL('./content/nach.content.json', import.meta.url), 'utf8')));
const game = content.games.find((g) => g.type === 'observation')!;
const data = observationData(game);

test('scenes exist for every level', () => {
  for (const level of observationLevels(data)) assert.ok(scenesForLevel(data, level).length > 0, `level ${level}`);
});

test('every scene has as many differences as its answerCount', () => {
  for (const s of data.scenes) assert.equal(s.differences.length, s.answerCount, s.id);
});

test('every difference lies inside the canvas', () => {
  for (const s of data.scenes) for (const d of s.differences) {
    assert.ok(d.x >= 0 && d.x <= s.canvas.width && d.y >= 0 && d.y <= s.canvas.height, s.id);
  }
});

const scene: ObservationScene = {
  id: 's', mode: 'diff', title: 't', level: 1, canvas: { width: 100, height: 100 }, sceneA: [], sceneB: [], answerCount: 2, prompt: 'p',
  differences: [{ kind: 'color', object: 'a', x: 20, y: 20, text: 'A' }, { kind: 'size', object: 'b', x: 80, y: 80, text: 'B' }],
};

test('a tap within tolerance finds the nearest difference', () => {
  const play = tapScene(startScenePlay(scene), { x: 22, y: 19 }, 7);
  assert.deepEqual(play.found, [0]);
  assert.equal(play.errors, 0);
});

test('a tap far from every difference is an error', () => {
  const play = tapScene(startScenePlay(scene), { x: 50, y: 50 }, 7);
  assert.equal(play.errors, 1);
  assert.deepEqual(play.found, []);
});

test('the same difference cannot be found twice', () => {
  let play = tapScene(startScenePlay(scene), { x: 20, y: 20 }, 7);
  play = tapScene(play, { x: 21, y: 21 }, 7);
  assert.deepEqual(play.found, [0]);
  assert.equal(play.errors, 0);
});

test('finding all differences finishes the scene', () => {
  let play = tapScene(startScenePlay(scene), { x: 20, y: 20 }, 7);
  play = tapScene(play, { x: 80, y: 80 }, 7);
  assert.equal(play.finished, true);
});

test('stars drop with errors', () => {
  assert.equal(sceneStars({ errors: 0, finished: true }), 3);
  assert.equal(sceneStars({ errors: 2, finished: true }), 2);
  assert.equal(sceneStars({ errors: 5, finished: true }), 1);
  assert.equal(sceneStars({ errors: 0, finished: false }), 0);
});

test('scenesForLevel returns a bounded random selection without repeats', () => {
  const picked = scenesForLevel(data, 3, seededRng(1), 2);
  assert.ok(picked.length <= 2);
  assert.equal(new Set(picked.map((s) => s.id)).size, picked.length);
});

test('a tap near a found and an unfound difference finds the unfound one', () => {
  const close: ObservationScene = { ...scene, differences: [{ kind: 'a', object: 'a', x: 50, y: 50, text: 'A' }, { kind: 'b', object: 'b', x: 54, y: 50, text: 'B' }] };
  let play = tapScene(startScenePlay(close), { x: 50, y: 50 }, 7);
  play = tapScene(play, { x: 51, y: 50 }, 7);
  assert.deepEqual(play.found, [0, 1]);
  assert.equal(play.errors, 0);
});

test('a non-numeric tolerance falls back to the default', () => {
  const g = content.games.find((x) => x.type === 'observation')!;
  assert.equal(observationData({ ...g, data: { ...g.data, tolerance: 'мусор' } }).tolerance, 7);
});
