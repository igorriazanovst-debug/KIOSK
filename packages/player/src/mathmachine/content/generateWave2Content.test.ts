import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE2_TOPICS, countWave2Tasks, mergeIntoContent } from './generateWave2Content.ts';

test('countWave2Tasks returns the exact expected total (20+16+16+16+8)', () => {
  assert.equal(countWave2Tasks(), 76);
});

test('WAVE2_TOPICS has exactly 5 topics, one per Этап 2b wave 2 category', () => {
  assert.equal(WAVE2_TOPICS.length, 5);
});

test('no duplicate topic, group, or task ids across all of WAVE2_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE2_TOPICS) {
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

test('within every choice-mode group, the correct answer is not always at the same button position', () => {
  for (const topic of WAVE2_TOPICS) {
    for (const group of topic.groups) {
      const choiceTasks = group.tasks.filter((t) => Array.isArray(t.choices));
      if (choiceTasks.length < 2) continue;
      const positions = new Set(
        choiceTasks.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer))),
      );
      assert.ok(
        positions.size > 1,
        `group ${group.id} always places the correct answer at button position ${[...positions]} — a child could solve it without reading`,
      );
    }
  }
});

test('every generated task has a correctAnswer consistent with its own params', () => {
  for (const topic of WAVE2_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_multiply_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a * b);
        }
        if (task.typeId === 'number_divide_remainder') {
          const { a, b } = task.params as { a: number; b: number };
          const quotient = Math.floor(a / b);
          const remainder = a % b;
          assert.equal(task.correctAnswer, `${quotient} ост. ${remainder}`);
          assert.ok(quotient >= 1, `division quotient must be >= 1 to keep decoys well-formed: ${task.id}`);
          assert.ok(remainder >= 1, `this wave only generates non-zero-remainder division tasks: ${task.id}`);
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
          assert.ok(task.choices!.includes(task.correctAnswer as string));
        }
        if (task.typeId === 'number_multiple_check') {
          const { n } = task.params as { n: number; options: number[] };
          assert.equal((task.correctAnswer as number) % n, 0, `correctAnswer must be a genuine multiple of n: ${task.id}`);
          for (const choice of task.choices as number[]) {
            if (choice !== task.correctAnswer) {
              assert.notEqual(choice % n, 0, `distractor ${choice} must NOT be a multiple of ${n}: ${task.id}`);
            }
          }
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'round_to_ten') {
          const { n } = task.params as { n: number };
          assert.equal(task.correctAnswer, Math.round(n / 10) * 10);
          assert.ok(n % 10 !== 0, `round_to_ten tasks should use a number that isn't already a multiple of 10: ${task.id}`);
        }
        if (task.typeId === 'ordinal_position') {
          const { series, position } = task.params as { series: number[]; position: number };
          assert.equal(task.correctAnswer, series[position - 1]);
          assert.equal(series.length, 5);
          assert.ok(position >= 1 && position <= 5);
          assert.equal(new Set(series).size, 5, `series must have 5 distinct numbers: ${task.id}`);
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

test('mergeIntoContent adds all wave 2 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE2_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE2_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave2Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_multiplication: { id: 'top_multiplication', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_multiplication/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
