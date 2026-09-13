import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLetterShowQuestion, LETTER_OPTIONS, QuestionBuildError } from './letterShow';
import { buildWordCompletingQuestion, SYLLABLE_OPTIONS } from './wordCompleting';
import { buildWordMakeQuestion } from './wordMake';
import { seededRng, shuffled } from './random';
import { testLibrary } from '../model/testLibrary';

const rng = () => seededRng(42);

test('генератор с зерном повторяем', () => {
  const a = shuffled([1, 2, 3, 4, 5, 6, 7, 8], seededRng(7));
  const b = shuffled([1, 2, 3, 4, 5, 6, 7, 8], seededRng(7));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, shuffled([1, 2, 3, 4, 5, 6, 7, 8], seededRng(8)));
});

// ─── Этап 1 ──────────────────────────────────────────────────────────────

test('панель этапа 1 — восемь букв, верная среди них ровно одна', () => {
  const question = buildLetterShowQuestion(testLibrary(), 'avtobus', rng());
  assert.equal(question.optionLetterNumbers.length, LETTER_OPTIONS);
  assert.equal(question.answerLetterNumber, 1);
  assert.equal(
    question.optionLetterNumbers.filter((n) => n === question.answerLetterNumber).length,
    1
  );
  assert.equal(new Set(question.optionLetterNumbers).size, LETTER_OPTIONS);
});

test('панель этапа 1 наполняется буквами алфавита, а не только теми, у кого есть слова', () => {
  // У эталона на панели стоит «Ё», а слов у неё всего две — значит панель
  // это кусочек алфавита, а не витрина имеющегося контента
  const question = buildLetterShowQuestion(testLibrary(), 'banan', rng());
  const withoutWords = question.optionLetterNumbers.filter((n) => n > 2);
  assert.ok(withoutWords.length > 0, 'на панели должны быть буквы без слов');
});

test('этап 1 берёт первую букву через слог, а не через название слова', () => {
  const library = testLibrary();
  // «Банан» переопределён так, что первый слог начинается не с Б
  library.words[2].syllableIds = ['ar', 'nan'];
  const question = buildLetterShowQuestion(library, 'banan', rng());
  assert.equal(question.answerLetterNumber, 1);
});

test('этап 1 отказывается строить вопрос по отсутствующему слову', () => {
  assert.throws(() => buildLetterShowQuestion(testLibrary(), 'net', rng()), QuestionBuildError);
});

test('короткий алфавит не мешает построить вопрос — панель просто меньше', () => {
  const library = testLibrary();
  library.letters = library.letters.slice(0, 3);
  const question = buildLetterShowQuestion(library, 'avtobus', rng());
  assert.equal(question.optionLetterNumbers.length, 3);
  assert.ok(question.optionLetterNumbers.includes(1));
});

// ─── Этап 2 ──────────────────────────────────────────────────────────────

test('этап 2 показывает все слоги кроме последнего, его же и спрашивает', () => {
  const question = buildWordCompletingQuestion(testLibrary(), 'avtobus', rng());
  assert.deepEqual(question.shownSyllableIds, ['av', 'to']);
  assert.equal(question.answerSyllableId, 'bus');
});

test('панель этапа 2 — восемь слогов, верный один', () => {
  // В фикстуре слогов всего восемь, три из них принадлежат «Автобусу» и
  // в дистракторы не идут, поэтому пакет расширяется до настоящего размера
  const library = testLibrary();
  for (let i = 0; i < 10; i++) {
    library.syllables.push({ id: `zap${i}`, name: `за${i}`, letterNumbers: [9, 1] });
  }
  const question = buildWordCompletingQuestion(library, 'avtobus', rng());
  assert.equal(question.optionSyllableIds.length, SYLLABLE_OPTIONS);
  assert.equal(question.optionSyllableIds.filter((id) => id === 'bus').length, 1);
  assert.equal(new Set(question.optionSyllableIds).size, SYLLABLE_OPTIONS);
});

