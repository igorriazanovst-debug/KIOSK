// packages/chrono-ui/scripts/copy-css.mjs
// tsc не копирует не-TS файлы — .css из src нужно скопировать в dist рядом
// с скомпилированным .js, иначе относительные импорты вида
// import './BoardView.css' в dist/board/BoardView.js ничего не найдут.

import { readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

function copyCssFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const srcPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      copyCssFiles(srcPath);
      continue;
    }
    if (!entry.name.endsWith('.css')) continue;
    const relative = srcPath.slice(srcDir.length + 1);
    const destPath = join(distDir, relative);
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
  }
}

copyCssFiles(srcDir);
