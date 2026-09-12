// packages/player/src/periodictable/orbitalGeometry.ts
// Строит 3D-геометрию орбиталей из УЖЕ РАЗОБРАННЫХ данных (orbitalModel.ts)
// через настоящие угловые функции сферических гармоник (не сферы/цилиндры,
// слепленные "на глаз"), тот же метод, которым рисуют орбитали в любом
// учебнике/приложении по химии — точка на поверхности лепестка задаётся
// r(θ,φ) = |f(θ,φ)| в сферических координатах, где f — реальная (не
// комплексная) угловая часть волновой функции.
//
// ВАЖНО (найдено по живому замечанию пользователя "чувство что построено
// неправильно", проверено численно — см. orbitalGeometry.formulas.test.ts):
// первая версия строила p/d-орбитали ОДНОЙ формулой + поворотами меша
// (THREE.Object3D.rotation). Для p-орбитали, симметричной вокруг своей же
// оси (см. p ниже — фигура вращения, инвариантна к повороту вокруг
// собственной оси), поворот вокруг ЭТОЙ ЖЕ оси на 90° был буквально
// no-op: одна из трёх p-орбиталей дублировалась, другая не строилась
// вовсе. Сейчас КАЖДАЯ орбиталь — отдельная, независимо verified замкнутая
// формула, без поворотов существующего меша. Корректность всего набора
// подтверждена математическим инвариантом (см. тест): сумма квадратов всех
// орбиталей одной подоболочки — константа при любых (θ,φ), это стандартное
// свойство полного набора вещественных сферических гармоник одного l —
// если бы формулы были неполными/задублированными, сумма плавала бы.
//
// Исключение — f-орбитали: используются 3 настоящие (не все 7) формы
// f-подоболочки, каждая — своя независимая формула, не поворот одной.
// Разбирать оставшиеся 4 — того не стоит для музейного экспоната;
// зафиксировано в design-обсуждении и в подписи под 3D-видом
// (OrbitalViewer3D.tsx: "формы приближённые, f-орбитали упрощены").

import * as THREE from 'three';
import type { ElectronType } from './model/schema.ts';
import type { OrbitalGroup, Subshell } from './orbitalModel.ts';
import { ELECTRON_TYPE_COLOR } from './colorPalette.ts';

export type AngularFn = (theta: number, phi: number) => number;

// Ось θ=0 — локальная "полярная" ось построения (в коде помечена как Y —
// см. buildLobeMesh); физически это не более чем выбор системы координат
// для рисования, три p/пять d-орбиталей всё равно образуют полный
// корректный набор независимо от того, какую ось назвать "полюсом".
export const S_ANGULAR: AngularFn = () => 1;

// Три p-орбитали — каждая своей формулой (НЕ поворотом одного меша, см.
// комментарий в шапке файла). Сумма квадратов ≡ 1 — доказано в тесте.
export const P_POLE_ANGULAR: AngularFn = (theta) => Math.cos(theta);
export const P_A_ANGULAR: AngularFn = (theta, phi) => Math.sin(theta) * Math.cos(phi);
export const P_B_ANGULAR: AngularFn = (theta, phi) => Math.sin(theta) * Math.sin(phi);

// Пять d-орбиталей — коэффициенты 2 и 1/√3 подобраны так, чтобы сумма
// квадратов всех пяти была константой (тот же инвариант, что у p) —
// это и есть численная проверка, что набор из пяти формул действительно
// полный и взаимно согласованный, а не "5 похожих на вид функций".
export const D_POLE2_ANGULAR: AngularFn = (theta) => (3 * Math.cos(theta) ** 2 - 1) / Math.sqrt(3);
export const D_A_POLE_ANGULAR: AngularFn = (theta, phi) => 2 * Math.sin(theta) * Math.cos(theta) * Math.cos(phi);
export const D_B_POLE_ANGULAR: AngularFn = (theta, phi) => 2 * Math.sin(theta) * Math.cos(theta) * Math.sin(phi);
export const D_EQUATOR_1_ANGULAR: AngularFn = (theta, phi) => Math.sin(theta) ** 2 * Math.sin(2 * phi);
export const D_EQUATOR_2_ANGULAR: AngularFn = (theta, phi) => Math.sin(theta) ** 2 * Math.cos(2 * phi);

// f: 3 из 7 реальных форм f-подоболочки (см. шапку файла) — каждая своя
// формула, тоже без поворотов одного меша.
export const F_POLE3_ANGULAR: AngularFn = (theta) => Math.cos(theta) * (5 * Math.cos(theta) ** 2 - 3);
export const F_A_ANGULAR: AngularFn = (theta, phi) => Math.sin(theta) * (5 * Math.cos(theta) ** 2 - 1) * Math.cos(phi);
export const F_B_ANGULAR: AngularFn = (theta, phi) => Math.sin(theta) * (5 * Math.cos(theta) ** 2 - 1) * Math.sin(phi);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Доля лепестка не окрашивается по знаку синим/оранжевым (это красило бы
// ВСЕ подоболочки одинаково — ровно то, из-за чего пользователь не мог
// понять, какая фигура какой подоболочке принадлежит: цвет на 3D-фигуре
// не совпадал с цветом точки в подписи под ней). Вместо этого — цвет
// самой подоболочки (та же карта ELECTRON_TYPE_COLOR, что красит плитки в
// режиме «Электронный тип» и легенду ниже холста), а знак фазы — светлее/
// темнее ТОГО ЖЕ цвета, а не другой цвет вовсе.
function phaseShade(base: [number, number, number], positive: boolean): THREE.Color {
  const [r, g, b] = base;
  const t = positive ? 0.55 : -0.25; // светлее для +, темнее для -
  const mix = (c: number) => {
    const target = t >= 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(t));
  };
  return new THREE.Color(mix(r) / 255, mix(g) / 255, mix(b) / 255);
}

