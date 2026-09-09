import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE1_TOPICS, countWave1Tasks, mergeIntoContent } from './generateWave1Content.ts';

test('countWave1Tasks returns the exact expected total (17+17+10+20+16)', () => {
  assert.equal(countWave1Tasks(), 80);
});

test('WAVE1_TOPICS has exactly 5 topics, one per Этап 2b wave 1 category', () => {
  assert.equal(WAVE1_TOPICS.length, 5);
});

test('no duplicate topic, group, or task ids across all of WAVE1_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE1_TOPICS) {
    assert.ok(!topicIds.has(topic.id), `duplicate topic id: ${topic.id}`);
    topicIds.add(topic.id);
    for (const group of topic.groups) {
      assert.ok(!groupIds.has(group.id), `duplicate group id: ${group.id}`);
      groupIds.add(group.id);
      for (const task of group.tasks) {
        assert.ok(!taskIds.has(task.id), `duplicate task id: ${task.id}`);
        taskIds.add(task.id);
      }
    }
  }
});

test('every generated task has a correctAnswer consistent with its own params', () => {
  for (const topic of WAVE1_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_subtract_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a - b);
          assert.ok(a - b >= 1, `subtraction result must be positive: ${task.id}`);
        }
        if (task.typeId === 'number_compare') {
          const { a, b, direction } = task.params as { a: number; b: number; direction: number };
          const expected = direction === 1 ? Math.min(a, b) : Math.max(a, b);
          assert.equal(task.correctAnswer, expected);
          assert.deepEqual(task.choices, [a, b]);
        }
        if (task.typeId === 'digit_recognition') {
          const { target } = task.params as { target: number };
          assert.equal(task.correctAnswer, target);
          assert.ok(Array.isArray(task.choices) && task.choices.length === 3);
          assert.ok(new Set(task.choices).size === 3, `choices must be distinct: ${task.id}`);
          assert.ok(task.choices!.includes(target));
        }
        if (task.typeId === 'number_composition') {
          const { whole, knownPart } = task.params as { whole: number; knownPart: number };
          assert.equal(task.correctAnswer, whole - knownPart);
          assert.ok(whole - knownPart >= 1, `composition remainder must be positive: ${task.id}`);
        }
        if (task.typeId === 'number_ordering') {
          const { series, direction } = task.params as { series: number[]; direction: number };
          const expected = direction === 1 ? Math.min(...series) : Math.max(...series);
          assert.equal(task.correctAnswer, expected);
          assert.deepEqual(task.choices, series);
        }
      }
    }
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

test('mergeIntoContent adds all wave 1 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE1_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE1_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave1Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_subtraction: { id: 'top_subtraction', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_subtraction/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
