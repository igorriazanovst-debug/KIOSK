import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BioiqQuizSchema } from '../model/schema.ts';
import demoContent from './bioiqDemoContent.json' with { type: 'json' };

test('bioiqDemoContent.json validates against BioiqQuizSchema', () => {
  const result = BioiqQuizSchema.safeParse(demoContent);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify((result as any).error?.issues));
});

test('bioiqDemoContent.json has 4 questions per level', () => {
  const result = BioiqQuizSchema.parse(demoContent);
  for (const level of [1, 2, 3] as const) {
    const count = result.questions.filter((q) => q.level === level).length;
    assert.equal(count, 4, `level ${level} should have 4 questions`);
  }
});
