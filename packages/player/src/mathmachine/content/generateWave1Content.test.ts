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
          assert.deepEqual(
            [...(task.choices as number[])].sort((x, y) => x - y),
            [a, b].sort((x, y) => x - y),
            `choices must be a permutation of {a,b}: ${task.id}`,
          );
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

// ─── Батарея тестов-инвариантов Эпика 12 (переделка 2026-09-09) ─────────
// Урок исходного проекта, обобщённый: правильный ответ не должен
// вычисляться ни из позиции кнопки, ни из формы/порядка контента —
// проверяется на позицию (частота/периодичность/линейная формула),
// специфичный для «Сравнения» порядок слов в тексте, и специфичную для
// «Цифр» эвристику «средний вариант».

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
  for (const topic of WAVE1_TOPICS) {
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

test('within "Сравнение", the correct number is not always named at the same position in the question text', () => {
  let checkedGroups = 0;
  for (const topic of WAVE1_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'number_compare');
      if (tasks.length < 4) continue;
      checkedGroups += 1;
      const namedFirstFlags = tasks.map((t) => {
        const match = /: (-?\d+) или (-?\d+)\?/.exec(t.text);
        assert.ok(match, `unparseable comparison text: ${t.text}`);
        return Number(match![1]) === Number(t.correctAnswer) ? 1 : 0;
      });
      const freq = maxFrequency(namedFirstFlags);
      assert.ok(
        freq <= Math.ceil(tasks.length / 2),
        `group ${group.id}: correct number named first/second ${JSON.stringify(namedFirstFlags)} — constant in ${freq}/${tasks.length}`,
      );
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one number_compare group to exist');
});

test('within "Цифры", taking the median of the three shown choices does not solve most tasks', () => {
  let checkedGroups = 0;
  for (const topic of WAVE1_TOPICS) {
    for (const group of topic.groups) {
      const tasks = group.tasks.filter((t) => t.typeId === 'digit_recognition');
      if (tasks.length < 4) continue;
      checkedGroups += 1;
      let solved = 0;
      for (const t of tasks) {
        const sorted = [...(t.choices as number[])].sort((a, b) => a - b);
        if (sorted[1] === t.correctAnswer) solved += 1;
      }
      assert.ok(
        solved <= Math.ceil(tasks.length / 2),
        `group ${group.id}: "take the median" heuristic solves ${solved}/${tasks.length} tasks`,
      );
    }
  }
  assert.ok(checkedGroups > 0, 'expected at least one digit_recognition group to exist');
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
