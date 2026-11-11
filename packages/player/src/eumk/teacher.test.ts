// K5-2/K5-3: преподавательский режим (домен) и экспорт результатов.
// Преподаватель - аккаунт с ролью teacher (поле появляется как и пароль в
// K5-1: старые данные без поля парсятся, role по умолчанию student).
// Преподаватель видит результаты всех обучающихся, сбрасывает пароль
// обучающегося и выгружает результаты в CSV / на печать; данные не меняются.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountSchema, EumkUserDataSchema, emptyUserData, type Account, type EumkUserData } from './model/schema.ts';
import { csvEscape, isTeacher, resultsToCsv, rowsOf, studentsOf, buildResultsHtml } from './teacher.ts';

function account(id: string, name: string, role: 'student' | 'teacher' = 'student', password: unknown = null): Account {
  return { id, name, role, password, createdAt: 1000 };
}

function result(id: string, accountId: string, finishedAt: number, correct = 5, grade = 4) {
  return { id, accountId, finishedAt, durationSeconds: 120, correct, total: 10, grade,
    signature: `sig-${id}`, questionIds: ['q1', 'q2'] };
}

function data(): EumkUserData {
  const d = emptyUserData();
  d.accounts = [account('a1', 'Анна'), account('a2', 'Игорь'), account('t1', 'Мария Сергеевна', 'teacher')];
  d.results = [result('r1', 'a1', 2000), result('r2', 'a2', 3000), result('r3', 'a1', 1000), result('r4', 't1', 4000)];
  return d;
}

test('role is optional with student default (backward compat, как пароль в K5-1)', () => {
  const parsed = AccountSchema.parse({ id: 'a', name: 'Имя', createdAt: 1 });
  assert.equal(parsed.role, 'student');
  const old = AccountSchema.parse({ id: 'a', name: 'Имя', createdAt: 1, role: undefined });
  assert.equal(old.role, 'student');
  // старый блоб данных без поля role проходит целиком
  const blob = { schemaVersion: 1, accounts: [{ id: 'a', name: 'Имя', createdAt: 1 }], results: [], taskProgress: {}, soundOn: true };
  assert.equal(EumkUserDataSchema.safeParse(blob).success, true);
});

test('isTeacher distinguishes roles', () => {
  assert.equal(isTeacher(account('t', 'Т', 'teacher')), true);
  assert.equal(isTeacher(account('s', 'С')), false);
});

test('rowsOf: результаты всех с именами, новые сверху, у преподавателя - только свои', () => {
  const rows = rowsOf(data(), null);
  assert.deepEqual(rows.map((r) => r.id), ['r4', 'r2', 'r1', 'r3']);
  assert.equal(rows[3].studentName, 'Анна');
  const one = rowsOf(data(), 'a1');
  assert.deepEqual(one.map((r) => r.id), ['r1', 'r3']);
});

test('studentsOf: только обучающиеся, отсортированы по имени', () => {
  const names = studentsOf(data()).map((a) => a.name);
  assert.deepEqual(names, ['Анна', 'Игорь']);
});

test('csvEscape: запятые, кавычки и переносы экранируются', () => {
  assert.equal(csvEscape('просто'), 'просто');
  assert.equal(csvEscape('а,б'), '"а,б"');
  assert.equal(csvEscape('а"б'), '"а""б"');
  assert.equal(csvEscape('а\nб'), '"а\nб"');
  assert.equal(csvEscape('а;б'), 'а;б'); // разделитель - запятая, точка с запятой не опасна
});

test('resultsToCsv: заголовок, строки, числа как есть', () => {
  const csv = resultsToCsv(rowsOf(data(), 'a1'));
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Ученик,Дата,Баллы,Отметка,Время (мин:сек)');
  assert.ok(lines[1].startsWith('Анна,'), lines[1]);
  assert.equal(lines.length, 3); // заголовок + 2 результата
  assert.ok(!csv.includes('Игорь'));
});

test('resultsToCsv: имя с запятой не ломает колонки', () => {
  const d = data();
  d.accounts = [account('a1', 'Иванов, Иван')];
  d.results = [result('r1', 'a1', 2000)];
  const lines = resultsToCsv(rowsOf(d, null)).split('\n');
  assert.ok(lines[1].startsWith('"Иванов, Иван",'), lines[1]);
});

test('buildResultsHtml: таблица с именами и экранированием разметки', () => {
  const html = buildResultsHtml(rowsOf(data(), null), 'Итоги группы');
  assert.ok(html.includes('<table'));
  assert.ok(html.includes('Мария Сергеевна'));
  assert.ok(html.includes('Итоги группы'));
  const evil = data();
  evil.accounts = [account('a1', '<b>Хакер</b>')];
  evil.results = [result('r1', 'a1', 2000)];
  const safe = buildResultsHtml(rowsOf(evil, null), 'T');
  assert.ok(!safe.includes('<b>'), 'html-инъекция через имя ученика');
  assert.ok(safe.includes('&lt;b&gt;'));
});
