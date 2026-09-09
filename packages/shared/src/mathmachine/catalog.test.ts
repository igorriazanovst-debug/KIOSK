import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTopics, listGroupsForTopic, tasksForGroup, nextUndoneTaskId, summarizeGroupProgress } from './catalog';
import type { MathMachineContent, Group } from './model/schema';

const content: MathMachineContent = {
  schemaVersion: 1,
  sections: [{ id: 's1', name: 'Арифметика', topicIds: ['top1'] }],
  topics: { top1: { id: 'top1', name: 'Сложение', groupIds: ['g1'] } },
  groups: { g1: { id: 'g1', name: 'Группа 1', taskIds: ['t1', 't2', 't3'] } },
  tasks: {
    t1: { id: 't1', typeId: 'number_sum_two', text: '1+1', params: { a: 1, b: 1 }, correctAnswer: 2 },
    t2: { id: 't2', typeId: 'number_sum_two', text: '2+2', params: { a: 2, b: 2 }, correctAnswer: 4 },
    t3: { id: 't3', typeId: 'number_sum_two', text: '3+3', params: { a: 3, b: 3 }, correctAnswer: 6 },
  },
  mathTools: [],
  media: {},
};

test('listTopics flattens sections into topic refs with section context', () => {
  const topics = listTopics(content);
  assert.deepEqual(topics, [{ sectionId: 's1', sectionName: 'Арифметика', topicId: 'top1', topicName: 'Сложение' }]);
});

test('listGroupsForTopic returns the resolved Group objects for a topic', () => {
  const groups = listGroupsForTopic(content, 'top1');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 'g1');
});

test('listGroupsForTopic returns an empty array for an unknown topic', () => {
  assert.deepEqual(listGroupsForTopic(content, 'nope'), []);
});

test('tasksForGroup resolves task ids to Task objects in order', () => {
  const tasks = tasksForGroup(content, 'g1');
  assert.deepEqual(tasks.map((t) => t.id), ['t1', 't2', 't3']);
});

test('nextUndoneTaskId returns the first task not yet in doneTaskIds', () => {
  const group: Group = content.groups.g1;
  assert.equal(nextUndoneTaskId(group, undefined), 't1');
  assert.equal(nextUndoneTaskId(group, { doneTaskIds: ['t1'], currentTaskId: null }), 't2');
});

test('nextUndoneTaskId returns null when the group is fully done', () => {
  const group: Group = content.groups.g1;
  assert.equal(nextUndoneTaskId(group, { doneTaskIds: ['t1', 't2', 't3'], currentTaskId: null }), null);
});

test('summarizeGroupProgress reports total and doneCount', () => {
  const group: Group = content.groups.g1;
  const summary = summarizeGroupProgress(group, { doneTaskIds: ['t1'], currentTaskId: 't2' });
  assert.equal(summary.total, 3);
  assert.equal(summary.doneCount, 1);
  assert.equal(summary.currentIndex, 1);
});

test('summarizeGroupProgress with no progress at all reports zero done', () => {
  const group: Group = content.groups.g1;
  const summary = summarizeGroupProgress(group, undefined);
  assert.equal(summary.doneCount, 0);
  assert.equal(summary.currentIndex, 0);
});
