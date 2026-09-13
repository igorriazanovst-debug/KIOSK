// packages/shared/src/alphabet/game/random.ts
// Случайность, вынесенная в параметр.
//
// Ни один движок этапа не зовёт Math.random напрямую: генератор передаётся
// снаружи. Иначе отбор вариантов невозможно проверить тестом — а отбор
// вариантов это и есть половина смысла этапа.

export type Rng = () => number;

export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Генератор с зерном для тестов и для воспроизводимых партий.
 * mulberry32 — четыре строки и приличное качество; криптостойкость здесь
 * никому не нужна, а повторяемость нужна.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
