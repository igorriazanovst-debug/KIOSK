// packages/player/src/periodictable/orbitalGeometry.formulas.test.ts
// Проверяет МАТЕМАТИЧЕСКУЮ корректность угловых функций орбиталей, не
// только "что-то рендерится". Первая версия этого файла строила
// p/d-орбитали одной формулой + поворотами THREE.Object3D.rotation — для
// фигуры, симметричной вокруг собственной оси (p-орбиталь — тело
// вращения), поворот вокруг ЭТОЙ ЖЕ оси на 90° был no-op: одна орбиталь
// дублировалась, другая не строилась вовсе (найдено по замечанию
// пользователя "чувство что построено неправильно", подтверждено
// численно). Этот тест ловит именно такой класс дефекта:
// 1. Ни одна пара функций одной подоболочки не совпадает как функция
//    (сэмплы в разных точках (θ,φ) должны различаться).
// 2. Сумма квадратов всех функций одной подоболочки — КОНСТАНТА при любых
//    (θ,φ) — стандартное свойство полного набора вещественных сферических
//    гармоник одного l. Если бы функции были неполными или задублированными,
//    сумма плавала бы в зависимости от (θ,φ), а не была бы одним числом.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  S_ANGULAR,
  P_POLE_ANGULAR,
  P_A_ANGULAR,
  P_B_ANGULAR,
  D_POLE2_ANGULAR,
  D_A_POLE_ANGULAR,
  D_B_POLE_ANGULAR,
  D_EQUATOR_1_ANGULAR,
  D_EQUATOR_2_ANGULAR,
  type AngularFn,
} from './orbitalGeometry.ts';

// Сетка (θ,φ) для сэмплирования — не проходит через полюса (θ=0/π), где
// φ вырождается (любой φ даёт одну и ту же точку) и могло бы дать ложное
// "функции равны" на исключительной точке.
function samplePoints(): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let ti = 1; ti < 8; ti++) {
    for (let pi = 0; pi < 8; pi++) {
      points.push([(ti / 8) * Math.PI, (pi / 8) * 2 * Math.PI]);
    }
  }
  return points;
}

function sumOfSquares(fns: AngularFn[], theta: number, phi: number): number {
  return fns.reduce((acc, fn) => acc + fn(theta, phi) ** 2, 0);
}

test('the three p-orbital functions are pairwise distinct (not one function rotated into a no-op duplicate)', () => {
  const points = samplePoints();
  const valuesA = points.map(([t, p]) => P_POLE_ANGULAR(t, p));
  const valuesB = points.map(([t, p]) => P_A_ANGULAR(t, p));
  const valuesC = points.map(([t, p]) => P_B_ANGULAR(t, p));
  // Регрессия ровно на тот баг, что был найден: раньше "третья" p-орбиталь
  // технически была тем же самым мешем, что и первая (поворот вокруг
  // собственной оси симметрии — no-op). Сравниваем поточечно, не просто
  // "похоже/непохоже".
  assert.notDeepEqual(valuesA, valuesB);
  assert.notDeepEqual(valuesA, valuesC);
  assert.notDeepEqual(valuesB, valuesC);
});

test('the sum of squares of the three p-orbital functions is exactly 1 everywhere (complete, correctly normalized set)', () => {
  for (const [theta, phi] of samplePoints()) {
    const sum = sumOfSquares([P_POLE_ANGULAR, P_A_ANGULAR, P_B_ANGULAR], theta, phi);
    assert.ok(Math.abs(sum - 1) < 1e-9, `expected 1, got ${sum} at theta=${theta}, phi=${phi}`);
  }
});

test('the five d-orbital functions are pairwise distinct', () => {
  const points = samplePoints();
  const fns = [D_POLE2_ANGULAR, D_A_POLE_ANGULAR, D_B_POLE_ANGULAR, D_EQUATOR_1_ANGULAR, D_EQUATOR_2_ANGULAR];
  for (let i = 0; i < fns.length; i++) {
    for (let j = i + 1; j < fns.length; j++) {
      const valuesI = points.map(([t, p]) => fns[i](t, p));
      const valuesJ = points.map(([t, p]) => fns[j](t, p));
      assert.notDeepEqual(valuesI, valuesJ, `d-orbital functions at index ${i} and ${j} are identical`);
    }
  }
});

test('the sum of squares of the five d-orbital functions is constant everywhere (complete, consistently normalized set)', () => {
  const fns = [D_POLE2_ANGULAR, D_A_POLE_ANGULAR, D_B_POLE_ANGULAR, D_EQUATOR_1_ANGULAR, D_EQUATOR_2_ANGULAR];
  const points = samplePoints();
  const reference = sumOfSquares(fns, points[0][0], points[0][1]);
  for (const [theta, phi] of points) {
    const sum = sumOfSquares(fns, theta, phi);
    assert.ok(Math.abs(sum - reference) < 1e-9, `expected constant ${reference}, got ${sum} at theta=${theta}, phi=${phi}`);
  }
});

test('the s-orbital function is a genuine constant (sphere, no angular dependence)', () => {
  for (const [theta, phi] of samplePoints()) {
    assert.equal(S_ANGULAR(theta, phi), 1);
  }
});
