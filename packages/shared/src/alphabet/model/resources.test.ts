import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wordImagePath,
  wordAudioPath,
  wordWithoutLastSyllableAudioPath,
  letterAudioPath,
  syllableAudioPath,
  schemeHasAudio,
  expectedLibraryFiles,
  checkLibraryCompleteness,
  checkPathCollisions,
  harmfulPathCollisions,
  estimateContentSize,
} from './resources';
import { testLibrary, TEST_LIBRARY_FILES } from './testLibrary';

test('пути ресурсов совпадают с эталонной раскладкой', () => {
  assert.equal(wordImagePath('avtobus'), 'img/avtobus.svg');
  assert.equal(wordAudioPath('avtobus'), 'media/avtobus.mp3');
  assert.equal(wordWithoutLastSyllableAudioPath('avtobus'), 'media/avtobus_bgn.mp3');
  assert.equal(letterAudioPath(1), 'media/1.mp3');
  assert.equal(letterAudioPath(33), 'media/33.mp3');
  assert.equal(syllableAudioPath('vto'), 'media/vto.mp3');
});

test('комплектная фикстура проходит проверку', () => {
  const report = checkLibraryCompleteness(testLibrary(), TEST_LIBRARY_FILES);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.unreferenced, []);
  assert.equal(report.complete, true);
});

test('нехватка одного mp3 — не предупреждение, а несоответствие', () => {
  // Именно так дефект дожил до продакшена у эталона: очередь
  // воспроизведения на отсутствующем файле не падает
  const files = TEST_LIBRARY_FILES.filter((f) => f !== 'media/avtobus_bgn.mp3');
  const report = checkLibraryCompleteness(testLibrary(), files);
  assert.equal(report.complete, false);
  assert.deepEqual(report.missing, ['media/avtobus_bgn.mp3']);
});

test('лишний файл в пакете виден как мёртвый вес', () => {
  const report = checkLibraryCompleteness(testLibrary(), [...TEST_LIBRARY_FILES, 'media/staroe.mp3']);
  assert.equal(report.complete, true);
  assert.deepEqual(report.unreferenced, ['media/staroe.mp3']);
});

test('разделители пути приводятся к POSIX-форме', () => {
  // На Windows обход каталога отдаёт «\», манифест всегда в «/»
  const windows = TEST_LIBRARY_FILES.map((f) => f.replace(/\//g, '\\'));
  assert.equal(checkLibraryCompleteness(testLibrary(), windows).complete, true);
});

test('односложное слово не требует записи «без последнего слога»', () => {
  const files = expectedLibraryFiles(testLibrary());
  assert.ok(files.includes('media/avtobus_bgn.mp3'));
  assert.ok(!files.includes('media/bant_bgn.mp3'), 'у «Бант» нет последнего слога, чтобы его убрать');
});

test('незаписанная озвучка снимает требование звука, но не картинок', () => {
  // Иллюстрации и озвучка делаются разными людьми и в разные сроки;
  // пакет без звука обязан собираться
  const library = testLibrary({ audioScheme: { recorded: false } });
  assert.equal(schemeHasAudio(library), false);
  const files = expectedLibraryFiles(library);
  assert.deepEqual(files, ['img/avtobus.svg', 'img/arbuz.svg', 'img/banan.svg', 'img/bant.svg']);
});

test('список ожидаемых файлов без повторов', () => {
  const files = expectedLibraryFiles(testLibrary());
  assert.equal(new Set(files).size, files.length);
});

test('односложное слово делит файл со своим слогом — это не дефект', () => {
  // «Бант»/слог «бант» звучат одинаково, один mp3 на двоих — экономия,
  // ровно как «Йод»/`jod` у эталона
  const collisions = checkPathCollisions(testLibrary());
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].path, 'media/bant.mp3');
  assert.equal(collisions[0].benign, true);
  assert.deepEqual(harmfulPathCollisions(testLibrary()), []);
});

test('слог, забирающий путь чужого слова, — дефект сборки', () => {
  // Слог с идентификатором «arbuz» перезапишет озвучку слова «Арбуз»,
  // и слово заговорит куском другого слова
  const library = testLibrary();
  library.syllables.push({ id: 'arbuz', name: 'арбуз', letterNumbers: [1, 18, 2, 21, 9] });
  const harmful = harmfulPathCollisions(library);
  assert.equal(harmful.length, 1);
  assert.equal(harmful[0].path, 'media/arbuz.mp3');
  assert.equal(harmful[0].owners.length, 2);
});

test('слог с числовым идентификатором забирает путь буквы', () => {
  const library = testLibrary();
  library.syllables.push({ id: '1', name: 'а', letterNumbers: [1] });
  const harmful = harmfulPathCollisions(library);
  assert.deepEqual(
    harmful.map((c) => c.path),
    ['media/1.mp3']
  );
});

test('слог, кончающийся на _bgn, забирает путь чужого «без последнего слога»', () => {
  // «_» в идентификаторах означает мягкий знак, так что такой слог возможен
  const library = testLibrary();
  library.syllables.push({ id: 'arbuz_bgn', name: 'бгн', letterNumbers: [2] });
  assert.deepEqual(
    harmfulPathCollisions(library).map((c) => c.path),
    ['media/arbuz_bgn.mp3']
  );
});

test('оценка веса считает общий файл односложного слова один раз', () => {
  const estimate = estimateContentSize(testLibrary(), { imageBytes: 1000, audioBytes: 100 });
  // 33 буквы + 8 слогов + 4 слова + 3 записи «без последнего слога»,
  // минус один общий файл «Бант»/«бант» = 47
  assert.equal(estimate.audioFileCount, 47);
  assert.equal(estimate.wordCount, 4);
  assert.equal(estimate.imageBytes, 4000);
  assert.equal(estimate.audioBytes, 4700);
  assert.equal(estimate.totalBytes, 8700);
});
