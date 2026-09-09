import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MathMachineContent, GroupProgress } from '@kiosk/shared';
import { TOPIC_CATEGORIES, categorizeTopicId, listTopicsByCategory, isTopicComplete } from './topicCategories.ts';

// Две темы делят префикс top_addition* (сложение / сумма трёх чисел —
// проверяет, что более специфичная категория выигрывает), плюс тема без
// сопоставленной категории (проверяет, что она тихо отбрасывается, а не
// падает и не создаёт пустую категорию).
const content: MathMachineContent = {
  schemaVersion: 1,
  sections: [{ id: 's1', name: 'Арифметика', topicIds: ['top_addition', 'top_addition_three_wide', 'top_unknown_thing'] }],
  topics: {
    top_addition: { id: 'top_addition', name: 'Сложение', groupIds: ['ga'] },
    top_addition_three_wide: { id: 'top_addition_three_wide', name: 'Сумма трёх чисел: числа до 20', groupIds: ['gb'] },
    top_unknown_thing: { id: 'top_unknown_thing', name: 'Тема без категории', groupIds: ['gc'] },
  },
  groups: {
    ga: { id: 'ga', name: 'Группа A', taskIds: ['t1'] },
    gb: { id: 'gb', name: 'Группа B', taskIds: ['t2'] },
    gc: { id: 'gc', name: 'Группа C', taskIds: ['t3'] },
  },
  tasks: {
    t1: { id: 't1', typeId: 'number_sum_two', text: '1+1', params: { a: 1, b: 1 }, correctAnswer: 2 },
    t2: { id: 't2', typeId: 'number_sum_two', text: '2+2', params: { a: 2, b: 2 }, correctAnswer: 4 },
    t3: { id: 't3', typeId: 'number_sum_two', text: '3+3', params: { a: 3, b: 3 }, correctAnswer: 6 },
  },
  mathTools: [],
  media: {},
};

test('categorizeTopicId prefers the more specific addition_three category over addition', () => {
  assert.equal(categorizeTopicId('top_addition_three_wide')?.key, 'addition_three');
  assert.equal(categorizeTopicId('top_addition')?.key, 'addition');
});

test('categorizeTopicId returns undefined for an id matching no known category', () => {
  assert.equal(categorizeTopicId('top_unknown_thing'), undefined);
});

test('listTopicsByCategory groups topics by their id-derived category, dropping unmatched topics', () => {
  const groups = listTopicsByCategory(content);
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  assert.deepEqual(byKey.addition.topics.map((t) => t.topicId), ['top_addition']);
  assert.deepEqual(byKey.addition_three.topics.map((t) => t.topicId), ['top_addition_three_wide']);
  const allTopicIds = groups.flatMap((g) => g.topics.map((t) => t.topicId));
  assert.ok(!allTopicIds.includes('top_unknown_thing'), 'unmatched topic must not appear in any category');
});

test('listTopicsByCategory never emits an empty category group', () => {
  for (const g of listTopicsByCategory(content)) {
    assert.ok(g.topics.length > 0, `category ${g.key} must not be empty`);
  }
});

test('listTopicsByCategory preserves the declared TOPIC_CATEGORIES order', () => {
  const keys = listTopicsByCategory(content).map((g) => g.key);
  const expectedOrder = TOPIC_CATEGORIES.map((c) => c.key).filter((k) => keys.includes(k));
  assert.deepEqual(keys, expectedOrder);
});

test('isTopicComplete is true when the topic\'s single group is fully done', () => {
  const allDone: Record<string, GroupProgress> = { ga: { doneTaskIds: ['t1'], currentTaskId: null } };
  assert.equal(isTopicComplete(content, allDone, 'top_addition'), true);
});

test('isTopicComplete is false when a topic has multiple groups and only some are done', () => {
  const multiGroupContent: MathMachineContent = {
    ...content,
    topics: { ...content.topics, top_addition: { id: 'top_addition', name: 'Сложение', groupIds: ['ga', 'gb'] } },
  };
  const partial: Record<string, GroupProgress> = { ga: { doneTaskIds: ['t1'], currentTaskId: null } };
  assert.equal(isTopicComplete(multiGroupContent, partial, 'top_addition'), false);
});

test('isTopicComplete is false with no progress at all', () => {
  assert.equal(isTopicComplete(content, {}, 'top_addition'), false);
});

test('isTopicComplete is false for an unknown topic id', () => {
  assert.equal(isTopicComplete(content, {}, 'top_nope'), false);
});
