// Offline-генератор контента Этапа 2b, волна 1 (спека
// docs/superpowers/specs/2026-09-08-mathmachine-content-pipeline-design.md,
// разд. 1-2). Чистые функции без побочных эффектов — файловый ввод-вывод
// в отдельном runGenerateWave1.ts. Перечисление детерминировано (без RNG) —
// для конечных арифметических диапазонов это проще и надёжнее случайной
// генерации: результат воспроизводим построчным чтением кода.
//
// Переделка Эпика 12 (2026-09-09, реставрация): позиция правильного ответа
// в choice-группах теперь выводится из ХЭША СОДЕРЖАНИЯ задания (params),
// а не из индекса задания внутри группы — иначе позиция образует
// тривиальный цикл, предсказуемый без чтения условия. Тем же приёмом
// устранены находки этой волны: (1) «Сравнение» называло числа в тексте
// вопроса строго по возрастанию независимо от того, что спрашивается —
// эвристика по самому тексту вопроса решала группу на 100%, не только по
// позиции кнопки; (2) «Цифры» — дистракторы target±1 всегда делали
// правильный ответ медианой трёх показанных чисел; (3) «Упорядочение» —
// ряд всегда строился по возрастанию, поэтому минимум/максимум всегда
// стоял на одном и том же (первом/последнем) месте.
//
// Рефакторинг дублирования (2026-09-09): buildGroup/rotate/contentHash/
// mergeIntoContent раньше дублировались по себе в каждой из трёх волн
// (осознанное решение спеки волны 2, разд. 3 — «каждый скрипт волны
// самодостаточен» — но при переделке Эпика 12 правки приходилось вносить
// в 2-3 местах одновременно, см. Тип6_бэклог.md). Вынесены в
// generatorShared.ts — только чистая инфраструктура, сама волна (какие
// задания/темы/диапазоны) остаётся здесь.

import type { MathMachineContent, Task } from '@kiosk/shared';
import { buildGroup, rotate, contentHash, mergeWaveIntoContent, type GroupSpec, type TopicSpec } from './generatorShared.ts';

export type { GroupSpec, TopicSpec };

// ─── Вычитание (17 заданий: 9 + 8) ────────────────────────────────────

function subtractTask(a: number, b: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_subtract_two',
    text: `Сколько будет ${a} минус ${b}?`,
    params: { a, b },
    correctAnswer: a - b,
  };
}

function buildSubtractionTopic(): TopicSpec {
  const minus1 = buildGroup(
    'sub_b1',
    'Вычесть 1',
    Array.from({ length: 9 }, (_, i) => subtractTask(i + 2, 1)),
  );
  const minus2 = buildGroup(
    'sub_b2',
    'Вычесть 2',
    Array.from({ length: 8 }, (_, i) => subtractTask(i + 3, 2)),
  );
  return { id: 'top_subtraction', name: 'Вычитание', groups: [minus1, minus2] };
}

// ─── Сравнение (17 заданий: 9 + 8) ─────────────────────────────────────
// direction: 1 = спрашиваем "меньше" (ищем минимум); 0 = "больше" (максимум).
// Порядок называния чисел в тексте вопроса и позиция кнопки — две
// НЕЗАВИСИМЫЕ оси, каждая со своей солью, чтобы одна не выводилась из
// другой.

function numberCompareTask(a: number, b: number, direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'меньше' : 'больше';
  const correct = direction === 1 ? Math.min(a, b) : Math.max(a, b);
  const nameSwapped = contentHash('w1-cmp-text-order-1', [a, b, direction]) % 2 === 1;
  const [first, second] = nameSwapped ? [b, a] : [a, b];
  const posShift = contentHash('w1-cmp-position-46', [a, b, direction]);
  const choices = rotate([a, b], posShift);
  return {
    typeId: 'number_compare',
    text: `Какое число ${question}: ${first} или ${second}?`,
    params: { a, b, direction },
    correctAnswer: correct,
    choices,
  };
}

function buildComparisonTopic(): TopicSpec {
  const askBigger = buildGroup(
    'cmp_next',
    'Сравнение соседних чисел',
    Array.from({ length: 9 }, (_, i) => numberCompareTask(i + 1, i + 2, 0)),
  );
  const askSmaller = buildGroup(
    'cmp_gap',
    'Сравнение через число',
    Array.from({ length: 8 }, (_, i) => numberCompareTask(i + 1, i + 3, 1)),
  );
  return { id: 'top_comparison', name: 'Сравнение чисел', groups: [askBigger, askSmaller] };
}

// ─── Цифры (10 заданий) ────────────────────────────────────────────────
// Дистракторы больше не всегда target±1 (что делало target медианой трёх
// показанных чисел) — выбираются хэшем из более широкого пула смещений,
// так что target не всегда оказывается серединой при сортировке.

