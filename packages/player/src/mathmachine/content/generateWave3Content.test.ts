import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema, type MathMachineContent } from '@kiosk/shared';
import { WAVE3_TOPICS, countWave3Tasks, mergeIntoContent } from './generateWave3Content.ts';

test('countWave3Tasks returns the exact expected total (16+70+24+9+16)', () => {
  assert.equal(countWave3Tasks(), 135);
});

test('WAVE3_TOPICS has exactly 13 topics (1 доли + 7 умножение + 3 деление + 1 сложение + 1 вычитание)', () => {
  assert.equal(WAVE3_TOPICS.length, 13);
});

test('no duplicate topic, group, or task ids across all of WAVE3_TOPICS', () => {
  const topicIds = new Set<string>();
  const groupIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const topic of WAVE3_TOPICS) {
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

// Урок волны 2, обобщённый до класса «правильный ответ не должен
// вычисляться из ФОРМЫ вариантов» — с первого коммита, не постфактум.

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

test('within every choice-mode group, the button position is not exploitable (frequency/period/linear formula)', () => {
  let checkedGroups = 0;
  for (const topic of WAVE3_TOPICS) {
    for (const group of topic.groups) {
      const choiceTasks = group.tasks.filter((t) => Array.isArray(t.choices));
      if (choiceTasks.length < 4) continue;
      checkedGroups += 1;
      const numOptions = choiceTasks[0].choices!.length;
      const positions = choiceTasks.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer)));
      const freq = maxFrequency(positions);
      assert.ok(
        freq <= Math.ceil(choiceTasks.length / 2),
        `group ${group.id}: button position ${JSON.stringify(positions)} hits one slot ${freq}/${choiceTasks.length} times`,
      );
      const period = exploitablePeriod(positions);
      assert.ok(
        period === null || period > choiceTasks.length / 2,
        `group ${group.id}: positions ${JSON.stringify(positions)} follow an exploitable period ${period}`,
      );
      const linear = maxLinearFormulaMatch(positions, numOptions);
      assert.ok(
        linear <= Math.ceil(choiceTasks.length / 2),
        `group ${group.id}: a linear formula (a*i+c) mod N matches positions ${JSON.stringify(positions)} in ${linear}/${choiceTasks.length} tasks`,
      );
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one choice-mode group to exist');
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

test('within every number_divide_remainder group, no structural shortcut solves every task', () => {
  let checkedGroups = 0;
  for (const topic of WAVE3_TOPICS) {
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
          solved <= Math.floor(tasks.length / 2),
          `group ${group.id}: shortcut "${name}" hits the correct answer in ${solved}/${tasks.length} tasks — too reliable to be safe`,
        );
      }
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one number_divide_remainder group to exist');
});

// Системная находка Эпика 12 (оригинал): позиция правильного ответа была
// не просто предсказуема ВНУТРИ группы, а БАЙТ-В-БАЙТ идентична МЕЖДУ
// разными группами (одна и та же последовательность во всём каталоге) —
// признак того, что позиция зависела от номера задания, а не от его
// содержания. Проверяем это явно для трёх групп деления этой волны.
test('the three division groups do not all share the identical button-position sequence', () => {
  const divisionGroups = WAVE3_TOPICS.flatMap((t) => t.groups).filter((g) =>
    g.tasks.some((t) => t.typeId === 'number_divide_remainder'),
  );
  assert.ok(divisionGroups.length >= 2, 'expected at least two division groups to compare');
  const sequences = divisionGroups.map((g) =>
    g.tasks.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer))).join(','),
  );
  const distinct = new Set(sequences);
  assert.ok(
    distinct.size > 1,
    `all division groups share the identical position sequence ${sequences[0]} — position is derived from task index, not content`,
  );
});

// Найдено вживую (R1): в grp_div_67 частное-минус-остаток правильного
// ответа было константой (=1) для всех заданий группы — эвристика
// «единственный вариант с q−r=c» решала группу без деления. Проверяем,
// что ни одна константа c не выделяет правильный вариант больше чем в
// половине заданий ни в одной группе деления.
test('within every number_divide_remainder group, no single q-minus-r constant identifies the correct option too often', () => {
  let checkedGroups = 0;
  for (const topic of WAVE3_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_divide_remainder');
      if (tasks.length < 2) continue;
      checkedGroups += 1;
      for (let c = -9; c <= 9; c++) {
        let solved = 0;
        for (const task of tasks) {
          const parsed = (task.choices as string[]).map(parseDivisionOption);
          const matching = parsed.filter((p) => p.quotient - p.remainder === c);
          if (matching.length === 1) {
            const guess = `${matching[0].quotient} ост. ${matching[0].remainder}`;
            if (guess === task.correctAnswer) solved += 1;
          }
        }
        assert.ok(
          solved <= Math.floor(tasks.length / 2),
          `group ${group.id}: constant q−r=${c} identifies the correct option in ${solved}/${tasks.length} tasks — too reliable to be safe`,
        );
      }
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one number_divide_remainder group to exist');
});

test('share_of_whole tasks never have a choices field (numeric-only type)', () => {
  let checked = 0;
  for (const topic of WAVE3_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId !== 'share_of_whole') continue;
        checked += 1;
        assert.equal(task.choices, undefined, `share_of_whole task ${task.id} must not have choices`);
      }
    }
  }
  assert.equal(checked, 16, 'expected exactly 16 share_of_whole tasks');
});

