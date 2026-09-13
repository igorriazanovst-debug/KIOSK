// packages/alphabet-library/tools/plan-narration.mjs
// Готовит список заданий на озвучку: какой файл и с каким текстом.
//
// ПУТИ СПРАШИВАЮТСЯ У ДОМЕНА (@kiosk/shared, alphabet/model/resources), а не
// собираются здесь строками. Иначе генератор и проверка комплектности
// разойдутся в путях — и файлы будут лежать на диске, а игра молча не будет
// их находить: отсутствующий файл очередь воспроизведения не роняет.
// В Тип 2 ровно это один раз и случилось (нумерация вариантов с нуля против
// единицы), и поймала именно проверка комплектности.
//
// ЧЕТЫРЕ РОДА ЗАПИСЕЙ:
//   media/<номер>.mp3       буква: произносится ЗВУК, а не название буквы
//   media/<слог>.mp3        слог
//   media/<id>.mp3          слово целиком
//   media/<id>_bgn.mp3      слово без последнего слога
//
// ПРО БУКВЫ. Ребёнку, который учится читать, говорят «м», а не «эм»: иначе
// «М-А-М-А» складывается в «эм-а-эм-а». Поэтому текст для буквы — сама буква,
// и SAPI произносит её как звук. Для гласных разницы нет, для согласных она
// принципиальна.
//
// ПРО «БЕЗ ПОСЛЕДНЕГО СЛОГА». Это НЕ склейка слоговых записей: диктор
// произносит начало слова со связной интонацией. Здесь синтезатору
// скармливается текст начала слова целиком — «авто-бу», — а не по слогам,
// чтобы интонация не рассыпалась на перечисление.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { alphabet } = require('../../shared/dist/index.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outFile = outFlag >= 0 ? args[outFlag + 1] : path.join(here, 'narration-plan.json');

const library = alphabet.parseAlphabetLibrary(
  JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'))
);

/** Слово без последнего слога — текстом, а не по слогам */
function withoutLastSyllable(word) {
  const names = word.syllableIds.map(
    (id) => library.syllables.find((s) => s.id === id)?.name ?? ''
  );
  return names.slice(0, -1).join('');
}

const plan = [];
const seen = new Set();
const add = (filePath, text) => {
  if (seen.has(filePath)) return;
  seen.add(filePath);
  plan.push({ path: filePath, text });
};

for (const letter of library.letters) {
  // Звук буквы, а не её название: «м», не «эм»
  add(alphabet.letterAudioPath(letter.number), letter.name.toLowerCase());
}

for (const syllable of library.syllables) {
  add(alphabet.syllableAudioPath(syllable.id), syllable.name);
}

for (const word of library.words) {
  add(alphabet.wordAudioPath(word.id), word.name);
  if (word.hasWithoutLastSyllable) {
    add(alphabet.wordWithoutLastSyllableAudioPath(word.id), withoutLastSyllable(word));
  }
}

// Сверка с тем, что потребует проверка комплектности, если объявить озвучку
// записанной. Расхождение здесь означает, что генератор сделает не тот набор
// файлов, который потом будут искать
const expected = alphabet
  .expectedLibraryFiles({ ...library, audioScheme: { recorded: true } })
  .filter((f) => f.endsWith('.mp3'));
const planned = new Set(plan.map((p) => p.path));
const missing = expected.filter((f) => !planned.has(f));
const extra = [...planned].filter((f) => !expected.includes(f));

fs.writeFileSync(outFile, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

console.log(`заданий: ${plan.length}`);
console.log(`  букв: ${library.letters.length}`);
console.log(`  слогов: ${library.syllables.length}`);
console.log(`  слов целиком: ${library.words.length}`);
console.log(`  слов без последнего слога: ${library.words.filter((w) => w.hasWithoutLastSyllable).length}`);
console.log(`сверка с проверкой комплектности: не хватает ${missing.length}, лишних ${extra.length}`);
if (missing.length) console.log('  НЕ ХВАТАЕТ:', missing.slice(0, 5).join(', '));
if (extra.length) console.log('  ЛИШНИЕ:', extra.slice(0, 5).join(', '));
console.log(`план записан: ${outFile}`);

if (missing.length || extra.length) process.exitCode = 1;
