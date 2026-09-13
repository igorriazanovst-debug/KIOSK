// packages/alphabet-library/tools/build.mjs
// Собирает пакет контента: index.json и иллюстрации-заглушки.
//
// ИЛЛЮСТРАЦИИ ЗДЕСЬ — ЗАГЛУШКИ, и это видно с первого взгляда: абстрактная
// фигура и подпись «заглушка». Они не притворяются рисунками, чтобы никто не
// принял собранный пакет за готовый к поставке.
//
// ЗАГЛУШКА СТАВИТСЯ ТОЛЬКО ТАМ, ГДЕ КАРТИНКИ НЕТ. Сборщик манифеста не
// должен уметь уничтожать контент — см. комментарий у самой записи файлов.
//
// ЗАГЛУШКА НЕ НЕСЁТ НИ БУКВЫ, НИ НАЗВАНИЯ СЛОВА — и это главное решение
// файла. Первая версия рисовала первую букву слова крупно в круге и
// подписывала словом; на этапе «покажи букву» это буквально был ответ,
// напечатанный на карточке. Заглушка не должна давать того, чего не даст
// настоящий рисунок: узнать слово по изображению — и есть задание.
//
// Различимы между собой они при этом остаются: фигура и цвет выводятся из
// идентификатора. Это условие проверки, а не украшательство — на всех трёх
// этапах выбирают из нескольких карточек, и будь они одинаковы, живой прогон
// не доказал бы ничего.
//
// Следствие: С ЗАГЛУШКАМИ ИГРА ОСМЫСЛЕННА ТОЛЬКО СО ЗВУКОМ. Так и задумано:
// слово несут картинка и озвучка, а пока картинки условные — одна озвучка.
//
// ОЗВУЧКА ЗДЕСЬ НЕ ГЕНЕРИРУЕТСЯ — этим занимается отдельный прогон
// (tools/plan-narration.mjs плюс общий генератор из words-library). Здесь
// только СМОТРЯТ, полон ли набор файлов, и от этого зависит, объявит ли
// манифест озвучку записанной.
//
// Флаг `audioScheme.recorded: false` — законное состояние пакета: схема
// допускает его специально, иначе иллюстрации нельзя было бы начать раньше
// звука, а делают их разные люди и в разные сроки.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalogue } from './catalogue.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const assets = path.join(root, 'assets');
const imgDir = path.join(assets, 'img');

const SCHEMA_VERSION = 1;

/**
 * Устойчивый хеш идентификатора: одно слово — всегда один вид заглушки.
 *
 * FNV-1a, а не «умножение на 31»: последнее на коротких строках вроде «ryba»
 * и «yula» заметно кучкуется, и заглушек-двойников выходило 10 из 95 вместо
 * ожидаемых трёх.
 */
