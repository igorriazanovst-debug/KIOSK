import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEpochYearsAgo } from './epochRelative';

test('parseEpochYearsAgo: "65 млн лет назад"', () => {
  const m = parseEpochYearsAgo('65 млн лет назад');
  assert.deepEqual(m, { kind: 'epoch', yearsBeforeEpoch: 65_000_000, precision: 'millionYears', approximate: true });
});

test('parseEpochYearsAgo: "4.5 млрд лет назад" (decimal, dot separator)', () => {
  const m = parseEpochYearsAgo('4.5 млрд лет назад');
  assert.deepEqual(m, { kind: 'epoch', yearsBeforeEpoch: 4_500_000_000, precision: 'billionYears', approximate: true });
});

test('parseEpochYearsAgo: "4,5 млрд лет назад" (decimal, comma separator)', () => {
  const m = parseEpochYearsAgo('4,5 млрд лет назад');
  assert.deepEqual(m, { kind: 'epoch', yearsBeforeEpoch: 4_500_000_000, precision: 'billionYears', approximate: true });
});

test('parseEpochYearsAgo: "300 тысяч лет назад" (spelled-out unit word)', () => {
  const m = parseEpochYearsAgo('300 тысяч лет назад');
  assert.deepEqual(m, { kind: 'epoch', yearsBeforeEpoch: 300_000, precision: 'millennium', approximate: true });
});

test('parseEpochYearsAgo: "2 миллиона лет назад" (spelled-out million)', () => {
  const m = parseEpochYearsAgo('2 миллиона лет назад');
  assert.deepEqual(m, { kind: 'epoch', yearsBeforeEpoch: 2_000_000, precision: 'millionYears', approximate: true });
});

test('parseEpochYearsAgo: "1 миллиард лет назад" (spelled-out billion)', () => {
  const m = parseEpochYearsAgo('1 миллиард лет назад');
  assert.deepEqual(m, { kind: 'epoch', yearsBeforeEpoch: 1_000_000_000, precision: 'billionYears', approximate: true });
});

test('parseEpochYearsAgo: precision comes from the spoken unit word, not the magnitude of the result', () => {
  // "тыс" всегда -> millennium, даже когда названное число тысяч велико -
  // сказано "с точностью до тысячи" в обоих случаях, это и есть точность.
  assert.equal(parseEpochYearsAgo('5 тыс лет назад')!.precision, 'millennium');
  assert.equal(parseEpochYearsAgo('500 тыс лет назад')!.precision, 'millennium');
});

test('parseEpochYearsAgo: without an explicit unit word, is not an epoch match (that is calendar parseYearsAgo\'s job)', () => {
  assert.equal(parseEpochYearsAgo('10 лет назад'), null);
});

test('parseEpochYearsAgo rejects unrelated text', () => {
  assert.equal(parseEpochYearsAgo('бла-бла-бла не дата'), null);
  assert.equal(parseEpochYearsAgo('22.06.1941'), null);
});

test('parseEpochYearsAgo rejects zero/negative magnitudes', () => {
  assert.equal(parseEpochYearsAgo('0 млн лет назад'), null);
});
