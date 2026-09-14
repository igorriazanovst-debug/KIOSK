// packages/shared/src/inophone/game/session.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInophoneSession,
  answer,
  clearLastAnswer,
  currentConceptId,
  currentPlayerId,
  results,
  winners,
  sceneConceptIds,
  findScene,
  MAX_PLAYERS,
  SessionSetupError,
} from './session';
import { togglePresentation, isPresentationUsable, DEFAULT_PRESENTATION } from './presentation';
import { parseInophoneLibrary } from '../model/schema';
import { LANGUAGE_CODES } from '../model/languages';

function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const langs = (w: string) =>
  Object.fromEntries(LANGUAGE_CODES.map((c) => [c, { text: `${w}-${c}`, hasAudio: c === 'ru' }]));
const titles = (t: string) => Object.fromEntries(LANGUAGE_CODES.map((c) => [c, `${t}-${c}`]));

/** Сцена на восемь объектов — хватает, чтобы раздача разводила задания */
function testLibrary() {
  const names = ['bed', 'lamp', 'rug', 'chair', 'door', 'window', 'clock', 'pillow'];
  return parseInophoneLibrary({
    schemaVersion: 1,
    concepts: names.map((n) => ({ id: n, hasPicture: true, translations: langs(n) })),
    scenes: [
      {
        id: 'bedroom',
        titles: titles('Спальня'),
        viewBox: { width: 1600, height: 1000 },
        hotspots: names.map((n, i) => ({
          conceptId: n,
          points: `${i * 100},10 ${i * 100 + 80},10 ${i * 100 + 80},90 ${i * 100},90`,
        })),
      },
    ],
    themes: [{ id: 'flat', titles: titles('Квартира'), sceneIds: ['bedroom'] }],
  });
}

const build = (over: Record<string, unknown> = {}) =>
  buildInophoneSession(testLibrary(), {
    roundId: 'r1',
    mode: 'training',
    sceneId: 'bedroom',
    playerIds: ['p1'],
    questionsPerPlayer: 3,
    rng: seededRng(7),
    ...over,
  });

test('партия собирается и задания берутся только со сцены', () => {
  const s = build();
  const pool = new Set(sceneConceptIds(findScene(testLibrary(), 'bedroom')));
  assert.equal(s.questions.p1.length, 3);
  for (const c of s.questions.p1) assert.ok(pool.has(c), `${c} не со сцены`);
});

test('соревнование в одиночку отвергается', () => {
  // ТЗ строка 89: «для двух и более пользователей». Молча превратить
  // соревнование в тренировку — худшее из решений
  assert.throws(() => build({ mode: 'challenge' }), SessionSetupError);
});

test('соревнование вдвоём собирается', () => {
  const s = build({ mode: 'challenge', playerIds: ['p1', 'p2'] });
  assert.equal(s.questions.p1.length, 3);
  assert.equal(s.questions.p2.length, 3);
});

test('игроков сверх предела и повторяющихся отвергает', () => {
  assert.throws(() => build({ playerIds: ['a', 'b', 'c', 'd', 'e'] }), SessionSetupError);
  assert.throws(() => build({ playerIds: ['a', 'a'] }), SessionSetupError);
  assert.equal(MAX_PLAYERS, 4);
});

test('сцена без объектов не даёт собрать партию', () => {
  const lib = parseInophoneLibrary({
    schemaVersion: 1,
    concepts: [{ id: 'bed', hasPicture: true, translations: langs('bed') }],
    scenes: [
      { id: 'empty', titles: titles('Пусто'), viewBox: { width: 10, height: 10 }, hotspots: [] },
      {
        id: 'ok',
        titles: titles('Есть'),
        viewBox: { width: 10, height: 10 },
        hotspots: [{ conceptId: 'bed', points: '1,1 2,1 2,2' }],
      },
    ],
    themes: [{ id: 't', titles: titles('Т'), sceneIds: ['empty', 'ok'] }],
  });
  assert.throws(
    () =>
      buildInophoneSession(lib, {
        roundId: 'r',
        mode: 'training',
        sceneId: 'empty',
        playerIds: ['p1'],
        questionsPerPlayer: 1,
        rng: seededRng(1),
      }),
    /нет размеченных объектов/
  );
});

test('верный ответ засчитывается и двигает партию', () => {
  let s = build();
  const expected = currentConceptId(s);
  assert.ok(expected);
  const out = answer(s, expected);
  assert.equal(out.correct, true);
  assert.equal(out.session.tally.p1.success, 1);
  assert.equal(out.session.tally.p1.fail, 0);
  assert.notEqual(currentConceptId(out.session), null);
});

