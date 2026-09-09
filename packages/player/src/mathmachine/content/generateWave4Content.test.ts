import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE4_TOPICS, countWave4Tasks, mergeIntoContent } from './generateWave4Content.ts';

test('countWave4Tasks returns the exact expected total (16+16+20+16+16+8)', () => {
  assert.equal(countWave4Tasks(), 92);
});

test('WAVE4_TOPICS has exactly 6 topics (deepening 6 existing categories, no new task types)', () => {
  assert.equal(WAVE4_TOPICS.length, 6);
});

test('no duplicate topic, group, or task ids across all of WAVE4_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE4_TOPICS) {
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
  for (const topic of WAVE4_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_subtract_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a - b);
          assert.ok(a - b >= 1, `subtraction result must be positive: ${task.id}`);
          assert.ok(a >= 11 && a <= 18, `this wave's subtraction deepening targets minuend 11-18: ${task.id}`);
        }
        if (task.typeId === 'number_sum_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a + b);
        }
        if (task.typeId === 'number_multiple_check') {
          const { n } = task.params as { n: number; options: number[] };
          assert.equal((task.correctAnswer as number) % n, 0, `correctAnswer must be a genuine multiple of n: ${task.id}`);
          assert.ok(n >= 6 && n <= 10, `this wave's Кратные deepening targets n=6-10: ${task.id}`);
          for (const choice of task.choices as number[]) {
            if (choice !== task.correctAnswer) {
              assert.notEqual(choice % n, 0, `distractor ${choice} must NOT be a multiple of ${n}: ${task.id}`);
            }
          }
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'ordinal_position') {
          const { series, position } = task.params as { series: number[]; position: number };
          assert.equal(task.correctAnswer, series[position - 1]);
          assert.ok(series.length === 6 || series.length === 7, `this wave's ordinal deepening targets series length 6 or 7: ${task.id}`);
          assert.ok(position >= 1 && position <= series.length);
          assert.equal(new Set(series).size, series.length, `series must have distinct numbers: ${task.id}`);
        }
        if (task.typeId === 'round_to_ten') {
          const { n } = task.params as { n: number };
          assert.equal(task.correctAnswer, Math.round(n / 100) * 100);
          assert.ok(n >= 100 && n < 1000, `this wave's rounding deepening targets 3-digit numbers: ${task.id}`);
          assert.ok(n % 100 !== 50, `round_to_ten tasks should avoid the exact-half convention: ${task.id}`);
        }
        if (task.typeId === 'share_of_whole') {
          const { total, parts } = task.params as { total: number; parts: number };
          assert.equal(parts, 3, `this wave's share deepening is specifically "треть" (parts=3): ${task.id}`);
          assert.equal(total % parts, 0, `total must be evenly divisible by parts: ${task.id}`);
          assert.equal(task.correctAnswer, total / parts);
        }
      }
    }
  }
});

test('within every choice-mode group (Кратные), the button position is not exploitable (frequency/period/linear formula)', () => {
  function maxFrequency(values: number[]): number {
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return Math.max(...counts.values());
  }
  function exploitablePeriod(values: number[]): number | null {
    const n = values.length;
    for (let period = 1; period <= Math.floor(n / 2); period++) {
      let matches = true;
      for (let i = period; i < n; i++) {
        if (values[i] !== values[i % period]) {
          matches = false;
          break;
        }
      }
      if (matches) return period;
    }
    return null;
  }
  function maxLinearFormulaMatch(values: number[], modulus: number): number {
    let best = 0;
    for (let a = 0; a < modulus; a++) {
      for (let c = 0; c < modulus; c++) {
        let matches = 0;
        values.forEach((v, i) => {
          if (((a * i + c) % modulus + modulus) % modulus === v) matches++;
        });
        best = Math.max(best, matches);
      }
    }
    return best;
  }

  let checkedGroups = 0;
  for (const topic of WAVE4_TOPICS) {
    for (const group of topic.groups) {
      const choiceTasks = group.tasks.filter((t) => Array.isArray(t.choices));
      if (choiceTasks.length < 4) continue;
      checkedGroups += 1;
      const numOptions = choiceTasks[0].choices!.length;
      const positions = choiceTasks.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer)));
      const freq = maxFrequency(positions);
      assert.ok(freq <= Math.ceil(choiceTasks.length / 2), `group ${group.id}: button position hits one slot ${freq}/${choiceTasks.length} times`);
      const period = exploitablePeriod(positions);
      assert.ok(period === null || period > choiceTasks.length / 2, `group ${group.id}: exploitable period ${period}`);
      const linear = maxLinearFormulaMatch(positions, numOptions);
      assert.ok(linear <= Math.ceil(choiceTasks.length / 2), `group ${group.id}: linear formula matches ${linear}/${choiceTasks.length}`);
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one choice-mode group (Кратные) to exist');
});

test('within "Кратные" (this wave), taking the median of the three shown choices does not solve most tasks', () => {
  let checkedGroups = 0;
  for (const topic of WAVE4_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_multiple_check');
      if (tasks.length < 4) continue;
      checkedGroups += 1;
      let solved = 0;
      for (const t of tasks) {
        const sorted = [...(t.choices as number[])].sort((a, b) => a - b);
        if (sorted[1] === t.correctAnswer) solved += 1;
      }
      assert.ok(solved <= Math.ceil(tasks.length / 2), `group ${group.id}: "take the median" heuristic solves ${solved}/${tasks.length} tasks`);
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one number_multiple_check group to exist');
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

test('mergeIntoContent adds all wave 4 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE4_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE4_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave4Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_subtraction_carry: { id: 'top_subtraction_carry', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_subtraction_carry/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
