import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCreateUserWord,
  applyUpdateUserWord,
  applyDeleteUserWord,
  applyCreateSet,
  applyUpdateSet,
  applyDeleteSet,
  MIN_SET_WORDS,
} from './contentRules';
import { WordsRulesError } from './rules';
import type { UserSet, UserWord } from '../model/schema';

const word = (id: string, name: string, image: string | null = 'pic.png'): UserWord => ({
  id,
  name,
  level: 9,
  imageFile: image,
  audioFile: null,
});

const draft = (name: string, imageFile: string | null = 'pic.png', audioFile: string | null = null) => ({
  name,
  imageFile,
  audioFile,
});

// ─── Свои слова ─────────────────────────────────────────────────────────

test('своё слово создаётся с уровнем 9 — у него свой сценарий озвучки', () => {
  const { created } = applyCreateUserWord([], draft('Скворечник'), 'u1');
  assert.equal(created.level, 9);
  assert.equal(created.name, 'Скворечник');
});

test('название обрезается по краям, пустое отклоняется', () => {
  assert.equal(applyCreateUserWord([], draft('  Ёлка  '), 'u1').created.name, 'Ёлка');
  assert.throws(() => applyCreateUserWord([], draft('   '), 'u1'), WordsRulesError);
});

test('слово без картинки и без записи не создаётся', () => {
  // Его нечем показать ребёнку и нечем произнести
  assert.throws(
    () => applyCreateUserWord([], draft('Пустое', null, null), 'u1'),
    (e: unknown) => e instanceof WordsRulesError && /картинка или запись/.test(e.message),
  );
});

test('слово только с записью, без картинки — допустимо', () => {
  const { created } = applyCreateUserWord([], draft('Шорох', null, 'rec.webm'), 'u1');
  assert.equal(created.audioFile, 'rec.webm');
});

test('одинаковое название без учёта регистра отклоняется', () => {
  const words = [word('u1', 'Ёлка')];
  assert.throws(() => applyCreateUserWord(words, draft('ёлка'), 'u2'), WordsRulesError);
});

test('правка слова: имя меняется, идентификатор остаётся', () => {
  const words = [word('u1', 'Ёлка')];
  const { updated } = applyUpdateUserWord(words, 'u1', draft('Сосна', 'new.png'));
  assert.equal(updated.id, 'u1');
  assert.equal(updated.name, 'Сосна');
  assert.equal(updated.imageFile, 'new.png');
});

test('правка не считает собственное имя слова дубликатом', () => {
  const words = [word('u1', 'Ёлка'), word('u2', 'Сосна')];
  assert.doesNotThrow(() => applyUpdateUserWord(words, 'u1', draft('Ёлка', 'other.png')));
  assert.throws(() => applyUpdateUserWord(words, 'u1', draft('Сосна')), WordsRulesError);
});

test('правка несуществующего слова — ошибка', () => {
  assert.throws(() => applyUpdateUserWord([], 'нет', draft('Ёлка')), WordsRulesError);
});

// ─── Удаление слова: вычистка из комплектов ─────────────────────────────

test('удалённое слово вычищается из ВСЕХ комплектов', () => {
  // Комплект, ссылающийся на удалённое слово, — это партия, падающая посреди урока
  const words = [word('u1', 'Ёлка'), word('u2', 'Сосна'), word('u3', 'Берёза')];
  const sets: UserSet[] = [
    { id: 's1', title: 'Деревья', wordIds: ['u1', 'u2'] },
    { id: 's2', title: 'Лес', wordIds: ['u2', 'u3'] },
    { id: 's3', title: 'Без него', wordIds: ['u1', 'u3'] },
  ];

  const res = applyDeleteUserWord(words, sets, 'u2');

  assert.deepEqual(res.words.map((w) => w.id), ['u1', 'u3']);
  assert.deepEqual(res.sets.find((s) => s.id === 's1')!.wordIds, ['u1']);
  assert.deepEqual(res.sets.find((s) => s.id === 's2')!.wordIds, ['u3']);
  assert.deepEqual(res.sets.find((s) => s.id === 's3')!.wordIds, ['u1', 'u3']);
  assert.deepEqual(res.affectedSetIds, ['s1', 's2']);
});

test('после удаления ни в одном комплекте не остаётся висячей ссылки', () => {
  const words = [word('u1', 'Ёлка'), word('u2', 'Сосна')];
  const sets: UserSet[] = [{ id: 's1', title: 'Деревья', wordIds: ['u1', 'u2'] }];
  const res = applyDeleteUserWord(words, sets, 'u1');
  const known = new Set(res.words.map((w) => w.id));
  for (const set of res.sets) {
    for (const id of set.wordIds) assert.ok(known.has(id), `висячая ссылка ${id}`);
  }
});

