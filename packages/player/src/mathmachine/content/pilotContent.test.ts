import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MathMachineContentSchema } from '@kiosk/shared';
import pilotContent from './pilotContent.json' with { type: 'json' };

test('pilotContent.json validates against MathMachineContentSchema', () => {
  const result = MathMachineContentSchema.safeParse(pilotContent);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues, null, 2));
});

test('pilotContent has exactly two topics with at least one group each', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  const topicIds = Object.keys(parsed.topics);
  assert.equal(topicIds.length, 2);
  for (const id of topicIds) {
    assert.ok(parsed.topics[id].groupIds.length >= 1);
  }
});

test('every task referenced by a group actually exists in tasks', () => {
  const parsed = MathMachineContentSchema.parse(pilotContent);
  for (const group of Object.values(parsed.groups)) {
    for (const taskId of group.taskIds) {
      assert.ok(parsed.tasks[taskId], `missing task ${taskId} referenced by group ${group.id}`);
    }
  }
});
