import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroup,
  rotate,
  contentHash,
  formatDivision,
  divideTask,
  mergeWaveIntoContent,
  DIVISION_DECOY_SCHEMES,
} from './generatorShared.ts';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';

test('buildGroup names the first task "_intro" and numbers the rest from 1', () => {
  const group = buildGroup('foo', 'Foo Group', [
    { typeId: 'number_sum_two', text: 'a', params: { a: 1, b: 1 }, correctAnswer: 2 },
    { typeId: 'number_sum_two', text: 'b', params: { a: 1, b: 1 }, correctAnswer: 2 },
    { typeId: 'number_sum_two', text: 'c', params: { a: 1, b: 1 }, correctAnswer: 2 },
  ]);
  assert.equal(group.id, 'grp_foo');
  assert.deepEqual(group.tasks.map((t) => t.id), ['foo_intro', 'foo_1', 'foo_2']);
});

test('rotate shifts an array cyclically and handles negative/out-of-range shifts', () => {
  assert.deepEqual(rotate([1, 2, 3], 0), [1, 2, 3]);
  assert.deepEqual(rotate([1, 2, 3], 1), [2, 3, 1]);
  assert.deepEqual(rotate([1, 2, 3], -1), [3, 1, 2]);
  assert.deepEqual(rotate([1, 2, 3], 4), [2, 3, 1]);
});

test('contentHash is deterministic and salt-sensitive', () => {
  const h1 = contentHash('salt-a', [1, 2, 'x']);
  const h2 = contentHash('salt-a', [1, 2, 'x']);
  const h3 = contentHash('salt-b', [1, 2, 'x']);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('formatDivision renders "quotient ост. remainder"', () => {
  assert.equal(formatDivision(3, 1), '3 ост. 1');
});

test('divideTask throws if any decoy scheme would push the quotient below 1', () => {
  // quotient=1, scheme with dq=-1 would make it 0
  assert.throws(() => divideTask(7, 5, 'test-scheme-salt-that-picks-a-negative-dq', 'test-pos'), /fall below 1/);
});

test('divideTask produces 3 distinct choices including the correct answer, for a safe pair', () => {
  const task = divideTask(16, 6, 'w3-div-scheme-0', 'w3-div-position-0');
  assert.equal(new Set(task.choices).size, 3);
  assert.ok(task.choices!.includes(task.correctAnswer as string));
  assert.equal(task.correctAnswer, '2 ост. 4');
});

test('divideTask with the same inputs and salts is deterministic across calls', () => {
  const a = divideTask(19, 6, 'w3-div-scheme-0', 'w3-div-position-0');
  const b = divideTask(19, 6, 'w3-div-scheme-0', 'w3-div-position-0');
  assert.deepEqual(a, b);
});

test('DIVISION_DECOY_SCHEMES has 4 entries, each with 2 offset pairs', () => {
  assert.equal(DIVISION_DECOY_SCHEMES.length, 4);
  for (const scheme of DIVISION_DECOY_SCHEMES) {
    assert.equal(scheme.length, 2);
  }
});

const BASE_CONTENT: MathMachineContent = {
  schemaVersion: 1,
  sections: [{ id: 'sec_arithmetic', name: 'Арифметика', topicIds: ['top_addition'] }],
  topics: { top_addition: { id: 'top_addition', name: 'Сложение', groupIds: ['grp_add_1'] } },
  groups: { grp_add_1: { id: 'grp_add_1', name: 'Сложение до 10', taskIds: ['add1_intro'] } },
  tasks: { add1_intro: { id: 'add1_intro', typeId: 'number_sum_two', text: '1+1', params: { a: 1, b: 1 }, correctAnswer: 2 } },
  mathTools: [],
  media: {},
};

test('mergeWaveIntoContent adds new topics/groups/tasks without touching existing content', () => {
  const waveTopics = [buildGroup('newg', 'New Group', [{ typeId: 'number_sum_two', text: 'x', params: { a: 1, b: 1 }, correctAnswer: 2 }])].map(
    (group) => ({ id: 'top_new', name: 'New Topic', groups: [group] }),
  );
  const merged = mergeWaveIntoContent(BASE_CONTENT, waveTopics, 'sec_arithmetic');
  assert.ok(merged.topics.top_addition, 'existing topic must survive');
  assert.ok(merged.topics.top_new, 'new topic must be added');
  assert.equal(Object.keys(merged.tasks).length, 2);
  const section = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.deepEqual(section.topicIds, ['top_addition', 'top_new']);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true);
});

test('mergeWaveIntoContent throws on a colliding topic id instead of silently overwriting', () => {
  const waveTopics = [{ id: 'top_addition', name: 'collide', groups: [] }];
  assert.throws(() => mergeWaveIntoContent(BASE_CONTENT, waveTopics, 'sec_arithmetic'), /top_addition/);
});

test('mergeWaveIntoContent throws when the target section does not exist', () => {
  assert.throws(() => mergeWaveIntoContent(BASE_CONTENT, [], 'sec_missing'), /sec_missing/);
});