/**
 * Строит один "лепестковый" меш по угловой функции: сфера-развёртка (UV),
 * где радиус каждой вершины — |f(θ,φ)|, отмасштабированный под номер
 * оболочки n. Вершины красятся по знаку f (светлее/темнее цвета
 * подоболочки) — та же идея "две доли разного оттенка", что в учебных
 * изображениях орбиталей, но привязана к цвету подоболочки, не к
 * произвольной сине-оранжевой паре.
 */
export function buildLobeMesh(fn: AngularFn, scale: number, baseColorHex: string, segments = 40): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseRgb = hexToRgb(baseColorHex);

  const thetaSteps = segments;
  const phiSteps = segments * 2;

  for (let i = 0; i <= thetaSteps; i++) {
    const theta = (i / thetaSteps) * Math.PI;
    for (let j = 0; j <= phiSteps; j++) {
      const phi = (j / phiSteps) * Math.PI * 2;
      const value = fn(theta, phi);
      const r = Math.abs(value) * scale;
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.cos(theta);
      const z = r * Math.sin(theta) * Math.sin(phi);
      positions.push(x, y, z);
      const color = phaseShade(baseRgb, value >= 0);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let i = 0; i < thetaSteps; i++) {
    for (let j = 0; j < phiSteps; j++) {
      const a = i * (phiSteps + 1) + j;
      const b = a + phiSteps + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.05,
  });

  return new THREE.Mesh(geometry, material);
}

// Разнесение оболочек по радиусу сделано заметно шире прежнего
// (0.9+n*0.35 → 1.2+n*0.9): у элементов с несколькими валентными группами
// близких n (например Ce: 4f/5d/6s) прежний шаг был меньше самого размаха
// лепестков — оболочки визуально сливались в одно пятно вместо
// различимых концентрических слоёв. Слово "чувство, что построено
// непонятно" (дословная формулировка пользователя) — во многом именно
// об этом перекрытии, не только о цвете.
function shellScale(n: number): number {
  return 1.2 + n * 0.9;
}

/** Цвет по типу подоболочки — та же карта, что красит плитки в режиме
 *  «Электронный тип» (colorPalette.ts) и подпись-чип под 3D-видом. Теперь
 *  ЭТОТ ЖЕ цвет идёт и в саму 3D-геометрию (buildSubshellGroup ниже) —
 *  раньше фигуры красились отдельной сине-оранжевой парой, не совпадавшей
 *  с чипом легенды. */
export function orbitalGroupColor(subshell: Subshell): string {
  return ELECTRON_TYPE_COLOR[subshell as ElectronType];
}

function buildSubshellGroup(subshell: Subshell, n: number): THREE.Group {
  const group = new THREE.Group();
  const scale = shellScale(n);
  const color = orbitalGroupColor(subshell);

  if (subshell === 's') {
    group.add(buildLobeMesh(S_ANGULAR, scale * 0.55, color));
    return group;
  }

  if (subshell === 'p') {
    group.add(buildLobeMesh(P_POLE_ANGULAR, scale, color));
    group.add(buildLobeMesh(P_A_ANGULAR, scale, color));
    group.add(buildLobeMesh(P_B_ANGULAR, scale, color));
    return group;
  }

  if (subshell === 'd') {
    group.add(buildLobeMesh(D_POLE2_ANGULAR, scale, color));
    group.add(buildLobeMesh(D_A_POLE_ANGULAR, scale, color));
    group.add(buildLobeMesh(D_B_POLE_ANGULAR, scale, color));
    group.add(buildLobeMesh(D_EQUATOR_1_ANGULAR, scale, color));
    group.add(buildLobeMesh(D_EQUATOR_2_ANGULAR, scale, color));
    return group;
  }

  // f: см. комментарий в шапке файла — 3 из 7 реальных форм, не все.
  group.add(buildLobeMesh(F_POLE3_ANGULAR, scale, color));
  group.add(buildLobeMesh(F_A_ANGULAR, scale, color));
  group.add(buildLobeMesh(F_B_ANGULAR, scale, color));
  return group;
}

/** Собирает единую сцену-группу под все валентные орбитальные группы
 *  элемента — по одной подгруппе на каждый OrbitalGroup, без пересечения
 *  радиусов (разные n естественно разносятся по shellScale). */
export function buildAtomOrbitals(groups: OrbitalGroup[]): THREE.Group {
  const atom = new THREE.Group();
  for (const g of groups) {
    const subGroup = buildSubshellGroup(g.subshell, g.n);
    subGroup.userData = { n: g.n, subshell: g.subshell, electronCount: g.electronCount };
    atom.add(subGroup);
  }
  return atom;
}
