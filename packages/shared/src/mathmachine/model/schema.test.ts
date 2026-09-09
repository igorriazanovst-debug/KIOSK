import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaAssetSchema,
  TaskSchema,
  TaskTypeIdSchema,
  GroupSchema,
  TopicSchema,
  SectionSchema,
  MathToolSchema,
  MathMachineContentSchema,
  MATHMACHINE_CONTENT_SCHEMA_VERSION,
  GroupProgressSchema,
  MathMachineUserDataSchema,
  MATHMACHINE_USERDATA_SCHEMA_VERSION,
} from './schema';

test('MediaAssetSchema rejects a sha256 that is not 64 lowercase hex chars', () => {
  assert.equal(
    MediaAssetSchema.safeParse({ id: 'm1', fileName: 'a.mp3', mimeType: 'audio/mpeg', fileSize: 1, sha256: 'ABCDEF' }).success,
    false,
  );
});

test('MediaAssetSchema rejects a fileName containing a path separator', () => {
  assert.equal(
    MediaAssetSchema.safeParse({ id: 'm1', fileName: '../a.mp3', mimeType: 'audio/mpeg', fileSize: 1, sha256: 'a'.repeat(64) }).success,
    false,
  );
});

test('TaskSchema rejects an unknown typeId', () => {
  assert.equal(
    TaskSchema.safeParse({ id: 't1', typeId: 'not_a_real_type', text: 'x', params: {}, correctAnswer: 1 }).success,
    false,
  );
});

test('TaskSchema accepts a well-formed numeric task with array params (number_missing)', () => {
  const result = TaskSchema.safeParse({
    id: 't1',
    typeId: 'number_missing',
    text: 'Какое число пропущено?',
    params: { series: [2, 4, 6, 8, 10], missingIndex: 2 },
    correctAnswer: 6,
  });
  assert.equal(result.success, true);
});

test('GroupSchema rejects a group with zero tasks', () => {
  assert.equal(GroupSchema.safeParse({ id: 'g1', name: 'Группа', taskIds: [] }).success, false);
});

test('MathMachineContentSchema requires the exact current schemaVersion', () => {
  assert.equal(
    MathMachineContentSchema.safeParse({ schemaVersion: 999, sections: [], topics: {}, groups: {}, tasks: {}, mathTools: [], media: {} }).success,
    false,
  );
  assert.equal(
    MathMachineContentSchema.safeParse({
      schemaVersion: MATHMACHINE_CONTENT_SCHEMA_VERSION, sections: [], topics: {}, groups: {}, tasks: {}, mathTools: [], media: {},
    }).success,
    true,
  );
});

test('MathMachineUserDataSchema defaults progress to empty and soundOn to true', () => {
  const result = MathMachineUserDataSchema.parse({ schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION });
  assert.deepEqual(result.progress, {});
  assert.equal(result.soundOn, true);
});

test('GroupProgressSchema defaults doneTaskIds to empty and currentTaskId to null', () => {
  const result = GroupProgressSchema.parse({});
  assert.deepEqual(result.doneTaskIds, []);
  assert.equal(result.currentTaskId, null);
});

test('SectionSchema and MathToolSchema accept minimal well-formed records', () => {
  assert.equal(SectionSchema.safeParse({ id: 's1', name: 'Арифметика', topicIds: ['t1'] }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'weights', name: 'Весы' }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'not_a_tool', name: 'X' }).success, false);
});

test('MathToolSchema accepts the two Этап 2a tool ids (chain, two_segments)', () => {
  assert.equal(MathToolSchema.safeParse({ id: 'chain', name: 'Цепочка' }).success, true);
  assert.equal(MathToolSchema.safeParse({ id: 'two_segments', name: 'Два отрезка' }).success, true);
});

test('TaskTypeIdSchema accepts the five Этап 2b wave 1 task types', () => {
  const wave1Types = ['number_subtract_two', 'number_compare', 'digit_recognition', 'number_composition', 'number_ordering'];
  for (const id of wave1Types) {
    assert.equal(TaskTypeIdSchema.safeParse(id).success, true, `expected ${id} to be a valid TaskTypeId`);
  }
});

test('TaskTypeIdSchema accepts the five Этап 2b wave 2 task types', () => {
  const wave2Types = ['number_multiply_two', 'number_divide_remainder', 'number_multiple_check', 'round_to_ten', 'ordinal_position'];
  for (const id of wave2Types) {
    assert.equal(TaskTypeIdSchema.safeParse(id).success, true, `expected ${id} to be a valid TaskTypeId`);
  }
});

test('TaskTypeIdSchema accepts the Этап 2b wave 3 task type (share_of_whole)', () => {
  assert.equal(TaskTypeIdSchema.safeParse('share_of_whole').success, true);
});
