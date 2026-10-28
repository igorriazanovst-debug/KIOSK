import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EumkContentSchema, GradeScaleSchema } from './schema.ts';

const base = JSON.parse(readFileSync(new URL('../content/nach.content.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));

test('the real primary content passes the schema', () => {
  assert.equal(EumkContentSchema.safeParse(base).success, true);
});

test('a grade scale must not rise as the mark falls', () => {
  assert.equal(GradeScaleSchema.safeParse({ five: 0.5, four: 0.75, three: 0.4 }).success, false);
  assert.equal(GradeScaleSchema.safeParse({ five: 0.9, four: 0.75, three: 0.5 }).success, true);
});

test('duplicate task ids are rejected', () => {
  const c = clone();
  c.tasks[1].id = c.tasks[0].id;
  assert.equal(EumkContentSchema.safeParse(c).success, false);
});

test('duplicate game ids are rejected', () => {
  const c = clone();
  c.games[1].id = c.games[0].id;
  assert.equal(EumkContentSchema.safeParse(c).success, false);
});

test('a gaps answer outside its options is rejected', () => {
  const c = clone();
  const t = c.tasks.find((x: any) => x.type === 'gaps');
  t.data.answers[0] = 'нет такого варианта';
  assert.equal(EumkContentSchema.safeParse(c).success, false);
});

test('duplicate sort items or match left parts are rejected', () => {
  const c = clone();
  const s = c.tasks.find((x: any) => x.type === 'sort');
  s.data.items[1].text = s.data.items[0].text;
  assert.equal(EumkContentSchema.safeParse(c).success, false);
  const d = clone();
  const m = d.tasks.find((x: any) => x.type === 'match');
  m.data.pairs[1][0] = m.data.pairs[0][0];
  assert.equal(EumkContentSchema.safeParse(d).success, false);
});
