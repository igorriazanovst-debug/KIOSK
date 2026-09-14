// packages/inophone-library/tools/generate-espeak.mjs
// Озвучка французского, немецкого, китайского и башкирского через eSpeak NG.
//
// ПОЧЕМУ НЕ SAPI: на машине сборки установлены только русский и английский
// голоса (проверено — SAPI отдаёт Irina и Zira, WinRT только русские). Решение
// пользователя от 14.09.2026: поставить eSpeak и закрыть шесть языков целиком,
// а не отдавать пакет с четырьмя немыми языками.
//
// ТЕКСТ ПЕРЕДАЁТСЯ ФАЙЛОМ В UTF-8, А НЕ АРГУМЕНТОМ КОМАНДНОЙ СТРОКИ. Это не
// стилистика: через аргумент кириллица доезжает до eSpeak искажённой, он читает
// башкирское «мендәр» по буквам как набор латинских диакритик — 3,6 секунды
// вместо 1,0. Поймано измерением длительности, а не на слух.
//
// ESPEAK_DATA_PATH ЗАДАЁТСЯ ЯВНО: eSpeak распакован из MSI, а не установлен, и
// сам свой каталог данных не находит.
//
// Запуск: node tools/generate-espeak.mjs <каталог espeak> <каталог wav>

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildPlan, ESPEAK_SPEED } from './narration-plan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const espeakDir = process.argv[2];
const outRoot = process.argv[3];

if (!espeakDir || !outRoot) {
  console.error('Запуск: node tools/generate-espeak.mjs <каталог espeak> <каталог wav>');
  process.exit(1);
}

const exe = path.join(espeakDir, 'espeak-ng.exe');
if (!fs.existsSync(exe)) {
  console.error(`Нет eSpeak NG: ${exe}`);
  process.exit(1);
}

const env = { ...process.env, ESPEAK_DATA_PATH: espeakDir };
const textFile = path.join(os.tmpdir(), `inophone-say-${process.pid}.txt`);

const plan = buildPlan().filter((it) => it.engine === 'espeak');
let made = 0;
let skipped = 0;
const failed = [];

for (const it of plan) {
  const dir = path.join(outRoot, it.code);
  fs.mkdirSync(dir, { recursive: true });
  const wav = path.join(dir, `${it.id}.wav`);
  if (fs.existsSync(wav)) {
    skipped += 1;
    continue;
  }

  fs.writeFileSync(textFile, it.text, 'utf8');
  try {
    execFileSync(exe, ['-v', it.code, '-s', String(ESPEAK_SPEED), '-w', wav, '-f', textFile], {
      env,
      stdio: 'pipe',
    });
  } catch (err) {
    failed.push(`${it.code}/${it.id}: ${err.message}`);
    continue;
  }

  // Пустой файл — это НЕ успех. eSpeak возвращает нулевой код и на тексте,
  // который не смог прочитать; без этой проверки в пакет попадает тишина, и
  // узнаётся об этом на занятии
  if (!fs.existsSync(wav) || fs.statSync(wav).size < 1000) {
    failed.push(`${it.code}/${it.id}: файл пустой («${it.text}»)`);
    if (fs.existsSync(wav)) fs.unlinkSync(wav);
    continue;
  }
  made += 1;
  if (made % 200 === 0) console.log(`  озвучено ${made}`);
}

try {
  fs.unlinkSync(textFile);
} catch {
  /* временный файл мог не создаться — это не повод падать в конце работы */
}

console.log(`eSpeak: сделано ${made}, пропущено (уже было) ${skipped}, не вышло ${failed.length}`);
for (const f of failed.slice(0, 20)) console.log('  ' + f);
if (failed.length > 20) console.log(`  …и ещё ${failed.length - 20}`);
