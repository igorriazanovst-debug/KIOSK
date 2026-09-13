// packages/shared/src/alphabet/conformance/vectors.test.ts
// Сверочные векторы — общий контракт между этой реализацией и нативной
// Android-реализацией (Android делается отдельно, не поверх этого кода).
//
// Здесь проверяется, что ЭТА реализация им соответствует; та же таблица
// прогоняется на стороне Android. Расхождение обязано быть падением теста, а
// не тихой разницей в поведении на занятии.
//
// ЧЕМ ЭТОТ ФАЙЛ ОТЛИЧАЕТСЯ ОТ ОБЫЧНЫХ ТЕСТОВ. Обычный тест проверяет, что
// поведение правильное. Этот — что поведение НЕ ИЗМЕНИЛОСЬ. Если правило
// когда-нибудь придётся менять осознанно, векторы перегенерируются, и разница
// будет видна в диффе `vectors.json` — то есть попадёт на ревью, а не
// проскользнёт.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vectors from './vectors.json';

import {
  wordImagePath,
  wordAudioPath,
  wordWithoutLastSyllableAudioPath,
  letterAudioPath,
  syllableAudioPath,
} from '../model/resources';
import { parseAlphabetLibrary } from '../model/schema';
import { wordsForCompleting, wordsForLetterShow, wordsForMaking } from '../model/graph';
import { letterChartRows, mergeSessionStatistics } from '../game/statistics';
import {
  applyCreateSet,
  applyCreateWord,
  applyDeleteSyllable,
  applyDeleteWord,
  checkUserWordReadiness,
  resolveImportedSetTitle,
} from '../store/contentRules';
import type { Syllable, Word } from '../model/schema';

const v = vectors as any;

const U1 = 'u0000000000000001';
const U2 = 'u0000000000000002';
const U3 = 'u0000000000000003';
const syl = (id: string, name: string, letters: number[]): Syllable => ({
  id,
  name,
  letterNumbers: letters,
});

test('векторы: раскладка файлов не изменилась', () => {
  // Разойдись пути — файлы будут лежать на диске, а игра молча не будет их
  // находить: отсутствующий файл очередь воспроизведения не роняет
  for (const c of v.resources.wordImage) assert.equal(wordImagePath(c.wordId), c.path);
  for (const c of v.resources.wordAudio) assert.equal(wordAudioPath(c.wordId), c.path);
  for (const c of v.resources.wordWithoutLastSyllable) {
    assert.equal(wordWithoutLastSyllableAudioPath(c.wordId), c.path);
  }
  for (const c of v.resources.letterAudio) {
    assert.equal(letterAudioPath(c.letterNumber), c.path);
  }
  for (const c of v.resources.syllableAudio) {
    assert.equal(syllableAudioPath(c.syllableId), c.path);
  }
});

test('векторы: пригодность слова этапу', () => {
  // Реализация, которая предложит односложное слово на этапе 3, покажет
  // ребёнку задание без решения
  const library = parseAlphabetLibrary({
    schemaVersion: 1,
    audioScheme: { recorded: true },
    letters: [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'].map((name, i) => ({
      number: i + 1,
      name,
      wordIds: i === 0 ? ['avtobus'] : i === 10 ? ['jod'] : [],
    })),
    syllables: [
      syl('av', 'ав', [1, 3]),
      syl('to', 'то', [20, 16]),
      syl('bus', 'бус', [2, 21, 19]),
      syl('jod', 'йод', [11, 16, 5]),
    ],
    words: [
      { id: 'avtobus', name: 'Автобус', syllableIds: ['av', 'to', 'bus'], hasWithoutLastSyllable: true },
      { id: 'jod', name: 'Йод', syllableIds: ['jod'], hasWithoutLastSyllable: false },
    ],
    sets: [],
  });

  assert.deepEqual(wordsForLetterShow(library).map((w) => w.id), v.stageEligibility.letterShow);
  assert.deepEqual(wordsForCompleting(library).map((w) => w.id), v.stageEligibility.wordCompleting);
  assert.deepEqual(wordsForMaking(library).map((w) => w.id), v.stageEligibility.wordMake);
});

test('векторы: слияние статистики — сессия замещается, итог накапливается', () => {
  const first = mergeSessionStatistics({}, 'u1', [
    { letterNumber: 1, correct: true },
    { letterNumber: 1, correct: false },
    { letterNumber: 2, correct: true },
  ]);
  assert.deepEqual(first, v.statistics.afterFirst);

  const second = mergeSessionStatistics(first, 'u1', [{ letterNumber: 1, correct: true }]);
  assert.deepEqual(second, v.statistics.afterSecond);

  // Буква без ответов даёт null, а не ноль: ноль читается как «отвечал и
  // всё неверно» — ровно противоположно правде
  assert.deepEqual(letterChartRows(second, 'u1', [1, 2, 7]), v.statistics.chartRows);
});

