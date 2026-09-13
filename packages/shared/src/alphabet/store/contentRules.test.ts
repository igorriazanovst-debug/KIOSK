import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AlphabetContentError,
  applyCreateSet,
  applyCreateSyllable,
  applyCreateWord,
  applyDeleteSet,
  applyDeleteSyllable,
  applyDeleteWord,
  applyUpdateSet,
  applyUpdateWord,
  checkUserWordReadiness,
  isUserEntityId,
  mergeUserContent,
  parseUserContent,
  resolveImportedSetTitle,
  MAX_SYLLABLES_PER_WORD,
} from './contentRules';
import { testLibrary } from '../model/testLibrary';
import { checkGraph } from '../model/graph';
import type { Syllable, Word, WordSet } from '../model/schema';

const U1 = 'u0000000000000001';
const U2 = 'u0000000000000002';
const U3 = 'u0000000000000003';

const syl = (id: string, name: string, letters: number[]): Syllable => ({
  id,
  name,
  letterNumbers: letters,
});

test('идентификатор своей сущности отличается по форме', () => {
  assert.equal(isUserEntityId(U1), true);
  assert.equal(isUserEntityId('utka'), false);
});

// ─── Слоги ──────────────────────────────────────────────────────────────

test('свой слог создаётся и нормализуется', () => {
  const { created } = applyCreateSyllable([], { name: '  ВТО  ', letterNumbers: [3, 20, 16] }, U1);
  assert.equal(created.name, 'вто');
  assert.deepEqual(created.letterNumbers, [3, 20, 16]);
});

test('слог с тем же написанием заводить нельзя', () => {
  // Второй такой слог получил бы свой файл озвучки, а звучал бы одинаково
  const base = [syl(U1, 'вто', [3, 20, 16])];
  assert.throws(
    () => applyCreateSyllable(base, { name: 'ВТО', letterNumbers: [3, 20, 16] }, U2),
    /уже есть/
  );
});

test('слог принимает только русские буквы', () => {
  for (const bad of ['', '   ', 'vto', 'в то', 'в-то', 'в1']) {
    assert.throws(
      () => applyCreateSyllable([], { name: bad, letterNumbers: [3] }, U1),
      AlphabetContentError,
      `принят слог «${bad}»`
    );
  }
});

test('слог без букв или с номером вне алфавита не принимается', () => {
  assert.throws(() => applyCreateSyllable([], { name: 'вто', letterNumbers: [] }, U1));
  assert.throws(() => applyCreateSyllable([], { name: 'вто', letterNumbers: [34] }, U1));
});

test('слог, использованный словом, удалить нельзя — и сказано, каким', () => {
  // Иначе слово сломалось бы задним числом, а педагог его в этот момент
  // даже не видел
  const syllables = [syl(U1, 'ко', [12, 16]), syl(U2, 'шка', [26, 12, 1])];
  const words: Word[] = [
    { id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true },
  ];
  assert.throws(() => applyDeleteSyllable(syllables, words, U1), /Кошка/);
});

test('неиспользуемый свой слог удаляется', () => {
  const syllables = [syl(U1, 'ко', [12, 16])];
  assert.deepEqual(applyDeleteSyllable(syllables, [], U1), []);
});

test('поставочный слог удалить нельзя', () => {
  const syllables = [syl('av', 'ав', [1, 3])];
  assert.throws(() => applyDeleteSyllable(syllables, [], 'av'), /Поставочный/);
});

// ─── Слова ──────────────────────────────────────────────────────────────

const twoSyllables = [syl(U1, 'ко', [12, 16]), syl(U2, 'шка', [26, 12, 1])];

test('своё слово создаётся', () => {
  const { created } = applyCreateWord(
    [],
    twoSyllables,
    { name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true },
    U3
  );
  assert.equal(created.name, 'Кошка');
  assert.equal(created.hasWithoutLastSyllable, true);
  assert.equal(created.imageFile, null);
});

test('написание слова обязано совпадать со склейкой слогов', () => {
  // Иначе на этапе 3 ребёнок соберёт «кошка», а подписано будет «Кошечка»,
  // и прав окажется он
  assert.throws(
    () =>
      applyCreateWord(
        [],
        twoSyllables,
        { name: 'Кошечка', syllableIds: [U1, U2], hasWithoutLastSyllable: true },
        U3
      ),
    /складываются в «кошка»/
  );
});

test('регистр слова приводится сам, а не требуется от педагога', () => {
  // Отказ ради того, что исправляется одной строкой кода, — просто помеха:
  // регистр на экранной клавиатуре переключается отдельной кнопкой
  for (const typed of ['кошка', 'КОШКА', '  КоШкА  ']) {
    const { created } = applyCreateWord([], twoSyllables, { name: typed, syllableIds: [U1, U2] }, U3);
    assert.equal(created.name, 'Кошка', `«${typed}» не приведено к «Кошка»`);
  }
});

