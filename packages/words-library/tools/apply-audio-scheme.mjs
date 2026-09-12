// packages/words-library/tools/apply-audio-scheme.mjs
//
// Прописывает схему озвучки в index.json — но ТОЛЬКО если все файлы, которые
// эта схема требует, реально лежат на диске.
//
// Тот же принцип, что у «Матемашки»: там идентификатор озвучки проставляется
// заданию лишь при фактически существующем mp3. Причина здесь весомее: схема
// в манифесте — это обещание, на которое опирается и проверка комплектности, и
// рантайм. Манифест, объявивший озвучку, которой нет, даёт худший из возможных
// исходов: `hasAudio` становится true, подпись «озвучка не записана» с экрана
// исчезает, игра пытается проиграть несуществующий файл, очередь ошибку
// глотает — и ребёнок видит молчащую карточку без всякого объяснения.
//
// Манифест правится точечно (JSON.parse → JSON.stringify с отступом 2), а не
// через ConvertTo-Json в PowerShell: тот переформатирует файл целиком.
//
// Запуск:
//   node tools/apply-audio-scheme.mjs --voices irina --phrases 2 --neutral

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const sharedPath = path.resolve(packageRoot, '../shared/dist/index.js');
if (!fs.existsSync(sharedPath)) {
  console.error(`Не найден собранный @kiosk/shared: ${sharedPath}`);
  process.exit(1);
}
const { parseWordsLibrary, checkLibraryCompleteness, estimateContentSize } = require(sharedPath);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const voices = String(arg('voices', '')).split(',').map((v) => v.trim()).filter(Boolean);
const phrasesPerVoice = Number(arg('phrases', 0));
const neutral = arg('neutral', false) !== false;
const dryRun = arg('dry-run', false) !== false;

/**
 * Файлы пакета — пути ОТНОСИТЕЛЬНО каталога assets, в POSIX-форме: именно так
 * их отдаёт listFilesSync в electron/words/contentLibrary.js, и именно в такой
 * форме их ждёт checkLibraryCompleteness. Префикс «assets/» здесь был бы
 * расхождением с рантаймом, и проверка нашла бы «ничего».
 */
function listPackageFiles(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listPackageFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

const indexPath = path.join(packageRoot, 'index.json');
const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

// Библиотека с ЖЕЛАЕМОЙ схемой — по ней и спрашиваем комплектность
const candidate = { ...raw, audioScheme: { voices, phrasesPerVoice, neutral } };
const library = parseWordsLibrary(candidate);

const assetsDir = path.join(packageRoot, 'assets');
const files = fs.existsSync(assetsDir) ? listPackageFiles(assetsDir) : [];

const report = checkLibraryCompleteness(library, files);

console.log(`Схема: neutral=${neutral}, голоса=[${voices.join(', ') || '—'}], фраз на голос=${phrasesPerVoice}`);
console.log(`Файлов в пакете: ${files.length}`);

if (!report.complete) {
  console.error(`\nНЕ ХВАТАЕТ ФАЙЛОВ: ${report.missing.length}. Схема НЕ записана.`);
  for (const f of report.missing.slice(0, 20)) console.error('  нет: ' + f);
  if (report.missing.length > 20) console.error(`  … и ещё ${report.missing.length - 20}`);
  console.error('\nСначала сгенерируйте озвучку (tools/generate-narration.ps1), потом повторите.');
  process.exit(1);
}

if (report.unreferenced.length > 0) {
  console.log(`\nЛишние файлы (мёртвый вес дистрибутива), ${report.unreferenced.length}:`);
  for (const f of report.unreferenced.slice(0, 10)) console.log('  лишний: ' + f);
}

// Фактический вес — вход для решения по бюджету контента (спайк 0.3 плана)
const bytesOf = (rel) => fs.statSync(path.join(assetsDir, rel)).size;
const avg = (list) => (list.length ? list.reduce((s, f) => s + bytesOf(f), 0) / list.length : 0);

const wordImages = files.filter((f) => f.startsWith('img/words/'));
const themeCovers = files.filter((f) => f.startsWith('img/themes/'));
const audioFiles = files.filter((f) => f.endsWith('.mp3'));

const imageBytes = [...wordImages, ...themeCovers].reduce((s, f) => s + bytesOf(f), 0);
const audioBytes = audioFiles.reduce((s, f) => s + bytesOf(f), 0);

const estimate = estimateContentSize(library, {
  imageBytes: avg(wordImages),
  themeCoverBytes: avg(themeCovers),
  audioBytes: avg(audioFiles),
});

console.log('\nФактический вес пакета:');
console.log(`  иллюстрации: ${(imageBytes / 1024).toFixed(1)} КБ`);
console.log(`  озвучка: ${audioFiles.length} файлов, ${(audioBytes / 1024).toFixed(1)} КБ`);
console.log(`  средний mp3: ${(audioBytes / Math.max(1, audioFiles.length) / 1024).toFixed(1)} КБ`);
console.log(`  оценка по модели на текущий каталог: ${(estimate.totalBytes / 1024).toFixed(1)} КБ`);

// Проекция на целевой каталог ТЗ (план берёт с запасом: 270 слов, 15 тем) —
// это фактический ответ на спайк 0.3 «сколько весит контент при схеме N»
const projected = estimateContentSize(
  { ...library, words: Array.from({ length: 270 }, (_, i) => library.words[i % library.words.length]),
    themes: Array.from({ length: 15 }, (_, i) => library.themes[i % library.themes.length]) },
  { imageBytes: avg(wordImages), themeCoverBytes: avg(themeCovers), audioBytes: avg(audioFiles) }
);
console.log('');
console.log('Проекция на целевой каталог (270 слов, 15 тем) при этой схеме:');
console.log(`  файлов озвучки: ${projected.audioFileCount}`);
console.log(`  озвучка: ${(projected.audioBytes / 1024 / 1024).toFixed(1)} МБ`);
console.log(`  всего контента: ${(projected.totalBytes / 1024 / 1024).toFixed(1)} МБ`);

if (dryRun) {
  console.log('\n--dry-run: манифест не изменён');
  process.exit(0);
}

raw.audioScheme = { voices, phrasesPerVoice, neutral };
fs.writeFileSync(indexPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
console.log(`\nСхема записана в ${path.relative(process.cwd(), indexPath)}`);
