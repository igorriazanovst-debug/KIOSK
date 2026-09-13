// packages/words-library/tools/build.mjs
// Сборка поставочного пакета «Я знаю много слов» из словаря catalogue.mjs.
//
// Делает четыре вещи:
//   1. пишет index.json;
//   2. ставит заглушку туда, где иллюстрации ЕЩЁ НЕТ;
//   3. убирает картинки и озвучку слов и тем, которых больше нет в словаре;
//   4. честно докладывает, сколько картинок настоящих, а сколько заглушек.
//
// ЗАГЛУШКА СТАВИТСЯ, ТОЛЬКО ЕСЛИ КАРТИНКИ НЕТ. Прежний генератор
// (generate-placeholders.mjs) перезаписывал каталог целиком — в Типе 3 такой
// сборщик однажды снёс 95 настоящих иллюстраций, сделанных за три часа.
// Правило, а не порядок запуска: порядок команд забывается, правило остаётся.
//
// ЗАГЛУШКА УЗНАЁТСЯ ПО СОДЕРЖИМОМУ, а не по наличию файла. В Типе 3 сборщик
// проверял существование и бодро доложил «все настоящие», когда девяносто две
// картинки были свежепоставленными заглушками. Отчёт о готовности контента,
// который ошибается в свою пользу, опаснее отсутствующего: на него смотрят
// вместо проверки.
//
// Запуск: node tools/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLibrary, THEMES } from './catalogue.mjs';
// Пути к каталогам берутся ИЗ ТОГО ЖЕ МОДУЛЯ, что и проверка комплектности.
// Зашитые строки здесь уже подвели: я написал assets/audio вместо
// assets/media, и уборка звука молча не нашла ни одного файла. При обратной
// ошибке она бы их удалила. Единственный источник правды о путях — resources.
// Разрешается так же, как в plan-narration.mjs: у пакета контента нет своего
// node_modules, поэтому берём собранный shared по пути, а не по имени
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');

const sharedPath = path.resolve(ROOT, '../shared/dist/index.js');
if (!fs.existsSync(sharedPath)) {
  console.error(`Не найден собранный @kiosk/shared: ${sharedPath}
Соберите: cd packages/shared && npm run build`);
  process.exit(1);
}
const {
  WORDS_IMAGE_DIR,
  WORDS_THEME_IMAGE_DIR,
  WORDS_AUDIO_DIR,
  WORDS_THEME_AUDIO_DIR,
  WORDS_FINAL_SCENE_AUDIO_DIR,
} = createRequire(import.meta.url)(sharedPath);
const WORD_IMG = path.join(ASSETS, WORDS_IMAGE_DIR);
const THEME_IMG = path.join(ASSETS, WORDS_THEME_IMAGE_DIR);
const WORD_AUDIO = path.join(ASSETS, WORDS_AUDIO_DIR);
const THEME_AUDIO = path.join(ASSETS, WORDS_THEME_AUDIO_DIR);
const FINAL_AUDIO = path.join(ASSETS, WORDS_FINAL_SCENE_AUDIO_DIR);

const SCHEMA_VERSION = 1;
const AUDIO_SCHEME = { voices: ['irina'], phrasesPerVoice: 2, neutral: true };

const PLACEHOLDER_MARK = 'заглушка';

fs.mkdirSync(WORD_IMG, { recursive: true });
fs.mkdirSync(THEME_IMG, { recursive: true });

const isPlaceholder = (file) =>
  fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(PLACEHOLDER_MARK);

/**
 * Заглушка НЕ должна подсказывать ответ и не должна быть узнаваемой: ребёнок
 * ищет картинку по слову, и если на заглушке будет написано слово или
 * нарисован предмет, проверка игрового цикла перестанет что-либо значить.
 * Отсюда абстрактные фигуры и никакого текста.
 */
