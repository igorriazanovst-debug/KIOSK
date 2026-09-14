// packages/shared/src/inophone/model/schema.test.ts
//
// Проверяется НЕ то, что схема принимает правильный пакет, а то, что она
// ОТВЕРГАЕТ неправильный и называет место. Пакет контента собирается
// скриптами, и единственное, что отделяет опечатку в идентификаторе от
// занятия, на котором половина сцены не откликается, — эти проверки.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseInophoneLibrary,
  playableConceptIds,
  translationOf,
  InophoneContentError,
  INOPHONE_SCHEMA_VERSION,
} from './schema';
import { LANGUAGE_CODES } from './languages';

const tr = (text: string, hasAudio = false) => ({ text, hasAudio });

/** Все шесть языков сразу — иначе схема справедливо отвергнет */
function allLangs(word: string) {
  return Object.fromEntries(LANGUAGE_CODES.map((c) => [c, tr(`${word}-${c}`)]));
}
function allTitles(title: string) {
  return Object.fromEntries(LANGUAGE_CODES.map((c) => [c, `${title}-${c}`]));
}

function library(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: INOPHONE_SCHEMA_VERSION,
    concepts: [
      { id: 'bed', hasPicture: true, translations: allLangs('кровать') },
      { id: 'lamp', hasPicture: true, translations: allLangs('лампа') },
    ],
    scenes: [
      {
        id: 'bedroom',
        titles: allTitles('Спальня'),
        viewBox: { width: 1600, height: 1000 },
        hotspots: [
          { conceptId: 'bed', points: '10,10 200,10 200,120 10,120' },
          { conceptId: 'lamp', points: '400,50 460,50 460,140 400,140' },
        ],
      },
    ],
    themes: [{ id: 'flat', titles: allTitles('Квартира'), sceneIds: ['bedroom'] }],
    ...overrides,
  };
}

test('правильный пакет разбирается', () => {
  const lib = parseInophoneLibrary(library());
  assert.equal(lib.concepts.length, 2);
  assert.equal(lib.scenes[0].hotspots.length, 2);
});

test('понятие без одного из шести языков отвергается с указанием языка', () => {
  const broken = library({
    concepts: [
      {
        id: 'bed',
        hasPicture: true,
        translations: Object.fromEntries(
          LANGUAGE_CODES.filter((c) => c !== 'ba').map((c) => [c, tr('x')])
        ),
      },
      { id: 'lamp', hasPicture: true, translations: allLangs('лампа') },
    ],
  });
  assert.throws(() => parseInophoneLibrary(broken), (e: Error) => {
    assert.ok(e instanceof InophoneContentError);
    assert.match(e.message, /bed/);
    assert.match(e.message, /ba/);
    return true;
  });
});

test('отсутствие озвучки ошибкой НЕ является', () => {
  // Для четырёх языков из шести синтеза на машине разработки нет, и пакет без
  // их озвучки — честное промежуточное состояние, а не битый формат
  const lib = parseInophoneLibrary(library());
  assert.equal(lib.concepts[0].translations.ba.hasAudio, false);
});

test('хотспот на несуществующее понятие отвергается и называет сцену', () => {
  const broken = library({
    scenes: [
      {
        id: 'bedroom',
        titles: allTitles('Спальня'),
        viewBox: { width: 1600, height: 1000 },
        hotspots: [{ conceptId: 'chair', points: '10,10 20,10 20,20' }],
      },
    ],
  });
  assert.throws(() => parseInophoneLibrary(broken), (e: Error) => {
    assert.match(e.message, /bedroom/);
    assert.match(e.message, /chair/);
    return true;
  });
});

test('одно понятие дважды на одной сцене отвергается', () => {
  // Иначе тренировка становится нечестной: верных областей две, вторая
  // засчитается как ошибка
  const broken = library({
    scenes: [
      {
        id: 'bedroom',
        titles: allTitles('Спальня'),
        viewBox: { width: 1600, height: 1000 },
        hotspots: [
          { conceptId: 'bed', points: '10,10 20,10 20,20' },
          { conceptId: 'bed', points: '30,30 40,30 40,40' },
        ],
      },
    ],
  });
  assert.throws(() => parseInophoneLibrary(broken), /размечено дважды/);
});

test('сцена вне всех тем отвергается как недостижимая', () => {
  const broken = library({
    scenes: [
      ...library().scenes,
      {
        id: 'kitchen',
        titles: allTitles('Кухня'),
        viewBox: { width: 100, height: 100 },
        hotspots: [],
      },
    ],
  });
  assert.throws(() => parseInophoneLibrary(broken), /kitchen/);
});

test('тема на несуществующую сцену отвергается', () => {
  const broken = library({ themes: [{ id: 'flat', titles: allTitles('Квартира'), sceneIds: ['nowhere'] }] });
  assert.throws(() => parseInophoneLibrary(broken), /nowhere/);
});

test('повторяющиеся идентификаторы отвергаются', () => {
  const broken = library({
    concepts: [
      { id: 'bed', hasPicture: true, translations: allLangs('кровать') },
      { id: 'bed', hasPicture: true, translations: allLangs('кровать2') },
    ],
  });
  assert.throws(() => parseInophoneLibrary(broken), /повторяется/);
});

test('контур из одной точки отвергается', () => {
  // Область из одной точки нельзя нажать — это разметка, потерянная молча
  const broken = library({
    scenes: [
      {
        id: 'bedroom',
        titles: allTitles('Спальня'),
        viewBox: { width: 100, height: 100 },
        hotspots: [{ conceptId: 'bed', points: '10,10' }],
      },
    ],
  });
  assert.throws(() => parseInophoneLibrary(broken));
});

test('играются только понятия, размеченные на сценах', () => {
  const lib = parseInophoneLibrary(
    library({
      concepts: [
        { id: 'bed', hasPicture: true, translations: allLangs('кровать') },
        { id: 'lamp', hasPicture: true, translations: allLangs('лампа') },
        { id: 'rug', hasPicture: true, translations: allLangs('ковёр') },
      ],
    })
  );
  const playable = playableConceptIds(lib);
  assert.equal(playable.size, 2);
  assert.ok(!playable.has('rug'), 'слово из словаря без хотспота играться не может');
});

test('перевод достаётся по коду языка, неизвестное понятие даёт null', () => {
  const lib = parseInophoneLibrary(library());
  assert.equal(translationOf(lib, 'bed', 'de')?.text, 'кровать-de');
  assert.equal(translationOf(lib, 'nope', 'de'), null);
});
