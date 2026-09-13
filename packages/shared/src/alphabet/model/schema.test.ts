import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAlphabetLibrary,
  parseAlphabetSettings,
  parseStatistics,
  AlphabetValidationError,
  ALPHABET_LIBRARY_SCHEMA_VERSION,
  ALPHABET_SETTINGS_SCHEMA_VERSION,
  DEFAULT_ALPHABET_SETTINGS,
  LibraryIdSchema,
  UserIdSchema,
} from './schema';
import { testLibrary } from './testLibrary';

test('пакет контента разбирается и сохраняет граф', () => {
  const library = testLibrary();
  assert.equal(library.letters.length, 33);
  assert.equal(library.words.length, 4);
  const avtobus = library.words.find((w) => w.id === 'avtobus');
  assert.deepEqual(avtobus?.syllableIds, ['av', 'to', 'bus']);
});

test('слово на букву У — законный поставочный идентификатор', () => {
  // Запрещено не «начинаться с u», а совпадать ПО ФОРМЕ со своим
  // идентификатором. Первая версия правила отвергала «Утку», «Улитку» и
  // «Ухо» — то есть букву У целиком
  const library = testLibrary({
    letters: [{ number: 21, name: 'У', wordIds: ['utka'] }],
    syllables: [{ id: 'ut', name: 'ут', letterNumbers: [21, 20] }],
    words: [{ id: 'utka', name: 'Утка', syllableIds: ['ut'], hasWithoutLastSyllable: false }],
    sets: [],
  } as never);
  assert.equal(library.words[0].id, 'utka');
});

test('поставочный и свой идентификаторы не пересекаются по форме', () => {
  // Проверяется на самих схемах, а не через пакет: в списках слов лежат и
  // поставочные, и свои, поэтому пакет обязан принимать оба вида — но одна
  // строка не должна годиться сразу под обе роли, иначе обновление поставки
  // однажды затрёт слово педагога
  assert.equal(LibraryIdSchema.safeParse('utka').success, true);
  assert.equal(LibraryIdSchema.safeParse('u0123456789abcdef').success, false);
  assert.equal(UserIdSchema.safeParse('u0123456789abcdef').success, true);
  assert.equal(UserIdSchema.safeParse('utka').success, false);
  // «u» и 16 hex — и ни символом больше
  assert.equal(UserIdSchema.safeParse('u0123456789abcde').success, false);
  assert.equal(LibraryIdSchema.safeParse('u0123456789abcde').success, true);
});

test('идентификатор слова педагога — «u» и 16 hex-символов', () => {
  const library = testLibrary({
    letters: [{ number: 1, name: 'А', wordIds: ['u0123456789abcdef'] }],
    syllables: [{ id: 'ap', name: 'ап', letterNumbers: [1, 16] }],
    words: [
      {
        id: 'u0123456789abcdef',
        name: 'Апорт',
        syllableIds: ['ap'],
        hasWithoutLastSyllable: false,
        imageFile: null,
      },
    ],
    sets: [],
  } as never);
  assert.equal(library.words[0].id, 'u0123456789abcdef');
});

test('повторяющийся идентификатор слова — ошибка разбора, а не тихое затенение', () => {
  // zod дубликаты в массиве не ловит, а второе слово просто заслонило бы
  // первое при поиске по id — и половина заданий молча исчезла бы
  assert.throws(
    () =>
      testLibrary({
        words: [
          { id: 'arbuz', name: 'Арбуз', syllableIds: ['ar', 'buz'], hasWithoutLastSyllable: true },
          { id: 'arbuz', name: 'Другой', syllableIds: ['ar'], hasWithoutLastSyllable: false },
        ],
      } as never),
    /идентификаторы слов/
  );
});

test('повторяющийся номер буквы — ошибка разбора', () => {
  assert.throws(
    () =>
      testLibrary({
        letters: [
          { number: 1, name: 'А', wordIds: [] },
          { number: 1, name: 'Б', wordIds: [] },
        ],
      } as never),
    /номера букв/
  );
});

test('номер буквы держится в пределах алфавита', () => {
  assert.throws(() => testLibrary({ letters: [{ number: 34, name: 'Ы', wordIds: [] }] } as never));
  assert.throws(() => testLibrary({ letters: [{ number: 0, name: 'А', wordIds: [] }] } as never));
});

test('слово без слогов не разбирается', () => {
  // Слово без разбивки нельзя ни озвучить послогово, ни отнести к букве
  assert.throws(
    () =>
      testLibrary({
        words: [{ id: 'pusto', name: 'Пусто', syllableIds: [], hasWithoutLastSyllable: false }],
      } as never)
  );
});

test('буква без слов разбирается: промежуточное состояние пакета законно', () => {
  // Требование «не менее 2 иллюстраций» проверяется отдельно и адресовано
  // готовому пакету, а не каждому промежуточному сохранению
  const library = testLibrary({
    letters: [
      { number: 1, name: 'А', wordIds: [] },
      { number: 2, name: 'Б', wordIds: ['banan', 'bant'] },
    ],
  } as never);
  assert.equal(library.letters[0].wordIds.length, 0);
});

test('настройки по умолчанию проходят собственную проверку', () => {
  assert.deepEqual(parseAlphabetSettings(DEFAULT_ALPHABET_SETTINGS), DEFAULT_ALPHABET_SETTINGS);
  assert.equal(DEFAULT_ALPHABET_SETTINGS.schemaVersion, ALPHABET_SETTINGS_SCHEMA_VERSION);
});

test('число вопросов в партии — только из списка экрана настроек', () => {
  assert.throws(() => parseAlphabetSettings({ ...DEFAULT_ALPHABET_SETTINGS, questionCount: 7 }));
  assert.equal(
    parseAlphabetSettings({ ...DEFAULT_ALPHABET_SETTINGS, questionCount: 20 }).questionCount,
    20
  );
});

test('громкость вне 0..100 отвергается', () => {
  assert.throws(() => parseAlphabetSettings({ ...DEFAULT_ALPHABET_SETTINGS, volume: 120 }));
  assert.throws(() => parseAlphabetSettings({ ...DEFAULT_ALPHABET_SETTINGS, volume: -1 }));
});

test('чужая версия схемы пакета отвергается', () => {
  assert.throws(
    () => parseAlphabetLibrary({ ...testLibrary(), schemaVersion: ALPHABET_LIBRARY_SCHEMA_VERSION + 1 }),
    AlphabetValidationError
  );
});

test('битая запись статистики отбрасывается, остальные выживают', () => {
  // Потерять из-за одной испорченной строки прогресс всего класса —
  // несоразмерная цена; поэтому разбор статистики терпимый
  const stats = parseStatistics({
    u1: {
      '1': { lastSession: [2, 3], total: [10, 20] },
      '2': { lastSession: 'сломано', total: [1, 1] },
      '3': { lastSession: [0, 0], total: [4, 4] },
    },
  });
  assert.deepEqual(Object.keys(stats.u1).sort(), ['1', '3']);
  assert.deepEqual(stats.u1['1'].total, [10, 20]);
});

test('статистика из мусора даёт пустой объект, а не исключение', () => {
  assert.deepEqual(parseStatistics(null), {});
  assert.deepEqual(parseStatistics('строка'), {});
  assert.deepEqual(parseStatistics([1, 2, 3]), {});
  assert.deepEqual(parseStatistics({ u1: 'не объект' }), {});
});
