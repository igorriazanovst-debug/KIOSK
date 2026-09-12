// packages/words-library/tools/plan-narration.mjs
//
// Готовит план генерации озвучки: список { path, text } для generate-narration.ps1.
//
// Зачем отдельный шаг на Node, а не часть .ps1 — две причины:
//
// 1. Пути к файлам озвучки знает ровно один модуль — resources.ts в
//    @kiosk/shared, он же потом проверяет комплектность пакета. Если бы пути
//    складывал PowerShell своей строковой склейкой, скрипт и проверка со
//    временем разошлись бы, и озвучка просто не находилась бы в игре — молча,
//    потому что отсутствующий файл очередь воспроизведения не роняет.
// 2. Тот же мотив, по которому у «Матемашки» идентификаторы озвучки
//    проставляет Node, а не PowerShell: ConvertTo-Json переформатирует JSON
//    целиком и даёт огромный неинформативный diff.
//
// Требует собранный @kiosk/shared (packages/shared: npm run build).
//
// Запуск:
//   node tools/plan-narration.mjs --voices irina --phrases 2 --neutral --out plan.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const sharedPath = path.resolve(packageRoot, '../shared/dist/index.js');
if (!fs.existsSync(sharedPath)) {
  console.error(`Не найден собранный @kiosk/shared: ${sharedPath}\nСоберите: cd packages/shared && npm run build`);
  process.exit(1);
}
const shared = require(sharedPath);
const {
  wordNeutralAudioPath,
  wordPhraseAudioPath,
  themeIntroAudioPath,
  themeFinalAudioPath,
  parseWordsLibrary,
} = shared;

// ─── аргументы ──────────────────────────────────────────────────────────

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const voices = String(arg('voices', '')).split(',').map((v) => v.trim()).filter(Boolean);
const phrasesPerVoice = Number(arg('phrases', 0));
const neutral = arg('neutral', false) !== false;
const outFile = path.resolve(String(arg('out', 'narration-plan.json')));

if (!neutral && (voices.length === 0 || phrasesPerVoice === 0)) {
  console.error('Схема без озвучки: нечего генерировать. Укажите --neutral и/или --voices с --phrases');
  process.exit(1);
}

// ─── тексты ─────────────────────────────────────────────────────────────
//
// Фразы намеренно построены так, чтобы слово стояло в ИМЕНИТЕЛЬНОМ падеже:
// в манифесте оно только в нём и есть, а синтезатор склонять не умеет.
// «Найди стол» потребовало бы винительного и на части слов дало бы
// неграмотную речь — «Где стол?» и «Покажи, где стол» работают с любым
// словом без изменения формы.

const PHRASE_TEMPLATES = [
  (name) => `Где ${name.toLowerCase()}?`,
  (name) => `Покажи, где ${name.toLowerCase()}.`,
  (name) => `Найди картинку: ${name.toLowerCase()}.`,
];

if (phrasesPerVoice > PHRASE_TEMPLATES.length) {
  console.error(`Шаблонов фраз всего ${PHRASE_TEMPLATES.length}, запрошено ${phrasesPerVoice}`);
  process.exit(1);
}

const themeIntroText = (title) => `Тема: ${title}. Послушай и найди нужную картинку.`;
const themeFinalText = (title) => `Молодец! Тема «${title}» пройдена.`;

// ─── план ───────────────────────────────────────────────────────────────

const library = parseWordsLibrary(
  JSON.parse(fs.readFileSync(path.join(packageRoot, 'index.json'), 'utf8'))
);

const plan = [];

for (const theme of library.themes) {
  for (const voice of voices) {
    plan.push({ path: themeIntroAudioPath(theme.id, voice), text: themeIntroText(theme.title) });
  }
  // Финальная сцена требуется проверкой комплектности, как только у схемы
  // появляется озвучка в любом виде — см. schemeHasAudio в resources.ts
  plan.push({ path: themeFinalAudioPath(theme.id), text: themeFinalText(theme.title) });
}

for (const word of library.words) {
  if (neutral) {
    plan.push({ path: wordNeutralAudioPath(word.id), text: word.name });
  }
  for (const voice of voices) {
    // Нумерация вариантов — С НУЛЯ, ровно как в wordAudioPaths (resources.ts).
    // Считать с единицы «потому что так естественнее» нельзя: проверка
    // комплектности спросит 0.mp3, на диске будет 1.mp3 и 2.mp3, и озвучка
    // молча не найдётся. Один раз так и вышло — поймала проверка.
    for (let n = 0; n < phrasesPerVoice; n += 1) {
      plan.push({
        path: wordPhraseAudioPath(word.id, voice, n),
        text: PHRASE_TEMPLATES[n](word.name),
      });
    }
  }
}

fs.writeFileSync(outFile, JSON.stringify(plan, null, 2), 'utf8');

console.log(`Схема: neutral=${neutral}, голоса=[${voices.join(', ')}], фраз на голос=${phrasesPerVoice}`);
console.log(`Слов: ${library.words.length}, тем: ${library.themes.length}`);
console.log(`Заданий на генерацию: ${plan.length}`);
console.log(`План записан: ${outFile}`);