function placeholderSvg(seed, color) {
  // FNV-1a: у простого умножения на 31 короткие идентификаторы кучкуются, и
  // в Типе 3 из 95 заглушек десять оказались одинаковыми
  let h = 0x811c9dc5;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const a = 60 + (h % 120);
  const b = 60 + ((h >>> 8) % 120);
  const r = 40 + ((h >>> 16) % 70);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- заглушка: настоящей иллюстрации ещё нет -->
  <rect width="512" height="512" rx="48" fill="${color}" opacity="0.18"/>
  <circle cx="${a + 140}" cy="${b + 140}" r="${r}" fill="${color}" opacity="0.5"/>
  <rect x="${b + 90}" y="${a + 200}" width="${r * 2}" height="${r * 2}" rx="18" fill="${color}" opacity="0.35"/>
  <path d="M ${a + 60} ${b + 330} L ${a + 200} ${b + 330} L ${a + 130} ${b + 210} Z" fill="${color}" opacity="0.28"/>
</svg>
`;
}

const library = buildLibrary();
const colorOf = Object.fromEntries(THEMES.map((t) => [t.id, t.color]));

// ─── index.json ──────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(ROOT, 'index.json'),
  `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, audioScheme: AUDIO_SCHEME, ...library }, null, 2)}\n`,
  'utf8'
);

// ─── иллюстрации слов ────────────────────────────────────────────────────
let real = 0;
let stubs = 0;
for (const word of library.words) {
  const file = path.join(WORD_IMG, `${word.id}.svg`);
  if (fs.existsSync(file)) {
    if (isPlaceholder(file)) stubs += 1;
    else real += 1;
    continue;
  }
  fs.writeFileSync(file, placeholderSvg(word.id + word.name, colorOf[word.themeId] ?? '#666'), 'utf8');
  stubs += 1;
}

// ─── обложки тем ─────────────────────────────────────────────────────────
let coversReal = 0;
let coversStub = 0;
for (const theme of library.themes) {
  const file = path.join(THEME_IMG, `${theme.id}.svg`);
  if (fs.existsSync(file)) {
    if (isPlaceholder(file)) coversStub += 1;
    else coversReal += 1;
    continue;
  }
  fs.writeFileSync(file, placeholderSvg(theme.id + theme.title, colorOf[theme.id] ?? '#666'), 'utf8');
  coversStub += 1;
}

// ─── уборка: файлов слов и тем, которых больше нет ───────────────────────
//
// Уборка СИММЕТРИЧНА для картинок и звука. В Типе 3 она была однобокой:
// картинки исчезнувших слов удалялись, а их озвучка оставалась, и двадцать
// осиротевших mp3 заметила внешняя сверка, а не сам сборщик.
const knownWords = new Set(library.words.map((w) => w.id));
const knownThemes = new Set(library.themes.map((t) => t.id));

for (const file of fs.readdirSync(WORD_IMG)) {
  if (!knownWords.has(path.parse(file).name)) {
    fs.unlinkSync(path.join(WORD_IMG, file));
    console.log(`убрана картинка слова, которого больше нет: ${file}`);
  }
}
for (const file of fs.readdirSync(THEME_IMG)) {
  if (!knownThemes.has(path.parse(file).name)) {
    fs.unlinkSync(path.join(THEME_IMG, file));
    console.log(`убрана обложка темы, которой больше нет: ${file}`);
  }
}

function sweepAudio(dir, known, what) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const name = path.parse(entry).name;
    if (known.has(name)) continue;
    const full = path.join(dir, entry);
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`убрана озвучка ${what}, которого больше нет: ${entry}`);
  }
}
sweepAudio(WORD_AUDIO, knownWords, 'слова');
sweepAudio(THEME_AUDIO, knownThemes, 'темы');
sweepAudio(FINAL_AUDIO, knownThemes, 'финальной сцены');

// ─── отчёт ───────────────────────────────────────────────────────────────
const audioCount = [WORD_AUDIO, THEME_AUDIO, FINAL_AUDIO]
  .filter((d) => fs.existsSync(d))
  .reduce(
    (sum, d) => sum + fs.readdirSync(d, { recursive: true }).filter((f) => String(f).endsWith('.mp3')).length,
    0
  );
const expectedAudio =
  library.words.length * (1 + AUDIO_SCHEME.voices.length * AUDIO_SCHEME.phrasesPerVoice) +
  library.themes.length * (AUDIO_SCHEME.voices.length + 1);

console.log(`тем: ${library.themes.length} (ТЗ строка 59 требует ≥ 15)`);
console.log(`слов: ${library.words.length} (ТЗ строка 58 требует ≥ 250)`);
console.log(`вводных частей тем: ${library.themes.filter((t) => t.intro).length} из ${library.themes.length}`);
console.log(
  `иллюстраций слов: ${library.words.length}` +
    (stubs > 0 ? ` — из них ЗАГЛУШЕК ${stubs}, настоящих ${real}` : ' (все настоящие)')
);
console.log(
  `обложек тем: ${library.themes.length}` +
    (coversStub > 0 ? ` — из них ЗАГЛУШЕК ${coversStub}, настоящих ${coversReal}` : ' (все настоящие)')
);
console.log(
  `озвучка: ${audioCount} из ${expectedAudio} файлов` +
    (audioCount >= expectedAudio ? ' — полная' : ` — НЕ ХВАТАЕТ ${expectedAudio - audioCount}`)
);
