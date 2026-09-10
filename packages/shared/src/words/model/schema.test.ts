import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWordsLibrary,
  parseUserWords,
  parseUserSets,
  parseWordsSettings,
  isUserWordId,
  WordsValidationError,
  WORDS_LIBRARY_SCHEMA_VERSION,
  WORDS_SETTINGS_SCHEMA_VERSION,
  DEFAULT_WORDS_SETTINGS,
} from './schema';

function library(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: WORDS_LIBRARY_SCHEMA_VERSION,
    audioScheme: { voices: ['girl'], phrasesPerVoice: 2, neutral: true },
    themes: [
      { id: 'digits', title: 'Цифры', wordIds: ['0000', '0001'] },
      { id: 'pets', title: 'Домашние животные', wordIds: ['0100'] },
    ],
    words: [
      { id: '0000', name: 'Ноль', themeId: 'digits', level: 0 },
      { id: '0001', name: 'Один', themeId: 'digits', level: 0 },
      { id: '0100', name: 'Кошка', themeId: 'pets', level: 1 },
    ],
    ...overrides,
  };
}

test('parseWordsLibrary принимает корректную библиотеку', () => {
  const parsed = parseWordsLibrary(library());
  assert.equal(parsed.words.length, 3);
  assert.equal(parsed.themes[0].id, 'digits');
});

test('parseWordsLibrary отвергает голый объект без версии схемы', () => {
  assert.throws(() => parseWordsLibrary({ themes: [], words: [] }), WordsValidationError);
});

test('parseWordsLibrary отвергает дублирующиеся НАЗВАНИЯ тем', () => {
  // Ровно дефект эталона ОС3: два набора «Домашние животные» и два «Дикие
  // животные» — уникальных названий 13 из 15, риск на приёмке по строке 59 ТЗ.
  const broken = library({
    themes: [
      { id: 'pets', title: 'Домашние животные', wordIds: ['0000'] },
      { id: 'pets2', title: 'Домашние животные', wordIds: ['0001'] },
    ],
    words: [
      { id: '0000', name: 'Кошка', themeId: 'pets', level: 0 },
      { id: '0001', name: 'Собака', themeId: 'pets2', level: 0 },
    ],
  });
  assert.throws(
    () => parseWordsLibrary(broken),
    (e: unknown) =>
      e instanceof WordsValidationError &&
      e.issues.some((i) => i.includes('Домашние животные')),
  );
});

test('parseWordsLibrary отвергает тему со ссылкой на несуществующее слово', () => {
  const broken = library({
    themes: [{ id: 'digits', title: 'Цифры', wordIds: ['0000', '9999'] }],
  });
  assert.throws(
    () => parseWordsLibrary(broken),
    (e: unknown) => e instanceof WordsValidationError && e.issues.some((i) => i.includes('9999')),
  );
});

test('parseWordsLibrary отвергает слово, не перечисленное в своей теме', () => {
  const broken = library({
    themes: [
      { id: 'digits', title: 'Цифры', wordIds: ['0000'] },
      { id: 'pets', title: 'Домашние животные', wordIds: ['0100'] },
    ],
  });
  // 0001 объявлено в words с themeId digits, но в списке темы его нет
  assert.throws(
    () => parseWordsLibrary(broken),
    (e: unknown) => e instanceof WordsValidationError && e.issues.some((i) => i.includes('0001')),
  );
});

test('идентификатор слова: поставочное — 4 цифры, пользовательское — с префиксом u', () => {
  assert.equal(isUserWordId('0000'), false);
  assert.equal(isUserWordId('u1a2b3c4d'), true);
  assert.equal(isUserWordId('uZZZ'), false);
});

test('parseWordsLibrary отвергает нечетырёхзначный идентификатор', () => {
  const broken = library({
    themes: [{ id: 'digits', title: 'Цифры', wordIds: ['1'] }],
    words: [{ id: '1', name: 'Один', themeId: 'digits', level: 0 }],
  });
  assert.throws(() => parseWordsLibrary(broken), WordsValidationError);
});

test('parseUserWords принимает слово педагога без картинки и без звука', () => {
  const words = parseUserWords([
    { id: 'u0123abcd', name: 'Скворечник', level: 9, imageFile: null, audioFile: null },
  ]);
  assert.equal(words[0].level, 9);
});

test('parseUserWords отвергает имя файла с разделителем пути', () => {
  assert.throws(
    () =>
      parseUserWords([
        { id: 'u0123abcd', name: 'Скворечник', level: 9, imageFile: '../evil.svg', audioFile: null },
      ]),
    WordsValidationError,
  );
});

test('parseUserSets отвергает висячую ссылку на удалённое слово', () => {
  const known = new Set(['0000']);
  assert.throws(
    () => parseUserSets([{ id: 'my-set', title: 'Моё', wordIds: ['0000', 'u9999aaaa'] }], known),
    (e: unknown) =>
      e instanceof WordsValidationError && e.issues.some((i) => i.includes('u9999aaaa')),
  );
});

test('parseUserSets принимает комплект из поставочных и своих слов сразу', () => {
  // Прямое требование строки 56 ТЗ: «как из существующих слов, так и из слов,
  // добавленных самостоятельно».
  const known = new Set(['0000', 'u9999aaaa']);
  const sets = parseUserSets(
    [{ id: 'my-set', title: 'Моё', wordIds: ['0000', 'u9999aaaa'] }],
    known,
  );
  assert.equal(sets[0].wordIds.length, 2);
});

test('настройки: режим стола заведён явно, в отличие от эталона', () => {
  const settings = parseWordsSettings({
    schemaVersion: WORDS_SETTINGS_SCHEMA_VERSION,
    volume: 50,
    device: 'table',
    levelOverrides: { '0000': 2 },
  });
  assert.equal(settings.device, 'table');
  assert.equal(settings.levelOverrides['0000'], 2);
});

test('настройки: громкость вне 0..100 отвергается', () => {
  assert.throws(
    () =>
      parseWordsSettings({
        schemaVersion: WORDS_SETTINGS_SCHEMA_VERSION,
        volume: 300,
        device: 'board',
        levelOverrides: {},
      }),
    WordsValidationError,
  );
});

test('дефолтные настройки проходят собственную валидацию', () => {
  assert.deepEqual(parseWordsSettings(DEFAULT_WORDS_SETTINGS), DEFAULT_WORDS_SETTINGS);
});
