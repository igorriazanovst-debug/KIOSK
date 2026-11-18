// Разрешение путей схемы kioskres:// — платформенно-независимый доступ к
// поставочным (read-only) ресурсам вшитого контента: медиа музея и т.п.
// URL: kioskres://<имя-файла> → <resourcesPath>/museum-media/<имя-файла>.
// Работает одинаково на Linux (/opt/<продукт>/resources) и Windows
// (<каталог установки>\resources) — контент больше не зависит от ОС.
//
// Модуль без electron: логика проверяется node:test.

const path = require('node:path');

// Никакого обхода каталогов: итог обязан остаться внутри root.
// URL парсится строково: new URL() для кастомных схем кладёт имя файла
// в hostname (с lowercase) и ломает регистр имён вида m001.JPG.
function resolveKioskresPath(url, root) {
  if (!root) return null;
  const m = /^kioskres:\/\/(.+)$/.exec(String(url));
  if (!m) return null;
  let rel;
  try {
    rel = decodeURIComponent(m[1].replace(/^\/+/, ''));
  } catch {
    return null;
  }
  if (!rel || rel.includes('\0')) return null;
  const abs = path.normalize(path.join(root, rel));
  const base = path.normalize(root) + path.sep;
  if (abs !== path.normalize(root) && !abs.startsWith(base)) return null;
  return abs;
}

function guessMime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

module.exports = { resolveKioskresPath, guessMime };
