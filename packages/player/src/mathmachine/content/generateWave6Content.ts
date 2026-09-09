// Offline-генератор контента Этапа 2b, волна 6 — количественное
// расширение (согласовано с пользователем: продолжение прогрессий,
// начатых предыдущими волнами — «Кратные»/«Деление» на новые делители,
// «Состав числа»/«Доли целого» на большие числа, «Порядковые
// числительные» на более длинный ряд, «Сложение трёх чисел» на больший
// диапазон, впервые с Этапа 1). Ни одного нового TaskTypeId — только
// новые диапазоны/темы для уже существующих типов, поэтому schema.ts/
// taskEngine.ts/TaskVisual.tsx/TaskRunner.tsx не трогаются вовсе (тот же
// принцип, что и в волнах 4-5).
//
// Из 6 тем только 2 — choice-режима («Кратные», «Деление») и поэтому
// нуждаются в батарее инвариантов позиции кнопки; остальные 4 —
// numeric-режим, для них экплойт через позицию кнопки структурно
// невозможен (ответ вводится с клавиатуры/ленты цифр).

import type { MathMachineContent, Task } from '@kiosk/shared';
import {
  buildGroup,
  rotate,
  contentHash,
  mergeWaveIntoContent,
  divideTask as sharedDivideTask,
  type GroupSpec,
  type TopicSpec,
} from './generatorShared.ts';

export type { GroupSpec, TopicSpec };

// ─── Сложение трёх чисел: числа до 20 (16 заданий: 8 + 8) ────────────────
// Этап 1 покрыл только суммы ≤7. Numeric-режим — экплойт через позицию
// кнопки структурно невозможен.

function sumThreeTask(a: number, b: number, c: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_sum_three',
    text: `Сколько будет ${a} плюс ${b} плюс ${c}?`,
    params: { a, b, c },
    correctAnswer: a + b + c,
  };
}

function buildSumThreeWideTopic(): TopicSpec {
  const low = buildGroup(
    'sum3_low',
    'Сумма трёх чисел: 8-15',
    Array.from({ length: 8 }, (_, i) => sumThreeTask(2 + i, 3, 3)),
  );
  const high = buildGroup(
    'sum3_high',
    'Сумма трёх чисел: 13-20',
    Array.from({ length: 8 }, (_, i) => sumThreeTask(3 + i, 4, 6)),
  );
  return { id: 'top_addition_three_wide', name: 'Сложение трёх чисел: числа до 20', groups: [low, high] };
}

// ─── Кратные: 11-15 (20 заданий: 8 + 12) ─────────────────────────────────
// Волна 5 покрыла 6-10. Тот же приём (хэш содержания для выбора
// дистракторов и позиции) — для n≥11 ни один из смещений ±1..±3 сам не
// кратен n, поэтому фильтрация дистракторов никогда не сужает пул.

const MULTIPLE_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function multipleTask(n: number, k: number): Omit<Task, 'id'> {
  const correct = n * k;
  const candidates = MULTIPLE_OFFSET_POOL.map((d) => correct + d).filter((v) => v > 0 && v % n !== 0);
  const idx1 = contentHash('w6-mult-d1-0', [n, k]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w6-mult-d2-5', [n, k, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w6-mult-position-1', [n, k]);
  const choices = rotate([correct, d1, d2], posShift);
  return {
    typeId: 'number_multiple_check',
    text: `Какое из чисел делится на ${n} без остатка?`,
    params: { n, options: choices },
    correctAnswer: correct,
    choices,
  };
}

function buildMultiplesWide2Topic(): TopicSpec {
  const tasks1112: Omit<Task, 'id'>[] = [];
  [11, 12].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks1112.push(multipleTask(n, k));
  });
  const group1112 = buildGroup('kratn3_1112', 'Кратные 11 и 12', tasks1112);

  const tasks131415: Omit<Task, 'id'>[] = [];
  [13, 14, 15].forEach((n) => {
    for (let k = 2; k <= 5; k++) tasks131415.push(multipleTask(n, k));
  });
  const group131415 = buildGroup('kratn3_131415', 'Кратные 13, 14 и 15', tasks131415);

  return { id: 'top_multiples_3', name: 'Кратные: 11-15', groups: [group1112, group131415] };
}

// ─── Деление: делители 11 и 12 (16 заданий: 8 + 8) ───────────────────────
// Волна 3 покрыла делители 2-10. Все пары — частное ≥2 (требование
// `divideTask`'s decoy-схемы, минимальная дельта -1).

function divideTask(a: number, b: number): Omit<Task, 'id'> {
  return sharedDivideTask(a, b, 'w6-div-scheme-0', 'w6-div-position-8');
}

const DIVISION_PAIRS_11: [number, number][] = [
  [23, 11], [29, 11], [35, 11], [43, 11],
  [48, 11], [56, 11], [61, 11], [68, 11],
];
const DIVISION_PAIRS_12: [number, number][] = [
  [26, 12], [31, 12], [38, 12], [44, 12],
  [51, 12], [59, 12], [64, 12], [70, 12],
];

