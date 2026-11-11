import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEumkContent, type EumkContent } from '../model/schema.ts';

function load(name: string): EumkContent {
  const url = new URL(`./${name}.content.json`, import.meta.url);
  return parseEumkContent(JSON.parse(readFileSync(url, 'utf8')));
}

const nach = load('nach');
const dosh = load('dosh');

// Минимумы из ТЗ (закупка ГБПОУ КО «Педагогический колледж»).
test('primary: meets the minimums of the specification', () => {
  assert.ok(nach.theory.length >= 5, 'блоков теории');
  assert.ok(nach.bank.length >= 76, 'вопросов в банке');
  assert.ok(nach.tasks.length >= 28, 'заданий');
  assert.ok(nach.games.length >= 5, 'игр');
});

test('preschool: meets the minimums of the specification', () => {
  assert.equal(dosh.theory.length, 4);
  assert.ok(dosh.bank.length >= 48, 'вопросов в банке');
  assert.ok(dosh.tasks.length >= 20, 'заданий');
  assert.ok(dosh.games.length >= 4, 'игр');
  assert.ok(dosh.cases.length >= 5, 'кейсов');
});

test('both complexes have the three kinds of reference materials', () => {
  for (const c of [nach, dosh]) {
    assert.ok(c.references.normative.length > 0);
    assert.ok(c.references.literature.length > 0);
    assert.ok(c.references.terms.length > 0);
  }
});

test('the test is shorter than the bank, so every attempt is a real selection', () => {
  for (const c of [nach, dosh]) assert.ok(c.test.questionCount < c.bank.length);
});

test('the primary games cover exactly the five topics named in the specification', () => {
  // С волнами K5 число игр растёт (5 типов x 5 блоков), но множество тем
  // остаётся ровно теми пятью, что названы в ТЗ.
  assert.deepEqual(
    [...new Set(nach.games.map((g) => g.type))].sort(),
    ['attention', 'costume', 'logic', 'observation', 'syllables'],
  );
});

test('every bank question belongs to a theory block', () => {
  for (const c of [nach, dosh]) {
    const blocks = new Set(c.theory.map((b) => b.id));
    assert.ok(c.bank.every((q) => blocks.has(q.block)));
  }
});

test('every theory block is represented in the bank', () => {
  for (const c of [nach, dosh]) {
    const used = new Set(c.bank.map((q) => q.block));
    assert.ok(c.theory.every((b) => used.has(b.id)), 'есть блок без вопросов');
  }
});

test('the correct option is not systematically the longest one', () => {
  for (const c of [nach, dosh]) {
    const longest = c.bank.filter((q) => {
      const lengths = q.options.map((o) => o.length);
      return lengths[q.answer] === Math.max(...lengths) && lengths.filter((l) => l === lengths[q.answer]).length === 1;
    }).length;
    assert.ok(longest / c.bank.length < 0.35, `верный самый длинный в ${longest} из ${c.bank.length}`);
  }
});

test('the correct option is spread evenly over the four positions', () => {
  for (const c of [nach, dosh]) {
    const counts = [0, 0, 0, 0];
    for (const q of c.bank) counts[q.answer]++;
    const expected = c.bank.length / 4;
    assert.ok(counts.every((n) => Math.abs(n - expected) <= 2), `позиции: ${counts.join('/')}`);
  }
});
