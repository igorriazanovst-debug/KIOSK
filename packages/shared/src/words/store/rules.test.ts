import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeProfiles,
  applyCreateProfile,
  applyDeleteProfile,
  applySaveScore,
  WordsRulesError,
  MAX_PROFILES,
} from './rules';
import type { Profile, AwardTier } from '../model/schema';

const profile = (id: string, name: string): Profile => ({ id, name, createdAt: '2026-09-08T00:00:00.000Z' });

test('битые записи отбрасываются, целые выживают', () => {
  // Частично повреждённый файл не должен стоить педагогу всего списка детей
  const cleaned = sanitizeProfiles([profile('a', 'Аня'), { id: 42 }, null, 'мусор']);
  assert.deepEqual(cleaned.map((p) => p.name), ['Аня']);
});

test('не массив на входе — пустой список, а не падение', () => {
  assert.deepEqual(sanitizeProfiles(null), []);
  assert.deepEqual(sanitizeProfiles({ a: 1 }), []);
});

test('имя игрока обрезается по краям', () => {
  const { created } = applyCreateProfile([], '  Боря  ', 'id-1', 'now');
  assert.equal(created.name, 'Боря');
});

test('пустое имя отклоняется', () => {
  assert.throws(() => applyCreateProfile([], '   ', 'id', 'now'), WordsRulesError);
  assert.throws(() => applyCreateProfile([], '', 'id', 'now'), WordsRulesError);
});

test('слишком длинное имя отклоняется', () => {
  assert.throws(() => applyCreateProfile([], 'я'.repeat(41), 'id', 'now'), WordsRulesError);
});

test('одинаковое имя без учёта регистра отклоняется', () => {
  const existing = [profile('a', 'Вика')];
  assert.throws(() => applyCreateProfile(existing, 'вика', 'id', 'now'), WordsRulesError);
});

test('предел числа игроков соблюдается', () => {
  const many = Array.from({ length: MAX_PROFILES }, (_, i) => profile(`id${i}`, `Игрок${i}`));
  assert.throws(() => applyCreateProfile(many, 'Ещё один', 'id', 'now'), WordsRulesError);
});

test('созданный игрок добавляется в конец, исходный список не мутируется', () => {
  const before = [profile('a', 'Аня')];
  const { profiles } = applyCreateProfile(before, 'Боря', 'b', 'now');
  assert.deepEqual(profiles.map((p) => p.name), ['Аня', 'Боря']);
  assert.equal(before.length, 1, 'исходный массив не тронут');
});

test('удаление игрока уносит его достижения', () => {
  const profiles = [profile('a', 'Аня'), profile('b', 'Боря')];
  const scores: Record<string, Record<string, AwardTier>> = {
    a: { digits: 'gold' },
    b: { digits: 'silver' },
  };
  const next = applyDeleteProfile(profiles, scores, 'a');
  assert.deepEqual(next.profiles.map((p) => p.name), ['Боря']);
  assert.equal(next.scores.a, undefined);
  assert.equal(next.scores.b.digits, 'silver');
});

test('удаление несуществующего игрока — ошибка, а не тихий успех', () => {
  assert.throws(() => applyDeleteProfile([], {}, 'нет-такого'), WordsRulesError);
});

test('достижение повышается', () => {
  const first = applySaveScore({}, 'p1', 'digits', 'wooden');
  assert.equal(first.changed, true);
  const second = applySaveScore(first.scores, 'p1', 'digits', 'gold');
  assert.equal(second.changed, true);
  assert.equal(second.scores.p1.digits, 'gold');
});

test('понизить ступень нельзя', () => {
  const gold = applySaveScore({}, 'p1', 'digits', 'gold').scores;
  const down = applySaveScore(gold, 'p1', 'digits', 'wooden');
  assert.equal(down.changed, false);
  assert.equal(down.tier, 'gold');
  assert.equal(down.scores.p1.digits, 'gold');
});

test('повтор той же ступени ничего не меняет', () => {
  const silver = applySaveScore({}, 'p1', 'digits', 'silver').scores;
  assert.equal(applySaveScore(silver, 'p1', 'digits', 'silver').changed, false);
});

test('темы и игроки не смешиваются', () => {
  let scores = applySaveScore({}, 'p1', 'digits', 'gold').scores;
  scores = applySaveScore(scores, 'p1', 'pets', 'wooden').scores;
  scores = applySaveScore(scores, 'p2', 'digits', 'silver').scores;
  assert.equal(scores.p1.digits, 'gold');
  assert.equal(scores.p1.pets, 'wooden');
  assert.equal(scores.p2.digits, 'silver');
});

test('неизвестная ступень отклоняется', () => {
  assert.throws(() => applySaveScore({}, 'p1', 'digits', 'platinum' as AwardTier), WordsRulesError);
});

test('правила одинаковы для любой платформы: идентификатор и время приходят снаружи', () => {
  // Именно поэтому Windows и Android получают одно поведение, а не два
  const a = applyCreateProfile([], 'Аня', 'electron-id', 'T1');
  const b = applyCreateProfile([], 'Аня', 'android-id', 'T2');
  assert.equal(a.created.name, b.created.name);
  assert.notEqual(a.created.id, b.created.id);
});
