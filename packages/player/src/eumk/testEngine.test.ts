import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from './rng.ts';
import { buildTest, signatureOf, gradeForShare, scoreTest, formatDuration, type BuiltTest } from './testEngine.ts';
import type { BankQuestion, GradeScale } from './model/schema.ts';

const SCALE: GradeScale = { five: 0.9, four: 0.75, three: 0.5 };

function makeBank(perBlock: number, blocks = 5): BankQuestion[] {
  const bank: BankQuestion[] = [];
  for (let b = 1; b <= blocks; b++) {
    for (let i = 1; i <= perBlock; i++) {
      bank.push({
        id: `q-${b}-${i}`, block: `b${b}`, section: '', level: 'знание', question: `Вопрос ${b}.${i}`,
        options: ['A', 'B', 'C', 'D'], answer: (b + i) % 4, explanation: '', sources: [],
      });
    }
  }
  return bank;
}

test('buildTest returns the requested number of distinct questions', () => {
  const t = buildTest({ bank: makeBank(10), count: 20, rng: seededRng(1), previousSignatures: [] });
  assert.equal(t.questions.length, 20);
  assert.equal(new Set(t.questions.map((q) => q.id)).size, 20);
});

test('buildTest clamps count to the bank size', () => {
  const t = buildTest({ bank: makeBank(2, 2), count: 50, rng: seededRng(1), previousSignatures: [] });
  assert.equal(t.questions.length, 4);
});

test('buildTest covers every block when count allows', () => {
  const t = buildTest({ bank: makeBank(10), count: 20, rng: seededRng(3), previousSignatures: [] });
  const blocks = new Set(t.questions.map((q) => q.block));
  assert.equal(blocks.size, 5);
});

test('buildTest spreads questions across blocks roughly evenly', () => {
  const t = buildTest({ bank: makeBank(10), count: 20, rng: seededRng(5), previousSignatures: [] });
  const counts = new Map<string, number>();
  for (const q of t.questions) counts.set(q.block, (counts.get(q.block) ?? 0) + 1);
  for (const n of counts.values()) assert.equal(n, 4);
});

test('buildTest never repeats a previously issued combination', () => {
  const bank = makeBank(4, 2); // 8 вопросов, тест из 2 по одному из блока -> 16 комбинаций
  const issued: string[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const t = buildTest({ bank, count: 2, rng: seededRng(seed), previousSignatures: issued });
    assert.ok(!issued.includes(t.signature), `signature ${t.signature} already issued`);
    issued.push(t.signature);
  }
});

test('buildTest still returns a test when every combination was used', () => {
  const bank = makeBank(1, 2); // 2 вопроса, тест из 2: единственная комбинация
  const first = buildTest({ bank, count: 2, rng: seededRng(1), previousSignatures: [] });
  const second = buildTest({ bank, count: 2, rng: seededRng(2), previousSignatures: [first.signature] });
  assert.equal(second.questions.length, 2);
});

test('buildTest shuffles answer options and tracks the correct position', () => {
  const t = buildTest({ bank: makeBank(10), count: 20, rng: seededRng(11), previousSignatures: [] });
  for (const q of t.questions) {
    assert.equal(q.options.length, 4);
    assert.deepEqual([...q.optionOrder].sort(), [0, 1, 2, 3]);
    const original = makeBank(10).find((b) => b.id === q.id)!;
    assert.equal(q.options[q.correctPosition], original.options[original.answer]);
  }
});

test('buildTest spreads the correct answer over all positions', () => {
  const positions = new Set<number>();
  for (let seed = 1; seed <= 10; seed++) {
    const t = buildTest({ bank: makeBank(10), count: 20, rng: seededRng(seed), previousSignatures: [] });
    for (const q of t.questions) positions.add(q.correctPosition);
  }
  assert.equal(positions.size, 4);
});

test('signatureOf does not depend on question order', () => {
  assert.equal(signatureOf(['b', 'a', 'c']), signatureOf(['c', 'a', 'b']));
});

test('gradeForShare maps shares to marks on the scale boundaries', () => {
  assert.equal(gradeForShare(1, SCALE), 5);
  assert.equal(gradeForShare(0.9, SCALE), 5);
  assert.equal(gradeForShare(0.89, SCALE), 4);
  assert.equal(gradeForShare(0.75, SCALE), 4);
  assert.equal(gradeForShare(0.74, SCALE), 3);
  assert.equal(gradeForShare(0.5, SCALE), 3);
  assert.equal(gradeForShare(0.49, SCALE), 2);
  assert.equal(gradeForShare(0, SCALE), 2);
});

test('scoreTest counts correct answers by visible position and builds the report', () => {
  const t: BuiltTest = buildTest({ bank: makeBank(10), count: 10, rng: seededRng(2), previousSignatures: [] });
  const answers: Record<string, number | null> = {};
  t.questions.forEach((q, i) => { answers[q.id] = i < 8 ? q.correctPosition : (q.correctPosition + 1) % 4; });
  const report = scoreTest(t, answers, SCALE, 125);
  assert.equal(report.correct, 8);
  assert.equal(report.total, 10);
  assert.equal(report.grade, 4);
  assert.equal(report.durationSeconds, 125);
  assert.equal(report.items.filter((i) => i.isCorrect).length, 8);
});

test('scoreTest treats a missing answer as wrong', () => {
  const t = buildTest({ bank: makeBank(10), count: 5, rng: seededRng(4), previousSignatures: [] });
  const report = scoreTest(t, {}, SCALE, 10);
  assert.equal(report.correct, 0);
  assert.equal(report.grade, 2);
  assert.ok(report.items.every((i) => i.chosenPosition === null));
});

test('scoreTest reports per-block results', () => {
  const t = buildTest({ bank: makeBank(10), count: 20, rng: seededRng(8), previousSignatures: [] });
  const answers: Record<string, number | null> = {};
  for (const q of t.questions) answers[q.id] = q.correctPosition;
  const report = scoreTest(t, answers, SCALE, 60);
  assert.equal(report.byBlock.length, 5);
  assert.ok(report.byBlock.every((b) => b.correct === b.total));
});

test('formatDuration renders minutes and seconds', () => {
  assert.equal(formatDuration(0), '0 мин 00 с');
  assert.equal(formatDuration(65), '1 мин 05 с');
  assert.equal(formatDuration(3725), '62 мин 05 с');
});
