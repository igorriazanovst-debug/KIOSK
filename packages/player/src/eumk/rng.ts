// Генератор случайных чисел и перемешивание для движка ЭУМК. Вся логика
// домена принимает `Rng`, а не зовёт Math.random напрямую: в рантайме
// подставляется криптослучайный источник, в тестах - детерминированный.

export type Rng = () => number;

// mulberry32 - небольшой быстрый генератор с воспроизводимым результатом.
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

// Источник для рантайма: каждое начало теста должно давать новую
// комбинацию, поэтому сид берётся из crypto, а не из времени.
export function runtimeRng(): Rng {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return seededRng(buffer[0]);
}

export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickWithoutRepeat<T>(pool: readonly T[], count: number, rng: Rng): T[] {
  return shuffled(pool, rng).slice(0, Math.max(0, Math.min(count, pool.length)));
}
