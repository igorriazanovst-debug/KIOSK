// Игра «Наблюдательность»: найти отличия между двумя картинками, понять,
// что появилось, пропало или изменилось. Картинки - наборы простых фигур
// на поле 100x100, поэтому лицензий на изображения нет.

import { pickWithoutRepeat, type Rng } from './rng.ts';
import type { EumkGame } from './model/schema.ts';

export interface SceneShape {
  shape: string;
  color: string;
  x: number;
  y: number;
  size: number;
}

export interface SceneDifference {
  kind: string;
  object: string;
  x: number;
  y: number;
  text: string;
}

export interface ObservationScene {
  id: string;
  mode: 'diff' | 'added' | 'missing' | 'changed';
  title: string;
  level: number;
  canvas: { width: number; height: number };
  sceneA: SceneShape[];
  sceneB: SceneShape[];
  differences: SceneDifference[];
  answerCount: number;
  prompt: string;
}

export interface ObservationData {
  scenes: ObservationScene[];
  // Допуск в единицах поля 100x100: насколько близко к отличию должно попасть нажатие.
  tolerance: number;
}

export const SCENES_PER_PLAY = 4;

const DEFAULT_TOLERANCE = 7;

function toleranceOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TOLERANCE;
}

export function observationData(game: EumkGame): ObservationData {
  return { scenes: (game.data.scenes ?? []) as ObservationScene[], tolerance: toleranceOf(game.data.tolerance) };
}

export function observationLevels(data: ObservationData): number[] {
  return [...new Set(data.scenes.map((s) => s.level))].sort((a, b) => a - b);
}

export function scenesForLevel(data: ObservationData, level: number, rng?: Rng, limit = SCENES_PER_PLAY): ObservationScene[] {
  const pool = data.scenes.filter((s) => s.level === level);
  return rng ? pickWithoutRepeat(pool, limit, rng) : pool.slice(0, limit);
}

export interface ScenePlay {
  scene: ObservationScene;
  found: number[];
  errors: number;
  finished: boolean;
}

export function startScenePlay(scene: ObservationScene): ScenePlay {
  return { scene, found: [], errors: 0, finished: false };
}

export function tapScene(play: ScenePlay, point: { x: number; y: number }, tolerance: number): ScenePlay {
  if (play.finished) return play;
  let nearest = -1;
  let nearestDistance = Infinity;
  play.scene.differences.forEach((d, index) => {
    if (play.found.includes(index)) return;
    const distance = Math.hypot(d.x - point.x, d.y - point.y);
    if (distance <= tolerance && distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  if (nearest === -1) {
    // Нажатие рядом с уже найденным отличием - не ошибка.
    const nearFound = play.found.some((i) => Math.hypot(play.scene.differences[i].x - point.x, play.scene.differences[i].y - point.y) <= tolerance);
    return nearFound ? play : { ...play, errors: play.errors + 1 };
  }
  const found = [...play.found, nearest];
  return { ...play, found, finished: found.length === play.scene.differences.length };
}

export function sceneStars(outcome: { errors: number; finished: boolean }): 0 | 1 | 2 | 3 {
  if (!outcome.finished) return 0;
  if (outcome.errors === 0) return 3;
  if (outcome.errors <= 2) return 2;
  return 1;
}
