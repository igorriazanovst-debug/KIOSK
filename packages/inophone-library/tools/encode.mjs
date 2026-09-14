// packages/inophone-library/tools/encode.mjs
// WAV из синтезаторов → mp3 пакета.
//
// ГРОМКОСТЬ ВЫРАВНИВАЕТСЯ (loudnorm). Два синтезатора звучат с разной
// громкостью, и без выравнивания ученик, слушая слово по-русски и следом
// по-французски, крутит громкость между языками. Это ровно та же обработка, что
// у Типов 2 и 3 — «Инофон» не имеет права звучать иначе соседних пособий.
//
// ТИШИНА ПО КРАЯМ СРЕЗАЕТСЯ. SAPI оставляет до полусекунды в начале; на
// карточке словаря, где слово слушают подряд на трёх языках, эти паузы
// складываются в ощущение, что программа подвисает.
//
// ПУСТОЙ ИЛИ СЛИШКОМ КОРОТКИЙ РЕЗУЛЬТАТ — ОШИБКА, А НЕ ФАЙЛ. Молчащий mp3
// выглядит в пакете как готовая озвучка: проверка комплектности его засчитает,
// приложение покажет кнопку звука, и тишина обнаружится на занятии.
//
// Запуск: node tools/encode.mjs <каталог wav> <путь к ffmpeg>

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(ROOT, 'assets');

const wavRoot = process.argv[2];
const ff = process.argv[3] || 'ffmpeg';

if (!wavRoot || !fs.existsSync(wavRoot)) {
  console.error('Запуск: node tools/encode.mjs <каталог wav> [путь к ffmpeg]');
  process.exit(1);
}

/** Меньше этого размера mp3 не бывает даже у самого короткого слова */
const MIN_MP3_BYTES = 900;

let made = 0;
let skipped = 0;
const failed = [];

for (const code of fs.readdirSync(wavRoot)) {
  const srcDir = path.join(wavRoot, code);
  if (!fs.statSync(srcDir).isDirectory()) continue;
  const dstDir = path.join(ASSETS, 'audio', code);
  fs.mkdirSync(dstDir, { recursive: true });

  for (const name of fs.readdirSync(srcDir)) {
    if (!name.endsWith('.wav')) continue;
    const src = path.join(srcDir, name);
    const dst = path.join(dstDir, name.replace(/\.wav$/, '.mp3'));
    if (fs.existsSync(dst)) {
      skipped += 1;
      continue;
    }

    try {
      execFileSync(
        ff,
        [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', src,
          // Порядок фильтров значим: сначала срезаем тишину, потом выравниваем
          // громкость — иначе loudnorm считает уровень вместе с паузами
          '-af', 'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11',
          '-ar', '44100', '-ac', '1', '-b:a', '96k',
          dst,
        ],
        { stdio: 'pipe' }
      );
    } catch (err) {
      failed.push(`${code}/${name}: ffmpeg — ${String(err.message).slice(0, 120)}`);
      continue;
    }

    if (!fs.existsSync(dst) || fs.statSync(dst).size < MIN_MP3_BYTES) {
      failed.push(`${code}/${name}: результат пустой или слишком короткий`);
      if (fs.existsSync(dst)) fs.unlinkSync(dst);
      continue;
    }
    made += 1;
    if (made % 200 === 0) console.log(`  закодировано ${made}`);
  }
}

console.log(`mp3: сделано ${made}, пропущено (уже было) ${skipped}, не вышло ${failed.length}`);
for (const f of failed.slice(0, 20)) console.log('  ' + f);
if (failed.length > 20) console.log(`  …и ещё ${failed.length - 20}`);
if (failed.length > 0) process.exitCode = 1;
