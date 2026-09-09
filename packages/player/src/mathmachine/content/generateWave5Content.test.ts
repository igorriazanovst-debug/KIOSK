import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE5_TOPICS, countWave5Tasks, mergeIntoContent } from './generateWave5Content.ts';

test('countWave5Tasks returns the exact expected total (16+20+16+16+16+16)', () => {
  assert.equal(countWave5Tasks(), 100);
});

test('WAVE5_TOPICS has exactly 6 topics (balancing 5 previously single-topic categories)', () => {
  assert.equal(WAVE5_TOPICS.length, 6);
});

test('no duplicate topic, group, or task ids across all of WAVE5_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE5_TOPICS) {
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
  for (const topic of WAVE5_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_compare') {
          const { a, b, direction } = task.params as { a: number; b: number; direction: 0 | 1 };
          const expected = direction === 1 ? Math.min(a, b) : Math.max(a, b);
          assert.equal(task.correctAnswer, expected);
          assert.ok(a >= 15 && b >= 15 && a <= 50 && b <= 50, `this wave's comparison deepening targets 15-50: ${task.id}`);
          assert.equal(new Set(task.choices).size, 2, `both choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'number_composition') {
          const { whole, knownPart } = task.params as { whole: number; knownPart: number };
          assert.equal(task.correctAnswer, whole - knownPart);
          assert.ok(whole >= 11 && whole <= 20, `this wave's composition deepening targets 11-20: ${task.id}`);
          assert.ok(knownPart >= 1 && knownPart < whole);
        }
        if (task.typeId === 'number_ordering') {
          const { series, direction } = task.params as { series: number[]; direction: 0 | 1 };
          const expected = direction === 1 ? Math.min(...series) : Math.max(...series);
          assert.equal(task.correctAnswer, expected);
          assert.equal(series.length, 4, `this wave's ordering deepening targets 4-number series: ${task.id}`);
          assert.equal(new Set(series).size, series.length, `series must have distinct numbers: ${task.id}`);
        }
        if (task.typeId === 'number_counting') {
          const { count } = task.params as { count: number };
          assert.equal(task.correctAnswer, count);
          assert.ok(count >= 11 && count <= 20, `this wave's counting deepening targets 11-20: ${task.id}`);
        }
        if (task.typeId === 'number_missing') {
          const { series, missingIndex } = task.params as { series: number[]; missingIndex: number };
          assert.equal(task.correctAnswer, series[missingIndex]);
          assert.equal(series.length, 6, `this wave's missing-number deepening targets 6-element series: ${task.id}`);
          const step = series[1] - series[0];
          assert.ok(step === 2 || step === 3, `this wave targets step 2 or 3: ${task.id}`);
          for (let i = 1; i < series.length; i++) {
            assert.equal(series[i] - series[i - 1], step, `series must be a consistent arithmetic progression: ${task.id}`);
          }
        }
        if (task.typeId === 'ordinal_position') {
          const { series, position } = task.params as { series: number[]; position: number };
          assert.equal(task.correctAnswer, series[position - 1]);
          assert.ok(series.length === 8 || series.length === 9, `this wave's ordinal deepening targets series length 8 or 9: ${task.id}`);
          assert.ok(position >= 1 && position <= series.length);
          assert.equal(new Set(series).size, series.length, `series must have distinct numbers: ${task.id}`);
        }
      }
    }
  }
});

test('within every choice-mode group (Сравнение, Порядок чисел), the button position is not exploitable (frequency/period/linear formula)', () => {
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
  for (const topic of WAVE5_TOPICS) {
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
  assert.equal(checkedGroups, 4, 'expected exactly 4 choice-mode groups (2 Сравнение + 2 Порядок чисел)');
});

test('within "Порядок чисел: четыре числа", the minimum/maximum does not always land on the same series position', () => {
  let checkedGroups = 0;
  for (const topic of WAVE5_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_ordering' && (t.params as { series: number[] }).series.length === 4);
      if (tasks.length < 4) continue;
      checkedGroups += 1;
      const positions = tasks.map((t) => (t.params as { series: number[] }).series.indexOf(t.correctAnswer as number));
      const counts = new Map<number, number>();
      for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1);
      assert.ok(Math.max(...counts.values()) <= Math.ceil(tasks.length / 2), `group ${group.id}: correct value sits at one series slot ${Math.max(...counts.values())}/${tasks.length} times`);
    }
  }
  assert.equal(checkedGroups, 2, 'expected exactly 2 number_ordering groups in this wave');
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

test('mergeIntoContent adds all wave 5 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE5_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE5_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave5Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_ordinal_3: { id: 'top_ordinal_3', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_ordinal_3/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
