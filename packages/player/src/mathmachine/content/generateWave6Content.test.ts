import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE6_TOPICS, countWave6Tasks, mergeIntoContent } from './generateWave6Content.ts';

test('countWave6Tasks returns the exact expected total (16+20+16+16+16+20)', () => {
  assert.equal(countWave6Tasks(), 104);
});

test('WAVE6_TOPICS has exactly 6 topics (continuing progressions started in previous waves)', () => {
  assert.equal(WAVE6_TOPICS.length, 6);
});

test('no duplicate topic, group, or task ids across all of WAVE6_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE6_TOPICS) {
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
  for (const topic of WAVE6_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_sum_three') {
          const { a, b, c } = task.params as { a: number; b: number; c: number };
          assert.equal(task.correctAnswer, a + b + c);
          assert.ok(a + b + c >= 8 && a + b + c <= 20, `this wave's sum-of-three deepening targets sums 8-20: ${task.id}`);
        }
        if (task.typeId === 'number_multiple_check') {
          const { n } = task.params as { n: number; options: number[] };
          assert.equal((task.correctAnswer as number) % n, 0, `correctAnswer must be a genuine multiple of n: ${task.id}`);
          assert.ok(n >= 11 && n <= 15, `this wave's Кратные deepening targets n=11-15: ${task.id}`);
          for (const choice of task.choices as number[]) {
            if (choice !== task.correctAnswer) {
              assert.notEqual(choice % n, 0, `distractor ${choice} must NOT be a multiple of ${n}: ${task.id}`);
            }
          }
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'number_divide_remainder') {
          const { a, b } = task.params as { a: number; b: number };
          assert.ok(b === 11 || b === 12, `this wave's Деление deepening targets divisors 11-12: ${task.id}`);
          const quotient = Math.floor(a / b);
          const remainder = a % b;
          assert.equal(task.correctAnswer, `${quotient} ост. ${remainder}`);
          assert.ok(quotient >= 2, `quotient must be >=2 for the decoy scheme's guard: ${task.id}`);
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'ordinal_position') {
          const { series, position } = task.params as { series: number[]; position: number };
          assert.equal(task.correctAnswer, series[position - 1]);
          assert.equal(series.length, 10, `this wave's ordinal deepening targets series length 10: ${task.id}`);
          assert.ok(position >= 1 && position <= 10);
          assert.equal(new Set(series).size, series.length, `series must have distinct numbers: ${task.id}`);
        }
        if (task.typeId === 'share_of_whole') {
          const { total, parts } = task.params as { total: number; parts: number };
          assert.ok(parts === 2 || parts === 4, `this wave's share deepening targets half/quarter: ${task.id}`);
          assert.ok(total >= 40 && total <= 68, `this wave's share deepening targets totals 40-68: ${task.id}`);
          assert.equal(total % parts, 0, `total must be evenly divisible by parts: ${task.id}`);
          assert.equal(task.correctAnswer, total / parts);
        }
        if (task.typeId === 'number_composition') {
          const { whole, knownPart } = task.params as { whole: number; knownPart: number };
          assert.equal(task.correctAnswer, whole - knownPart);
          assert.ok(whole >= 21 && whole <= 30, `this wave's composition deepening targets 21-30: ${task.id}`);
          assert.ok(knownPart >= 1 && knownPart < whole);
        }
      }
    }
  }
});

test('within every choice-mode group (Кратные, Деление), the button position is not exploitable (frequency/period/linear formula)', () => {
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
  for (const topic of WAVE6_TOPICS) {
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
  assert.equal(checkedGroups, 4, 'expected exactly 4 choice-mode groups (2 Кратные + 2 Деление)');
});

test('within "Кратные" (this wave), taking the median of the three shown choices does not solve most tasks', () => {
  let checkedGroups = 0;
  for (const topic of WAVE6_TOPICS) {
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
  assert.equal(checkedGroups, 2, 'expected exactly 2 number_multiple_check groups in this wave');
});

function parseDivisionOption(option: string): { quotient: number; remainder: number } {
  const match = /^(-?\d+) ост\. (\d+)$/.exec(option);
  assert.ok(match, `unparseable division option: ${option}`);
  return { quotient: Number(match![1]), remainder: Number(match![2]) };
}

function majorityOf(values: number[]): number | null {
  const winners = [...new Set(values)].filter((v) => values.filter((x) => x === v).length >= 2);
  return winners.length === 1 ? winners[0] : null;
}

function minorityOf(values: number[]): number | null {
  const singles = [...new Set(values)].filter((v) => values.filter((x) => x === v).length === 1);
  return singles.length === 1 ? singles[0] : null;
}

const DIVISION_SHORTCUTS: Record<string, (choices: string[]) => string | null> = {
  'majority quotient + majority remainder': (choices) => {
    const parsed = choices.map(parseDivisionOption);
    const quotient = majorityOf(parsed.map((p) => p.quotient));
    const remainder = majorityOf(parsed.map((p) => p.remainder));
    if (quotient === null || remainder === null) return null;
    const guess = `${quotient} ост. ${remainder}`;
    return choices.includes(guess) ? guess : null;
  },
  'the option with the odd-one-out quotient': (choices) => {
    const parsed = choices.map(parseDivisionOption);
    const quotient = minorityOf(parsed.map((p) => p.quotient));
    if (quotient === null) return null;
    return choices[parsed.findIndex((p) => p.quotient === quotient)];
  },
  'the option with the odd-one-out remainder': (choices) => {
    const parsed = choices.map(parseDivisionOption);
    const remainder = minorityOf(parsed.map((p) => p.remainder));
    if (remainder === null) return null;
    return choices[parsed.findIndex((p) => p.remainder === remainder)];
  },
};

test('within every number_divide_remainder group (this wave), no structural shortcut solves every task', () => {
  let checkedGroups = 0;
  for (const topic of WAVE6_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_divide_remainder');
      if (tasks.length < 2) continue;
      checkedGroups += 1;
      for (const [name, shortcut] of Object.entries(DIVISION_SHORTCUTS)) {
        const solved = tasks.filter((t) => shortcut(t.choices as string[]) === t.correctAnswer).length;
        assert.ok(
          solved < tasks.length,
          `group ${group.id} is fully solvable by "${name}" (${solved}/${tasks.length}) — no division required`,
        );
        assert.ok(
          solved <= Math.ceil(tasks.length / 2),
          `group ${group.id}: shortcut "${name}" hits the correct answer in ${solved}/${tasks.length} tasks — too reliable to be safe`,
        );
      }
    }
  }
  assert.equal(checkedGroups, 2, 'expected exactly 2 number_divide_remainder groups in this wave');
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

test('mergeIntoContent adds all wave 6 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE6_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE6_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave6Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_composition_3: { id: 'top_composition_3', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_composition_3/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