test('отвергается только то, что поправить нельзя', () => {
  for (const bad of ['', '   ', 'Koshka', 'Кошка 1', 'Кошка2']) {
    assert.throws(
      () => applyCreateWord([], twoSyllables, { name: bad, syllableIds: [U1, U2] }, U3),
      AlphabetContentError,
      `принято слово «${bad}»`
    );
  }
});

test('слово из несуществующих слогов не создаётся', () => {
  assert.throws(
    () => applyCreateWord([], twoSyllables, { name: 'Кошка', syllableIds: [U1, 'нет'] }, U3),
    /Слогов нет/
  );
});

test('слово длиннее панели этапа 3 отвергается при создании', () => {
  // Лучше сказать об этом в редакторе, чем на занятии
  // Слоги должны быть РАЗНЫМИ: одинаковое написание запрещено отдельным
  // правилом, и без этого тест упал бы не туда, куда целится
  const many = Array.from({ length: MAX_SYLLABLES_PER_WORD + 1 }, (_, i) =>
    syl(`u${String(i).padStart(16, '0')}`, `л${'аоуыэ'[i % 5]}${i}`.replace(/\d/g, ''), [13, 1])
  );
  assert.throws(
    // Имя без пробела: проверка имени идёт ПЕРЕД проверкой числа слогов,
    // и с пробелом тест падал бы не на том правиле
    () => applyCreateWord([], many, { name: 'Многосложное', syllableIds: many.map((s) => s.id) }, U3),
    /не поместится/
  );
});

test('односложное слово не получает записи «без последнего слога»', () => {
  const one = [syl(U1, 'кот', [12, 16, 20])];
  const { created } = applyCreateWord(
    [],
    one,
    { name: 'Кот', syllableIds: [U1], hasWithoutLastSyllable: true },
    U3
  );
  assert.equal(created.hasWithoutLastSyllable, false, 'убирать нечего — флаг должен сброситься');
});

test('слово с тем же именем дважды не заводится', () => {
  const { words } = applyCreateWord([], twoSyllables, { name: 'Кошка', syllableIds: [U1, U2] }, U3);
  // Регистр при сравнении не важен: «кошка» приводится к «Кошка» и совпадает
  assert.throws(
    () => applyCreateWord(words, twoSyllables, { name: 'кошка', syllableIds: [U1, U2] }, U1),
    /уже есть/
  );
});

test('поставочное слово не изменить и не удалить', () => {
  const words: Word[] = [
    { id: 'avtobus', name: 'Автобус', syllableIds: ['av'], hasWithoutLastSyllable: false },
  ];
  assert.throws(() => applyUpdateWord(words, [syl('av', 'ав', [1, 3])], 'avtobus', {
    name: 'Автобус',
    syllableIds: ['av'],
  }), /Поставочное/);
  assert.throws(() => applyDeleteWord(words, [], 'avtobus'), /Поставочное/);
});

test('удалённое слово исчезает из ВСЕХ комплектов', () => {
  // Комплект из десяти слов, где половина не существует, дал бы партию
  // вдвое короче обещанной
  const words: Word[] = [
    { id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true },
  ];
  const sets: WordSet[] = [
    { id: U1, title: 'Дом', wordIds: [U3] },
    { id: U2, title: 'Улица', wordIds: [U3] },
  ];
  const result = applyDeleteWord(words, sets, U3);
  assert.deepEqual(result.words, []);
  assert.deepEqual(result.sets.map((s) => s.wordIds), [[], []]);
});

// ─── Готовность слова ───────────────────────────────────────────────────

test('слово без озвучки годится этапу 1 и не годится этапам 2 и 3', () => {
  const word: Word = { id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: false };
  const r = checkUserWordReadiness(word, {
    hasImage: true,
    hasWholeAudio: false,
    syllablesWithAudio: new Set(),
  });
  assert.equal(r.letterShow, true);
  assert.equal(r.wordCompleting, false);
  assert.equal(r.wordMake, false);
  assert.ok(r.missing.some((m) => /слова целиком/.test(m)));
  assert.ok(r.missing.some((m) => /без последнего слога/.test(m)));
  assert.ok(r.missing.some((m) => /озвучка слогов/.test(m)));
});

test('полностью озвученное слово годится всем трём этапам', () => {
  const word: Word = { id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true };
  const r = checkUserWordReadiness(word, {
    hasImage: true,
    hasWholeAudio: true,
    syllablesWithAudio: new Set([U1, U2]),
  });
  assert.deepEqual(r.missing, []);
  assert.equal(r.letterShow, true);
  assert.equal(r.wordCompleting, true);
  assert.equal(r.wordMake, true);
});

test('без иллюстрации не годится ни один этап', () => {
  const word: Word = { id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true };
  const r = checkUserWordReadiness(word, {
    hasImage: false,
    hasWholeAudio: true,
    syllablesWithAudio: new Set([U1, U2]),
  });
  assert.equal(r.letterShow, false);
  assert.equal(r.wordCompleting, false);
  assert.equal(r.wordMake, false);
});

