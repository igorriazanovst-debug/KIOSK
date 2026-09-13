// packages/player/src/periodictable/shellGeometry.ts
// Строит 3D-визуализацию "кольца-оболочки" (Bohr-модель) — по мотивам
// открытого кода источника (github.com/zhilips/zperiod,
// js/modules/threeRenderer.js): TorusGeometry-кольцо на каждую занятую
// оболочку + электроны-точки на кольце. Не претендует на квантовую
// точность (реальная орбиталь — не окружность), но именно так проще
// понять, на что смотришь, без знания квантовой химии — ради этого и
// сделана замена прежнего подхода с лепестковыми s/p/d/f-формами
// (orbitalGeometry.ts, удалён).

import * as THREE from 'three';
import type { ShellOccupancy } from './shellModel.ts';

const RING_COLOR = 0x90a4ae; // нейтральный серо-синий — то же общее "спокойное" направление, что уже задано остальным редизайном
const ELECTRON_COLOR = 0x4fc3f7; // яркий голубой — электроны должны бросаться в глаза на фоне нейтральных колец

function shellRadius(n: number): number {
  return 1.1 + n * 0.9;
}

export interface ShellVisual {
  group: THREE.Group;
  // Электроны каждой оболочки — отдельные меши с сохранённым углом и
  // радиусом, чтобы аниматор (OrbitalViewer3D.tsx) мог вращать их по
  // кольцу независимо от вращения всей сцены.
  electrons: { mesh: THREE.Mesh; radius: number; angle: number; speed: number }[];
}

/** Собирает кольца-оболочки + электроны-точки под все занятые оболочки
 *  элемента. Все кольца лежат в одной плоскости (как в источнике) —
 *  сознательно, это и делает модель читаемой с одного взгляда: не нужно
 *  распутывать пересекающиеся 3D-формы, только сосчитать кольца от
 *  центра наружу. */
export function buildShellVisualization(shells: ShellOccupancy[]): ShellVisual {
  const group = new THREE.Group();
  const electrons: ShellVisual['electrons'] = [];

  for (const shell of shells) {
    const radius = shellRadius(shell.n);

    const ringGeometry = new THREE.TorusGeometry(radius, 0.025, 12, 96);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: RING_COLOR, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const electronGeometry = new THREE.SphereGeometry(0.09, 16, 12);
    for (let i = 0; i < shell.electronCount; i++) {
      const angle = (i / shell.electronCount) * Math.PI * 2;
      const material = new THREE.MeshStandardMaterial({
        color: ELECTRON_COLOR,
        emissive: 0x0d47a1,
        emissiveIntensity: 0.4,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(electronGeometry, material);
      mesh.position.set(radius * Math.cos(angle), 0, radius * Math.sin(angle));
      group.add(mesh);
      // Внешние оболочки вращаются медленнее — тот же приём, что у
      // реальных орбитальных периодов (дальше от ядра — длиннее "виток"),
      // не претендует на физическую точность скорости, только на то,
      // чтобы оболочки визуально не двигались одинаково и не сливались.
      electrons.push({ mesh, radius, angle, speed: 0.6 / shell.n });
    }
  }

  return { group, electrons };
}
