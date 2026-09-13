// packages/player/src/periodictable/nucleusModel.ts
// Чистая логика ядра атома — число протонов/нейтронов и равномерное
// распределение точек по сфере (алгоритм Фибоначчи), тот же общий подход,
// что в открытом коде источника (github.com/zhilips/zperiod,
// js/modules/threeRenderer.js: протоны и нейтроны как отдельные сферы,
// расставленные по сфере Фибоначчи). Пользователь отметил, что центр
// сцены раньше не читался как ядро (была всего одна маленькая жёлтая
// точка) — источник строит настоящий "шарик" из частиц, это и
// воспроизводим, не выдумывая новый подход с нуля.

/** Число нейтронов — округление (относительная атомная масса − номер
 *  элемента). Это ОЦЕНКА по преобладающему изотопу, не точный подсчёт
 *  для какого-то конкретного изотопа (тот же класс приближения, что и у
 *  источника — нейтронов у смеси изотопов элемента не бывает "ровно
 *  одно число"). Не может быть отрицательным (защита от некорректных
 *  входных данных, не ожидается для реальных элементов). */
export function estimateNeutronCount(atomicNumber: number, atomicMass: number): number {
  return Math.max(0, Math.round(atomicMass) - atomicNumber);
}

export interface NucleusComposition {
  protonCount: number;
  neutronCount: number;
  totalNucleons: number;
}

export function computeNucleusComposition(atomicNumber: number, atomicMass: number): NucleusComposition {
  const neutronCount = estimateNeutronCount(atomicNumber, atomicMass);
  return { protonCount: atomicNumber, neutronCount, totalNucleons: atomicNumber + neutronCount };
}

/** Равномерное распределение N точек на единичной сфере — стандартный
 *  алгоритм "сфера Фибоначчи" (золотой угол), тот же общий приём, что
 *  источник использует для расстановки протонов/нейтронов. Возвращает
 *  единичные векторы направления (x,y,z) — домножить на нужный радиус
 *  на стороне вызывающего кода. */
export function fibonacciSpherePoints(count: number): [number, number, number][] {
  if (count <= 0) return [];
  const points: [number, number, number][] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2; // от 1 до -1
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;
    points.push([x, y, z]);
  }
  return points;
}

// Верхняя граница числа реально отрисовываемых частиц: у тяжёлых
// элементов (например уран — 92 протона + ~146 нейтронов = 238) рисовать
// каждый нуклон отдельной сферой избыточно (внутренние всё равно
// не видны за внешним слоем — источник называет это "interior culling")
// и дорого по кадрам на слабом киоск-железе. Отображаемое подмножество
// сохраняет РЕАЛЬНУЮ пропорцию протонов/нейтронов (см. sampleNucleusParticles).
export const MAX_RENDERED_NUCLEONS = 90;

export interface NucleusParticle {
  isProton: boolean;
}

/** Подмножество частиц для отрисовки, сохраняющее реальную пропорцию
 *  протонов/нейтронов даже когда общее число обрезано до
 *  MAX_RENDERED_NUCLEONS. Детерминированно (не Math.random) — тесты и
 *  живая проверка видят один и тот же результат при том же составе.
 *  Стандартный приём "равномерно распределить k истин среди n слотов":
 *  слот i — протон, если округлённое накопление доли протонов
 *  перескакивает целое число именно на этом шаге. Сумма телескопируется
 *  в round(renderCount·protonFraction) — протоны равномерно рассеяны по
 *  всей последовательности, а не собраны в начале (важно, потому что
 *  дальше эта последовательность идёт на раскладку по сфере Фибоначчи
 *  по порядку — собранные в начале протоны легли бы одним пятном). */
export function sampleNucleusParticles(composition: NucleusComposition): NucleusParticle[] {
  const renderCount = Math.min(composition.totalNucleons, MAX_RENDERED_NUCLEONS);
  if (renderCount === 0) return [];
  const protonFraction = composition.protonCount / composition.totalNucleons;
  const particles: NucleusParticle[] = [];
  for (let i = 0; i < renderCount; i++) {
    const before = Math.round(i * protonFraction);
    const after = Math.round((i + 1) * protonFraction);
    particles.push({ isProton: after > before });
  }
  return particles;
}
