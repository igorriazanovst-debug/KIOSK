import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FR022_GROUP1_TOPICS, countFR022Group1Tasks } from './generateFR022Group1Content.ts';

// Инвариант, найденный ценой дорогого урока в Эпике 12 (арифметика):
// позиция правильного ответа в choices НЕ должна быть константой внутри
// группы — иначе задание решается кликом на фиксированную позицию, не
// применяя реальный навык. Пишется ВМЕСТЕ с первым коммитом генератора,
// не постфактум (см. Тип6_бэклог.md, Эпик 30).
function assertNoConstantAnswerPosition(groupName: string, tasks: { choices?: (number | string)[]; correctAnswer: number | string }[]) {
  const withChoices = tasks.filter((t) => t.choices && t.choices.length > 1);
  if (withChoices.length < 2) return; // недостаточно заданий, чтобы иметь позиционный паттерн
  const positions = withChoices.map((t) => t.choices!.findIndex((c) => String(c) === String(t.correctAnswer)));
  assert.ok(positions.every((p) => p >= 0), `${groupName}: correctAnswer not found among choices for some task`);
  const distinctPositions = new Set(positions);
  assert.ok(
    distinctPositions.size > 1,
    `${groupName}: correct answer sits at the same position (${[...distinctPositions]}) in all ${positions.length} tasks — position-bias defect (Эпик 12 class)`,
  );
}

test('FR022 Group 1 produces exactly the expected topic/group/task counts', () => {
  assert.equal(FR022_GROUP1_TOPICS.length, 8);
  const topicIds = FR022_GROUP1_TOPICS.map((t) => t.id);
  assert.deepEqual(
    [...topicIds].sort(),
    [
      'top_measure_length',
      'top_measure_mass',
      'top_measure_volume',
      'top_measure_estimate',
      'top_time_weekday',
      'top_time_season',
      'top_time_event',
      'top_shares_fraction_compare',
    ].sort(),
  );
  assert.equal(countFR022Group1Tasks(), 10 + 10 + 10 + 7 + 4 + 10 + 8 + 10);
});

test('every task has a unique id within FR022 Group 1', () => {
  const ids = FR022_GROUP1_TOPICS.flatMap((t) => t.groups.flatMap((g) => g.tasks.map((task) => task.id)));
  assert.equal(new Set(ids).size, ids.length);
});

test('no choice-mode group in FR022 Group 1 has a constant correct-answer position', () => {
  for (const topic of FR022_GROUP1_TOPICS) {
    for (const group of topic.groups) {
      assertNoConstantAnswerPosition(`${topic.id}/${group.id}`, group.tasks);
    }
  }
});

test('estimate_fraction tasks never have equal numerators (no ambiguous comparison)', () => {
  const fractionTopic = FR022_GROUP1_TOPICS.find((t) => t.id === 'top_shares_fraction_compare')!;
  for (const group of fractionTopic.groups) {
    for (const task of group.tasks) {
      assert.notEqual(task.params.numA, task.params.numB);
    }
  }
});

test('compare_mass and compare_volume tasks never compare an item to itself', () => {
  for (const topicId of ['top_measure_mass', 'top_measure_volume']) {
    const topic = FR022_GROUP1_TOPICS.find((t) => t.id === topicId)!;
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        assert.equal(task.choices?.length, 2);
        assert.notEqual(task.choices![0], task.choices![1]);
      }
    }
  }
});

// Найдено НЕЗАВИСИМЫМ ревью содержания (2026-09-09), не этим набором
// тестов: в top_measure_length correctAnswer был буквально 'Первый' во
// ВСЕХ 10 заданиях — позиция кнопки честно варьировалась (см. тест выше),
// но сама ПОДПИСЬ правильного ответа была константой. Ребёнок мог решать
// задание, кликая кнопку с текстом «Первый», вообще не глядя на отрезки —
// позиционный тест этого не ловит, потому что проверяет ИНДЕКС в choices,
// а не то, какое литеральное значение хранится в correctAnswer. Тот же
// класс уязвимости применим к любой группе, где словарь вариантов ответа
// ФИКСИРОВАН и ПОВТОРЯЕТСЯ между заданиями (три ниже) — не к
// compare_mass/compare_volume/event_order, где у каждого задания свои,
// уникальные названия предметов/событий, кликать по фиксированной подписи
// там не получится.
function assertNoConstantAnswerValue(groupName: string, tasks: { correctAnswer: number | string }[]) {
  const values = tasks.map((t) => String(t.correctAnswer));
  const distinct = new Set(values);
  assert.ok(
    distinct.size > 1,
    `${groupName}: correctAnswer value is the same literal ("${values[0]}") for all ${values.length} tasks — a solver could click that label without reading the question at all`,
  );
}

test('groups with a small shared choice vocabulary do not have a constant correct-answer value', () => {
  for (const topicId of ['top_measure_length', 'top_time_weekday', 'top_time_season']) {
    const topic = FR022_GROUP1_TOPICS.find((t) => t.id === topicId)!;
    for (const group of topic.groups) {
      assertNoConstantAnswerValue(`${topic.id}/${group.id}`, group.tasks);
    }
  }
});

test('every task in FR022 Group 1 has choices that include the correct answer', () => {
  for (const topic of FR022_GROUP1_TOPICS) {
    for (const group of topic.groups) {
      for (const task of group.tasks) {
        assert.ok(task.choices, `${task.id}: missing choices`);
        assert.ok(
          task.choices!.some((c) => String(c) === String(task.correctAnswer)),
          `${task.id}: correctAnswer ${task.correctAnswer} not present in choices ${JSON.stringify(task.choices)}`,
        );
      }
    }
  }
});
