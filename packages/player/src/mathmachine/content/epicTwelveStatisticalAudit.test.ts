// Статистически откалиброванная проверка Эпика 12 — по методологии
// оригинального проекта (см. Тип6_бэклог.md, Эпик 12: «финальная
// проверка... применил СТАТИСТИЧЕСКИ ОТКАЛИБРОВАННУЮ методологию —
// нулевые модели по 500 000 случайных конструкций, а не наивные пороги
// "не больше половины"»). Обычные тесты волн (generateWaveNContent.test.ts)
// проверяют детерминированные пороги (частота ≤ ceil(G/2) и т.п.) — этот
// файл идёт дальше: для каждой оси строится РАСПРЕДЕЛЕНИЕ метрики на
// случайном шуме ТОГО ЖЕ РАЗМЕРА (то же число заданий G, тот же набор
// значений на выбор), и наблюдаемый (хэш-based) результат сравнивается
// именно с этим распределением, а не с произвольным порогом.
//
// Критерий: доля случайных конструкций, давших РАВНУЮ ИЛИ БОЛЬШУЮ
// (т.е. не менее опасную) эксплуатируемость, должна быть НЕ МЕНЬШЕ 5% —
// иначе наблюдаемая конструкция статистически значимо (на уровне 95%)
// предсказуемее типичного случайного шума того же размера, что и
// является тревожным сигналом, даже если детерминированный порог
// формально пройден.
//
// PRNG — детерминированный (mulberry32, не Math.random()), чтобы прогон
// был воспроизводим и не флейки от истинной случайности при разной
// близости наблюдаемого значения к порогу.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema } from '@kiosk/shared';
import pilotContent from './pilotContent.json' with { type: 'json' };
import { DIVISION_DECOY_SCHEMES } from './generatorShared.ts';

const TRIALS = 20000;
const MIN_PERCENTILE = 0.05;

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function maxFrequency(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Math.max(...counts.values());
}

function exploitablePeriod(values: number[]): number | null {
  const n = values.length;
  for (let period = 1; period <= Math.floor(n / 2); period++) {
    let matches = true;
    for (let i = period; i < n; i++) {
      if (values[i] !== values[i % period]) {
        matches = false;
        break;
      }
    }
    if (matches) return period;
  }
  return null;
}

function maxLinearFormulaMatch(values: number[], modulus: number): number {
  let best = 0;
  for (let a = 0; a < modulus; a++) {
    for (let c = 0; c < modulus; c++) {
      let matches = 0;
      values.forEach((v, i) => {
        if (((a * i + c) % modulus + modulus) % modulus === v) matches++;
      });
      best = Math.max(best, matches);
    }
  }
  return best;
}

/** Единый скаляр «насколько эксплуатируема последовательность позиций» — чем больше, тем опаснее. */
function positionExploitabilityScore(positions: number[], numOptions: number): number {
  const freq = maxFrequency(positions);
  const period = exploitablePeriod(positions);
  const periodScore = period !== null && period <= positions.length / 2 ? positions.length : 0;
  const linear = maxLinearFormulaMatch(positions, numOptions);
  return Math.max(freq, periodScore, linear);
}

/** Доля из TRIALS случайных конструкций, давших score >= observedScore (не менее опасных, чем наша). */
function percentileAtLeastAsExploitable(observedScore: number, sampleNullScore: () => number, rng: () => number): number {
  let count = 0;
  for (let i = 0; i < TRIALS; i++) {
    if (sampleNullScore() >= observedScore) count++;
  }
  void rng;
  return count / TRIALS;
}

const parsed = MathMachineContentSchema.parse(pilotContent);

// ─── Ось 1: позиция кнопки — все choice-группы каталога ─────────────────

test('[statistical] button position is not exploitable beyond random noise, for every choice-mode group', () => {
  const rng = mulberry32(120260909);
  const report: { group: string; G: number; N: number; observedScore: number; percentile: number }[] = [];
  let checked = 0;

  for (const group of Object.values(parsed.groups)) {
    const tasks = group.taskIds.map((id) => parsed.tasks[id]).filter((t) => Array.isArray(t.choices));
    if (tasks.length < 4) continue;
    checked++;

    const G = tasks.length;
    const N = tasks[0].choices!.length;
    const observedPositions = tasks.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer)));
    const observedScore = positionExploitabilityScore(observedPositions, N);

    const percentile = percentileAtLeastAsExploitable(
      observedScore,
      () => {
        const randomPositions = Array.from({ length: G }, () => Math.floor(rng() * N));
        return positionExploitabilityScore(randomPositions, N);
      },
      rng,
    );

    report.push({ group: group.id, G, N, observedScore, percentile });
    assert.ok(
      percentile >= MIN_PERCENTILE,
      `group ${group.id}: позиция (score=${observedScore}, G=${G}, N=${N}) не менее эксплуатируема лишь в ${(percentile * 100).toFixed(2)}% случайных конструкций того же размера — статистически значимо предсказуемее шума`,
    );
  }

  assert.ok(checked > 0, 'expected at least one choice-mode group to exist');
  console.log(`[position audit] checked ${checked} groups, min percentile ${Math.min(...report.map((r) => r.percentile)).toFixed(3)}`);
});