test('нехватка слогов даёт панель короче восьми, но с верным ответом', () => {
  // Свой маленький пакет педагога — законный случай, а не дефект
  const question = buildWordCompletingQuestion(testLibrary(), 'avtobus', rng());
  assert.equal(question.optionSyllableIds.length, 6, 'восемь слогов минус три своих плюс верный');
  assert.ok(question.optionSyllableIds.includes('bus'));
});

test('уже набранные слоги слова в дистракторы не попадают', () => {
  // Как у эталона: при набранном МАЛЬ варианта МАЛЬ на панели нет —
  // положить его второй раз нельзя ни по какому правилу игры
  const question = buildWordCompletingQuestion(testLibrary(), 'avtobus', rng());
  assert.ok(!question.optionSyllableIds.includes('av'));
  assert.ok(!question.optionSyllableIds.includes('to'));
});

test('этап 2 отказывается от односложного слова', () => {
  assert.throws(
    () => buildWordCompletingQuestion(testLibrary(), 'bant', rng()),
    /односложн/
  );
});

test('этап 2 отказывается от слова без записи «без последнего слога»', () => {
  // Иначе звучало бы слово целиком — вместе с ответом, который ребёнок
  // должен найти сам
  const library = testLibrary();
  library.words[0].hasWithoutLastSyllable = false;
  assert.throws(
    () => buildWordCompletingQuestion(library, 'avtobus', rng()),
    /без последнего слога/
  );
});

// ─── Этап 3 ──────────────────────────────────────────────────────────────

test('панель этапа 3 содержит все слоги слова одновременно', () => {
  // У эталона: «табурет», три ячейки, на панели и ТА, и БУ, и РЕТ
  const question = buildWordMakeQuestion(testLibrary(), 'avtobus', rng());
  assert.deepEqual(question.answerSyllableIds, ['av', 'to', 'bus']);
  for (const id of ['av', 'to', 'bus']) {
    assert.ok(question.optionSyllableIds.includes(id), `на панели нет слога ${id}`);
  }
  assert.equal(question.optionSyllableIds.length, SYLLABLE_OPTIONS);
});

test('восемь — общее число вариантов, а не число дистракторов', () => {
  const library = testLibrary();
  const three = buildWordMakeQuestion(library, 'avtobus', rng());
  const two = buildWordMakeQuestion(library, 'arbuz', rng());
  assert.equal(three.optionSyllableIds.length, SYLLABLE_OPTIONS);
  assert.equal(two.optionSyllableIds.length, SYLLABLE_OPTIONS);
  // у трёхслогового дистракторов 5, у двуслогового 6
  assert.equal(three.optionSyllableIds.filter((id) => !['av', 'to', 'bus'].includes(id)).length, 5);
  assert.equal(two.optionSyllableIds.filter((id) => !['ar', 'buz'].includes(id)).length, 6);
});

test('слово длиннее панели отвергается, а не роняет занятие', () => {
  const library = testLibrary();
  library.words[0].syllableIds = ['av', 'to', 'bus', 'ar', 'buz', 'ba', 'nan', 'bant', 'av2'];
  library.syllables.push({ id: 'av2', name: 'ав', letterNumbers: [1] });
  assert.throws(() => buildWordMakeQuestion(library, 'avtobus', rng()), /не помещается/);
});

test('нехватка слогов в пакете даёт панель короче восьми, но рабочую', () => {
  // Свой маленький пакет педагога — законный случай, а не дефект
  const library = testLibrary();
  library.syllables = library.syllables.filter((s) => ['av', 'to', 'bus', 'ar'].includes(s.id));
  const question = buildWordMakeQuestion(library, 'avtobus', rng());
  assert.equal(question.optionSyllableIds.length, 4);
  for (const id of ['av', 'to', 'bus']) {
    assert.ok(question.optionSyllableIds.includes(id));
  }
});
