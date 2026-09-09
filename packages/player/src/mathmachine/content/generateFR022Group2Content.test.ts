import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FR022_GROUP2_TOPICS, countFR022Group2Tasks } from './generateFR022Group2Content.ts';

// Тот же класс инвариантов, что и в Этапе 3 (Эпик 12/30) — пишется ВМЕСТЕ
// с генератором, не постфактум.
function assertNoConstantAnswerPosition(groupName: string, tasks: { choices?: (number | string)[]; correctAnswer: number | string }[]) {
  const withChoices = tasks.filter((t) => t.choices && t.choices.length > 1);
  if (withChoices.length < 2) return;
  const positions = withChoices.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer)));
  assert.ok(positions.every((p) => p >= 0), `${groupName}: correctAnswer not found among choices for some task`);
  const distinctPositions = new Set(positions);
  assert.ok(
    distinctPositions.size > 1,
    `${groupName}: correct answer sits at the same position (${[...distinctPositions]}) in all ${positions.length} tasks — position-bias defect (Эпик 12 class)`,
  );
}

function assertNoConstantAnswerValue(groupName: string, tasks: { correctAnswer: number | string }[]) {
  const values = tasks.map((t) => String(t.correctAnswer));
  const distinct = new Set(values);
  assert.ok(
    distinct.size > 1,
    `${groupName}: correctAnswer value is the same literal ("${values[0]}") for all ${values.length} tasks — a solver could click that label without reading the question at all`,
  );
}

test('FR022 Group 2 produces exactly the expected topic/group/task counts', () => {
  assert.equal(FR022_GROUP2_TOPICS.length, 13);
  const topicIds = FR022_GROUP2_TOPICS.map((t) => t.id);
  assert.deepEqual(
    [...topicIds].sort(),
    [
      'top_counting_add_combo',
      'top_counting_subtract_combo',
      'top_time_clock',
      'top_measure_mass_scale',
      'top_geometry_angle',
      'top_geometry_shape_name',
      'top_geometry_shape_properties',
      'top_geometry_solid_name',
      'top_geometry_solid_properties',
      'top_space_position',
      'top_space_direction',
      'top_space_ordering',
      'top_space_coordinates',
    ].sort(),
  );
  assert.equal(countFR022Group2Tasks(), 10 + 10 + 10 + 10 + 10 + 6 + 5 + 5 + 5 + 10 + 10 + 10 + 10);
});

test('every task has a unique id within FR022 Group 2', () => {
  const ids = FR022_GROUP2_TOPICS.flatMap((t) => t.groups.flatMap((g) => g.tasks.map((task) => task.id)));
  assert.equal(new Set(ids).size, ids.length);
});

const CHOICE_TOPIC_IDS = [
  'top_time_clock',
  'top_measure_mass_scale',
  'top_geometry_angle',
  'top_geometry_shape_name',
  'top_geometry_shape_properties',
  'top_geometry_solid_name',
  'top_geometry_solid_properties',
  'top_space_position',
  'top_space_direction',
  'top_space_ordering',
  'top_space_coordinates',
];

test('no choice-mode group in FR022 Group 2 has a constant correct-answer position', () => {
  for (const topicId of CHOICE_TOPIC_IDS) {
    const topic = FR022_GROUP2_TOPICS.find((t) => t.id === topicId)!;
    for (const group of topic.groups) {
      assertNoConstantAnswerPosition(`${topic.id}/${group.id}`, group.tasks);
    }
  }
});

test('no choice-mode group in FR022 Group 2 has a constant correct-answer value', () => {
  for (const topicId of CHOICE_TOPIC_IDS) {
    const topic = FR022_GROUP2_TOPICS.find((t) => t.id === topicId)!;
    for (const group of topic.groups) {
      assertNoConstantAnswerValue(`${topic.id}/${group.id}`, group.tasks);
    }
  }
});

test('every task in FR022 Group 2 with choices includes the correct answer', () => {
  for (const topic of FR022_GROUP2_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        if (!task.choices) continue;
        assert.ok(
          task.choices.some((c) => String(c) === String(task.correctAnswer)),
          `${task.id}: correctAnswer ${task.correctAnswer} not present in choices ${JSON.stringify(task.choices)}`,
        );
      }
    }
  }
});

test('count_then_add/count_then_subtract tasks have no choices (numeric input) and correct arithmetic', () => {
  const addTopic = FR022_GROUP2_TOPICS.find((t) => t.id === 'top_counting_add_combo')!;
  for (const group of addTopic.groups) {
    for (const task of group.tasks) {
      assert.equal(task.choices, undefined);
      const { groupA, groupB } = task.params as { groupA: number; groupB: number };
      assert.equal(task.correctAnswer, groupA + groupB);
    }
  }
  const subTopic = FR022_GROUP2_TOPICS.find((t) => t.id === 'top_counting_subtract_combo')!;
  for (const group of subTopic.groups) {
    for (const task of group.tasks) {
      assert.equal(task.choices, undefined);
      const { groupA, groupB } = task.params as { groupA: number; groupB: number };
      assert.ok(groupA > groupB, `${task.id}: groupA must exceed groupB for a positive subtraction result`);
      assert.equal(task.correctAnswer, groupA - groupB);
    }
  }
});

// Найдено при проектировании (не постфактум ревью, как в Эпике 12, но тот
// же класс риска): если прямой угол (90°) всегда оказывается визуально
// "средним" по величине среди трёх показанных углов, ребёнок может решать
// задание сравнением размеров на глаз, не зная, что такое прямой угол.
test('right_angle_recognition: the 90° angle is not always the visual median of the three shown angles', () => {
  const topic = FR022_GROUP2_TOPICS.find((t) => t.id === 'top_geometry_angle')!;
  const isMedianEachTime = topic.groups[0].tasks.every((task) => {
    const angles = (task.params as { angles: number[] }).angles;
    const sorted = [...angles].sort((a, b) => a - b);
    return sorted[1] === 90;
  });
  assert.equal(isMedianEachTime, false, '90° is the visual median angle in every single task — solvable by size comparison alone, not angle recognition');
});

test('spatial_ordering: correctAnswer values are not all the same permutation', () => {
  const topic = FR022_GROUP2_TOPICS.find((t) => t.id === 'top_space_ordering')!;
  assertNoConstantAnswerValue(`${topic.id}/${topic.groups[0].id}`, topic.groups[0].tasks);
});