test('файлы удалённого слова помечаются осиротевшими', () => {
  const words: UserWord[] = [
    { id: 'u1', name: 'Ёлка', level: 9, imageFile: 'a.png', audioFile: 'a.webm' },
  ];
  const res = applyDeleteUserWord(words, [], 'u1');
  assert.deepEqual(res.orphanedFiles.sort(), ['a.png', 'a.webm']);
});

test('файл, который делят два слова, осиротевшим не считается', () => {
  const words: UserWord[] = [
    { id: 'u1', name: 'Ёлка', level: 9, imageFile: 'общая.png', audioFile: null },
    { id: 'u2', name: 'Сосна', level: 9, imageFile: 'общая.png', audioFile: null },
  ];
  const res = applyDeleteUserWord(words, [], 'u1');
  assert.deepEqual(res.orphanedFiles, [], 'чужую картинку удалять нельзя');
});

test('удаление несуществующего слова — ошибка, а не тихий успех', () => {
  assert.throws(() => applyDeleteUserWord([], [], 'нет'), WordsRulesError);
});

// ─── Комплекты ──────────────────────────────────────────────────────────

const known = new Set(['0000', '0001', 'u1', 'u2']);

test('комплект собирается из поставочных и своих слов сразу', () => {
  // Прямое требование строки 56 ТЗ
  const { created } = applyCreateSet([], { title: 'Занятие', wordIds: ['0000', 'u1'] }, 's1', known);
  assert.deepEqual(created.wordIds, ['0000', 'u1']);
});

test('комплект из одного слова не создаётся', () => {
  assert.throws(
    () => applyCreateSet([], { title: 'Мало', wordIds: ['0000'] }, 's1', known),
    (e: unknown) => e instanceof WordsRulesError && new RegExp(String(MIN_SET_WORDS)).test(e.message),
  );
});

test('повторы слов в комплекте схлопываются', () => {
  const { created } = applyCreateSet(
    [],
    { title: 'Занятие', wordIds: ['0000', '0001', '0000'] },
    's1',
    known,
  );
  assert.deepEqual(created.wordIds, ['0000', '0001']);
});

test('комплект со ссылкой на несуществующее слово отклоняется', () => {
  assert.throws(
    () => applyCreateSet([], { title: 'Битый', wordIds: ['0000', 'u9999'] }, 's1', known),
    WordsRulesError,
  );
});

test('одинаковое название комплекта отклоняется', () => {
  const sets: UserSet[] = [{ id: 's1', title: 'Занятие', wordIds: ['0000', '0001'] }];
  assert.throws(
    () => applyCreateSet(sets, { title: 'занятие', wordIds: ['u1', 'u2'] }, 's2', known),
    WordsRulesError,
  );
});

test('переименование и правка состава — одна операция', () => {
  const sets: UserSet[] = [{ id: 's1', title: 'Занятие', wordIds: ['0000', '0001'] }];
  const { updated } = applyUpdateSet(sets, 's1', { title: 'Урок', wordIds: ['u1', 'u2'] }, known);
  assert.equal(updated.id, 's1');
  assert.equal(updated.title, 'Урок');
  assert.deepEqual(updated.wordIds, ['u1', 'u2']);
});

test('правка не считает собственное название дубликатом', () => {
  const sets: UserSet[] = [
    { id: 's1', title: 'Занятие', wordIds: ['0000', '0001'] },
    { id: 's2', title: 'Урок', wordIds: ['u1', 'u2'] },
  ];
  assert.doesNotThrow(() => applyUpdateSet(sets, 's1', { title: 'Занятие', wordIds: ['u1', 'u2'] }, known));
  assert.throws(() => applyUpdateSet(sets, 's1', { title: 'Урок', wordIds: ['u1', 'u2'] }, known), WordsRulesError);
});

test('удаление комплекта не трогает слова', () => {
  const sets: UserSet[] = [
    { id: 's1', title: 'Занятие', wordIds: ['0000', '0001'] },
    { id: 's2', title: 'Урок', wordIds: ['u1', 'u2'] },
  ];
  assert.deepEqual(applyDeleteSet(sets, 's1').map((s) => s.id), ['s2']);
  assert.throws(() => applyDeleteSet(sets, 'нет'), WordsRulesError);
});
