import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkGraph,
  checkLetterIllustrations,
  firstLetterNumber,
  letterByNumber,
  wordsForCompleting,
  wordsForLetterShow,
  wordsForMaking,
  MIN_ILLUSTRATIONS_PER_LETTER,
} from './graph';
import { testLibrary } from './testLibrary';

test('целая фикстура проходит проверку графа', () => {
  const report = checkGraph(testLibrary());
  assert.deepEqual(report.issues, []);
  assert.equal(report.consistent, true);
});

test('слово, ссылающееся на несуществующий слог, ловится', () => {
  const library = testLibrary();
  library.words[0].syllableIds = ['av', 'net-takogo', 'bus'];
  const report = checkGraph(library);
  assert.equal(report.consistent, false);
  const issue = report.issues.find((i) => i.kind === 'word-syllable');
  assert.ok(issue, 'ожидалась жалоба на связь слово→слог');
  assert.match(issue.message, /Автобус/);
  assert.match(issue.message, /net-takogo/);
});

test('слог, ссылающийся на букву вне алфавита пакета, ловится', () => {
  // Алфавит урезан до двух букв — так выглядит недособранный пакет,
  // где слоги завели раньше, чем весь алфавит
  const library = testLibrary();
  library.letters = library.letters.slice(0, 2);
  const report = checkGraph(library);
  const issue = report.issues.find((i) => i.kind === 'syllable-letter');
  assert.ok(issue);
  assert.match(issue.message, /№3\b/);
});

test('буква, перечисляющая удалённое слово, ловится', () => {
  // Ровно то, что случается, когда педагог удаляет своё слово:
  // запись слова ушла, ссылка у буквы осталась
  const library = testLibrary();
  library.words = library.words.filter((w) => w.id !== 'arbuz');
  const report = checkGraph(library);
  const issue = report.issues.find((i) => i.kind === 'letter-word');
  assert.ok(issue);
  assert.match(issue.message, /арбуз|arbuz/i);
});

test('комплект, ссылающийся на удалённое слово, ловится', () => {
  const library = testLibrary();
  library.words = library.words.filter((w) => w.id !== 'avtobus');
  const report = checkGraph(library);
  assert.ok(report.issues.some((i) => i.kind === 'set-word'));
});

test('слово, не перечисленное у своей буквы, ловится', () => {
  // Обратная связь важна не меньше прямой: слово в пакете есть, а этап
  // «покажи букву» его не увидит, потому что берёт задания из списка буквы
  const library = testLibrary();
  library.letters[0].wordIds = ['avtobus'];
  const report = checkGraph(library);
  const issue = report.issues.find((i) => i.kind === 'word-letter');
  assert.ok(issue);
  assert.match(issue.message, /Арбуз/);
});

test('первая буква слова берётся через первый слог', () => {
  const library = testLibrary();
  const avtobus = library.words[0];
  assert.equal(firstLetterNumber(avtobus, library), 1);
  assert.equal(letterByNumber(library, 1)?.name, 'А');
  assert.equal(letterByNumber(library, 34), null);
});

test('требование ТЗ о двух иллюстрациях на букву проверяется отдельно', () => {
  assert.equal(MIN_ILLUSTRATIONS_PER_LETTER, 2);
  const report = checkLetterIllustrations(testLibrary());
  // В фикстуре слова есть только у А и Б — пакет требованию не отвечает,
  // и остальные 31 буква перечислены поимённо, а не спрятаны за «не ok»
  assert.equal(report.ok, false);
  assert.equal(report.insufficient.length, 31);
  assert.equal(report.insufficient[0].name, 'В');
  assert.equal(report.insufficient[0].count, 0);
  // А и Б ровно на границе — и это должно быть ВИДНО, а не сойти за норму
  assert.deepEqual(
    report.atMinimum.map((l) => l.name),
    ['А', 'Б']
  );
});

test('буква с одной иллюстрацией проваливает требование', () => {
  const library = testLibrary();
  library.letters[0].wordIds = ['avtobus'];
  const report = checkLetterIllustrations(library);
  assert.equal(report.ok, false);
  assert.deepEqual(report.insufficient[0], { number: 1, name: 'А', count: 1 });
});

test('буква с запасом не попадает в список «на границе»', () => {
  const library = testLibrary();
  library.letters[1].wordIds = ['banan', 'bant', 'avtobus'];
  const report = checkLetterIllustrations(library);
  assert.deepEqual(
    report.atMinimum.map((l) => l.name),
    ['А']
  );
});

test('односложное слово годится этапу 1 и не годится этапам 2 и 3', () => {
  // «Бант» нечего достраивать и не из чего собирать. Это и есть причина,
  // по которой отбор заданий у каждого этапа свой
  const library = testLibrary();
  assert.equal(wordsForLetterShow(library).length, 4);
  assert.deepEqual(
    wordsForMaking(library).map((w) => w.id),
    ['avtobus', 'arbuz', 'banan']
  );
  assert.deepEqual(
    wordsForCompleting(library).map((w) => w.id),
    ['avtobus', 'arbuz', 'banan']
  );
});

test('слово без записи «без последнего слога» выпадает только из этапа 2', () => {
  const library = testLibrary();
  library.words[1].hasWithoutLastSyllable = false;
  assert.deepEqual(
    wordsForCompleting(library).map((w) => w.id),
    ['avtobus', 'banan']
  );
  // а собирать его по слогам по-прежнему можно
  assert.equal(
    wordsForMaking(library).some((w) => w.id === 'arbuz'),
    true
  );
});