function hashOf(id) {
  let hash = 0x811c9dc5;
  for (const ch of id) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function hueOf(id) {
  return hashOf(id) % 360;
}

function placeholderSvg(word) {
  const hue = hueOf(word.id);
  // Фигура выводится из идентификатора: карточки должны различаться между
  // собой, но ничего не сообщать о слове
  const shape = hashOf(`${word.id}#shape`) % 4;
  const tilt = (hashOf(`${word.id}#tilt`) % 5) * 9 - 18;
  const accent = (hue + 140) % 360;

  const figures = [
    `<circle cx="256" cy="236" r="118" fill="hsl(${accent} 58% 46%)"/>`,
    `<rect x="146" y="126" width="220" height="220" rx="34" fill="hsl(${accent} 58% 46%)"/>`,
    `<polygon points="256,112 374,346 138,346" fill="hsl(${accent} 58% 46%)"/>`,
    `<polygon points="256,110 372,236 256,362 140,236" fill="hsl(${accent} 58% 46%)"/>`,
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 62% 78%)"/>
      <stop offset="1" stop-color="hsl(${hue} 55% 60%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="36" fill="url(#g)"/>
  <g transform="rotate(${tilt} 256 236)">${figures[shape]}</g>
  <text x="256" y="440" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, sans-serif" font-size="34" font-weight="700"
        fill="#ffffff" opacity="0.85">заглушка</text>
</svg>
`;
}

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (ch) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[ch]);
}

const catalogue = buildCatalogue();

/**
 * Объявлять озвучку записанной МОЖНО ТОЛЬКО ПРИ ПОЛНОМ НАБОРЕ ФАЙЛОВ.
 *
 * Манифест, объявивший звук, которого нет, — худший исход: подпись «озвучка
 * ещё не записана» с экрана исчезает, кнопка становится активной, и ребёнок
 * видит молчащую карточку без всякого объяснения. Отсутствующий файл очередь
 * воспроизведения не роняет — именно поэтому такой дефект дожил бы до
 * занятия. В Тип 2 это отдельный шаг сборки, здесь — часть этой же.
 */
function audioIsComplete(cat) {
  const mediaDir = path.join(assets, 'media');
  const wanted = new Set();
  for (const letter of cat.letters) wanted.add(`${letter.number}.mp3`);
  for (const syllable of cat.syllables) wanted.add(`${syllable.id}.mp3`);
  for (const word of cat.words) {
    wanted.add(`${word.id}.mp3`);
    if (word.hasWithoutLastSyllable) wanted.add(`${word.id}_bgn.mp3`);
  }
  const missing = [...wanted].filter((name) => !fs.existsSync(path.join(mediaDir, name)));
  return { complete: missing.length === 0, missing, expected: wanted.size };
}

const audio = audioIsComplete(catalogue);

const library = {
  schemaVersion: SCHEMA_VERSION,
  audioScheme: { recorded: audio.complete },
  letters: catalogue.letters,
  syllables: catalogue.syllables,
  words: catalogue.words,
  sets: catalogue.sets,
};

// ЗАГЛУШКА СТАВИТСЯ, ТОЛЬКО ЕСЛИ КАРТИНКИ НЕТ. Первая версия чистила каталог
// целиком и писала заглушки заново — и однажды снесла 95 настоящих
// иллюстраций, сделанных за три часа, просто потому что сборку манифеста
// запустили после них. Сборщик манифеста не должен уметь уничтожать контент.
//
// media/ не трогается по той же причине: генерация озвучки занимает минуты.
fs.mkdirSync(imgDir, { recursive: true });

let placeholders = 0;
let real = 0;
for (const word of catalogue.words) {
  const file = path.join(imgDir, `${word.id}.svg`);
  if (fs.existsSync(file)) {
    real += 1;
    continue;
  }
  fs.writeFileSync(file, placeholderSvg(word), 'utf8');
  placeholders += 1;
}

// Картинки слов, которых больше нет в словаре, — мёртвый вес дистрибутива.
// Их убираем: это не контент, а мусор от прежних правок словаря
const known = new Set(catalogue.words.map((w) => `${w.id}.svg`));
for (const file of fs.readdirSync(imgDir)) {
  if (!known.has(file)) {
    fs.unlinkSync(path.join(imgDir, file));
    console.log(`убрана картинка слова, которого больше нет: ${file}`);
  }
}

fs.writeFileSync(
  path.join(root, 'index.json'),
  `${JSON.stringify(library, null, 2)}\n`,
  'utf8'
);

const bytes = catalogue.words.reduce(
  (sum, w) => sum + fs.statSync(path.join(imgDir, `${w.id}.svg`)).size,
  0
);

console.log(`букв: ${library.letters.length}`);
console.log(`слов: ${library.words.length}`);
console.log(`слогов: ${library.syllables.length}`);
console.log(`комплектов: ${library.sets.length}`);
console.log(
  `иллюстраций: ${catalogue.words.length}, ${(bytes / 1024).toFixed(1)} КБ` +
    (placeholders > 0 ? ` — из них ЗАГЛУШЕК ${placeholders}, настоящих ${real}` : ' (все настоящие)')
);
if (audio.complete) {
  const mediaBytes = fs
    .readdirSync(path.join(assets, 'media'))
    .reduce((sum, f) => sum + fs.statSync(path.join(assets, 'media', f)).size, 0);
  console.log(`озвучка: записана, ${audio.expected} файлов, ${(mediaBytes / 1024 / 1024).toFixed(1)} МБ`);
} else {
  console.log(
    `озвучка: НЕ записана — не хватает ${audio.missing.length} из ${audio.expected} файлов` +
      (audio.missing.length ? ` (например ${audio.missing.slice(0, 3).join(', ')})` : '')
  );
}
