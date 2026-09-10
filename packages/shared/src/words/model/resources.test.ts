import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wordImagePath,
  wordNeutralAudioPath,
  wordPhraseAudioPath,
  wordAudioPaths,
  audioFilesPerWord,
  themeCoverPath,
  themeIntroAudioPath,
  themeFinalAudioPath,
  schemeHasAudio,
  expectedLibraryFiles,
  checkLibraryCompleteness,
  estimateContentSize,
} from './resources';
import { parseWordsLibrary, WORDS_LIBRARY_SCHEMA_VERSION } from './schema';
import type { AudioScheme, WordsLibrary } from './schema';

const TWO_VOICE_SCHEME: AudioScheme = { voices: ['boy', 'girl'], phrasesPerVoice: 5, neutral: true };
const MVP_SCHEME: AudioScheme = { voices: ['girl'], phrasesPerVoice: 2, neutral: true };

function tinyLibrary(scheme: AudioScheme = MVP_SCHEME): WordsLibrary {
  return parseWordsLibrary({
    schemaVersion: WORDS_LIBRARY_SCHEMA_VERSION,
    audioScheme: scheme,
    themes: [{ id: 'digits', title: 'Цифры', wordIds: ['0000', '0001'] }],
    words: [
      { id: '0000', name: 'Ноль', themeId: 'digits', level: 0 },
      { id: '0001', name: 'Один', themeId: 'digits', level: 0 },
    ],
  });
}

test('пути ресурсов выводятся из одного идентификатора слова', () => {
  assert.equal(wordImagePath('0000'), 'img/words/0000.svg');
  assert.equal(wordNeutralAudioPath('0000'), 'media/words/0000/neutral.mp3');
  assert.equal(wordPhraseAudioPath('0000', 'girl', 1), 'media/words/0000/girl/1.mp3');
  assert.equal(themeCoverPath('digits'), 'img/themes/digits.svg');
  assert.equal(themeIntroAudioPath('digits', 'girl'), 'media/themes/digits/girl.mp3');
  assert.equal(themeFinalAudioPath('digits'), 'media/scenes-final/digits.mp3');
});

test('схема эталона даёт ровно 11 записей на слово', () => {
  // 5 фраз мужским + 5 женским + нейтральная — как в поставке ОС3
  assert.equal(audioFilesPerWord(TWO_VOICE_SCHEME), 11);
  assert.equal(wordAudioPaths('0000', TWO_VOICE_SCHEME).length, 11);
});

test('сокращённая схема MVP даёт 3 записи на слово', () => {
  assert.equal(audioFilesPerWord(MVP_SCHEME), 3);
  assert.deepEqual(wordAudioPaths('0000', MVP_SCHEME), [
    'media/words/0000/neutral.mp3',
    'media/words/0000/girl/0.mp3',
    'media/words/0000/girl/1.mp3',
  ]);
});

test('схема без нейтральной записи не создаёт для неё путь', () => {
  const scheme: AudioScheme = { voices: ['girl'], phrasesPerVoice: 1, neutral: false };
  assert.deepEqual(wordAudioPaths('0000', scheme), ['media/words/0000/girl/0.mp3']);
});

test('ожидаемый состав пакета: обложка, реплики и финал на тему, файлы на каждое слово', () => {
  const files = expectedLibraryFiles(tinyLibrary());
  assert.ok(files.includes('img/themes/digits.svg'));
  assert.ok(files.includes('media/themes/digits/girl.mp3'));
  assert.ok(files.includes('media/scenes-final/digits.mp3'));
  // 3 файла на тему + по 4 файла на слово (svg + 3 mp3) × 2 слова
  assert.equal(files.length, 3 + 2 * 4);
});

test('проверка комплектности ловит недостающий файл озвучки', () => {
  // Ровно дефект поставки эталона: у двух слов 10 файлов вместо 11, вариант
  // выбирается случайно из имеющихся, и пропуск дожил до продакшена незаметно.
  const library = tinyLibrary();
  const all = expectedLibraryFiles(library);
  const withHole = all.filter((f) => f !== 'media/words/0001/girl/1.mp3');

  const report = checkLibraryCompleteness(library, withHole);
  assert.equal(report.complete, false);
  assert.deepEqual(report.missing, ['media/words/0001/girl/1.mp3']);
});

test('полный пакет признаётся комплектным', () => {
  const library = tinyLibrary();
  const report = checkLibraryCompleteness(library, expectedLibraryFiles(library));
  assert.equal(report.complete, true);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.unreferenced, []);
});

test('лишние файлы в пакете видны отдельно и не считаются ошибкой комплектности', () => {
  const library = tinyLibrary();
  const files = [...expectedLibraryFiles(library), 'media/words/9999/neutral.mp3'];
  const report = checkLibraryCompleteness(library, files);
  assert.equal(report.complete, true);
  assert.deepEqual(report.unreferenced, ['media/words/9999/neutral.mp3']);
});

test('пути с обратными слэшами (Windows) сверяются корректно', () => {
  const library = tinyLibrary();
  const windowsStyle = expectedLibraryFiles(library).map((f) => f.replace(/\//g, '\\'));
  const report = checkLibraryCompleteness(library, windowsStyle);
  assert.equal(report.complete, true);
});

test('оценка веса контента: сокращённая схема кратно легче эталонной', () => {
  const avg = { imageBytes: 80_000, audioBytes: 24_000, themeCoverBytes: 8_000 };
  const light = estimateContentSize(tinyLibrary(MVP_SCHEME), avg);
  const heavy = estimateContentSize(tinyLibrary(TWO_VOICE_SCHEME), avg);

  assert.equal(light.audioFileCount, 2 * 3 + 1 * 2); // 3 на слово + (1 голос + финал) на тему
  assert.equal(heavy.audioFileCount, 2 * 11 + 1 * 3);
  assert.ok(heavy.audioBytes > light.audioBytes * 2);
  assert.equal(light.totalBytes, light.imageBytes + light.audioBytes);
});

test('пакет без записанной озвучки — законное состояние: спрашиваются только картинки', () => {
  // Иллюстрации и звук производятся разными людьми и в разные сроки; пакет,
  // где картинки уже есть, а озвучки ещё нет, обязан проходить проверку.
  const silent: AudioScheme = { voices: [], phrasesPerVoice: 0, neutral: false };
  assert.equal(schemeHasAudio(silent), false);

  const library = tinyLibrary(silent);
  const files = expectedLibraryFiles(library);
  assert.deepEqual(files.filter((f) => f.endsWith('.mp3')), []);
  assert.equal(files.length, 1 + 2, 'обложка темы и по иллюстрации на слово');

  const report = checkLibraryCompleteness(library, files);
  assert.equal(report.complete, true);
});

test('schemeHasAudio: голоса без фраз и фразы без голосов озвучкой не считаются', () => {
  assert.equal(schemeHasAudio({ voices: ['girl'], phrasesPerVoice: 0, neutral: false }), false);
  assert.equal(schemeHasAudio({ voices: [], phrasesPerVoice: 3, neutral: false }), false);
  assert.equal(schemeHasAudio({ voices: [], phrasesPerVoice: 0, neutral: true }), true);
  assert.equal(schemeHasAudio({ voices: ['girl'], phrasesPerVoice: 1, neutral: false }), true);
});