test('every generated task has a correctAnswer consistent with its own params', () => {
  for (const topic of WAVE3_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (task.typeId === 'share_of_whole') {
          const { total, parts } = task.params as { total: number; parts: number };
          assert.ok(parts === 2 || parts === 4, `parts must be 2 or 4: ${task.id}`);
          assert.equal(total % parts, 0, `total must be evenly divisible by parts: ${task.id}`);
          assert.equal(task.correctAnswer, total / parts);
          assert.ok(total >= 4 && total <= 40, `total must be within spec range 4-40: ${task.id}`);
        }
        if (task.typeId === 'number_multiply_two') {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a * b);
          assert.ok(a >= 1 && a <= 10 && b >= 1 && b <= 10, `a and b must be within spec range 1-10: ${task.id}`);
        }
        if (task.typeId === 'number_divide_remainder') {
          const { a, b } = task.params as { a: number; b: number };
          const quotient = Math.floor(a / b);
          const remainder = a % b;
          assert.equal(task.correctAnswer, `${quotient} ост. ${remainder}`);
          assert.ok(quotient >= 1, `division quotient must be >= 1: ${task.id}`);
          assert.ok(remainder >= 1, `this wave only generates non-zero-remainder division tasks: ${task.id}`);
          assert.ok(a >= 3 && a <= 50, `dividend must be within spec range 3-50: ${task.id}`);
          assert.ok(b >= 6 && b <= 10, `wave 3 division only covers divisors 6-10: ${task.id}`);
          assert.equal(new Set(task.choices).size, 3, `all 3 choice options must be distinct: ${task.id}`);
          assert.ok(task.choices!.includes(task.correctAnswer as string));
          for (const choice of task.choices as string[]) {
            const shown = parseDivisionOption(choice);
            assert.ok(shown.quotient >= 1, `no option may show a quotient below 1: ${task.id} → "${choice}"`);
            assert.ok(
              shown.remainder >= 0 && shown.remainder < b,
              `every option's remainder must be a valid remainder for divisor ${b}: ${task.id} → "${choice}"`,
            );
          }
        }
        if (task.typeId === 'number_sum_two' && task.id.startsWith('add_carry')) {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a + b);
          assert.ok(a + b > 10, `Сложение: переход через десяток must actually cross 10: ${task.id}`);
        }
        if (task.typeId === 'number_subtract_two' && task.id.startsWith('sub_wide')) {
          const { a, b } = task.params as { a: number; b: number };
          assert.equal(task.correctAnswer, a - b);
          assert.ok(a <= 20, `Вычитание: числа побольше must keep уменьшаемое within 20: ${task.id}`);
          assert.ok(b >= 3, `Вычитание: числа побольше must use вычитаемое >= 3 (1 and 2 already covered by wave 1): ${task.id}`);
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

test('mergeIntoContent adds all wave 3 topics without touching existing content', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  assert.ok(merged.topics.top_addition, 'existing topic must survive the merge');
  assert.equal(Object.keys(merged.topics).length, 1 + WAVE3_TOPICS.length);
  const arithmeticSection = merged.sections.find((s) => s.id === 'sec_arithmetic')!;
  assert.equal(arithmeticSection.topicIds.length, 1 + WAVE3_TOPICS.length);
  assert.equal(Object.keys(merged.tasks).length, 1 + countWave3Tasks());
});

test('mergeIntoContent throws instead of silently overwriting a colliding topic id', () => {
  const colliding: MathMachineContent = {
    ...BASE_CONTENT,
    topics: { ...BASE_CONTENT.topics, top_shares: { id: 'top_shares', name: 'existing', groupIds: ['x'] } },
  };
  assert.throws(() => mergeIntoContent(colliding), /top_shares/);
});

test('the merged content validates against MathMachineContentSchema', () => {
  const merged = mergeIntoContent(BASE_CONTENT);
  const result = MathMachineContentSchema.safeParse(merged);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});