test('НЕВЕРНЫЙ ответ тоже передаёт ход', () => {
  // Отличие от Типа 3: там ошибка убирает один из восьми вариантов и ход
  // остаётся. Здесь вариантов столько, сколько объектов на сцене, и
  // оставлять ход до попадания значило бы позволить перебрать всю сцену
  let s = build();
  const expected = currentConceptId(s);
  const wrong = sceneConceptIds(findScene(testLibrary(), 'bedroom')).find((c) => c !== expected);
  assert.ok(wrong);
  const out = answer(s, wrong);
  assert.equal(out.correct, false);
  assert.equal(out.session.tally.p1.fail, 1);
  assert.notEqual(currentConceptId(out.session), expected, 'вопрос обязан смениться');
});

test('ход идёт по кругу, номер вопроса растёт на замыкании круга', () => {
  let s = build({ mode: 'challenge', playerIds: ['p1', 'p2'], questionsPerPlayer: 2 });
  assert.equal(currentPlayerId(s), 'p1');
  s = answer(s, currentConceptId(s)!).session;
  assert.equal(currentPlayerId(s), 'p2');
  assert.equal(s.questionIndex, 0, 'круг ещё не замкнулся');
  s = answer(s, currentConceptId(s)!).session;
  assert.equal(currentPlayerId(s), 'p1');
  assert.equal(s.questionIndex, 1);
});

test('партия завершается после последнего вопроса последнего игрока', () => {
  let s = build({ mode: 'challenge', playerIds: ['p1', 'p2'], questionsPerPlayer: 2 });
  for (let i = 0; i < 4; i++) {
    const c = currentConceptId(s);
    assert.ok(c, `вопрос ${i} должен быть`);
    s = answer(s, c).session;
  }
  assert.equal(s.finished, true);
  assert.equal(currentConceptId(s), null);
});

test('ответ в завершённой партии ничего не меняет', () => {
  let s = build({ questionsPerPlayer: 1 });
  s = answer(s, currentConceptId(s)!).session;
  assert.equal(s.finished, true);
  const after = answer(s, 'bed');
  assert.equal(after.session, s, 'состояние обязано остаться тем же объектом');
});

test('исходное состояние не правится на месте', () => {
  const s = build();
  const before = JSON.stringify(s);
  answer(s, currentConceptId(s)!);
  assert.equal(JSON.stringify(s), before);
});

test('в совместной игре задания в круге не повторяются', () => {
  // Правило общее с Типами 2 и 3 — здесь проверяется, что оно ДОШЛО до этого
  // движка, а не только живёт в utils/turnDeal
  for (let seed = 1; seed <= 60; seed++) {
    const s = build({ mode: 'challenge', playerIds: ['p1', 'p2', 'p3'], questionsPerPlayer: 2, rng: seededRng(seed) });
    for (let q = 0; q < 2; q++) {
      const round = s.playerIds.map((p) => s.questions[p][q]);
      assert.equal(new Set(round).size, round.length, `зерно ${seed}, круг ${q}: повтор`);
    }
  }
});

test('итоги: доля у игрока без ответов — null, а не ноль', () => {
  const s = build({ mode: 'challenge', playerIds: ['p1', 'p2'], questionsPerPlayer: 1 });
  const rows = results(s);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].share, null, 'ноль читался бы как «отвечал и всё неверно»');
});

test('победителей может быть несколько — ничья не скрывается', () => {
  let s = build({ mode: 'challenge', playerIds: ['p1', 'p2'], questionsPerPlayer: 1 });
  s = answer(s, currentConceptId(s)!).session;
  s = answer(s, currentConceptId(s)!).session;
  assert.deepEqual(winners(s).sort(), ['p1', 'p2']);
});

test('показ результата снимается отдельным действием', () => {
  let s = build();
  s = answer(s, currentConceptId(s)!).session;
  assert.equal(s.lastAnswerCorrect, true);
  s = clearLastAnswer(s);
  assert.equal(s.lastAnswerCorrect, null);
});

// ─── подача задания (ТЗ строка 89) ───────────────────────────────────────

test('нельзя выключить оба способа подачи', () => {
  let p = DEFAULT_PRESENTATION;
  p = togglePresentation(p, 'audio');
  assert.deepEqual(p, { audio: false, text: true });
  p = togglePresentation(p, 'text');
  assert.equal(isPresentationUsable(p), true, 'выключив последний, включаем другой');
  assert.deepEqual(p, { audio: true, text: false });
});

test('включается ДРУГОЙ способ, а не тот, что выключали', () => {
  // Иначе нажатие не даёт видимого эффекта, и пользователь решает, что
  // переключатель сломан
  const p = togglePresentation({ audio: false, text: true }, 'text');
  assert.equal(p.text, false);
  assert.equal(p.audio, true);
});

test('переключение не правит переданное значение', () => {
  const p = { audio: true, text: true };
  togglePresentation(p, 'audio');
  assert.deepEqual(p, { audio: true, text: true });
});
