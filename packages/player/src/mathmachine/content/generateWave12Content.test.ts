import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE12_TOPICS, countWave12Tasks, mergeIntoContent } from './generateWave12Content.ts';

test('countWave12Tasks returns the exact expected total (30+30+60+24+20+24+30+24+30+24+24+24+30)', () => {
  assert.equal(countWave12Tasks(), 374);
});

test('WAVE12_TOPICS has exactly 13 topics (the sixth and final enlarged wave)', () => {
  assert.equal(WAVE12_TOPICS.length, 13);
});

test('no duplicate topic, group, or task ids across all of WAVE12_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE12_TOPICS) {
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

test('WAVE12_TOPICS does not include a "Доли целого" topic (school denominator set 2-12 completed in wave 10)', () => {
  for (const topic of WAVE12_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        assert.notEqual(task.typeId, 'share_of_whole', `wave 12 should not add share_of_whole tasks: ${task.id}`);
      }
    }
  }
});

test('every generated task has a correctAnswer consistent with its own params', () => {
  for (const topic of WAVE12_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'number_subtract_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a - b);
          assert.ok(a - b >= 1, `subtraction result must be positive: ${task.id}`);
          assert.ok(a >= 501 && a <= 1000, `this wave's subtraction deepening targets minuend 501-1000: ${task.id}`);
        }
        if (task.typeId === 'number_sum_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a + b);
          assert.ok(a + b >= 500 && a + b <= 1000, `this wave's addition deepening targets sums ~500-1000: ${task.id}`);
        }
        if (task.typeId === 'number_composition') {
          const { whole, knownPart } = task.params as { whole: number; knownPart: number };
          assert.equal(task.correctAnswer, whole - knownPart);
          assert.ok(whole >= 161 && whole <= 190, `this wave's composition deepening targets 161-190: ${task.id}`);
          assert.ok(knownPart >= 1 && knownPart < whole);
        }
        if (task.typeId === 'number_compare') {
          const { a, b, direction } = task.params as { a: number; b: number; direction: 0 | 1 };
          const expected = direction === 1 ? Math.min(a, b) : Math.max(a, b);
          assert.equal(task.correctAnswer, expected);
          assert.ok(a >= 3500 && b >= 3500 && a <= 5000 && b <= 5000, `this wave's comparison deepening targets 3500-5000: ${task.id}`);
          assert.equal(new Set(task.choices).size, 2, `both choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'number_ordering') {
          const { series, direction } = task.params as { series: number[]; direction: 0 | 1 };
          const expected = direction === 1 ? Math.min(...series) : Math.max(...series);
          assert.equal(task.correctAnswer, expected);
          assert.equal(series.length, 10, `this wave's ordering deepening targets 10-number series: ${task.id}`);
          assert.equal(new Set(series).size, series.length, `series must have distinct numbers: ${task.id}`);
        }
        if (task.typeId === 'ordinal_position') {
          const { series, position } = task.params as { series: number[]; position: number };
          assert.equal(task.correctAnswer, series[position - 1]);
          assert.ok(series.length === 21 || series.length === 22, `this wave's ordinal deepening targets series length 21 or 22: ${task.id}`);
          assert.ok(position >= 1 && position <= series.length);
          assert.equal(new Set(series).size, series.length, `series must have distinct numbers: ${task.id}`);
        }
        if (task.typeId === 'number_multiply_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a * b);
          assert.ok(a >= 21 && a <= 30, `this wave's multiplication deepening targets a two-digit multiplicand 21-30: ${task.id}`);
          assert.ok(b >= 2 && b <= 9, `this wave's multiplication deepening targets single-digit multiplier 2-9: ${task.id}`);
        }
        if (task.typeId === 'number_divide_remainder') {
          const { a, b } = task.params as { a: number; b: number };
          assert.ok(b >= 36 && b <= 40, `this wave's Деление deepening targets divisors 36-40: ${task.id}`);
          const quotient = Math.floor(a / b);
          const remainder = a % b;
          assert.equal(task.correctAnswer, `${quotient} ост. ${remainder}`);
          assert.ok(quotient >= 2, `quotient must be >=2 for the decoy scheme's guard: ${task.id}`);
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'number_multiple_check') {
          const { n } = task.params as { n: number; options: number[] };
          assert.equal((task.correctAnswer as number) % n, 0, `correctAnswer must be a genuine multiple of n: ${task.id}`);
          assert.ok(n >= 41 && n <= 45, `this wave's Кратные deepening targets n=41-45: ${task.id}`);
          for (const choice of task.choices as number[]) {
            if (choice !== task.correctAnswer) {
              assert.notEqual(choice % n, 0, `distractor ${choice} must NOT be a multiple of ${n}: ${task.id}`);
            }
          }
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
        }
        if (task.typeId === 'number_missing') {
          const { series, missingIndex } = task.params as { series: number[]; missingIndex: number };
          assert.equal(task.correctAnswer, series[missingIndex]);
          assert.equal(series.length, 6, `this wave's missing-number deepening targets 6-element series: ${task.id}`);
          const step = series[1] - series[0];
          assert.ok(step === 14 || step === 15, `this wave targets step 14 or 15: ${task.id}`);
          for (let i = 1; i < series.length; i++) {
            assert.equal(series[i] - series[i - 1], step, `series must be a consistent arithmetic progression: ${task.id}`);
          }
        }
        if (task.typeId === 'number_counting') {
          const { count } = task.params as { count: number };
          assert.equal(task.correctAnswer, count);
          assert.ok(count >= 121 && count <= 150, `this wave's counting deepening targets 121-150: ${task.id}`);
        }
        if (task.typeId === 'number_sum_three') {
          const { a, b, c } = task.params as { a: number; b: number; c: number };
          assert.equal(task.correctAnswer, a + b + c);
          assert.ok(a + b + c >= 125 && a + b + c <= 155, `this wave's sum-of-three deepening targets sums ~125-155: ${task.id}`);
        }
        if (task.typeId === 'round_to_ten') {
          const { n } = task.params as { n: number };
          assert.equal(task.correctAnswer, Math.round(n / 1000) * 1000);
          assert.ok(n >= 1000 && n < 10000, `this wave's rounding deepening targets 4-digit numbers: ${task.id}`);
          assert.ok(n % 1000 !== 500, `round_to_ten tasks should avoid the exact-half convention: ${task.id}`);
        }
      }
    }
  }
});

