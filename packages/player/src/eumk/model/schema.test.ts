import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AccountSchema, EumkContentSchema, EumkUserDataSchema, GameSchema, GradeScaleSchema, PasswordRecordSchema,
  PBKDF2_ALGO_ID, PASSWORD_RECORD_VERSION, PASSWORD_SALT_BYTES,
} from './schema.ts';

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

// ---------- Д-1: привязка игр к блокам теории ----------

test('a game without a block field stays valid with block="" (backward compat)', () => {
  const parsed = GameSchema.parse({ id: 'ng-test', title: 'Игра тестовая', type: 'logic' });
  assert.equal(parsed.block, '');
  // И весь реальный контент без поля block проходит без изменений.
  assert.equal(EumkContentSchema.safeParse(base).success, true);
});

test('a game can be attributed to an existing theory block (Д-1)', () => {
  const c = clone();
  c.games[0].block = c.theory[1].id;
  const parsed = EumkContentSchema.parse(c);
  assert.equal(parsed.games[0].block, 'n-b2');
});

test('a game block must reference an existing theory block', () => {
  const c = clone();
  c.games[0].block = 'нет-такого-блока';
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

// ---------- K5-1: пароли локальных учётных записей ----------

const validRecord = {
  version: PASSWORD_RECORD_VERSION,
  algo: PBKDF2_ALGO_ID,
  iterations: 1000,
  salt: 'ab'.repeat(PASSWORD_SALT_BYTES),
  hash: 'cd'.repeat(32),
  keyLen: 32,
};

test('an account saved before K5-1 (no password field) still parses - password becomes null', () => {
  const parsed = AccountSchema.parse({ id: 'acc-1', name: 'Ученик 1', createdAt: 123 });
  assert.equal(parsed.password, null);
});

test('a legacy user-data blob without any password fields parses unchanged (migration)', () => {
  const raw = {
    schemaVersion: 1,
    accounts: [{ id: 'acc-1', name: 'Ученик 1', createdAt: 123 }],
    results: [],
    taskProgress: {},
    soundOn: true,
  };
  const parsed = EumkUserDataSchema.parse(raw);
  assert.equal(parsed.accounts[0].password, null);
});

test('PasswordRecordSchema accepts a well-formed PBKDF2 record', () => {
  assert.equal(PasswordRecordSchema.safeParse(validRecord).success, true);
});

test('PasswordRecordSchema rejects damaged records', () => {
  const broken = [
    { ...validRecord, algo: 'scrypt' },                    // чужой алгоритм
    { ...validRecord, version: 2 },                        // формат будущей версии
    { ...validRecord, iterations: 0 },
    { ...validRecord, iterations: 100000001 },             // абсурдное число итераций
    { ...validRecord, salt: 'не-hex' },                    // не hex
    { ...validRecord, salt: 'ab' },                        // соль короче 16 байт
    { ...validRecord, salt: `${'ab'.repeat(16)}a` },       // нечётная длина hex - обрезанная запись
    { ...validRecord, hash: 'zz' },                        // не hex и не та длина
    { ...validRecord, hash: 'cd'.repeat(31) },             // длина хэша не равна keyLen*2
    { ...validRecord, keyLen: 0 },
    {},
  ];
  for (const bad of broken) {
    assert.equal(PasswordRecordSchema.safeParse(bad).success, false, `должна быть ошибка для ${JSON.stringify(bad)}`);
  }
});

// ---------- Волна 0 (S2): block/section заданий и section банка ----------

test('a task block must reference an existing theory block (S2)', () => {
  const c = clone();
  c.tasks[0].block = 'нет-такого-блока';
  assert.equal(EumkContentSchema.safeParse(c).success, false);
});

test('a task section must belong to the block of the task itself (S2)', () => {
  const c = clone();
  // nt-001 принадлежит n-b1; подсунем секцию чужого блока n-b2.
  c.tasks[0].section = c.theory[1].sections[0].id;
  assert.equal(EumkContentSchema.safeParse(c).success, false);
});

test('a bank question section must belong to the block of the question (S2)', () => {
  const c = clone();
  const foreign = c.theory.find((b: any) => b.id !== c.bank[0].block);
  c.bank[0].section = foreign.sections[0].id;
  assert.equal(EumkContentSchema.safeParse(c).success, false);
});

test('an empty task section is tolerated by the schema (checked by the battery)', () => {
  const c = clone();
  c.tasks[0].section = '';
  assert.equal(EumkContentSchema.safeParse(c).success, true);
});
