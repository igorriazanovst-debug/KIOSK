// packages/player/src/periodictable/orbitalGeometry.ts
// Строит 3D-геометрию орбиталей из УЖЕ РАЗОБРАННЫХ данных (orbitalModel.ts)
// через настоящие угловые функции сферических гармоник (не сферы/цилиндры,
// слепленные "на глаз"), тот же метод, которым рисуют орбитали в любом
// учебнике/приложении по химии — точка на поверхности лепестка задаётся
// r(θ,φ) = |f(θ,φ)| в сферических координатах, где f — реальная (не
// комплексная) угловая часть волновой функции.
//
// Исключение — f-орбитали: используется ОДНА настоящая формула (f_z³,
// физически корректна сама по себе) в нескольких поворотах вместо всех 7
// разных реальных форм f-подоболочки. Разбирать оставшиеся 6 — того не
// стоит для музейного экспоната: сознательное упрощение, зафиксировано и
// в design-обсуждении, и здесь.

import * as THREE from 'three';
import type { ElectronType } from './model/schema.ts';
import type { OrbitalGroup, Subshell } from './orbitalModel.ts';
import { ELECTRON_TYPE_COLOR } from './colorPalette.ts';

type AngularFn = (theta: number, phi: number) => number;

const ANGULAR_FN: Record<'s' | 'p' | 'dCloverleaf' | 'dz2' | 'fApprox', AngularFn> = {
  s: () => 1,
  p: (theta) => Math.cos(theta),
  dCloverleaf: (theta, phi) => Math.sin(theta) ** 2 * Math.sin(2 * phi),
  dz2: (theta) => 3 * Math.cos(theta) ** 2 - 1,
  fApprox: (theta) => Math.cos(theta) * (5 * Math.cos(theta) ** 2 - 3),
};

const POSITIVE_LOBE_COLOR = new THREE.Color(0x4fc3f7);
const NEGATIVE_LOBE_COLOR = new THREE.Color(0xff8a65);

/**
 * Строит один "лепестковый" меш по угловой функции: сфера-развёртка (UV),
 * где радиус каждой вершины — |f(θ,φ)|, отмасштабированный под номер
 * оболочки n. Вершины красятся по знаку f — тот же приём, что в любом
 * учебном изображении орбиталей (две доли разного "цвета фазы").
 */
function buildLobeMesh(fn: AngularFn, scale: number, segments = 40): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

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
      const color = value >= 0 ? POSITIVE_LOBE_COLOR : NEGATIVE_LOBE_COLOR;
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
    opacity: 0.85,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.05,
  });

  return new THREE.Mesh(geometry, material);
}

// Радиус растёт с номером оболочки — выше n визуально дальше от ядра,
// та же логика, что в любой школьной модели атома, только тут это ещё и
// разносит несколько валентных групп друг от друга без перекрытия.
function shellScale(n: number): number {
  return 0.9 + n * 0.35;
}

function buildSubshellGroup(subshell: Subshell, n: number): THREE.Group {
  const group = new THREE.Group();
  const scale = shellScale(n);

  if (subshell === 's') {
    group.add(buildLobeMesh(ANGULAR_FN.s, scale * 0.6));
    return group;
  }

  if (subshell === 'p') {
    const base = buildLobeMesh(ANGULAR_FN.p, scale);
    group.add(base);
    const py = base.clone();
    py.rotation.x = Math.PI / 2;
    group.add(py);
    const px = base.clone();
    px.rotation.y = Math.PI / 2;
    group.add(px);
    return group;
  }

  if (subshell === 'd') {
    const cloverleaf = buildLobeMesh(ANGULAR_FN.dCloverleaf, scale);
    // dxy (как есть), dx2-y2 (поворот на 45° вокруг z), dxz и dyz (тот же
    // лепесток, повёрнутый в плоскости xz/yz) — 4 геометрически одинаковых
    // орбитали этой подоболочки, различающихся только ориентацией.
    const dxy = cloverleaf;
    group.add(dxy);
    const dx2y2 = cloverleaf.clone();
    dx2y2.rotation.z = Math.PI / 4;
    group.add(dx2y2);
    const dxz = cloverleaf.clone();
    dxz.rotation.x = Math.PI / 2;
    group.add(dxz);
    const dyz = cloverleaf.clone();
    dyz.rotation.y = Math.PI / 2;
    group.add(dyz);
    group.add(buildLobeMesh(ANGULAR_FN.dz2, scale));
    return group;
  }

  // f: см. комментарий в шапке файла — упрощение, не 7 разных форм.
  const fBase = buildLobeMesh(ANGULAR_FN.fApprox, scale);
  group.add(fBase);
  for (const angle of [Math.PI / 3, (2 * Math.PI) / 3, Math.PI]) {
    const copy = fBase.clone();
    copy.rotation.x = angle;
    group.add(copy);
  }
  return group;
}

/** Цвет по типу подоболочки — та же карта, что красит плитки в режиме
 *  «Электронный тип» (colorPalette.ts), чтобы 3D-вид не заводил свою
 *  параллельную цветовую легенду. */
export function orbitalGroupColor(subshell: Subshell): string {
  return ELECTRON_TYPE_COLOR[subshell as ElectronType];
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