test('WAVE12_TOPICS reuses no round_to_ten (thousands) number already used by waves 8-11', () => {
  const PRIOR_THOUSAND_NUMBERS = new Set([
    1150, 1437, 1724, 2011, 2298, 2585, 2872, 3159, 3446, 3733, 4020, 4307, 4594, 4881, 5168,
    1780, 2073, 2366, 2659, 2952, 3245, 3538, 3831, 4124, 4417, 4710, 5003, 5296, 5589, 5882,
    6000, 6271, 6542, 6813, 7084, 7355, 7626, 7897, 8168, 8439, 8710, 8981, 9252, 9523, 9794,
    1300, 1533, 1766, 1999, 2232, 2465, 2698, 2931, 3164, 3397, 3630, 3863, 4096, 4329, 4562,
    2550, 2781, 3062, 3343, 3624, 3905, 4186, 4467, 4748, 5029, 5310, 5591, 5872, 6153, 6434,
    7200, 7367, 7534, 7701, 7868, 8035, 8202, 8369, 8536, 8703, 8870, 9037, 9204, 9371, 9538,
    3200, 3433, 3666, 3899, 4132, 4365, 4598, 4831, 5064, 5297, 5530, 5763, 5996, 6229, 6462,
    8100, 8227, 8354, 8481, 8608, 8735, 8862, 8989, 9116, 9243, 9370, 9497, 9624, 9751, 9878,
  ]);
  for (const topic of WAVE12_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'round_to_ten') {
          const { n } = task.params as { n: number };
          assert.ok(!PRIOR_THOUSAND_NUMBERS.has(n), `number ${n} was already used by an earlier wave's rounding topic: ${task.id}`);
        }
      }
    }
  }
});

test('within every choice-mode group (Сравнение, Порядок чисел, Деление, Кратные), the button position is not exploitable (frequency/period/linear formula)', () => {
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
  for (const topic of WAVE12_TOPICS) {
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
  assert.equal(checkedGroups, 10, 'expected exactly 10 choice-mode groups (3 Сравнение + 2 Порядок чисел + 3 Деление + 2 Кратные)');
});

test('within "Порядок чисел: десять чисел", the minimum/maximum does not always land on the same series position', () => {
  let checkedGroups = 0;
  for (const topic of WAVE12_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_ordering' && (t.params as { series: number[] }).series.length === 10);
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

test('within "Кратные" (this wave), taking the median of the three shown choices does not solve most tasks', () => {
  let checkedGroups = 0;
  for (const topic of WAVE12_TOPICS) {
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
  for (const topic of WAVE12_TOPICS) {
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
  assert.equal(checkedGroups, 3, 'expected exactly 3 number_divide_remainder groups in this wave');
});

test('within "Сравнение" (this wave), the number-naming order in the question text is not exploitable', () => {
  let checkedGroups = 0;
  for (const topic of WAVE12_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_compare');
      if (tasks.length < 4) continue;
      checkedGroups += 1;
      let firstNamedIsCorrect = 0;
      for (const t of tasks) {
        const firstNamed = Number(/Какое число (?:больше|меньше): (\d+) или/.exec(t.text)![1]);
        if (firstNamed === t.correctAnswer) firstNamedIsCorrect += 1;
      }
      assert.ok(
        firstNamedIsCorrect < tasks.length,
        `group ${group.id}: the FIRST named number is always correct (${firstNamedIsCorrect}/${tasks.length}) — text order leaks the answer`,
      );
    }
  }
  assert.equal(checkedGroups, 3, 'expected exactly 3 number_compare groups in this wave');
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

test('mergeIntoContent adds all wave 12 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE12_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE12_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave12Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_composition_9: { id: 'top_composition_9', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_composition_9/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
