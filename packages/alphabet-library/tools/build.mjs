// packages/alphabet-library/tools/build.mjs
// Собирает пакет контента: index.json и иллюстрации-заглушки.
//
// ИЛЛЮСТРАЦИИ ЗДЕСЬ — ЗАГЛУШКИ, и это видно с первого взгляда: буква на
// цветном поле и подпись словом. Они не притворяются рисунками, чтобы никто
// не принял собранный пакет за готовый к поставке.
//
// Заглушки всё же РАЗЛИЧИМЫ между собой (цвет выводится из идентификатора, и
// подпись у каждой своя) — это не украшательство, а условие проверки: на всех
// трёх этапах ребёнок выбирает из нескольких вариантов, и если карточки
// неотличимы, живой прогон не докажет ничего.
//
// Настоящие рисунки и озвучка — Фаза 7. До них `audioScheme.recorded: false`,
// и это законное состояние пакета: схема специально его допускает, иначе
// иллюстрации нельзя было бы начать раньше звука.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalogue } from './catalogue.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const assets = path.join(root, 'assets');
const imgDir = path.join(assets, 'img');

const SCHEMA_VERSION = 1;

/** Устойчивый цвет из идентификатора: одно слово — всегда один цвет */
function hueOf(id) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}

function placeholderSvg(word) {
  const hue = hueOf(word.id);
  const initial = word.name.charAt(0);
  // Длинное слово должно влезать: уменьшаем кегль, а не обрезаем текст
  const fontSize = word.name.length > 9 ? 46 : word.name.length > 7 ? 56 : 68;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 62% 74%)"/>
      <stop offset="1" stop-color="hsl(${hue} 55% 56%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="36" fill="url(#g)"/>
  <circle cx="256" cy="212" r="130" fill="#ffffff" opacity="0.86"/>
  <text x="256" y="212" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-size="170" font-weight="700"
        fill="hsl(${hue} 70% 34%)">${escapeXml(initial)}</text>
  <text x="256" y="412" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="700"
        fill="#ffffff">${escapeXml(word.name)}</text>
  <text x="256" y="470" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, sans-serif" font-size="26" fill="#ffffff" opacity="0.72">заглушка</text>
</svg>
`;
}

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (ch) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[ch]);
}

const catalogue = buildCatalogue();

const library = {
  schemaVersion: SCHEMA_VERSION,
  audioScheme: { recorded: false },
  letters: catalogue.letters,
  syllables: catalogue.syllables,
  words: catalogue.words,
  sets: catalogue.sets,
};

fs.rmSync(imgDir, { recursive: true, force: true });
fs.mkdirSync(imgDir, { recursive: true });

for (const word of catalogue.words) {
  fs.writeFileSync(path.join(imgDir, `${word.id}.svg`), placeholderSvg(word), 'utf8');
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
console.log(`иллюстраций: ${catalogue.words.length}, ${(bytes / 1024).toFixed(1)} КБ`);
console.log('озвучка: не записана (audioScheme.recorded = false)');