// ─── Ось 2: структурные эвристики деления — majority/odd-one-out ────────
// Эвристики majority/odd-one-out НЕ зависят от позиции (смотрят на
// множество показанных значений, не на слот) — нулевая модель здесь
// рандомизирует ВЫБОР СХЕМЫ дистракторов на каждое задание (вместо
// хэш-based), а не позицию.

function parseDivisionOption(option: string): { quotient: number; remainder: number } {
  const match = /^(-?\d+) ост\. (\d+)$/.exec(option);
  if (!match) throw new Error(`unparseable division option: ${option}`);
  return { quotient: Number(match[1]), remainder: Number(match[2]) };
}

function majorityOf(values: number[]): number | null {
  const winners = [...new Set(values)].filter((v) => values.filter((x) => x === v).length >= 2);
  return winners.length === 1 ? winners[0] : null;
}

function minorityOf(values: number[]): number | null {
  const singles = [...new Set(values)].filter((v) => values.filter((x) => x === v).length === 1);
  return singles.length === 1 ? singles[0] : null;
}

function formatDivision(quotient: number, remainder: number): string {
  return `${quotient} ост. ${remainder}`;
}

const DIVISION_SHORTCUTS: ((choices: string[]) => string | null)[] = [
  (choices) => {
    const parsed2 = choices.map(parseDivisionOption);
    const q = majorityOf(parsed2.map((p) => p.quotient));
    const r = majorityOf(parsed2.map((p) => p.remainder));
    if (q === null || r === null) return null;
    const guess = formatDivision(q, r);
    return choices.includes(guess) ? guess : null;
  },
  (choices) => {
    const parsed2 = choices.map(parseDivisionOption);
    const q = minorityOf(parsed2.map((p) => p.quotient));
    if (q === null) return null;
    return choices[parsed2.findIndex((p) => p.quotient === q)];
  },
  (choices) => {
    const parsed2 = choices.map(parseDivisionOption);
    const r = minorityOf(parsed2.map((p) => p.remainder));
    if (r === null) return null;
    return choices[parsed2.findIndex((p) => p.remainder === r)];
  },
];

function bestShortcutSolveRate(tasksOptions: { correct: string; options: string[] }[]): number {
  let best = 0;
  for (const shortcut of DIVISION_SHORTCUTS) {
    const solved = tasksOptions.filter((t) => shortcut(t.options) === t.correct).length;
    best = Math.max(best, solved);
  }
  return best;
}

/** Валидные (не роняющие частное ниже 1) схемы для пары (a,b). */
function validSchemeIndices(a: number, b: number): number[] {
  const quotient = Math.floor(a / b);
  return DIVISION_DECOY_SCHEMES.map((scheme, idx) => (scheme.some(([dq]) => quotient + dq < 1) ? -1 : idx)).filter((i) => i >= 0);
}

function optionsForScheme(a: number, b: number, schemeIdx: number): { correct: string; options: string[] } | null {
  const quotient = Math.floor(a / b);
  const remainder = a % b;
  const correct = formatDivision(quotient, remainder);
  const scheme = DIVISION_DECOY_SCHEMES[schemeIdx];
  const options = [correct, ...scheme.map(([dq, dr]) => formatDivision(quotient + dq, ((remainder + dr) % b + b) % b))];
  if (new Set(options).size !== 3) return null;
  return { correct, options };
}

test('[statistical] division structural shortcuts (majority/odd-one-out) are not exploitable beyond random scheme choice', () => {
  const rng = mulberry32(220260909);
  const report: { group: string; G: number; observedSolved: number; percentile: number }[] = [];
  let checked = 0;

  for (const group of Object.values(parsed.groups)) {
    const divTasks = group.taskIds.map((id) => parsed.tasks[id]).filter((t) => t.typeId === 'number_divide_remainder');
    if (divTasks.length < 2) continue;
    checked++;

    const observed = divTasks.map((t) => ({ correct: t.correctAnswer as string, options: t.choices as string[] }));
    const observedSolved = bestShortcutSolveRate(observed);

    // (a,b) пары восстанавливаются из params — нужны для перебора валидных схем в нулевой модели.
    const pairs = divTasks.map((t) => (t.params as { a: number; b: number }));

    const percentile = percentileAtLeastAsExploitable(
      observedSolved,
      () => {
        const randomized = pairs.map(({ a, b }) => {
          const valid = validSchemeIndices(a, b);
          let picked: { correct: string; options: string[] } | null = null;
          while (!picked) {
            const idx = valid[Math.floor(rng() * valid.length)];
            picked = optionsForScheme(a, b, idx);
          }
          return picked;
        });
        return bestShortcutSolveRate(randomized);
      },
      rng,
    );

    report.push({ group: group.id, G: divTasks.length, observedSolved, percentile });
    assert.ok(
      percentile >= MIN_PERCENTILE,
      `group ${group.id}: лучшая структурная эвристика решает ${observedSolved}/${divTasks.length} — не менее опасный результат лишь в ${(percentile * 100).toFixed(2)}% случайного выбора схемы`,
    );
  }

  assert.ok(checked > 0, 'expected at least one number_divide_remainder group to exist');
  console.log(`[division shortcut audit] checked ${checked} groups, min percentile ${Math.min(...report.map((r) => r.percentile)).toFixed(3)}`);
});