const DIGIT_OFFSET_POOL = [-3, -2, -1, 1, 2, 3];

function digitTask(target: number): Omit<Task, 'id'> {
  const candidates = DIGIT_OFFSET_POOL.map((d) => target + d).filter((v) => v >= 0 && v <= 9);
  const idx1 = contentHash('w1-digit-d1', [target]) % candidates.length;
  const d1 = candidates[idx1];
  const rest = candidates.filter((v) => v !== d1);
  const idx2 = contentHash('w1-digit-d2', [target, d1]) % rest.length;
  const d2 = rest[idx2];
  const posShift = contentHash('w1-digit-position-1', [target]);
  const choices = rotate([target, d1, d2], posShift);
  return {
    typeId: 'digit_recognition',
    text: `Найди цифру ${target}`,
    params: { target },
    correctAnswer: target,
    choices,
  };
}

function buildDigitsTopic(): TopicSpec {
  const group = buildGroup(
    'digit',
    'Учим цифры 0-9',
    Array.from({ length: 10 }, (_, i) => digitTask(i)),
  );
  return { id: 'top_digits', name: 'Цифры', groups: [group] };
}

// ─── Состав числа (20 заданий: 10 + 10) ────────────────────────────────

function compositionTask(whole: number, knownPart: number): Omit<Task, 'id'> {
  return {
    typeId: 'number_composition',
    text: `${whole} = ${knownPart} + ?`,
    params: { whole, knownPart },
    correctAnswer: whole - knownPart,
  };
}

function buildCompositionTopic(): TopicSpec {
  const small: Omit<Task, 'id'>[] = [];
  for (let whole = 2; whole <= 5; whole++) {
    for (let knownPart = 1; knownPart < whole; knownPart++) {
      small.push(compositionTask(whole, knownPart));
    }
  }
  const upTo5 = buildGroup('comp_5', 'Состав чисел до 5', small);

  const bigger: Omit<Task, 'id'>[] = [];
  for (let whole = 6; whole <= 10; whole++) {
    bigger.push(compositionTask(whole, 1));
    bigger.push(compositionTask(whole, whole - 1));
  }
  const upTo10 = buildGroup('comp_10', 'Состав чисел до 10', bigger);

  return { id: 'top_composition', name: 'Состав числа', groups: [upTo5, upTo10] };
}

// ─── Упорядочение (16 заданий: 8 + 8) ──────────────────────────────────
// direction: 1 = ищем наименьшее; 0 = ищем наибольшее. Базовый ряд всегда
// строился по возрастанию, поэтому минимум/максимум стоял на одном и том
// же месте (первом/последнем) во всех заданиях группы — теперь порядок
// показа ряда поворачивается хэшем содержания, независимо от direction.

function orderingTask(baseSeries: number[], direction: 0 | 1): Omit<Task, 'id'> {
  const question = direction === 1 ? 'самое маленькое' : 'самое большое';
  const posShift = contentHash('w1-order-position-12', [...baseSeries, direction]);
  const series = rotate(baseSeries, posShift);
  const correct = direction === 1 ? Math.min(...series) : Math.max(...series);
  return {
    typeId: 'number_ordering',
    text: `Какое число ${question}?`,
    params: { series, direction },
    correctAnswer: correct,
    choices: [...series],
  };
}

function buildOrderingTopic(): TopicSpec {
  const findMin = buildGroup(
    'order_min',
    'Найди наименьшее',
    Array.from({ length: 8 }, (_, i) => orderingTask([i + 1, i + 4, i + 8], 1)),
  );
  const findMax = buildGroup(
    'order_max',
    'Найди наибольшее',
    Array.from({ length: 8 }, (_, i) => orderingTask([i + 1, i + 3, i + 6], 0)),
  );
  return { id: 'top_ordering', name: 'Порядок чисел', groups: [findMin, findMax] };
}

// ─── Сборка ─────────────────────────────────────────────────────────────

export const WAVE1_TOPICS: TopicSpec[] = [
  buildSubtractionTopic(),
  buildComparisonTopic(),
  buildDigitsTopic(),
  buildCompositionTopic(),
  buildOrderingTopic(),
];

export function countWave1Tasks(): number {
  return WAVE1_TOPICS.reduce(
    (sum, topic) => sum + topic.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );
}

const ARITHMETIC_SECTION_ID = 'sec_arithmetic';

export function mergeIntoContent(content: MathMachineContent): MathMachineContent {
  return mergeWaveIntoContent(content, WAVE1_TOPICS, ARITHMETIC_SECTION_ID);
}
