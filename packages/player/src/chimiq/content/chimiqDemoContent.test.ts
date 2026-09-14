import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChimiqQuizSchema } from '../model/schema.ts';
import demoContent from './chimiqDemoContent.json' with { type: 'json' };

test('chimiqDemoContent.json validates against ChimiqQuizSchema', () => {
  const result = ChimiqQuizSchema.safeParse(demoContent);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues));
});

test('chimiqDemoContent.json has 4 questions per level', () => {
  const result = ChimiqQuizSchema.parse(demoContent);
  for (const level of [1, 2, 3] as const) {
    const count = result.questions.filter((q) => q.level === level).length;
    assert.equal(count, 4, `level ${level} should have 4 questions`);
  }
});