// ─── Ось 3: медиана — «Цифры» и «Кратные» ────────────────────────────────
// Медиана-эвристика не зависит от позиции — нулевая модель рандомизирует
// ВЫБОР ДИСТРАКТОРОВ из того же кандидатного пула, что использует
// реальный генератор (не хэш-based), и считает, как часто медиана трёх
// показанных чисел случайно совпадает с верным ответом.

const DIGIT_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];
const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function medianSolves(correct: number, choices: number[]): boolean {
  const sorted = [...choices].sort((a, b) => a - b);
  return sorted[1] === correct;
}

test('[statistical] "take the median" heuristic is not exploitable beyond random distractor choice, for Цифры and Кратные', () => {
  const rng = mulberry32(320260909);
  const report: { group: string; G: number; observedSolved: number; percentile: number }[] = [];
  let checked = 0;

  for (const group of Object.values(parsed.groups)) {
    const digitTasks = group.taskIds.map((id) => parsed.tasks[id]).filter((t) => t.typeId === 'digit_recognition');
    const multipleTasks = group.taskIds.map((id) => parsed.tasks[id]).filter((t) => t.typeId === 'number_multiple_check');
    const tasks = digitTasks.length > 0 ? digitTasks : multipleTasks;
    if (tasks.length < 4) continue;
    checked++;

    const isDigit = digitTasks.length > 0;
    const observedSolved = tasks.filter((t) => medianSolves(t.correctAnswer as number, t.choices as number[])).length;

    const percentile = percentileAtLeastAsExploitable(
      observedSolved,
      () => {
        let solved = 0;
        for (const t of tasks) {
          const correct = t.correctAnswer as number;
          let candidates: number[];
          if (isDigit) {
            candidates = DIGIT_OFFSET_POOL.map((d) => correct + d).filter((v) => v >= 0 && v <= 9);
          } else {
            const { n } = t.params as { n: number };
            candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
          }
          const idx1 = Math.floor(rng() * candidates.length);
          const d1 = candidates[idx1];
          const rest = candidates.filter((v) => v !== d1);
          const idx2 = Math.floor(rng() * rest.length);
          const d2 = rest[idx2];
          if (medianSolves(correct, [correct, d1, d2])) solved++;
        }
        return solved;
      },
      rng,
    );

    report.push({ group: group.id, G: tasks.length, observedSolved, percentile });
    assert.ok(
      percentile >= MIN_PERCENTILE,
      `group ${group.id}: медиана решает ${observedSolved}/${tasks.length} — не менее опасный результат лишь в ${(percentile * 100).toFixed(2)}% случайного выбора дистракторов`,
    );
  }

  assert.ok(checked > 0, 'expected at least one digit_recognition or number_multiple_check group to exist');
  console.log(`[median audit] checked ${checked} groups, min percentile ${Math.min(...report.map((r) => r.percentile)).toFixed(3)}`);
});

// ─── Ось 4: порядок называния чисел в тексте — «Сравнение» ──────────────
// Нулевая модель рандомизирует, какое из двух чисел называется первым
// (вместо хэш-based), и считает частоту «верный ответ назван первым».

test('[statistical] number naming order in "Сравнение" text is not exploitable beyond random swap', () => {
  const rng = mulberry32(420260909);
  const report: { group: string; G: number; observedFreq: number; percentile: number }[] = [];
  let checked = 0;

  for (const group of Object.values(parsed.groups)) {
    const tasks = group.taskIds.map((id) => parsed.tasks[id]).filter((t) => t.typeId === 'number_compare');
    if (tasks.length < 4) continue;
    checked++;

    const observedFlags = tasks.map((t) => {
      const match = /: (-?\d+) или (-?\d+)\?/.exec(t.text);
      if (!match) throw new Error(`unparseable comparison text: ${t.text}`);
      return Number(match[1]) === Number(t.correctAnswer) ? 1 : 0;
    });
    const observedFreq = maxFrequency(observedFlags);

    const percentile = percentileAtLeastAsExploitable(
      observedFreq,
      () => {
        const randomFlags = tasks.map(() => (rng() < 0.5 ? 1 : 0));
        return maxFrequency(randomFlags);
      },
      rng,
    );

    report.push({ group: group.id, G: tasks.length, observedFreq, percentile });
    assert.ok(
      percentile >= MIN_PERCENTILE,
      `group ${group.id}: верный ответ называется первым/вторым с частотой ${observedFreq}/${tasks.length} — не менее опасный результат лишь в ${(percentile * 100).toFixed(2)}% случайного порядка слов`,
    );
  }

  assert.ok(checked > 0, 'expected at least one number_compare group to exist');
  console.log(`[text-order audit] checked ${checked} groups, min percentile ${Math.min(...report.map((r) => r.percentile)).toFixed(3)}`);
});