test('векторы: правила редактора не изменились', () => {
  const syllables = [syl(U1, 'ко', [12, 16]), syl(U2, 'шка', [26, 12, 1])];
  const word: Word = {
    id: U3,
    name: 'Кошка',
    syllableIds: [U1, U2],
    hasWithoutLastSyllable: true,
  };

  const actual: Array<{ what: string; ok: boolean; result?: unknown; error?: string }> = [];
  const push = (what: string, fn: () => unknown) => {
    try {
      actual.push({ what, ok: true, result: fn() });
    } catch (err) {
      actual.push({ what, ok: false, error: (err as Error).message });
    }
  };

  push('регистр приводится', () =>
    applyCreateWord([], syllables, { name: 'КоШкА', syllableIds: [U1, U2] }, U3).created.name
  );
  push('написание не совпало со слогами', () =>
    applyCreateWord([], syllables, { name: 'Кошечка', syllableIds: [U1, U2] }, U3)
  );
  push('односложное не получает записи без последнего слога', () =>
    applyCreateWord(
      [],
      [syl(U1, 'кот', [12, 16, 20])],
      { name: 'Кот', syllableIds: [U1], hasWithoutLastSyllable: true },
      U3
    ).created.hasWithoutLastSyllable
  );
  push('слог, использованный словом, не удаляется', () =>
    applyDeleteSyllable(syllables, [word], U1)
  );
  push('удалённое слово уходит из комплектов', () =>
    applyDeleteWord([word], [{ id: U1, title: 'Дом', wordIds: [U3] }], U3).sets
  );
  push('повтор слова в комплекте схлопывается', () =>
    applyCreateSet([], [word], { title: 'Дом', wordIds: [U3, U3] }, U1).created.wordIds
  );
  push('конфликт имени при импорте', () =>
    resolveImportedSetTitle([{ id: U1, title: 'ПДД', wordIds: [] }], 'ПДД')
  );

  assert.deepEqual(actual, v.contentRules);
});

test('векторы: готовность своего слова', () => {
  const word: Word = {
    id: U3,
    name: 'Кошка',
    syllableIds: [U1, U2],
    hasWithoutLastSyllable: true,
  };
  assert.deepEqual(
    checkUserWordReadiness(word, {
      hasImage: false,
      hasWholeAudio: false,
      syllablesWithAudio: new Set(),
    }),
    v.readiness.nothing
  );
  assert.deepEqual(
    checkUserWordReadiness(word, {
      hasImage: true,
      hasWholeAudio: false,
      syllablesWithAudio: new Set(),
    }),
    v.readiness.imageOnly
  );
  assert.deepEqual(
    checkUserWordReadiness(word, {
      hasImage: true,
      hasWholeAudio: true,
      syllablesWithAudio: new Set([U1, U2]),
    }),
    v.readiness.complete
  );
});

test('векторы: что пакет отвергает, а что принимает', () => {
  // Контракт фиксирует не только запреты: нативная реализация может
  // оказаться строже нужного и отвергнуть законные данные
  const base = {
    schemaVersion: 1,
    audioScheme: { recorded: false },
    letters: [{ number: 1, name: 'А', wordIds: [] }],
    syllables: [syl('av', 'ав', [1, 3])],
    words: [{ id: 'a', name: 'А', syllableIds: ['av'], hasWithoutLastSyllable: false }],
    sets: [],
  };
  const cases: Array<[string, unknown]> = [
    ['чужая версия схемы', { ...base, schemaVersion: 2 }],
    ['номер буквы вне 1..33', { ...base, letters: [{ number: 34, name: 'Я', wordIds: [] }] }],
    [
      'повтор идентификатора слова',
      { ...base, words: [base.words[0], { ...base.words[0], name: 'Б' }] },
    ],
    ['слово без слогов', { ...base, words: [{ ...base.words[0], syllableIds: [] }] }],
    [
      'свой идентификатор в общем списке слов — ПРИНИМАЕТСЯ',
      { ...base, words: [{ ...base.words[0], id: U1 }] },
    ],
  ];

  const actual = cases.map(([what, input]) => {
    try {
      parseAlphabetLibrary(input);
      return { what, rejected: false };
    } catch {
      return { what, rejected: true };
    }
  });
  assert.deepEqual(actual, v.libraryValidation);
});
