// packages/player/src/periodictable/nucleusGeometry.ts
// Строит ядро атома как кластер сфер-протонов/нейтронов на сфере
// Фибоначчи + точечный свет — по мотивам открытого кода источника
// (github.com/zhilips/zperiod, js/modules/threeRenderer.js): там ядро —
// не одна точка, а десятки отдельных частиц с красным точечным светом,
// из-за чего центр читается как настоящее "ядро", а не безликая точка.
// Раньше здесь была одна маленькая жёлтая сфера-ориентир — пользователь
// заметил, что центр практически не читался на экране.

import * as THREE from 'three';
import { computeNucleusComposition, sampleNucleusParticles, fibonacciSpherePoints } from './nucleusModel.ts';

const PROTON_COLOR = 0xff3b30;
const NEUTRON_COLOR = 0x9e9e9e;

// Радиус ядра растёт с кубическим корнем числа нуклонов — тот же закон
// (R ∝ A^(1/3)), которым в реальной ядерной физике оценивают размер ядра
// по числу нуклонов A. Не претендует на точную физическую шкалу
// относительно радиуса электронных оболочек (те в этой модели и так не
// физически точны, см. shellGeometry.ts), но растёт "правильно"
// качественно: уран нагляднее выглядит крупнее водорода.
function nucleusRadius(totalNucleons: number): number {
  return 0.22 + Math.cbrt(Math.max(totalNucleons, 1)) * 0.11;
}

// Отдельная частица масштабируется вниз, когда их отрисовывается много
// (иначе плотно упакованные сферы у тяжёлых элементов сливаются в один
// нечитаемый ком) — чем гуще упаковка, тем мельче каждая частица.
function particleSize(renderedCount: number): number {
  return renderedCount <= 12 ? 0.11 : renderedCount <= 40 ? 0.08 : 0.06;
}

export interface NucleusVisual {
  group: THREE.Group;
  radius: number;
}

export function buildNucleus(atomicNumber: number, atomicMass: number): NucleusVisual {
  const composition = computeNucleusComposition(atomicNumber, atomicMass);
  const particles = sampleNucleusParticles(composition);
  const radius = nucleusRadius(composition.totalNucleons);
  const points = fibonacciSpherePoints(particles.length);
  const size = particleSize(particles.length);

  const group = new THREE.Group();
  const protonGeometry = new THREE.SphereGeometry(size, 12, 10);
  const neutronGeometry = new THREE.SphereGeometry(size, 12, 10);
  const protonMaterial = new THREE.MeshStandardMaterial({
    color: PROTON_COLOR,
    roughness: 0.25,
    metalness: 0.3,
    emissive: 0xb71c1c,
    emissiveIntensity: 0.6,
  });
  const neutronMaterial = new THREE.MeshStandardMaterial({
    color: NEUTRON_COLOR,
    roughness: 0.35,
    metalness: 0.25,
    emissive: 0x333333,
    emissiveIntensity: 0.3,
  });

  particles.forEach((particle, i) => {
    const [x, y, z] = points[i];
    const mesh = new THREE.Mesh(particle.isProton ? protonGeometry : neutronGeometry, particle.isProton ? protonMaterial : neutronMaterial);
    mesh.position.set(x * radius, y * radius, z * radius);
    group.add(mesh);
  });

  // Красный точечный свет из центра ядра — тот же приём, что у источника:
  // без него плотный кластер мелких частиц в центре сцены теряется на
  // фоне ярко освещённых внешних колец-оболочек, свет явно выделяет центр
  // как отдельный, "горячий" объект.
  const glow = new THREE.PointLight(0xff5252, 1.4, radius * 12);
  group.add(glow);

  return { group, radius };
}