function buildDivisionWideTopic(): TopicSpec {
  const group11 = buildGroup('div3_11', 'Деление на 11', DIVISION_PAIRS_11.map(([a, b]) => divideTask(a, b)));
  const group12 = buildGroup('div3_12', 'Деление на 12', DIVISION_PAIRS_12.map(([a, b]) => divideTask(a, b)));
  return { id: 'top_division_1112', name: 'Деление: делители 11 и 12', groups: [group11, group12] };
}

// ─── Порядковые числительные: ряд из 10 чисел (16 заданий: 8 + 8) ────────
// Волна 5 углубила до 8-9. Серии строятся формулой (не перебором вручную
// написанных массивов): для длины 10 и шага, взаимно простого с 10
// (3, 7, 9 или 1), отображение j -> (j*step) mod 10 — биекция на
// 0..9, поэтому base + это отображение всегда даёт 10 ПОПАРНО РАЗНЫХ
// чисел без риска опечатки при ручном наборе.

const ORDINAL10_COPRIME_STEPS = [3, 7, 9, 1];

function buildOrdinalSeries10(i: number): number[] {
  const base = 1 + i * 2;
  const step = ORDINAL10_COPRIME_STEPS[i % ORDINAL10_COPRIME_STEPS.length];
  return Array.from({ length: 10 }, (_, j) => base + ((j * step) % 10));
}

function ordinalTask(series: number[], position: number): Omit<Task, 'id'> {
  return {
    typeId: 'ordinal_position',
    text: `Какое число стоит на ${position}-м месте: ${series.join(', ')}?`,
    params: { series, position },
    correctAnswer: series[position - 1],
  };
}

function buildOrdinalWide3Topic(): TopicSpec {
  const firstHalf = buildGroup(
    'ordpos4_low',
    'Позиции 1-5',
    Array.from({ length: 8 }, (_, i) => ordinalTask(buildOrdinalSeries10(i), (i % 5) + 1)),
  );
  const secondHalf = buildGroup(
    'ordpos4_high',
    'Позиции 6-10',
    Array.from({ length: 8 }, (_, i) => ordinalTask(buildOrdinalSeries10(i + 8), (i % 5) + 6)),
  );
  return { id: 'top_ordinal_4', name: 'Порядковые числительные: ряд из 10 чисел', groups: [firstHalf, secondHalf] };
}

// ─── Доли целого: половина и четверть больших чисел (16 заданий: 8 + 8) ──
// Волна 3 покрыла половину (тоталы 4-30) и четверть (тоталы 8-36).
// Здесь — тоталы 40-68, впервые оба знаменателя делят одни и те же
// числа (40, 44, ... кратны 4, значит кратны и 2). Numeric-режим.

function shareTask(total: number, parts: 2 | 4): Omit<Task, 'id'> {
  const word = parts === 2 ? 'на две части' : 'на четыре части';
  return {
    typeId: 'share_of_whole',
    text: `У Матвея ${total} яблок. Он разделил их поровну ${word} — сколько досталось на одну часть?`,
    params: { total, parts },
    correctAnswer: total / parts,
  };
}

const SHARE_WIDE_TOTALS = [40, 44, 48, 52, 56, 60, 64, 68];

function buildShareWideTopic(): TopicSpec {
  const half = buildGroup('share2_half', 'Половина больших чисел', SHARE_WIDE_TOTALS.map((total) => shareTask(total, 2)));
  const quarter = buildGroup('share2_quarter', 'Четверть больших чисел', SHARE_WIDE_TOTALS.map((total) => shareTask(total, 4)));
  return { id: 'top_shares_2', name: 'Доли целого: половина и четверть больших чисел', groups: [half, quarter] };
}

// ─── Состав числа: числа 21-30 (20 заданий: 10 + 10) ─────────────────────
// Волна 1 покрыла до 10, волна 5 — 11-20. Та же структура крайних
// разложений («1 и остальное» / «остальное и 1»).

function compositionTask(whole: number, knownPart: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_composition',
    text: `${whole} = ${knownPart} + ?`,
    params: { whole, knownPart },
    correctAnswer: whole - knownPart,
  };
}

function buildCompositionWide2Topic(): TopicSpec {
  const low: Omit<Task, 'id'>[] = [];
  for (let whole = 21; whole <= 25; whole++) {
    low.push(compositionTask(whole, 1));
    low.push(compositionTask(whole, whole - 1));
  }
  const upTo25 = buildGroup('comp3_25', 'Состав чисел 21-25', low);

  const high: Omit<Task, 'id'>[] = [];
  for (let whole = 26; whole <= 30; whole++) {
    high.push(compositionTask(whole, 1));
    high.push(compositionTask(whole, whole - 1));
  }
  const upTo30 = buildGroup('comp3_30', 'Состав чисел 26-30', high);

  return { id: 'top_composition_3', name: 'Состав числа: числа 21-30', groups: [upTo25, upTo30] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE6_TOPICS: TopicSpec[] = [
  buildSumThreeWideTopic(),
  buildMultiplesWide2Topic(),
  buildDivisionWideTopic(),
  buildOrdinalWide3Topic(),
  buildShareWideTopic(),
  buildCompositionWide2Topic(),
];

export function countWave6Tasks(): number {
  return WAVE6_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE6_TOPICS, ARITHMETIC_SECTION_ID);
}
