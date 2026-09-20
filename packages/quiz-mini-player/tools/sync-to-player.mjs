// packages/quiz-mini-player/tools/sync-to-player.mjs
//
// Кладёт готовую поставку (проигрыватель, оба банка, библиотеку и её лицензию)
// рядом с кодом экспорта в приложении: packages/player/electron/physastroiq/standalone.
// Запускать после build.mjs и build-bank.mjs. Расхождение копий с источником
// ловит тест standaloneExport.test.js — забытый запуск не пройдёт незамеченным.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, '..', 'player', 'electron', 'physastroiq', 'standalone');
const FILES = [
  [path.join(ROOT, 'release', 'player.html'), 'player.html'],
  [path.join(ROOT, 'release', 'physastroiq-astronomy-390.xlsx'), 'physastroiq-astronomy-390.xlsx'],
  [path.join(ROOT, 'release', 'physastroiq-physics-90.xlsx'), 'physastroiq-physics-90.xlsx'],
  [path.join(ROOT, 'node_modules', 'xlsx', 'dist', 'xlsx.mini.min.js'), 'xlsx.mini.min.js'],
  [path.join(ROOT, 'node_modules', 'xlsx', 'LICENSE'), 'LICENSE-xlsx.txt'],
];
fs.mkdirSync(TARGET, { recursive: true });
for (const [from, name] of FILES) {
  fs.copyFileSync(from, path.join(TARGET, name));
  console.log(`${name}: ${(fs.statSync(from).size / 1024).toFixed(0)} КБ`);
}