// ─── Комплекты: пять операций ТЗ строки 77 ──────────────────────────────

const oneWord: Word[] = [
  { id: U3, name: 'Кошка', syllableIds: [U1, U2], hasWithoutLastSyllable: true },
];

test('создание комплекта', () => {
  const { created } = applyCreateSet([], oneWord, { title: '  Дом  ', wordIds: [U3] }, U1);
  assert.equal(created.title, 'Дом');
  assert.deepEqual(created.wordIds, [U3]);
});

test('переименование и правка состава — одной операцией', () => {
  const { sets } = applyCreateSet([], oneWord, { title: 'Дом', wordIds: [U3] }, U1);
  const { updated } = applyUpdateSet(sets, oneWord, U1, { title: 'Квартира', wordIds: [] });
  assert.equal(updated.title, 'Квартира');
  assert.deepEqual(updated.wordIds, []);
});

test('удаление комплекта', () => {
  const { sets } = applyCreateSet([], oneWord, { title: 'Дом', wordIds: [U3] }, U1);
  assert.deepEqual(applyDeleteSet(sets, U1), []);
});

test('комплект из несуществующих слов не создаётся', () => {
  assert.throws(() => applyCreateSet([], oneWord, { title: 'Дом', wordIds: ['нет'] }, U1), /Слов нет/);
});

test('повтор слова в комплекте схлопывается', () => {
  const { created } = applyCreateSet([], oneWord, { title: 'Дом', wordIds: [U3, U3] }, U1);
  assert.deepEqual(created.wordIds, [U3]);
});

test('поставочный комплект не изменить и не удалить', () => {
  const sets: WordSet[] = [{ id: 'transport', title: 'Транспорт', wordIds: [] }];
  assert.throws(() => applyUpdateSet(sets, [], 'transport', { title: 'Своё', wordIds: [] }), /Поставочный/);
  assert.throws(() => applyDeleteSet(sets, 'transport'), /Поставочный/);
});

test('импорт при конфликте имён переименовывает, а не отказывает', () => {
  // Отказ заставил бы педагога сначала идти переименовывать существующий
  const sets: WordSet[] = [{ id: U1, title: 'ПДД', wordIds: [] }];
  assert.deepEqual(resolveImportedSetTitle(sets, 'ПДД'), { title: 'ПДД (2)', renamed: true });
  assert.deepEqual(resolveImportedSetTitle(sets, 'Другое'), { title: 'Другое', renamed: false });
});

test('импорт переименовывает с учётом уже занятых номеров', () => {
  const sets: WordSet[] = [
    { id: U1, title: 'ПДД', wordIds: [] },
    { id: U2, title: 'ПДД (2)', wordIds: [] },
  ];
  assert.equal(resolveImportedSetTitle(sets, 'ПДД').title, 'ПДД (3)');
});

// ─── Слияние своего с поставочным ───────────────────────────────────────

test('своё слово попадает к своей букве, и граф остаётся целым', () => {
  // Без этой связи этап «покажи букву» своё слово никогда не предложит,
  // хотя оно есть
  const library = testLibrary();
  const merged = mergeUserContent(library, {
    syllables: twoSyllables,
    words: oneWord,
    sets: [{ id: U1, title: 'Дом', wordIds: [U3] }],
  });
  const letterK = merged.letters.find((l) => l.number === 12);
  assert.ok(letterK?.wordIds.includes(U3), 'слово «Кошка» не попало к букве К');
  const report = checkGraph(merged);
  assert.deepEqual(report.issues, [], 'слияние сломало граф');
});

test('слияние не правит поставочную библиотеку', () => {
  const library = testLibrary();
  const before = JSON.stringify(library);
  mergeUserContent(library, { syllables: twoSyllables, words: oneWord, sets: [] });
  assert.equal(JSON.stringify(library), before);
});

// ─── Разбор своего контента с диска ─────────────────────────────────────

test('битая запись отбрасывается, остальные выживают', () => {
  const parsed = parseUserContent({
    syllables: [syl(U1, 'ко', [12, 16]), { id: U2 }, syl(U3, 'шка', [26])],
    words: [{ id: U1, name: 'Кошка', syllableIds: [U1], hasWithoutLastSyllable: false }, 'мусор'],
    sets: [{ id: U1, title: 'Дом', wordIds: [] }, { id: U2 }],
  });
  assert.equal(parsed.syllables.length, 2);
  assert.equal(parsed.words.length, 1);
  assert.equal(parsed.sets.length, 1);
});

test('мусор вместо контента даёт пустые списки, а не исключение', () => {
  assert.deepEqual(parseUserContent(null), { words: [], syllables: [], sets: [] });
  assert.deepEqual(parseUserContent('строка'), { words: [], syllables: [], sets: [] });
  assert.deepEqual(parseUserContent({ words: 'нет' }), { words: [], syllables: [], sets: [] });
});
