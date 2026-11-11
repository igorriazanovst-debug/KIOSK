// Инварианты волны 6 (K5_контент_план §2): блок d-b1 «Теоретические основы
// организации обучения в разных возрастных группах» (дошкольное образование).
// Цели K0 для дошкольного: 25 заданий на блок (4+4+4+4+3+3+3 по семи типам,
// план §1.5), 25 вопросов (уровни 8/8/9). Игры дошкольного не поблочные —
// здесь не проверяются. Блоки d-b2…d-b4 закрываются волнами 7–9.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EumkContentSchema, type EumkTask } from '../model/schema.ts';

const dosh = EumkContentSchema.parse(JSON.parse(readFileSync(new URL('./dosh.content.json', import.meta.url), 'utf8')));
const BLOCK = 'd-b1';
const byType = <T extends EumkTask['type']>(type: T) =>
  dosh.tasks.filter((t): t is Extract<EumkTask, { type: T }> => t.type === type && t.block === BLOCK);

test('волна 6: блок d-b1 - заданий ровно 25, раскладка 4/4/4/4/3/3/3', () => {
  const tasks = dosh.tasks.filter((t) => t.block === BLOCK);
  assert.equal(tasks.length, 25, `сейчас ${tasks.length}`);
  const expected: Record<string, number> = { choice: 4, multi: 4, order: 4, sort: 4, match: 3, gaps: 3, input: 3 };
  const actual: Record<string, number> = {};
  for (const t of tasks) actual[t.type] = (actual[t.type] ?? 0) + 1;
  assert.deepEqual(actual, expected, `раскладка типов: ${JSON.stringify(actual)}`);
});

test('волна 6: задания d-b1 покрывают все разделы теории', () => {
  const sections = new Set(dosh.theory.find((b) => b.id === BLOCK)!.sections.map((s) => s.id));
  const used = new Set(dosh.tasks.filter((t) => t.block === BLOCK).map((t) => t.section));
  assert.equal(used.size, sections.size);
  assert.deepEqual([...used].filter((s) => !sections.has(s)), []);
});

test('волна 6: блок d-b1 - 25 вопросов с уровнями 8/8/9', () => {
  const bank = dosh.bank.filter((q) => q.block === BLOCK);
  assert.equal(bank.length, 25, `сейчас ${bank.length}`);
  const levels = { знание: 0, понимание: 0, применение: 0 } as Record<string, number>;
  for (const q of bank) levels[q.level]++;
  assert.deepEqual(levels, { знание: 8, понимание: 8, применение: 9 });
});

test('волна 6: позиции choice-заданий d-b1 разнообразны (H1)', () => {
  const positions = byType('choice').map((t) => t.data.correct[0]);
  assert.equal(positions.length, 4);
  assert.ok(new Set(positions).size >= 3, `позиции: ${positions}`);
  for (const p of new Set(positions)) {
    const n = positions.filter((x) => x === p).length;
    assert.ok(n <= 2, `позиция ${p} встречается ${n} раз`);
  }
});

test('волна 6: multi-наборы d-b1 без интервалов и сверхчастых индексов (H9)', () => {
  const sets = byType('multi').map((t) => [...t.data.correct].sort((a, b) => a - b));
  assert.equal(sets.length, 4);
  for (const s of sets) assert.ok(!s.every((v, i) => v === s[0] + i), `интервал: ${s}`);
  const width = Math.max(...byType('multi').map((t) => t.data.options.length));
  for (let i = 0; i < width; i++) {
    const share: number = sets.filter((s) => s.includes(i)).length / sets.length;
    assert.ok(share <= 0.75, `индекс ${i}: ${Math.round(share * 100)}%`);
  }
});
