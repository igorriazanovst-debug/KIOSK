// Инварианты волны 1 (K5_контент_план §2): блок n-b2
// «Русский язык с методикой преподавания».
// Точные целевые счётчики K0 появляются по мере волн: после волны 1 блок
// n-b2 обязан иметь 28 заданий (по 4 каждого из 7 типов), 20 вопросов банка
// (уровни 7/7/6) и 5 игр (по одной каждого из 5 типов ТЗ), все
// атрибутированные блоку. Блоки n-b3…n-b5 и дошкольное закрываются своими
// волнами - здесь не проверяются.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EumkContentSchema } from '../model/schema.ts';

import type { EumkTask } from '../model/schema.ts';

const nach = EumkContentSchema.parse(JSON.parse(readFileSync(new URL('./nach.content.json', import.meta.url), 'utf8')));
const byType = <T extends EumkTask['type']>(type: T) =>
  nach.tasks.filter((t): t is Extract<EumkTask, { type: T }> => t.type === type && t.block === BLOCK);

const BLOCK = 'n-b2';
const TASK_TARGET = 28; // 7 типов x 4
const TASKS_PER_TYPE = 4;
const BANK_TARGET = 20; // уровни 7/7/6
const GAME_TARGET = 5;  // 5 типов ТЗ, по одному на блок

test('волна 2: блок n-b2 - заданий ровно 28, по 4 каждого типа', () => {
  const tasks = nach.tasks.filter((t) => t.block === BLOCK);
  assert.equal(tasks.length, TASK_TARGET, `сейчас ${tasks.length}`);
  const byType = new Map<string, number>();
  for (const t of tasks) byType.set(t.type, (byType.get(t.type) ?? 0) + 1);
  for (const [type, n] of byType) {
    assert.equal(n, TASKS_PER_TYPE, `тип ${type}: ${n} заданий вместо ${TASKS_PER_TYPE}`);
  }
  assert.equal(byType.size, 7, 'в блоке представлены не все 7 типов');
});

test('волна 2: блок n-b2 - задания распределены по всем 5 разделам теории', () => {
  const sections = new Set(nach.theory.find((b) => b.id === BLOCK)!.sections.map((s) => s.id));
  const used = new Set(nach.tasks.filter((t) => t.block === BLOCK).map((t) => t.section));
  assert.deepEqual([...used].filter((s) => !sections.has(s)), [], 'задания вне разделов блока');
  assert.equal(used.size, sections.size, `задания покрывают ${used.size} из ${sections.size} разделов`);
});

test('волна 2: блок n-b2 - 20 вопросов банка с уровнями 7/7/6', () => {
  const bank = nach.bank.filter((q) => q.block === BLOCK);
  assert.equal(bank.length, BANK_TARGET, `сейчас ${bank.length}`);
  const levels = { знание: 0, понимание: 0, применение: 0 } as Record<string, number>;
  for (const q of bank) levels[q.level]++;
  assert.deepEqual(levels, { знание: 7, понимание: 7, применение: 6 }, `уровни: ${JSON.stringify(levels)}`);
});

test('волна 2: блок n-b2 - 5 игр, по одной каждого типа из ТЗ, все атрибутированы', () => {
  const games = nach.games.filter((g) => g.block === BLOCK);
  assert.equal(games.length, GAME_TARGET, `сейчас ${games.length}`);
  const types = new Set(games.map((g) => g.type));
  assert.deepEqual([...types].sort(), ['attention', 'costume', 'logic', 'observation', 'syllables']);
  // Затравка блока - одна из базовых игр (ng-*), остальные - новые пулы n1-*.
  assert.equal(games.filter((g) => g.id.startsWith('n2-')).length, GAME_TARGET - 1);
  assert.equal(games.filter((g) => g.id.startsWith('ng-')).length, 1);
});

test('волна 2: инварианты позиций в новых choice-заданиях n-b2 (H1-H3 в блоке)', () => {
  const positions = byType('choice').map((t) => t.data.correct[0]);
  assert.ok(positions.length >= 4);
  assert.ok(new Set(positions).size >= 3, `позиции не разнообразны: ${positions}`);
  const counts = new Map<number, number>();
  for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1);
  assert.ok(Math.max(...counts.values()) / positions.length <= 0.5, `одна позиция > половины: ${positions}`);
});

test('волна 2: multi-наборы n-b2 - без интервалов и без сверхчастых индексов', () => {
  const sets = byType('multi').map((t) => [...t.data.correct].sort((a, b) => a - b));
  assert.ok(sets.length >= 4);
  for (const s of sets) {
    const interval = s.every((v, i) => v === s[0] + i);
    assert.ok(!interval, `набор ${s} - непрерывный кусок списка`);
  }
  const width = Math.max(...byType('multi').map((t) => t.data.options.length));
  for (let i = 0; i < width; i++) {
    const share = sets.filter((s) => s.includes(i)).length / sets.length;
    assert.ok(share <= 0.75, `индекс ${i} верен в ${Math.round(share * 100)}% наборов n-b2`);
  }
});
