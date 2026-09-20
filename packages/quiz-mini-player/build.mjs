// packages/quiz-mini-player/build.mjs
//
// Собирает ЕДИНЫЙ player.html: стиль, библиотека чтения Excel и оба скрипта
// вшиты внутрь. Один файл — потому что его носят на флешке и открывают двойным
// щелчком; папка с ресурсами рядом потерялась бы при первом же копировании.
//
// CSP С ХЭШАМИ. Скрипты встроенные, поэтому вместо 'unsafe-inline' политика
// перечисляет sha256 каждого блока: выполнится только то, что вшито здесь.
// connect-src 'none' — файл викторины физически некуда отправить.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { inlineSafe } = createRequire(import.meta.url)('./tools/inlineSafe.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(HERE, ...parts), 'utf8');
const sha256 = (text) => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;

const xlsx = inlineSafe(read('node_modules', 'xlsx', 'dist', 'xlsx.mini.min.js'));
const core = inlineSafe(read('src', 'quizCore.js'));
const app = inlineSafe(read('src', 'app.js'));
const style = read('src', 'player.css');
// noscript-абзац в шаблоне имеет атрибут style — он статичен и тоже под хэшем
const NOSCRIPT_STYLE = 'padding:2rem';

const csp = [
  "default-src 'none'",
  `script-src ${[xlsx, core, app].map(sha256).join(' ')}`,
  `style-src ${sha256(style)} 'unsafe-hashes' ${sha256(NOSCRIPT_STYLE)}`,
  "img-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

// Замена функцией: в коде библиотеки встречается «$&», который строковая
// замена приняла бы за подстановку
const html = read('src', 'template.html')
  .replace('__CSP__', () => csp)
  .replace('__STYLE__', () => style)
  .replace('__XLSX__', () => xlsx)
  .replace('__CORE__', () => core)
  .replace('__APP__', () => app);

for (const marker of ['__CSP__', '__STYLE__', '__XLSX__', '__CORE__', '__APP__']) {
  if (html.includes(marker) && !xlsx.includes(marker)) throw new Error(`в шаблоне остался маркер ${marker}`);
}

// Не dist/: тот каталог в .gitignore, а готовый файл — часть поставки и лежит в git
const outDir = path.join(HERE, 'release');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'player.html'), html, 'utf8');
console.log(`player.html: ${(Buffer.byteLength(html) / 1024).toFixed(0)} КБ`);
