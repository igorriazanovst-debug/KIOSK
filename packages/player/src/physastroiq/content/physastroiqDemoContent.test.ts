import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysastroiqQuizSchema } from '../model/schema.ts';
import demoContent from './physastroiqDemoContent.json' with { type: 'json' };

test('physastroiqDemoContent.json validates against PhysastroiqQuizSchema', () => {
  const result = PhysastroiqQuizSchema.safeParse(demoContent);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues));
});

test('physastroiqDemoContent.json has 4 questions per level', () => {
  const result = PhysastroiqQuizSchema.parse(demoContent);
  for (const level of [1, 2, 3] as const) {
    const count = result.questions.filter((q) => q.level === level).length;
    assert.equal(count, 4, `level ${level} should have 4 questions`);
  }
});
